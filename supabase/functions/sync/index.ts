// Pulls Codeforces data for a student and records what changed in her activity timeline.
// Called by the app ("Sync now", for the student or a linked parent) and every few hours by pg_cron with {"all": true}.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { diffEvents, fetchCodeforces, type CfData } from "../_shared/cfsync.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function syncOne(admin: SupabaseClient, sid: string) {
  const { data: p } = await admin.from("profiles").select("cf_handle").eq("id", sid).single();
  if (!p?.cf_handle) throw new Error("No Codeforces handle set.");
  const { data: sec } = await admin.from("cf_secrets").select("api_key, api_secret").eq("student_id", sid).maybeSingle();
  const { data: cache } = await admin.from("cf_cache").select("data").eq("student_id", sid).maybeSingle();
  const next = await fetchCodeforces(p.cf_handle, { key: sec?.api_key, secret: sec?.api_secret });
  const up = await admin.from("cf_cache").upsert({ student_id: sid, data: next, synced_at: new Date().toISOString() });
  if (up.error) throw new Error(up.error.message);
  const events = diffEvents((cache?.data as CfData) ?? null, next);
  if (events.length) await admin.from("activity").insert(events.map(ev => ({ student_id: sid, kind: ev.kind, payload: ev })));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  let targets: string[];

  if (body.all) {
    // scheduled run: pg_cron sends the secret kept in Supabase Vault (see migrations/…_schedule.sql)
    const { data: ok } = await admin.rpc("cron_secret_ok", { s: req.headers.get("x-cron-secret") ?? "" });
    if (ok !== true) return json({ error: "forbidden" }, 403);
    const { data } = await admin.from("profiles").select("id").eq("role", "student").not("cf_handle", "is", null);
    targets = (data ?? []).map(p => p.id);
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Not signed in." }, 401);
    const sid: string = body.student_id ?? user.id;
    if (sid !== user.id) {
      const { data: link } = await admin.from("links").select("student_id").eq("parent_id", user.id).eq("student_id", sid).maybeSingle();
      if (!link) return json({ error: "Not allowed." }, 403);
    }
    targets = [sid];
  }

  const results = [];
  for (const sid of targets) {
    try { await syncOne(admin, sid); results.push({ sid, ok: true }) }
    catch (e) { results.push({ sid, ok: false, error: (e as Error).message }) }
  }
  const failed = results.find(r => !r.ok);
  return failed && !body.all ? json({ error: failed.error }, 500) : json({ results });
});
