import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { STAGES } from "../data/roadmap";
import type { Progress } from "../lib/progress";
import { Icon, LANE } from "./Icons";

export function Journey({ prog, sel, onSelect, onLocked }: { prog: Progress; sel: number; onSelect(si: number): void; onLocked(): void }) {
  return <div className="journey">{STAGES.map((st, si) => {
    const locked = si > prog.current, cls = locked ? "locked" : si < prog.current ? "done" : "cur";
    return <button key={si} className={`jstop ${cls} ${si === sel ? "sel" : ""}`} style={{ ["--sc" as string]: st.color }}
      onClick={() => locked ? onLocked() : onSelect(si)} title={locked ? "Locked" : st.title}>
      <span className="jdot">{locked ? <Icon name="lock" size={20} /> : si < prog.current ? <Icon name="check" size={20} /> : si}</span>
      <span className="jlab">{locked ? `Stage ${si}` : st.title}</span>
    </button>;
  })}</div>;
}

// The stage's lessons as a horizontal snake, so a whole stage fits on a laptop screen without scrolling.
export function StagePath({ prog, si, onOpen, onLocked }: { prog: Progress; si: number; onOpen(ii: number): void; onLocked(): void }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(700);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 700)); ro.observe(el); setW(el.clientWidth || 700);
    return () => ro.disconnect();
  }, []);
  const s = STAGES[si], n = s.items.length + 1;
  const per = Math.max(3, Math.min(7, Math.floor((W + 30) / 112))), rows = Math.ceil(n / per), rowH = 128, padX = 56, top = 78;
  const pos = (k: number) => {
    const r = Math.floor(k / per); let c = k % per; if (r % 2) c = per - 1 - c;
    return { x: per > 1 ? padX + c * (W - 2 * padX) / (per - 1) : W / 2, y: top + r * rowH + (c % 2 ? 14 : 0) };
  };
  const next = si === prog.current ? prog.nextItem(si) : null;
  const lastDone = s.items.reduce((m, it, ii) => prog.isDone(it) ? ii : m, -1);
  const pts = Array.from({ length: n }, (_, k) => { const q = pos(k); return `${q.x},${q.y}` });
  const cq = pos(n - 1), chestOpen = prog.stageProg(s).p >= 1;
  return <div className="pathbox" ref={box} style={{ height: top + (rows - 1) * rowH + 90 }}>
    <svg className="trail">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--line)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      {lastDone > 0 && <polyline points={pts.slice(0, lastDone + 1).join(" ")} fill="none" stroke="var(--gold)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />}
    </svg>
    {s.items.map((it, ii) => {
      const done = prog.isDone(it), open = prog.itemOpen(si, ii), q = pos(ii);
      return <div key={it.id}>
        {ii === next && <div className="bubble" style={{ left: q.x, top: q.y - 62 }}>START</div>}
        <motion.button className={`node ${open ? "" : "locked"} ${done ? "done" : ""} ${ii === next ? "current" : ""}`}
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: ii * 0.025, type: "spring", stiffness: 400, damping: 22 }}
          style={{ left: q.x - 32, top: q.y - 29, ["--c" as string]: LANE[it.lane].c, ["--cd" as string]: s.dark }}
          onClick={() => open ? onOpen(ii) : onLocked()} aria-label={open ? it.title : "Locked lesson"}>
          <Icon name={done ? "check" : open ? it.lane : "lock"} size={28} />
        </motion.button>
        {open && <div className="nlab" style={{ left: q.x - 59, top: q.y + 38, ["--lc" as string]: LANE[it.lane].c }}>
          <b>{LANE[it.lane].name}</b>{it.title.replace(/^CP-31 · /, "CP-31 ")}</div>}
      </div>;
    })}
    <div className={`chest ${chestOpen ? "open" : ""}`} style={{ left: cq.x - 32, top: cq.y - 29 }} title={chestOpen ? "Stage complete" : "Finish every lesson to open"}>{chestOpen ? "🏆" : "🎁"}</div>
  </div>;
}
