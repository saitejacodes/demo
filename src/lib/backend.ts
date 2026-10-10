import type { CfData } from "../../supabase/functions/_shared/cfsync.ts";
import { createLocalBackend } from "./localBackend";
import { createCloudBackend } from "./cloudBackend";

export type Role = "student" | "parent";
export interface Profile {
  id: string; role: Role; display_name: string; cf_handle: string | null;
  invite_code: string | null; unlocked_stage: number;
}
export type ActivityKind = "solved" | "failed" | "rating" | "unlock" | "proof" | "milestone" | "reflection" | "joined";
export interface Activity { id: string | number; kind: ActivityKind; payload: Record<string, unknown>; created_at: string }
export interface Proof { id: string; item_id: string; url: string; created_at: string }
export interface StudentData {
  profile: Profile;
  manual: Record<string, string>;                       // item id -> done timestamp (CSES + milestones)
  reflections: Record<string, Record<string, string>>;  // item id -> answers
  proofs: Proof[];
  activity: Activity[];
  cf: CfData | null;
  hasSecret: boolean;
}

export interface Backend {
  mode: "local" | "cloud";
  currentUserId(): Promise<string | null>;
  onAuthChange(cb: () => void): () => void;
  signUp(email: string, password: string, name: string, role: Role): Promise<{ needsConfirm: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  myProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Pick<Profile, "display_name" | "cf_handle" | "unlocked_stage">>): Promise<void>;
  linkStudent(code: string): Promise<void>;
  myStudents(): Promise<Profile[]>;
  load(studentId: string): Promise<StudentData>;
  setManual(itemId: string, done: boolean): Promise<void>;
  saveReflection(itemId: string, answers: Record<string, string>): Promise<void>;
  uploadProof(itemId: string, image: Blob): Promise<void>;
  log(kind: ActivityKind, payload: Record<string, unknown>): Promise<void>;
  setSecret(key: string, secret: string): Promise<void>;
  clearSecret(): Promise<void>;
  sync(studentId: string, onProgress?: (msg: string) => void): Promise<void>;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// "Try the demo" runs the in-browser backend with everything unlocked, even when Supabase is configured.
export const isDemo = (() => { try { return localStorage.getItem("rte-app:demo") === "1" } catch { return false } })();
export const setDemo = (on: boolean) => { try { on ? localStorage.setItem("rte-app:demo", "1") : localStorage.removeItem("rte-app:demo") } catch { /* private mode */ } };
export const backend: Backend = !isDemo && url && anon ? createCloudBackend(url, anon) : createLocalBackend();

// Screenshots are shrunk before upload: max 1400px, JPEG — keeps storage tiny and uploads fast.
export async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Could not read image")), "image/jpeg", 0.82));
}
