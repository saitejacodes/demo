import { useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { backend, type StudentData } from "../lib/backend";
import { JUNIORS, NEWCOMERS } from "../data/roadmap";
import { useApp } from "../state/AppContext";

// What a student must connect once so her map starts full instead of empty ("cold start").
export function setupState(data: StudentData | null) {
  const m = data?.manual ?? {};
  return {
    handle: !!data?.profile.cf_handle,
    groups: !!m["setup:groups"],
    key: !!(data?.hasSecret && data.cf?.groupAt && !data.cf.groupErr),
    cses: !!m["setup:cses"],
    tle: !!m["setup:tle"],
    finished: !!m["setup:done"],
  };
}
export const SETUP_STEPS = [
  { id: "handle", title: "Codeforces account" },
  { id: "groups", title: "Join the Assiut groups" },
  { id: "key", title: "Codeforces API key" },
  { id: "cses", title: "CSES account" },
  { id: "tle", title: "TLE CP-31 account" },
] as const;

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a className="btn" href={href} target="_blank" rel="noopener">{children} ↗</a>;
}

export function Setup() {
  const { me, data, refresh, reloadAccount, sync, syncMsg, toast } = useApp();
  const nav = useNavigate();
  const st = setupState(data);
  const [step, setStep] = useState(() => Math.max(0, SETUP_STEPS.findIndex(s => !st[s.id])));
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState(""), [key, setKey] = useState(""), [secret, setSecret] = useState("");
  const [err, setErr] = useState("");
  if (!me || !data) return null;
  if (me.role === "parent") return <Navigate to="/" replace />;

  const cur = SETUP_STEPS[step], last = step === SETUP_STEPS.length - 1;
  const next = () => { setErr(""); setStep(Math.min(step + 1, SETUP_STEPS.length - 1)) };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr("");
    try { await fn() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  };
  const mark = (id: string) => run(async () => { await backend.setManual(id, true); await refresh(); next() });

  const saveHandle = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const r = await (await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle.trim())}`)).json();
    if (r.status !== "OK") throw new Error("Codeforces doesn't know that handle. Check the spelling.");
    await backend.updateProfile({ cf_handle: r.result[0].handle });
    await reloadAccount(); await refresh(); next();
  }) };
  const saveKey = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    await backend.setSecret(key.trim(), secret.trim()); setKey(""); setSecret("");
    await refresh(); await sync();           // reads the group sheets; tells us if the key or membership is wrong
    await refresh();
  }) };
  const finish = () => run(async () => { await backend.setManual("setup:done", true); await refresh(); toast("You're all set 🎉"); nav("/learn", { replace: true }) });

  const body = (() => {
    switch (cur.id) {
      case "handle": return st.handle ? <>
        <p>✓ Connected as <b>{data.profile.cf_handle}</b>{data.cf ? ` · rating ${data.cf.info.rating}` : " · reading your submissions…"}</p>
        <p className="muted small">Your map is built from your real Codeforces submissions, so everything you've already solved counts.</p></>
        : <form onSubmit={saveHandle}>
          <p className="muted">Enter your Codeforces handle (the name in your profile URL, codeforces.com/profile/<b>handle</b>). No account yet? <a href="https://codeforces.com/register" target="_blank" rel="noopener">Create one</a> first.</p>
          <input className="field" placeholder="Codeforces handle" value={handle} onChange={e => setHandle(e.target.value)} autoCapitalize="off" autoComplete="off" required autoFocus />
          <button className="btn" disabled={busy}>{busy ? "Checking…" : "Connect"}</button></form>;
      case "groups": return <>
        <p className="muted">Your sheets live in two private Codeforces groups. Open each one, click <b>Join group</b>, and wait for approval if it asks.</p>
        <Ext href="https://codeforces.com/group/MWSDmqGsZm">Assiut Newcomers group</Ext>
        <Ext href="https://codeforces.com/group/c3FDl9EUi9">Assiut Juniors Phase 1 group</Ext>
        <p className="muted small">Your sheets: <a href={NEWCOMERS} target="_blank" rel="noopener">Newcomers</a> · <a href={JUNIORS} target="_blank" rel="noopener">Juniors</a>. The next step confirms the membership worked.</p></>;
      case "key": return st.key ? <>
        <p>✓ Connected — your Assiut sheets were read from your account{data.cf?.groupAt ? ` (${new Date(data.cf.groupAt).toLocaleString()})` : ""}.</p></>
        : <form onSubmit={saveKey}>
          <p className="muted">Codeforces hides group submissions from public view. A key created on <b>your</b> account lets this site read your sheet results (read-only; you can delete it any time).</p>
          <ol className="muted small" style={{ paddingLeft: 20, margin: "0 0 8px" }}>
            <li>Open <a href="https://codeforces.com/settings/api" target="_blank" rel="noopener">codeforces.com/settings/api</a> while signed in</li>
            <li>Click <b>Add API key</b> and name it <i>road-to-expert</i></li><li>Paste the Key and Secret below</li></ol>
          <label className="lb">Key</label><input className="field" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" autoCapitalize="off" required />
          <label className="lb">Secret</label><input className="field" type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" required />
          {(data.cf?.groupErr && data.hasSecret) && <p className="err small">⚠️ {data.cf.groupErr}</p>}
          <button className="btn" disabled={busy || !!syncMsg}>{syncMsg || (busy ? "Checking…" : "Save & check")}</button>
          {syncMsg && <p className="muted small">Reading your 15 sheets takes about 40 seconds…</p>}</form>;
      case "cses": return <>
        <p className="muted">CSES has no public connection, so you'll upload a screenshot of each <b>Accepted</b> result as proof. You just need an account to solve there.</p>
        <Ext href="https://cses.fi/register">Create a CSES account</Ext>
        <p className="muted small">Already have one? Skip straight to “I've done this”.</p></>;
      case "tle": return <>
        <p className="muted">The CP-31 sheet's video solutions and notes live on TLE Eliminators. Sign in with Google, open the CP-31 sheet, and click <b>Connect Codeforces</b> with your handle{data.profile.cf_handle ? <> (<b>{data.profile.cf_handle}</b>)</> : ""}.</p>
        <Ext href="https://www.tle-eliminators.com/login?prevRedirectUrl=%2Fcp-sheet">Open TLE Eliminators</Ext>
        <p className="muted small">Your progress here is still tracked automatically from Codeforces, with or without it.</p></>;
    }
  })();

  const needsConfirm = cur.id === "groups" || cur.id === "cses" || cur.id === "tle";
  const done = st[cur.id];
  return <div className="authwrap"><div className="authcard card" style={{ width: "min(560px,100%)" }}>
    <p className="muted small" style={{ margin: 0 }}>Step {step + 1} of {SETUP_STEPS.length} · {me.display_name || "welcome"}</p>
    <div className="rankbar"><i style={{ width: `${(SETUP_STEPS.filter(s => st[s.id]).length / SETUP_STEPS.length) * 100}%` }} /></div>
    <div style={{ display: "flex", gap: 6, margin: "4px 0 12px", flexWrap: "wrap" }}>{SETUP_STEPS.map((s, i) =>
      <button key={s.id} className="btn sm ghost" style={{ padding: "4px 10px", fontSize: 12, boxShadow: "none", borderColor: i === step ? "var(--accent)" : undefined }}
        onClick={() => { setErr(""); setStep(i) }}>{st[s.id] ? "✓" : i + 1} {s.title}</button>)}</div>
    <div className="h1" style={{ marginTop: 0 }}>{cur.title}</div>
    {body}
    {err && <p className="err small">{err}</p>}
    {needsConfirm && !done && <button className="btn ok" disabled={busy} onClick={() => mark(`setup:${cur.id}`)}>I've done this</button>}
    {(done || (cur.id === "key" && !st.key)) && !last && <button className={`btn ${done ? "" : "ghost"}`} onClick={next}>{done ? "Next" : "Skip for now"}</button>}
    {last && <button className="btn ok" disabled={busy || !st.handle} onClick={finish}>{SETUP_STEPS.every(s => st[s.id]) ? "Finish — open my map" : "Finish for now"}</button>}
    {last && !SETUP_STEPS.every(s => st[s.id]) && <p className="muted small">You can finish the remaining steps any time from Profile → Setup.</p>}
    {step > 0 && <button className="btn ghost" onClick={() => { setErr(""); setStep(step - 1) }}>Back</button>}
  </div></div>;
}
