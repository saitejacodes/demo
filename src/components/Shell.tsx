import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { backend } from "../lib/backend";
import { probURL } from "../lib/progress";
import { STAGES } from "../data/roadmap";
import { useApp } from "../state/AppContext";
import { Icon, type IconName } from "./Icons";
import { Chips, RankCard, Timeline } from "./Widgets";

export function Shell() {
  const { me, students, viewing, setViewing, data } = useApp();
  const loc = useLocation();
  const parent = me?.role === "parent";
  const nav: [string, string, IconName][] = [
    ...(parent ? [["/parent", "Overview", "eye"] as [string, string, IconName]] : []),
    ["/learn", parent ? "Her map" : "Learn", "home"], ["/today", "Today", "bolt"], ["/upsolve", "Upsolve", "redo"],
    ["/stats", "Stats", "stats"], ["/profile", "Profile", "user"],
  ];
  const showRail = !loc.pathname.startsWith("/parent") && !!data;
  return <div className={`shell ${showRail ? "" : "norail"}`}>
    <aside className="side">
      <div className="logo">road to expert</div>
      <nav className="nav">{nav.map(([to, label, icon]) => <NavLink key={to} to={to}><Icon name={icon} size={26} />{label}</NavLink>)}</nav>
      <div className="who">{me?.display_name || "You"}<small>{parent ? "Parent" : "Student"}{backend.mode === "local" ? " · demo mode" : ""}</small>
        {parent && students.length > 1 && <select value={viewing ?? ""} onChange={e => setViewing(e.target.value)}>
          {students.map(s => <option key={s.id} value={s.id}>{s.display_name || s.cf_handle}</option>)}</select>}
      </div>
    </aside>
    <main className="main">
      {backend.mode === "local" && <p className="banner-demo">Demo mode — data is saved in this browser only. Add the Supabase keys to switch to cloud save.</p>}
      {data && <div className="mtop chips"><Chips /></div>}
      <AnimatePresence mode="wait">
        <motion.div key={loc.pathname.split("/")[1]} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </main>
    {showRail && <Rail />}
  </div>;
}

function Rail() {
  const { prog, data, readOnly, syncMsg, sync } = useApp();
  const navigate = useNavigate();
  if (!prog || !data) return null;
  const cur = prog.current, ni = prog.nextItem(cur), nit = ni === null ? null : STAGES[cur].items[ni], sp = prog.stageProg(STAGES[cur]);
  return <aside className="rail">
    <div className="chips"><Chips /></div>
    {nit && <div className="card" style={{ borderColor: STAGES[cur].color }}>
      <p className="muted" style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: ".6px" }}>{readOnly ? "Working on" : "Next up"} · Stage {cur}</p>
      <h3 style={{ margin: "4px 0 0" }}>{nit.title}</h3>
      <button className="btn" style={{ background: STAGES[cur].color, boxShadow: `0 4px 0 ${STAGES[cur].dark}` }}
        onClick={() => navigate(`/learn/${cur}?lesson=${ni}`)}>{readOnly ? "View" : "Start"}</button></div>}
    <div className="card"><h3>This stage</h3><div className="rankbar"><i style={{ width: `${Math.round(sp.p * 100)}%`, background: STAGES[cur].color }} /></div>
      <p className="muted small" style={{ margin: 0 }}>{sp.d}/{sp.n} lessons done · Stage {cur + 1} opens when all are done</p></div>
    {prog.upsolve.length > 0 && <div className="card"><h3>Upsolve 🔁</h3>{prog.upsolve.slice(0, 3).map(u =>
      <div className="row" key={`${u.c}${u.i}`}><div className="dot" style={{ background: "var(--bad)" }}><Icon name="drill" size={20} /></div>
        <div className="t">{u.n}<small>{u.c}{u.i}</small></div><a className="go" target="_blank" rel="noopener" href={probURL(u)}>Go →</a></div>)}</div>}
    {readOnly ? <div className="card"><h3>Latest activity</h3><Timeline items={data.activity} cf={data.cf} limit={4} /></div> : <RankCard />}
    <p className="muted" style={{ fontSize: 12, margin: "0 4px" }}>
      {syncMsg || (data.cf ? `Synced ${new Date(data.cf.at).toLocaleString()}` : "Not synced yet")} · <a href="#" onClick={e => { e.preventDefault(); sync() }}>Sync now</a></p>
  </aside>;
}
