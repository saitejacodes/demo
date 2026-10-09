import { useState } from "react";
import { useApp } from "../state/AppContext";
import { Flame, Icon } from "./Icons";
import { itemTitle, problemLabel, rankOf, RANKS } from "../lib/progress";
import type { Activity, Proof } from "../lib/backend";
import type { CfData } from "../../supabase/functions/_shared/cfsync.ts";

export function Chips() {
  const { data, prog } = useApp();
  const r = data?.cf?.info.rating ?? 0, rk = rankOf(r);
  return <>
    <div className="stat" title="Day streak"><Flame />{prog?.streak() ?? 0}</div>
    <div className="stat" title="Lessons done"><span style={{ color: "#ffc800", display: "flex" }}><Icon name="bolt" /></span>{prog?.totalDone ?? 0}</div>
    <span className="rankpill">{data?.cf ? rk[1] : "Not synced"}</span>
    <div className="stat" title="Rating">{data?.cf?.info.avatar && <img className="avatar" src={data.cf.info.avatar} alt="" />}{data?.cf ? r : "—"}</div>
  </>;
}

export function RankCard() {
  const { data } = useApp();
  const r = data?.cf?.info.rating ?? 0, nx = RANKS.find(k => k[0] > r) ?? RANKS[RANKS.length - 1];
  return <div className="card"><h3>Road to Expert</h3><div className="rankbar"><i style={{ width: `${Math.min(100, r / 16)}%` }} /></div>
    <p className="muted small" style={{ margin: 0 }}>{data?.cf ? `${r} now · ${r >= 1600 ? "Expert reached 🎉" : `${1600 - r} to Expert`} · next: ${nx[1]} at ${nx[0]}` : "Waiting for the first sync"}</p></div>;
}

export function RatingChart({ cf }: { cf: CfData | null }) {
  const hist = cf?.rating || [];
  if (!hist.length) return <p className="muted">No rated contests yet. Join a live Div 4 / Div 3!</p>;
  const W = 640, H = 230, P = 30;
  const t0 = hist[0].t, t1 = Math.max(hist[hist.length - 1].t, t0 + 1), rs = hist.map(h => h.r), lo = Math.min(0, ...rs), hi = Math.max(1700, ...rs);
  const x = (t: number) => P + (t - t0) / (t1 - t0) * (W - 2 * P), y = (r: number) => H - P - (r - lo) / (hi - lo) * (H - 2 * P);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
    {RANKS.map((k, i) => { const top = Math.min(RANKS[i + 1]?.[0] ?? hi, hi); return k[0] > hi ? null : <rect key={k[1]} x={P} width={W - 2 * P} y={y(top)} height={y(k[0]) - y(top)} fill={k[2]} opacity={0.12} /> })}
    <line x1={P} x2={W - P} y1={y(1600)} y2={y(1600)} stroke="#2b5fdb" strokeDasharray="6 5" strokeWidth={2} />
    <text x={W - P} y={y(1600) - 6} textAnchor="end" fill="#2b5fdb" fontSize={12}>Expert 1600</text>
    <polyline points={hist.map(h => `${x(h.t)},${y(h.r)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" />
    {hist.map((h, i) => <circle key={i} cx={x(h.t)} cy={y(h.r)} r={4} fill="var(--card)" stroke="var(--accent)" strokeWidth={2}><title>{`${h.n}: ${h.r}`}</title></circle>)}
  </svg>;
}

export function Heatmap({ days }: { days: Map<string, number> }) {
  const cells = []; const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 7 * 26 - today.getDay());
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const c = days.get(d.toDateString()) || 0;
    cells.push(<i key={d.toDateString()} title={`${d.toDateString()}: ${c}`} style={c ? { background: "var(--ok)", opacity: Math.min(1, 0.35 + c * 0.15) } : undefined} />);
  }
  return <div className="heat">{cells}</div>;
}

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
const list = (keys: string[], cf: CfData | null, max = 6) => keys.slice(0, max).map(k => problemLabel(k, cf)).join(", ") + (keys.length > max ? ` +${keys.length - max} more` : "");

function describe(a: Activity, cf: CfData | null): [string, string] {
  const p = a.payload as { keys?: string[]; from?: number; to?: number; stage?: number; title?: string; item?: string; stuck?: string };
  switch (a.kind) {
    case "solved": return ["✅", `Solved ${p.keys?.length ?? 0}: ${list(p.keys ?? [], cf)}`];
    case "failed": return ["❌", `Tried, not accepted yet: ${list(p.keys ?? [], cf, 4)}`];
    case "rating": return ["📈", `Rating ${p.from} → ${p.to}`];
    case "unlock": return ["🔓", `Unlocked Stage ${p.stage}: ${p.title}`];
    case "proof": return ["📸", `CSES proof uploaded: ${itemTitle(p.item ?? "")}`];
    case "milestone": return ["🚩", `Marked done: ${itemTitle(p.item ?? "")}`];
    case "reflection": return ["📝", `Reflection on ${itemTitle(p.item ?? "")}${p.stuck ? ` — stuck: “${p.stuck}”` : ""}`];
    case "joined": return ["👋", "Joined Road to Expert"];
    default: return ["•", a.kind];
  }
}

export function Timeline({ items, cf, limit = 50 }: { items: Activity[]; cf: CfData | null; limit?: number }) {
  if (!items.length) return <p className="muted small">Nothing yet. Activity shows up here after each sync and every lesson she finishes.</p>;
  return <div className="tl">{items.slice(0, limit).map(a => {
    const [em, text] = describe(a, cf);
    return <div className="ev" key={a.id}><span className="em">{em}</span><div>{text}<small>{ago(a.created_at)}</small></div></div>;
  })}</div>;
}

export function ProofGallery({ proofs }: { proofs: Proof[] }) {
  const [big, setBig] = useState<string | null>(null);
  if (!proofs.length) return <p className="muted small">No CSES screenshots yet.</p>;
  return <>
    <div className="gallery">{proofs.map(p => <figure key={p.id} onClick={() => setBig(p.url)}>
      <img src={p.url} alt={`Proof for ${itemTitle(p.item_id)}`} loading="lazy" />
      <figcaption>{itemTitle(p.item_id)}<small>{ago(p.created_at)}</small></figcaption></figure>)}</div>
    {big && <div className="lightbox" onClick={() => setBig(null)}><img src={big} alt="CSES proof" /></div>}
  </>;
}
