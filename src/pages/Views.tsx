import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STAGES, NEWCOMERS, JUNIORS, CP31 } from "../data/roadmap";
import { backend } from "../lib/backend";
import { probURL } from "../lib/progress";
import { useApp } from "../state/AppContext";
import { Icon, LANE } from "../components/Icons";
import { Heatmap, RatingChart } from "../components/Widgets";
import { EmptyState } from "./Learn";
import { PARENT_ACCOUNTS } from "../config";

export function Today() {
  const { prog, data, readOnly } = useApp();
  const navigate = useNavigate();
  if (!prog || !data) return <EmptyState />;
  const cur = prog.current, ni = prog.nextItem(cur), it = ni === null ? null : STAGES[cur].items[ni];
  return <>
    <div className="h1">Today ⚡</div>
    <p className="muted">{readOnly ? "What she's working on right now" : "Your current lesson"} in <b>{STAGES[cur].title}</b>, then upsolve what was missed.</p>
    <div className="grid2"><div className="card">
      {it ? <div className="row"><div className="dot" style={{ background: LANE[it.lane].c }}><Icon name={it.lane} size={20} /></div>
        <div className="t">{it.title}<small>{LANE[it.lane].name}{it.lane === "rate" ? ` · next: ${it.probs!.find(p => !prog.cpSolved(p))?.[0] ?? ""}` : ""}{it.lane === "learn" ? ` · ${prog.sheetSolved(it)}/${it.n}` : ""}</small></div>
        <button className="go" onClick={() => navigate(`/learn/${cur}?lesson=${ni}`)}>Go →</button></div> : <p>Stage cleared! 🎉</p>}
      {prog.upsolve.slice(0, 3).map(u => <div className="row" key={`${u.c}${u.i}`}><div className="dot" style={{ background: "var(--bad)" }}><Icon name="drill" size={20} /></div>
        <div className="t">{u.n}<small>Upsolve · {u.c}{u.i}</small></div><a className="go" target="_blank" rel="noopener" href={probURL(u)}>Go →</a></div>)}
    </div>
    <div className="card"><h3>Rules of the road</h3><p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
      ⏱ Stuck 30–45 min → read the editorial → rewrite from scratch tomorrow.<br />🏁 One live rated round every week from Stage 2.<br />
      🔁 Upsolve every contest problem you attempted.<br />🚫 No AI while solving.<br />🔒 Lessons open one at a time; the next stage opens when this one is finished.</p></div></div>
  </>;
}

export function Upsolve() {
  const { prog, data } = useApp();
  if (!prog || !data) return <EmptyState />;
  const u = prog.upsolve;
  return <>
    <div className="h1">Upsolve queue 🔁</div>
    <p className="muted">Every Codeforces problem with a failed submission and no Accepted — {u.length} left.</p>
    <div className="card" style={{ marginTop: 14 }}>{!data.cf ? <p>Not synced yet.</p> : u.length ? <div className="plist">{u.map(s =>
      <div className="row" key={`${s.c}${s.i}`}><div className="dot" style={{ background: "var(--bad)" }}><Icon name="drill" size={20} /></div>
        <div className="t">{s.n}<small>{s.c}{s.i}{s.r ? ` · ${s.r}` : ""} · {s.v.replaceAll("_", " ").toLowerCase()}</small></div>
        <a className="go" target="_blank" rel="noopener" href={probURL(s)}>Solve →</a></div>)}</div> : <p>Queue empty — nice! ✨</p>}</div>
  </>;
}

export function Stats() {
  const { prog, data } = useApp();
  if (!prog || !data) return <EmptyState />;
  const info = data.cf?.info, total = STAGES.reduce((a, s) => a + s.items.length, 0);
  return <>
    <div className="h1">Stats 📈</div>
    <div className="kpis">
      <div className="kpi"><b>{info?.rating ?? "—"}</b><span>Rating (max {info?.maxRating ?? "—"})</span></div>
      <div className="kpi"><b>{prog.solved.size}</b><span>Problems solved</span></div>
      <div className="kpi"><b>{prog.totalDone}/{total}</b><span>Lessons done</span></div>
      <div className="kpi"><b>{prog.streak()} 🔥</b><span>Day streak</span></div></div>
    <div className="card" style={{ marginTop: 16 }}><h3>Rating journey</h3><RatingChart cf={data.cf} /></div>
    <div className="card" style={{ marginTop: 16 }}><h3>Activity · last 26 weeks</h3><Heatmap days={prog.days} /></div>
  </>;
}

export function Profile() {
  const { me, data, readOnly, students, reloadAccount, refresh, sync, toast, sound, setSound } = useApp();
  const [key, setKey] = useState(""), [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setThemeState] = useState(() => localStorage.getItem("rte-app:theme") || "auto");
  if (!me) return null;
  const setTheme = (t: string) => {
    localStorage.setItem("rte-app:theme", t); setThemeState(t);
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  };
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); try { await fn(); toast(ok) } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  };
  return <>
    <div className="h1">Profile</div>
    <div className="grid2"><div className="stack">
      <div className="card"><h3>{me.display_name || "Your account"}</h3>
        <p className="muted small" style={{ margin: 0 }}>{me.role === "parent" ? `Parent account · following ${students.length} student${students.length === 1 ? "" : "s"}` : `Student · Codeforces handle: ${me.cf_handle ?? "not set"}`}</p>
        {PARENT_ACCOUNTS && me.role === "student" && me.invite_code && <>
          <p className="small" style={{ marginBottom: 0 }}>Parent link code — share it so your parent can follow your progress:</p>
          <div className="code">{me.invite_code}</div></>}
        <button className="btn ghost" onClick={() => backend.signOut()}>Sign out</button></div>
      <div className="card"><h3>Settings</h3>
        <div className="row"><div className="t">Sound effects</div><button className="btn ghost sm" onClick={() => setSound(!sound)}>{sound ? "On" : "Off"}</button></div>
        <div className="row"><div className="t">Theme</div><button className="btn ghost sm" onClick={() => setTheme(theme === "auto" ? "light" : theme === "light" ? "dark" : "auto")}>{theme}</button></div></div>
      <div className="card"><h3>Resources</h3><p style={{ margin: 0, lineHeight: 1.8 }}>
        <a href={NEWCOMERS} target="_blank" rel="noopener">Assiut Newcomers group</a><br /><a href={JUNIORS} target="_blank" rel="noopener">Assiut Juniors Phase 1</a><br />
        <a href="https://cses.fi/problemset/" target="_blank" rel="noopener">CSES Problem Set</a><br /><a href={CP31} target="_blank" rel="noopener">TLE Eliminators CP-31</a></p></div>
    </div>
    {me.role === "student" && !readOnly && <div className="card"><h3>Assiut sheets: connect your Codeforces account</h3>
      <p className="muted small">Codeforces hides group submissions from the public API. A key created on <b>your</b> account lets the site read your group-sheet results. One-time setup:</p>
      <ol className="muted small" style={{ paddingLeft: 20, margin: "0 0 8px" }}>
        <li>Open <a href="https://codeforces.com/settings/api" target="_blank" rel="noopener">codeforces.com/settings/api</a></li>
        <li>Click <b>Add API key</b>, name it <i>road-to-expert</i></li><li>Paste the Key and Secret here</li></ol>
      {data?.hasSecret
        ? <><p className="small" style={{ color: data.cf?.groupErr ? "var(--bad)" : "var(--ok)" }}>{data.cf?.groupErr ? `⚠️ ${data.cf.groupErr}` : data.cf?.groupAt ? `✓ Connected · sheets synced ${new Date(data.cf.groupAt).toLocaleString()}` : "✓ Key saved — sync to read the sheets"}</p>
          <button className="btn" disabled={busy} onClick={() => sync()}>Sync now</button>
          <button className="btn ghost" disabled={busy} onClick={() => run(async () => { await backend.clearSecret(); await refresh() }, "Key removed")}>Remove key</button></>
        : <form onSubmit={e => { e.preventDefault(); run(async () => { await backend.setSecret(key.trim(), secret.trim()); setKey(""); setSecret(""); await refresh(); await sync() }, "Key saved") }}>
          <label className="lb">Key</label><input className="field" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" autoCapitalize="off" required />
          <label className="lb">Secret</label><input className="field" type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" required />
          <button className="btn" disabled={busy}>Save & sync</button></form>}
      <p className="muted small" style={{ marginBottom: 0 }}>{backend.mode === "cloud" ? "The key is stored on the server and never sent back to the browser." : "Demo mode: the key is stored in this browser."} The Codeforces API only reads data. You can delete the key on that settings page anytime.</p>
    </div>}
    {me.role === "parent" && <LinkStudent onLinked={async () => { await reloadAccount() }} />}
    </div>
  </>;
}

export function LinkStudent({ onLinked }: { onLinked(): Promise<void> }) {
  const { toast } = useApp();
  const [code, setCode] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  return <form className="card" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await backend.linkStudent(code); setCode(""); await onLinked(); toast("Linked ✓") } catch (er) { setErr((er as Error).message) } finally { setBusy(false) }
  }}>
    <h3>Follow a student</h3>
    <p className="muted small">Ask her for the parent link code shown on her Profile page.</p>
    <input className="field code" style={{ width: "100%", textAlign: "center" }} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234" required />
    {err && <p className="err small">{err}</p>}
    <button className="btn" disabled={busy}>{busy ? "Linking…" : "Link"}</button>
  </form>;
}
