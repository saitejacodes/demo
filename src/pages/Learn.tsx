import { useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { STAGES } from "../data/roadmap";
import { useApp } from "../state/AppContext";
import { Journey, StagePath } from "../components/Map";
import { LessonModal, StageGuide } from "../components/LessonModals";

export function Learn() {
  const { prog, data, readOnly, toast } = useApp();
  const params = useParams(), [query, setQuery] = useSearchParams();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<number | null>(null);
  if (!data || !prog) return <EmptyState />;
  const cur = prog.current;
  const want = params.stage === undefined ? cur : Number(params.stage);
  if (Number.isNaN(want) || want > cur || want < 0) return <Navigate to={`/learn/${cur}`} replace />;
  const sel = want, s = STAGES[sel], p = prog.stageProg(s);
  const lesson = query.get("lesson"), at = lesson !== null && prog.itemOpen(sel, +lesson) ? { si: sel, ii: +lesson } : null;
  const who = readOnly ? (data.profile.display_name || "She") : "you";

  const lockedStage = () => { const c = STAGES[cur].items[prog.nextItem(cur) ?? 0]; toast(`🔒 Locked. Finish Stage ${cur} first — next: “${c.title}”`) };
  const lockedLesson = () => { const n = prog.nextItem(sel); if (n !== null) toast(`🔒 Locked. Finish “${s.items[n].title}” first`) };
  const openLesson = (ii: number) => { setGuide(null); setQuery({ lesson: String(ii) }) };

  return <>
    <Journey prog={prog} sel={sel} onSelect={si => navigate(`/learn/${si}`)} onLocked={lockedStage} />
    <div className="unit" style={{ background: s.color }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="eyebrow">Stage {sel} · {s.weeks} · target {s.exp}</p><h2>{s.title}</h2><p>{s.theme}</p>
        <div className="bar"><i style={{ width: `${Math.round(p.p * 100)}%` }} /></div>
        <p style={{ fontSize: 13 }}>{p.d}/{p.n} done{sel === cur && sel < STAGES.length - 1 ? ` · ${p.n - p.d} more for ${who} to unlock Stage ${sel + 1}` : sel < cur ? " · completed" : ""}</p>
      </div>
      <button className="guide" onClick={() => setGuide(sel)}>📖 Guide</button>
    </div>
    <StagePath key={sel} prog={prog} si={sel} onOpen={openLesson} onLocked={lockedLesson} />
    <LessonModal at={at} onClose={() => setQuery({})} />
    <StageGuide si={guide} onClose={() => setGuide(null)} onOpen={openLesson} />
  </>;
}

export function EmptyState() {
  const { me, viewing } = useApp();
  if (me?.role === "parent" && !viewing) return <Navigate to="/parent" replace />;
  return <p className="muted" style={{ marginTop: 40 }}>Loading…</p>;
}
