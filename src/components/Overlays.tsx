import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useApp } from "../state/AppContext";

export function Modal({ open, onClose, wide, children }: { open: boolean; onClose(): void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && <>
        <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <div className="modalwrap">
          <motion.div className={`sheet ${wide ? "wide" : ""}`} role="dialog" aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}>
            {children}
          </motion.div>
        </div>
      </>}
    </AnimatePresence>
  );
}

export function Toast() {
  const { toastMsg, syncMsg } = useApp();
  const msg = toastMsg || syncMsg;
  return (
    <AnimatePresence>
      {msg && <motion.div key="t" className="toast" initial={{ opacity: 0, y: -16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -16, x: "-50%" }}>{msg}</motion.div>}
    </AnimatePresence>
  );
}

export function Celebration() {
  const { celebration: c, dismissCelebration } = useApp();
  return (
    <AnimatePresence>
      {c && <motion.div className="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={dismissCelebration}>
        <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 64 }}>{c.emoji}</div><h2>{c.title}</h2><p className="muted">{c.text}</p>
          <button className="btn" onClick={dismissCelebration}>Continue</button>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}
