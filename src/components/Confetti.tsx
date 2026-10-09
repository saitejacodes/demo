import { useEffect, useRef } from "react";

interface Part { x: number; y: number; vx: number; vy: number; r: number; s: number; c: string; life: number }
let canvas: HTMLCanvasElement | null = null;
let parts: Part[] = [];
const COLORS = ["#58cc02", "#ffc800", "#1cb0f6", "#ff4b4b", "#ce82ff", "#ff9600"];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function frame() {
  if (!canvas) return;
  const ctx = canvas.getContext("2d")!, dpr = devicePixelRatio;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of parts) {
    p.vy += 0.7 * dpr; p.vx *= 0.98; p.x += p.vx; p.y += p.vy; p.r += 0.2; p.life--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
  }
  parts = parts.filter(p => p.life > 0 && p.y < canvas!.height + 50);
  if (parts.length) requestAnimationFrame(frame); else ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function burst(n = 120) {
  if (!canvas || reduced()) return;
  const dpr = devicePixelRatio, start = parts.length === 0;
  for (let i = 0; i < n; i++) parts.push({
    x: canvas.width / 2, y: canvas.height * 0.45, vx: (Math.random() - 0.5) * 22 * dpr, vy: (-Math.random() * 22 - 6) * dpr,
    r: Math.random() * Math.PI, s: (6 + Math.random() * 6) * dpr, c: COLORS[i % COLORS.length], life: 120,
  });
  if (start) requestAnimationFrame(frame);
}

let actx: AudioContext | null = null;
export function ding() {
  actx ||= new AudioContext();
  [523, 659, 784].forEach((f, i) => {
    const o = actx!.createOscillator(), g = actx!.createGain(), t = actx!.currentTime + i * 0.09;
    o.frequency.value = f; o.type = "triangle";
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(actx!.destination); o.start(t); o.stop(t + 0.3);
  });
}

export function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    canvas = ref.current;
    const size = () => { if (canvas) { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio } };
    size(); addEventListener("resize", size);
    return () => removeEventListener("resize", size);
  }, []);
  return <canvas ref={ref} className="fx" />;
}
