import { useNavigate } from "react-router-dom";
import { STAGES } from "../data/roadmap";
import { rankOf } from "../lib/progress";
import { useApp } from "../state/AppContext";
import { ProofGallery, RatingChart, Timeline } from "../components/Widgets";
import { LinkStudent } from "./Views";

export function Parent() {
  const { students, data, prog, reloadAccount, sync, syncMsg } = useApp();
  const navigate = useNavigate();
  if (!students.length) return <>
    <div className="h1">Welcome 👋</div>
    <p className="muted">Link your student's account to follow her progress, see every CSES screenshot, and a timeline of everything she does.</p>
    <div className="grid2"><LinkStudent onLinked={reloadAccount} /></div>
  </>;
  if (!data || !prog) return <p className="muted" style={{ marginTop: 40 }}>Loading…</p>;

  const week = Date.now() - 7 * 864e5;
  const solvedWeek = new Set((data.cf?.subs || []).filter(s => s.v === "OK" && s.t * 1000 > week).map(s => `${s.c}${s.i}`)).size;
  const activeDays = [...prog.days.keys()].filter(d => new Date(d).getTime() > week - 864e5).length;
  const proofsWeek = data.proofs.filter(p => new Date(p.created_at).getTime() > week).length;
  const cur = prog.current, ni = prog.nextItem(cur), sp = prog.stageProg(STAGES[cur]);
  const r = data.cf?.info.rating ?? 0;

  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {data.cf?.info.avatar && <img className="avatar" style={{ width: 52, height: 52 }} src={data.cf.info.avatar} alt="" />}
      <div style={{ flex: 1 }}><div className="h1" style={{ margin: 0 }}>{data.profile.display_name || data.profile.cf_handle}</div>
        <p className="muted small" style={{ margin: 0 }}>{data.profile.cf_handle ? <a href={`https://codeforces.com/profile/${data.profile.cf_handle}`} target="_blank" rel="noopener">{data.profile.cf_handle}</a> : "No Codeforces handle yet"}
          {" · "}{data.cf ? `${rankOf(r)[1]} · ${r}` : "not synced"} · {syncMsg || (data.cf ? `synced ${new Date(data.cf.at).toLocaleString()}` : "")}</p></div>
      <button className="btn sm" onClick={sync} disabled={!!syncMsg}>Sync now</button>
    </div>
    <div className="kpis">
      <div className="kpi"><b>Stage {cur}</b><span>{STAGES[cur].title} · {sp.d}/{sp.n}</span></div>
      <div className="kpi"><b>{solvedWeek}</b><span>Problems solved this week</span></div>
      <div className="kpi"><b>{activeDays}/7</b><span>Active days this week</span></div>
      <div className="kpi"><b>{prog.streak()} 🔥</b><span>Day streak · {proofsWeek} proofs this week</span></div>
    </div>
    <div className="grid2">
      <div className="stack">
        <div className="card"><h3>Working on now</h3>
          <p style={{ margin: 0 }}>{ni === null ? "Stage complete 🎉" : STAGES[cur].items[ni].title}</p>
          <div className="rankbar"><i style={{ width: `${Math.round(sp.p * 100)}%`, background: STAGES[cur].color }} /></div>
          <button className="btn ghost" onClick={() => navigate(`/learn/${cur}`)}>Open her map</button></div>
        <div className="card" style={{ maxHeight: 420, overflowY: "auto" }}><h3>Timeline</h3><Timeline items={data.activity} cf={data.cf} /></div>
      </div>
      <div className="stack">
        <div className="card" style={{ maxHeight: 330, overflowY: "auto" }}><h3>CSES screenshots 📸</h3><ProofGallery proofs={data.proofs} /></div>
        <div className="card"><h3>Rating</h3><RatingChart cf={data.cf} /></div>
      </div>
    </div>
  </>;
}
