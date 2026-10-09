import { useState } from "react";
import { Link } from "react-router-dom";
import { cses, STAGES } from "../data/roadmap";
import { backend, compressImage } from "../lib/backend";
import { letters, SHEET_DONE } from "../lib/progress";
import { useApp } from "../state/AppContext";
import { burst, ding } from "./Confetti";
import { Icon, LANE } from "./Icons";
import { Modal } from "./Overlays";

const QUESTIONS: [string, string][] = [
  ["solved", "What did I solve, how long did each take?"], ["stuck", "Where did I get stuck — idea or bug?"],
  ["topic", "Topic of the missed problem?"], ["upsolved", "Did I upsolve it?"], ["next", "One thing I'll do differently"],
];

export function LessonModal({ at, onClose }: { at: { si: number; ii: number } | null; onClose(): void }) {
  return <Modal open={!!at} onClose={onClose} wide={!!at && STAGES[at.si].items[at.ii].lane === "rate"}>
    {at && <LessonBody si={at.si} ii={at.ii} onClose={onClose} />}
  </Modal>;
}

function LessonBody({ si, ii, onClose }: { si: number; ii: number; onClose(): void }) {
  const { data, prog, readOnly, refresh, toast, sound } = useApp();
  const [busy, setBusy] = useState(false);
  const it = STAGES[si].items[ii], ln = LANE[it.lane];
  const [answers, setAnswers] = useState<Record<string, string>>(data?.reflections[it.id] || {});
  if (!data || !prog) return null;
  const done = prog.isDone(it), who = data.profile.display_name || "She";
  const act = async (fn: () => Promise<void>, ok: string, party = false) => {
    setBusy(true);
    try { await fn(); await refresh(); toast(ok); if (party) { burst(); if (sound) ding() } }
    catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  };

  let body = null, actions = null;
  if (it.lane === "rate") {
    const solved = it.probs!.filter(prog.cpSolved).length;
    body = <>
      <p className="sub">{it.tier}-rated problems {it.from}–{it.to} from TLE CP-31, checked against the Codeforces account — <b>{solved}/{it.probs!.length}</b> solved.</p>
      <div className="plist three tight">{it.probs!.map((p, k) => {
        const [, c, i] = p[1][0].match(/^(\d+)(.+)$/)!, ok = prog.cpSolved(p), bad = !ok && prog.cpTried(p);
        return <div className="row" key={p[1][0]}>
          <div className="dot" style={{ background: ok ? "var(--gold)" : bad ? "var(--bad)" : "var(--lock)", color: ok || bad ? "#fff" : "var(--muted)" }}>{ok ? <Icon name="check" size={18} /> : it.from! + k}</div>
          <div className="t">{p[0]}<small>{p[1][0]}{bad ? " · tried, not accepted" : ""}</small></div>
          <a className="go" target="_blank" rel="noopener" href={`https://codeforces.com/contest/${c}/problem/${i}`}>{ok ? "View" : "Solve"} →</a></div>;
      })}</div></>;
    actions = <a className="btn ghost" href={it.url} target="_blank" rel="noopener">Open CP-31 sheet</a>;
  } else if (it.lane === "test") {
    const bc = prog.byContest[it.contestId!];
    body = <>
      <p className="sub">Do it as a <b>virtual</b> contest (contest page → “Virtual participation”). Done after taking part and solving at least 2.</p>
      {bc ? <><div className="probs">{[...bc.probs].sort().map(p => <span key={p} className={bc.ok.has(p) ? "ok" : "bad"}>{p}</span>)}</div>
        <p className="muted">{bc.ok.size} solved{bc.part ? "" : " · not yet a virtual/live participation"}</p></> : <p className="muted">No submissions yet.</p>}
      <h3 style={{ marginTop: 14, fontSize: 17 }}>Reflection</h3>
      <div className="grid2" style={{ marginTop: 4, gap: "4px 16px" }}>{QUESTIONS.map(([k, q]) => <div key={k}>
        <label className="lb">{q}</label>
        <textarea className="field" readOnly={readOnly} value={answers[k] || ""} onChange={e => setAnswers({ ...answers, [k]: e.target.value })} /></div>)}</div></>;
    actions = <><a className="btn" href={it.url} target="_blank" rel="noopener">Open contest</a>
      {!readOnly && <button className="btn ok" disabled={busy} onClick={() => act(() => backend.saveReflection(it.id, answers), "Reflection saved")}>Save reflection</button>}</>;
  } else if (it.lane === "learn") {
    const connected = data.hasSecret && data.cf?.groupAt;
    body = <>
      <p className="sub">{connected ? <>Read from <b>{data.profile.cf_handle}</b>'s Codeforces account. Green = Accepted, red = tried but not Accepted. Click a letter to open it.</>
        : readOnly ? `${who} hasn't connected her Codeforces API key yet, so group sheets can't be read.`
        : "Codeforces hides group-sheet submissions from the public API. Connect your API key once in Profile and this sheet fills in automatically."}</p>
      {data.cf?.groupErr && <p className="err">⚠️ {data.cf.groupErr}</p>}
      <div className="probs">{letters(it.n!).map(l => {
        const k = it.cid + l, ok = prog.solved.has(k), bad = !ok && prog.tried.has(k);
        return <a key={l} className={ok ? "ok" : bad ? "bad" : ""} href={`${it.url}/problem/${l}`} target="_blank" rel="noopener">{l}</a>;
      })}</div>
      <p className="muted">{prog.sheetSolved(it)}/{it.n} accepted · counts as done at {Math.ceil(it.n! * SHEET_DONE)}</p></>;
    actions = <>{!connected && !readOnly && <Link className="btn" to="/profile" onClick={onClose}>Connect in Profile</Link>}
      <a className={`btn ${connected || readOnly ? "" : "ghost"}`} href={it.url} target="_blank" rel="noopener">Open sheet</a></>;
  } else if (it.lane === "drill") {
    const proofs = data.proofs.filter(p => p.item_id === it.id);
    body = <>
      <p className="sub">Classic CSES task{cses[it.title] ? ` (cses.fi task ${cses[it.title]})` : ""}. Solve it, then upload a screenshot of the <b>Accepted</b> result — that's the proof, and the lesson is done.</p>
      {proofs[0] && <><img className="thumb" src={proofs[0].url} alt="Latest proof" /><p className="muted small">Uploaded {new Date(proofs[0].created_at).toLocaleString()}{proofs.length > 1 ? ` · ${proofs.length} screenshots` : ""}</p></>}
      {readOnly && !proofs.length && <p className="muted">No screenshot yet.</p>}</>;
    actions = <><a className="btn" href={it.url} target="_blank" rel="noopener">Open task</a>
      {!readOnly && <label className="btn ok" style={{ cursor: "pointer" }}>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Icon name="camera" size={18} />{busy ? "Uploading…" : proofs.length ? "Upload another" : "Upload screenshot"}</span>
        <input type="file" accept="image/*" hidden disabled={busy} onChange={e => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (f) act(async () => backend.uploadProof(it.id, await compressImage(f)), "Proof uploaded ✓", true);
        }} /></label>}</>;
  } else {
    body = <p className="sub">{it.note}</p>;
    actions = !readOnly && <button className={`btn ${data.manual[it.id] ? "ghost" : "ok"}`} disabled={busy}
      onClick={() => act(() => backend.setManual(it.id, !data.manual[it.id]), data.manual[it.id] ? "Marked not done" : "Done ✓", !data.manual[it.id])}>
      {data.manual[it.id] ? "Mark not done" : "Mark done"}</button>;
  }

  return <>
    <span className="tag" style={{ background: ln.c }}>{ln.name}{done ? " · ✓ done" : ""}</span>
    <h3>{it.title}</h3>{body}
    <div className="actions">{actions}<button className="btn ghost" onClick={onClose}>Close</button></div>
  </>;
}

export function StageGuide({ si, onClose, onOpen }: { si: number | null; onClose(): void; onOpen(ii: number): void }) {
  const { prog, data } = useApp();
  return <Modal open={si !== null} onClose={onClose} wide>
    {si !== null && prog && data && (() => {
      const s = STAGES[si];
      const refl = s.items.filter(it => it.lane === "test" && data.reflections[it.id]);
      return <>
        <span className="tag" style={{ background: s.color }}>Stage {si} · {s.weeks}</span><h3>{s.title}</h3>
        <p className="sub">{s.theme}. Expected rating after: <b>{s.exp}</b>. Lessons open one at a time; the next stage unlocks when all {s.items.length} are done.</p>
        <div className="plist three">{s.items.map((it, ii) => prog.itemOpen(si, ii)
          ? <div className="row" key={it.id}><div className="dot" style={{ background: prog.isDone(it) ? "var(--gold)" : LANE[it.lane].c }}><Icon name={prog.isDone(it) ? "check" : it.lane} size={20} /></div>
            <div className="t">{it.title}<small>{LANE[it.lane].name}</small></div><button className="go" onClick={() => onOpen(ii)}>Open →</button></div>
          : <div className="row" key={it.id}><div className="dot" style={{ background: "var(--lock)", color: "var(--lockfg)" }}><Icon name="lock" size={20} /></div>
            <div className="t muted">Lesson {ii + 1}<small>Locked</small></div></div>)}</div>
        {refl.length > 0 && <><h3 style={{ fontSize: 17, marginTop: 14 }}>Reflections</h3>
          {refl.map(it => <p key={it.id}><b>{it.title}:</b> <span className="muted">{data.reflections[it.id].next || data.reflections[it.id].stuck}</span></p>)}</>}
        <div className="actions"><button className="btn ghost" onClick={onClose}>Close</button></div>
      </>;
    })()}
  </Modal>;
}
