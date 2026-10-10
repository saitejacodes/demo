// Demo backend: everything lives in this browser's localStorage. Used when no Supabase keys are configured,
// so the whole app (both accounts, proofs, timeline) can be tried before any cloud setup.
import type { Activity, ActivityKind, Backend, Profile, Proof, Role, StudentData } from "./backend";
import { diffEvents, fetchCodeforces, type CfData } from "../../supabase/functions/_shared/cfsync.ts";

interface DB {
  users: { id: string; email: string; pw: string }[];
  profiles: Record<string, Profile>;
  links: { parent_id: string; student_id: string }[];
  manual: Record<string, Record<string, string>>;
  refl: Record<string, Record<string, Record<string, string>>>;
  proofs: Record<string, Proof[]>;
  activity: Record<string, Activity[]>;
  cf: Record<string, CfData>;
  secrets: Record<string, { key: string; secret: string }>;
  session: string | null;
}
const KEY = "rte-app:db";
const empty = (): DB => ({ users: [], profiles: {}, links: [], manual: {}, refl: {}, proofs: {}, activity: {}, cf: {}, secrets: {}, session: null });
function read(): DB { try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") } } catch { return empty() } }
function write(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) }
  catch { throw new Error("This browser's storage is full. Connect Supabase for cloud storage.") }
}
const uid = () => crypto.randomUUID();
const code = () => Math.random().toString(36).slice(2, 10).toUpperCase();
async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("rte:" + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const toDataURL = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b) });

export function createLocalBackend(): Backend {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(f => f());
  const me = () => { const id = read().session; if (!id) throw new Error("Not signed in"); return id };
  const addActivity = (db: DB, sid: string, kind: ActivityKind, payload: Record<string, unknown>) => {
    (db.activity[sid] ||= []).unshift({ id: uid(), kind, payload, created_at: new Date().toISOString() });
    db.activity[sid] = db.activity[sid].slice(0, 300);
  };

  return {
    mode: "local",
    async currentUserId() { return read().session },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },

    async signUp(email, password, name, role: Role) {
      const db = read(); email = email.trim().toLowerCase();
      if (db.users.some(u => u.email === email)) throw new Error("An account with this email already exists on this device.");
      const id = uid();
      db.users.push({ id, email, pw: await hash(password) });
      db.profiles[id] = { id, role, display_name: name, cf_handle: null, invite_code: role === "student" ? code() : null, unlocked_stage: 0 };
      if (role === "student") addActivity(db, id, "joined", {});
      db.session = id; write(db); notify();
      return { needsConfirm: false };
    },
    async signIn(email, password) {
      const db = read(); const u = db.users.find(x => x.email === email.trim().toLowerCase());
      if (!u || u.pw !== await hash(password)) throw new Error("Wrong email or password.");
      db.session = u.id; write(db); notify();
    },
    async signOut() { const db = read(); db.session = null; write(db); notify() },

    async myProfile() { return read().profiles[me()] },
    async updateProfile(patch) { const db = read(); Object.assign(db.profiles[me()], patch); write(db) },
    async linkStudent(c) {
      const db = read(), pid = me();
      if (db.profiles[pid].role !== "parent") throw new Error("Only parent accounts can link a student.");
      const s = Object.values(db.profiles).find(p => p.role === "student" && p.invite_code === c.trim().toUpperCase());
      if (!s) throw new Error("No student with that code.");
      if (!db.links.some(l => l.parent_id === pid && l.student_id === s.id)) db.links.push({ parent_id: pid, student_id: s.id });
      write(db);
    },
    async myStudents() { const db = read(), pid = me(); return db.links.filter(l => l.parent_id === pid).map(l => db.profiles[l.student_id]) },

    async load(sid): Promise<StudentData> {
      const db = read();
      return { profile: db.profiles[sid], manual: db.manual[sid] || {}, reflections: db.refl[sid] || {}, proofs: db.proofs[sid] || [],
        activity: db.activity[sid] || [], cf: db.cf[sid] || null, hasSecret: !!db.secrets[sid] };
    },
    async setManual(itemId, done) {
      const db = read(), sid = me(); const m = (db.manual[sid] ||= {});
      if (done) { m[itemId] = new Date().toISOString(); if (!itemId.startsWith("setup:")) addActivity(db, sid, "milestone", { item: itemId }) } else delete m[itemId];
      write(db);
    },
    async saveReflection(itemId, answers) {
      const db = read(), sid = me(); (db.refl[sid] ||= {})[itemId] = answers;
      addActivity(db, sid, "reflection", { item: itemId, stuck: answers.stuck || "", next: answers.next || "" }); write(db);
    },
    async uploadProof(itemId, image) {
      const db = read(), sid = me(), now = new Date().toISOString();
      (db.proofs[sid] ||= []).unshift({ id: uid(), item_id: itemId, url: await toDataURL(image), created_at: now });
      (db.manual[sid] ||= {})[itemId] = now;
      addActivity(db, sid, "proof", { item: itemId }); write(db);
    },
    async log(kind, payload) { const db = read(); addActivity(db, me(), kind, payload); write(db) },
    async setSecret(key, secret) { const db = read(); db.secrets[me()] = { key, secret }; write(db) },
    async clearSecret() { const db = read(); delete db.secrets[me()]; write(db) },

    async sync(sid, onProgress) {
      const db0 = read(), handle = db0.profiles[sid]?.cf_handle;
      if (!handle) throw new Error("No Codeforces handle set.");
      const next = await fetchCodeforces(handle, { ...db0.secrets[sid], onProgress });
      const db = read();
      for (const ev of diffEvents(db.cf[sid] || null, next)) addActivity(db, sid, ev.kind, { ...ev });
      db.cf[sid] = next; write(db);
    },
  };
}
