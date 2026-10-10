import type { CfData, Sub } from "../../supabase/functions/_shared/cfsync.ts";
import { STAGES, type CpProblem, type Item, type Stage } from "../data/roadmap";

export const UNLOCK_AT = 1;      // share of a stage's lessons needed to unlock the next stage (1 = all)
export const SHEET_DONE = 0.8;   // an Assiut sheet counts as done at 80% of its problems

export const RANKS: [number, string, string, string][] = [
  [0, "Newbie", "#8a8a8a", "#6b6b6b"], [1200, "Pupil", "#22a33a", "#17802b"], [1400, "Specialist", "#03a89e", "#027f78"],
  [1600, "Expert", "#2b5fdb", "#1f47a8"], [1900, "Candidate Master", "#aa00aa", "#800080"], [2100, "Master", "#ff8c00", "#cc7000"],
];
export const rankOf = (r: number) => { let x = RANKS[0]; for (const k of RANKS) if (r >= k[0]) x = k; return x };
export const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
export const probURL = (s: { c: number; i: string; g?: string }) =>
  s.g ? `https://codeforces.com/group/${s.g}/contest/${s.c}/problem/${s.i}` : `https://codeforces.com/contest/${s.c}/problem/${s.i}`;

export type Progress = ReturnType<typeof buildProgress>;

// Everything the UI needs, derived from her Codeforces submissions plus the manual ticks.
export function buildProgress(cf: CfData | null, manual: Record<string, string>, unlockAll = false) {
  const solved = new Set<string>(), tried = new Map<string, Sub>(), days = new Map<string, number>();
  const byContest: Record<number, { probs: Set<string>; ok: Set<string>; part: boolean }> = {};
  for (const s of cf?.subs || []) {
    const k = `${s.c}${s.i}`;
    if (s.v === "OK") { solved.add(k); const d = new Date(s.t * 1000).toDateString(); days.set(d, (days.get(d) || 0) + 1) }
    else if (s.v && s.v !== "TESTING" && s.v !== "COMPILATION_ERROR") tried.set(k, s);
    if (s.c) {
      const bc = (byContest[s.c] ||= { probs: new Set(), ok: new Set(), part: false });
      bc.probs.add(s.i); if (s.v === "OK") bc.ok.add(s.i);
      if (s.p === "VIRTUAL" || s.p === "CONTESTANT") bc.part = true;
    }
  }
  const cpSolved = (p: CpProblem) => p[1].some(id => solved.has(id));
  const cpTried = (p: CpProblem) => p[1].some(id => tried.has(id));
  const sheetSolved = (it: Item) => letters(it.n!).filter(l => solved.has(it.cid + l)).length;
  const isDone = (it: Item): boolean => {
    if (manual[it.id] && (it.lane === "drill" || it.lane === "mile")) return true;
    if (it.lane === "rate") return it.probs!.every(cpSolved);
    if (it.lane === "learn") return sheetSolved(it) >= Math.ceil(it.n! * SHEET_DONE);
    if (it.lane === "test") { const bc = byContest[it.contestId!]; return !!(bc && bc.part && bc.ok.size >= 2) }
    return false;
  };
  const stageProg = (s: Stage) => { const d = s.items.filter(isDone).length; return { d, n: s.items.length, p: d / s.items.length } };
  let current = STAGES.length - 1;
  for (let i = 0; i < STAGES.length; i++) if (stageProg(STAGES[i]).p < UNLOCK_AT) { current = i; break }
  const nextItem = (si: number) => { const ii = STAGES[si].items.findIndex(it => !isDone(it)); return ii < 0 ? null : ii };
  // Inside the current stage only finished lessons and the next one are open; later stages are closed.
  const unlocked = unlockAll ? STAGES.length - 1 : current;   // furthest stage she may open
  const itemOpen = (si: number, ii: number) => unlockAll || (si !== current ? si < current : isDone(STAGES[si].items[ii]) || ii === nextItem(si));
  const streak = () => {
    let n = 0; const d = new Date(); const has = (x: Date) => days.has(x.toDateString());
    if (!has(d)) d.setDate(d.getDate() - 1);
    while (has(d)) { n++; d.setDate(d.getDate() - 1) }
    return n;
  };
  const upsolve = [...tried].filter(([k]) => !solved.has(k)).map(([, s]) => s).sort((a, b) => b.t - a.t);
  const totalDone = STAGES.reduce((a, s) => a + stageProg(s).d, 0);
  return { unlocked, solved, tried, days, byContest, cpSolved, cpTried, sheetSolved, isDone, stageProg, current, nextItem, itemOpen, streak, upsolve, totalDone };
}

// Human labels for problem keys in the activity timeline.
const LABEL: Record<string, string> = {};
STAGES.forEach(st => st.items.forEach(it => {
  if (it.lane === "rate") it.probs!.forEach((p, k) => p[1].forEach(id => LABEL[id] = `CP-31 ${it.tier} #${it.from! + k} ${p[0]}`));
  if (it.lane === "learn") letters(it.n!).forEach(l => LABEL[it.cid + l] = `${it.title.split(" · ")[0]} ${l}`);
}));
export function problemLabel(key: string, cf: CfData | null) {
  if (LABEL[key]) return LABEL[key];
  const s = cf?.subs.find(x => `${x.c}${x.i}` === key);
  return s ? `${key} ${s.n}` : key;
}
export const itemTitle = (id: string) => id.split(":").slice(1).join(":");
