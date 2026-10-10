import { backend } from "./backend";

// Demo mode: a throwaway student kept in this browser, with setup skipped so every stage and lesson is open.
// A public handle gives the map real submissions to show.
const EMAIL = "demo@demo.local", PW = "demo-mode-only-" + "0000";
export async function ensureDemoSession() {
  if (await backend.currentUserId()) return;
  try { await backend.signIn(EMAIL, PW) }
  catch {
    await backend.signUp(EMAIL, PW, "Demo Student", "student");
    await backend.updateProfile({ cf_handle: "tourist" });
    await backend.setManual("setup:done", true);
  }
}
