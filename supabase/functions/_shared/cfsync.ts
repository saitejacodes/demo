// Codeforces sync, shared by the web app (local mode) and the `sync` edge function (Deno).
// No imports on purpose: it must run unchanged in both runtimes.

export interface Sub { c: number; i: string; n: string; r?: number; v: string; t: number; p: string; g?: string }
export interface CfData {
  info: { rating: number; maxRating: number; rank: string; avatar?: string };
  rating: { t: number; r: number; n: string }[];
  subs: Sub[];
  at: number;
  groupErr: string | null;
  groupAt: number | null;
}
export interface SyncEvent { kind: "solved" | "failed" | "rating"; keys?: string[]; from?: number; to?: number }

// Assiut group sheets (Newcomers + Juniors Phase 1). Kept here so the server doesn't need the roadmap.
export const SHEET_REFS: { group: string; cid: number }[] = [
  ...[219158, 219432, 219774, 219856, 223205, 223338, 223339, 223206, 223207, 223340].map(cid => ({ group: "MWSDmqGsZm", cid })),
  ...[262795, 263096, 263722, 264941, 267312].map(cid => ({ group: "c3FDl9EUi9", cid })),
];

const API = "https://codeforces.com/api/";
const GAP = 2100; // Codeforces allows roughly one call every 2 seconds
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function call<T>(method: string): Promise<T> {
  const res = await fetch(API + method);
  const j = await res.json();
  if (j.status !== "OK") throw new Error(j.comment || "Codeforces error");
  return j.result as T;
}

async function sha512hex(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Signed request, see https://codeforces.com/apiHelp → Authorization. Needed for private group contests.
async function signed<T>(method: string, params: Record<string, string | number | boolean>, key: string, secret: string): Promise<T> {
  const p: Record<string, string | number | boolean> = { ...params, apiKey: key, time: Math.floor(Date.now() / 1000) };
  const qs = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join("&");
  const rand = String(100000 + Math.floor(Math.random() * 900000));
  return call<T>(`${method}?${qs}&apiSig=${rand}${await sha512hex(`${rand}/${method}?${qs}#${secret}`)}`);
}

export function explainGroupErr(m: string): string {
  if (/not found/i.test(m)) return "This key's account can't see the Assiut groups. Create the key on her account and make sure she has joined both groups.";
  if (/apiSig|apiKey|signature|Incorrect/i.test(m)) return "API key or secret is wrong. Copy both again from codeforces.com/settings/api.";
  if (/time/i.test(m)) return "The device clock is off by more than 5 minutes.";
  return m;
}

// deno-lint-ignore no-explicit-any
const slim = (s: any): Sub => ({ c: s.problem.contestId, i: s.problem.index, n: s.problem.name, r: s.problem.rating, v: s.verdict, t: s.creationTimeSeconds, p: s.author.participantType });

export async function fetchCodeforces(
  handle: string,
  opts: { key?: string; secret?: string; onProgress?: (msg: string) => void } = {},
): Promise<CfData> {
  const h = encodeURIComponent(handle);
  // deno-lint-ignore no-explicit-any
  const info = (await call<any[]>(`user.info?handles=${h}`))[0]; await sleep(GAP);
  // deno-lint-ignore no-explicit-any
  const rating = await call<any[]>(`user.rating?handle=${h}`); await sleep(GAP);
  // deno-lint-ignore no-explicit-any
  const subs = (await call<any[]>(`user.status?handle=${h}&from=1&count=10000`)).map(slim);
  let groupErr: string | null = null, groupAt: number | null = null;
  if (opts.key && opts.secret) {
    // check the key first: group contests answer "not found" before they check the key
    try { await sleep(GAP); await signed("user.friends", { onlyOnline: false }, opts.key, opts.secret) } catch (e) { groupErr = explainGroupErr((e as Error).message) }
    for (let k = 0; k < SHEET_REFS.length && !groupErr; k++) {
      opts.onProgress?.(`Reading Assiut sheets ${k + 1}/${SHEET_REFS.length}…`);
      await sleep(GAP);
      try {
        // deno-lint-ignore no-explicit-any
        const gs = await signed<any[]>("contest.status", { contestId: SHEET_REFS[k].cid, handle, from: 1, count: 1000 }, opts.key, opts.secret);
        subs.push(...gs.map(x => ({ ...slim(x), g: SHEET_REFS[k].group })));
      } catch (e) { groupErr = explainGroupErr((e as Error).message) }
    }
    if (!groupErr) groupAt = Date.now();
  }
  return {
    info: { rating: info.rating || 0, maxRating: info.maxRating || 0, rank: info.rank || "unrated", avatar: info.titlePhoto },
    // deno-lint-ignore no-explicit-any
    rating: rating.map((x: any) => ({ t: x.ratingUpdateTimeSeconds, r: x.newRating, n: x.contestName })),
    subs, at: Date.now(), groupErr, groupAt,
  };
}

const solvedSet = (d: CfData | null) => new Set((d?.subs || []).filter(s => s.v === "OK").map(s => `${s.c}${s.i}`));
const failedSet = (d: CfData | null) => {
  const ok = solvedSet(d);
  return new Set((d?.subs || []).filter(s => s.v && s.v !== "OK" && s.v !== "TESTING" && s.v !== "COMPILATION_ERROR").map(s => `${s.c}${s.i}`).filter(k => !ok.has(k)));
};

// What changed between two syncs, for the activity timeline. Nothing is reported on the very first sync.
export function diffEvents(prev: CfData | null, next: CfData): SyncEvent[] {
  if (!prev) return [];
  const ps = solvedSet(prev), pf = failedSet(prev), out: SyncEvent[] = [];
  const solved = [...solvedSet(next)].filter(k => !ps.has(k));
  const failed = [...failedSet(next)].filter(k => !pf.has(k));
  if (solved.length) out.push({ kind: "solved", keys: solved });
  if (failed.length) out.push({ kind: "failed", keys: failed });
  if (next.info.rating !== prev.info.rating) out.push({ kind: "rating", from: prev.info.rating, to: next.info.rating });
  return out;
}
