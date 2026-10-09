import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { backend, type Profile, type StudentData } from "../lib/backend";
import { buildProgress, rankOf, RANKS, type Progress } from "../lib/progress";
import { STAGES } from "../data/roadmap";
import { burst, ding } from "../components/Confetti";

interface Celebration { emoji: string; title: string; text: string }
interface AppState {
  ready: boolean;
  userId: string | null;
  me: Profile | null;
  students: Profile[];
  viewing: string | null;
  setViewing(id: string): void;
  data: StudentData | null;
  prog: Progress | null;
  readOnly: boolean;
  syncMsg: string | null;
  sound: boolean;
  setSound(v: boolean): void;
  refresh(): Promise<void>;
  reloadAccount(): Promise<void>;
  sync(): Promise<void>;
  toast(msg: string): void;
  toastMsg: string | null;
  celebrate(c: Celebration): void;
  celebration: Celebration | null;
  dismissCelebration(): void;
}
const Ctx = createContext<AppState>(null!);
export const useApp = () => useContext(Ctx);

const pref = {
  get: (k: string) => { try { return localStorage.getItem("rte-app:" + k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem("rte-app:" + k, v) } catch { /* private mode */ } },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [viewing, setViewingState] = useState<string | null>(null);
  const [data, setData] = useState<StudentData | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [sound, setSoundState] = useState(pref.get("sound") === "1");
  const toastTimer = useRef<number>(0);
  const sessionStage = useRef<number | null>(null);
  const autoSynced = useRef(false);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg); clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);
  const celebrate = useCallback((c: Celebration) => { setCelebration(c); burst(200); if (pref.get("sound") === "1") ding() }, []);
  const setSound = (v: boolean) => { pref.set("sound", v ? "1" : "0"); setSoundState(v) };

  const reloadAccount = useCallback(async () => {
    const id = await backend.currentUserId();
    setUserId(id);
    if (!id) { setMe(null); setStudents([]); setViewingState(null); setData(null); setReady(true); return }
    const p = await backend.myProfile();
    setMe(p);
    if (p.role === "parent") {
      const list = await backend.myStudents();
      setStudents(list);
      const saved = pref.get("viewing");
      setViewingState(list.find(s => s.id === saved)?.id ?? list[0]?.id ?? null);
    } else { setStudents([]); setViewingState(p.id) }
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!viewing) { setData(null); return }
    setData(await backend.load(viewing));
  }, [viewing]);

  useEffect(() => { reloadAccount(); return backend.onAuthChange(() => { autoSynced.current = false; reloadAccount() }) }, [reloadAccount]);
  useEffect(() => { sessionStage.current = null; refresh().catch(e => toast(e.message)) }, [refresh, toast]);

  const setViewing = (id: string) => { pref.set("viewing", id); setViewingState(id) };
  const prog = useMemo(() => data ? buildProgress(data.cf, data.manual) : null, [data]);
  const readOnly = me?.role === "parent";

  const sync = useCallback(async () => {
    if (!viewing || syncMsg) return;
    setSyncMsg("Syncing with Codeforces…");
    try { await backend.sync(viewing, m => setSyncMsg(m)); await refresh(); toast("Synced ✓") }
    catch (e) { toast("Sync failed: " + (e as Error).message) }
    finally { setSyncMsg(null) }
  }, [viewing, syncMsg, refresh, toast]);

  // Students: sync automatically when the cached data is older than 30 minutes.
  useEffect(() => {
    if (!data || readOnly || autoSynced.current || !data.profile.cf_handle) return;
    autoSynced.current = true;
    if (!data.cf || Date.now() - data.cf.at > 30 * 60 * 1000) sync();
  }, [data, readOnly, sync]);

  // Stage unlocks: record them for the parent's timeline, celebrate the ones that happen in this session.
  useEffect(() => {
    if (!prog || !data || !me) return;
    const cur = prog.current;
    if (sessionStage.current === null) sessionStage.current = cur;
    if (!readOnly && cur > data.profile.unlocked_stage) {
      backend.updateProfile({ unlocked_stage: cur })
        .then(() => backend.log("unlock", { stage: cur, title: STAGES[cur].title }))
        .then(refresh).catch(() => {});
    }
    if (cur > sessionStage.current) {
      sessionStage.current = cur;
      celebrate({ emoji: "🔓", title: `Stage ${cur} unlocked!`, text: `${STAGES[cur].title} — ${STAGES[cur].theme}.` });
    }
  }, [prog, data, me, readOnly, refresh, celebrate]);

  // The accent colour follows her live rank; a new rank gets a celebration once per device.
  useEffect(() => {
    const r = data?.cf?.info.rating ?? 0, rk = rankOf(r);
    document.documentElement.style.setProperty("--accent", rk[2]);
    document.documentElement.style.setProperty("--accent-d", rk[3]);
    if (!data?.cf) return;
    const key = "seenRank:" + data.profile.id, seen = pref.get(key);
    if (seen && seen !== rk[1] && RANKS.findIndex(k => k[1] === rk[1]) > RANKS.findIndex(k => k[1] === seen))
      celebrate({ emoji: "🎖️", title: `${rk[1]}!`, text: `Rating ${r}. The whole map now wears the new colour.` });
    pref.set(key, rk[1]);
  }, [data, celebrate]);

  const value: AppState = {
    ready, userId, me, students, viewing, setViewing, data, prog, readOnly, syncMsg, sound, setSound,
    refresh, reloadAccount, sync, toast, toastMsg, celebrate, celebration, dismissCelebration: () => setCelebration(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
