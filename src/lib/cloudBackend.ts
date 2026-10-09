// Cloud backend on Supabase: auth, Postgres (with row-level security), Storage for proof screenshots,
// and the `sync` edge function that pulls Codeforces data server-side. Schema: supabase/migrations.
import { createClient } from "@supabase/supabase-js";
import type { Activity, ActivityKind, Backend, Profile, StudentData } from "./backend";
import { diffEvents, fetchCodeforces, type CfData } from "../../supabase/functions/_shared/cfsync.ts";

export function createCloudBackend(url: string, anonKey: string): Backend {
  const sb = createClient(url, anonKey);
  const must = <T,>(r: { data: T; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data };
  const me = async () => { const { data } = await sb.auth.getSession(); if (!data.session) throw new Error("Not signed in"); return data.session.user.id };
  const log = async (kind: ActivityKind, payload: Record<string, unknown>) => {
    must(await sb.from("activity").insert({ student_id: await me(), kind, payload }));
  };

  return {
    mode: "cloud",
    async currentUserId() { const { data } = await sb.auth.getSession(); return data.session?.user.id ?? null },
    onAuthChange(cb) { const { data } = sb.auth.onAuthStateChange(() => cb()); return () => data.subscription.unsubscribe() },

    async signUp(email, password, name, role) {
      const r = await sb.auth.signUp({ email, password, options: { data: { name, role }, emailRedirectTo: location.origin } });
      if (r.error) throw new Error(r.error.message);
      return { needsConfirm: !r.data.session };
    },
    async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw new Error(r.error.message) },
    async signOut() { await sb.auth.signOut() },

    async myProfile() { return must(await sb.from("profiles").select("*").eq("id", await me()).single()) as Profile },
    async updateProfile(patch) { must(await sb.from("profiles").update(patch).eq("id", await me())) },
    async linkStudent(code) { must(await sb.rpc("link_student", { code })) },
    async myStudents() {
      const links = must(await sb.from("links").select("student_id").eq("parent_id", await me())) as { student_id: string }[];
      if (!links.length) return [];
      return must(await sb.from("profiles").select("*").in("id", links.map(l => l.student_id))) as Profile[];
    },

    async load(sid): Promise<StudentData> {
      const [profile, manual, refl, proofs, activity, cache, secret] = await Promise.all([
        sb.from("profiles").select("*").eq("id", sid).single(),
        sb.from("manual_done").select("item_id,done_at").eq("student_id", sid),
        sb.from("reflections").select("item_id,answers").eq("student_id", sid),
        sb.from("proofs").select("id,item_id,path,created_at").eq("student_id", sid).order("created_at", { ascending: false }),
        sb.from("activity").select("id,kind,payload,created_at").eq("student_id", sid).order("created_at", { ascending: false }).limit(300),
        sb.from("cf_cache").select("data").eq("student_id", sid).maybeSingle(),
        sb.rpc("has_cf_secret", { sid }),
      ]);
      const pr = must(proofs) as { id: string; item_id: string; path: string; created_at: string }[];
      const signed = pr.length ? must(await sb.storage.from("proofs").createSignedUrls(pr.map(p => p.path), 60 * 60)) : [];
      return {
        profile: must(profile) as Profile,
        manual: Object.fromEntries((must(manual) as { item_id: string; done_at: string }[]).map(m => [m.item_id, m.done_at])),
        reflections: Object.fromEntries((must(refl) as { item_id: string; answers: Record<string, string> }[]).map(r => [r.item_id, r.answers])),
        proofs: pr.map((p, k) => ({ id: p.id, item_id: p.item_id, created_at: p.created_at, url: signed?.[k]?.signedUrl || "" })),
        activity: must(activity) as Activity[],
        cf: ((must(cache) as { data: CfData } | null)?.data) ?? null,
        hasSecret: !!must(secret),
      };
    },
    async setManual(itemId, done) {
      const sid = await me();
      if (done) { must(await sb.from("manual_done").upsert({ student_id: sid, item_id: itemId })); await log("milestone", { item: itemId }) }
      else must(await sb.from("manual_done").delete().eq("student_id", sid).eq("item_id", itemId));
    },
    async saveReflection(itemId, answers) {
      const sid = await me();
      must(await sb.from("reflections").upsert({ student_id: sid, item_id: itemId, answers, updated_at: new Date().toISOString() }));
      await log("reflection", { item: itemId, stuck: answers.stuck || "", next: answers.next || "" });
    },
    async uploadProof(itemId, image) {
      const sid = await me();
      const path = `${sid}/${Date.now()}-${itemId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
      must(await sb.storage.from("proofs").upload(path, image, { contentType: "image/jpeg" }));
      must(await sb.from("proofs").insert({ student_id: sid, item_id: itemId, path }));
      must(await sb.from("manual_done").upsert({ student_id: sid, item_id: itemId }));
      await log("proof", { item: itemId });
    },
    log,
    async setSecret(key, secret) { must(await sb.rpc("set_cf_secret", { key, secret })) },
    async clearSecret() { must(await sb.rpc("clear_cf_secret")) },

    // Prefer the server: it holds the API secret and also runs on a schedule. If the function isn't
    // deployed yet, fall back to a public-data sync from the browser (no Assiut sheets).
    async sync(sid, onProgress) {
      onProgress?.("Syncing with Codeforces…");
      const r = await sb.functions.invoke("sync", { body: { student_id: sid } });
      if (!r.error) return;
      if (sid !== await me()) throw new Error("Server sync is not deployed yet. Ask her to open the site and sync.");
      const profile = must(await sb.from("profiles").select("cf_handle").eq("id", sid).single()) as { cf_handle: string | null };
      if (!profile.cf_handle) throw new Error("No Codeforces handle set.");
      const prev = (must(await sb.from("cf_cache").select("data").eq("student_id", sid).maybeSingle()) as { data: CfData } | null)?.data ?? null;
      const next = await fetchCodeforces(profile.cf_handle, { onProgress });
      next.groupErr = "Assiut sheets sync needs the server function (see README).";
      must(await sb.from("cf_cache").upsert({ student_id: sid, data: next, synced_at: new Date().toISOString() }));
      for (const ev of diffEvents(prev, next)) await log(ev.kind, { ...ev });
    },
  };
}
