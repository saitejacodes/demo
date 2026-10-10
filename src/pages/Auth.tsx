import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { backend, setDemo, type Role } from "../lib/backend";
import { useApp } from "../state/AppContext";
import { PARENT_ACCOUNTS } from "../config";

export function Login() {
  const { userId, reloadAccount } = useApp();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [role, setRole] = useState<Role>("student");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<{ err?: string; info?: string }>({});
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  if (userId) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg({});
    try {
      if (tab === "in") await backend.signIn(f.email, f.password);
      else {
        if (f.password.length < 8) throw new Error("Use at least 8 characters for the password.");
        const r = await backend.signUp(f.email, f.password, f.name.trim(), role);
        if (r.needsConfirm) { setMsg({ info: "Check your email and click the confirmation link, then sign in." }); setTab("in"); return }
      }
      await reloadAccount(); nav("/");
    } catch (er) { setMsg({ err: (er as Error).message }) } finally { setBusy(false) }
  };
  // Demo: see src/lib/demo.ts
  const startDemo = () => { setDemo(true); location.assign("/") };   // reload so the in-browser backend is used
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return <div className="authwrap"><form className="authcard card" onSubmit={submit}>
    <div className="big">🗺️</div>
    <div className="h1" style={{ textAlign: "center" }}>Road to Expert</div>
    <p className="muted small" style={{ textAlign: "center", margin: 0 }}>Codeforces 0 → 1600, one unlocked stage at a time.</p>
    {backend.mode === "local" && <p className="banner-demo" style={{ marginTop: 12 }}>Demo mode — accounts live in this browser only.</p>}
    <div className="tabs2"><button type="button" className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>Sign in</button>
      <button type="button" className={tab === "up" ? "on" : ""} onClick={() => setTab("up")}>Create account</button></div>
    {tab === "up" && <>
      {PARENT_ACCOUNTS && <div className="seg">
        <button type="button" className={role === "student" ? "on" : ""} onClick={() => setRole("student")}>🎓 I'm the student<small>Follow the roadmap</small></button>
        <button type="button" className={role === "parent" ? "on" : ""} onClick={() => setRole("parent")}>👀 I'm the parent<small>Follow her progress</small></button>
      </div>}
      <label className="lb">Name</label><input className="field" required value={f.name} onChange={set("name")} autoComplete="name" />
    </>}
    <label className="lb">Email</label><input className="field" type="email" required value={f.email} onChange={set("email")} autoComplete="email" />
    <label className="lb">Password</label><input className="field" type="password" required value={f.password} onChange={set("password")} autoComplete={tab === "in" ? "current-password" : "new-password"} />
    {msg.err && <p className="err small">{msg.err}</p>}
    {msg.info && <p className="small" style={{ color: "var(--ok)" }}>{msg.info}</p>}
    <button className="btn" disabled={busy}>{busy ? "Please wait…" : tab === "in" ? "Sign in" : "Create account"}</button>
    <button type="button" className="btn ghost" onClick={startDemo}>👀 Try the demo — everything unlocked</button>
    <p className="muted small" style={{ textAlign: "center", margin: "8px 0 0" }}>The demo runs in your browser only and never touches real accounts.</p>
  </form></div>;
}
