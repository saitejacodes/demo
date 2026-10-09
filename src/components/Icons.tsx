import type { Lane } from "../data/roadmap";

const P: Record<string, string> = {
  learn: "M12 3 1 9l11 6 9-4.9V17h2V9zM5 13.2V17l7 4 7-4v-3.8L12 17z",
  drill: "M20.7 7.1 16.9 3.3 14.4 5.8l1.4 1.4-8.6 8.6-1.4-1.4L3.3 16.9l3.8 3.8 2.5-2.5-1.4-1.4 8.6-8.6 1.4 1.4z",
  rate: "m12 2 3 6.6 7 .7-5.3 4.7 1.6 7L12 17.3 5.7 21l1.6-7L2 9.3l7-.7z",
  test: "M15 1H9v2h6zm-4 13h2V8h-2zm8-6.6 1.4-1.4-1.4-1.4-1.4 1.4A9 9 0 1 0 21 13a9 9 0 0 0-2-5.6zM12 20a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  mile: "M5 21V3h2v1h12l-2 4 2 4H7v9z",
  check: "m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z",
  lock: "M17 9V7A5 5 0 0 0 7 7v2H5v13h14V9zm-8 0V7a3 3 0 0 1 6 0v2z",
  home: "M12 3 2 11h3v9h5v-6h4v6h5v-9h3z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  redo: "M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
  stats: "M4 20h16v2H4zM6 10h3v8H6zm5-6h3v14h-3zm5 9h3v5h-3z",
  user: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0z",
  eye: "M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  camera: "M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z",
};
export type IconName = keyof typeof P | Lane;
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d={P[name]} /></svg>;
}
export function Flame() {
  return <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true"><path fill="#ff9600" d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 10.5 11C10.5 7 12 2 12 2z" /><path fill="#ffc800" d="M12 13s2 1.6 2 3.4a2 2 0 0 1-4 0C10 14.6 12 13 12 13z" /></svg>;
}
export const LANE: Record<Lane, { name: string; c: string }> = {
  learn: { name: "Learn", c: "var(--learn)" }, drill: { name: "Drill", c: "var(--drill)" }, rate: { name: "Rate", c: "var(--rate)" },
  test: { name: "Test", c: "var(--test)" }, mile: { name: "Milestone", c: "var(--mile)" },
};
