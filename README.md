# Road to Expert

A Duolingo-style roadmap from Codeforces 0 → Expert (1600), tracked from real submissions.
One lesson opens at a time; a stage unlocks only when the previous one is finished.

- **Student**: map, lessons, CSES screenshot proofs, contest reflections, upsolve queue, stats.
- **Parent**: overview of a linked student — current lesson, weekly numbers, activity timeline, every CSES screenshot, rating.
- **Auto-tracking**: CP-31 (372 problems), Div 3/4 checkpoints, rating, streak, upsolves from the public Codeforces API;
  Assiut group sheets with the student's own Codeforces API key (read server-side).

Stack: React + TypeScript + Vite, Motion, Supabase (auth, Postgres with row-level security, Storage, Edge Functions, pg_cron).

## Run locally

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in **demo mode**: accounts and data live in that browser only.

## Connect Supabase (cloud save)

1. **Database** — Supabase dashboard → SQL Editor → paste and run `supabase/migrations/20261009000000_init.sql`.
2. **Keys** — copy `.env.example` to `.env.local` and fill in the Project URL and the anon/publishable key
   (dashboard → Project Settings → API). Restart `npm run dev`.
3. **Auth** — Authentication → URL Configuration: set Site URL to where the app runs (e.g. `http://localhost:5173`, later the Vercel URL).
4. **Server sync** (needed for Assiut sheets and scheduled syncs):
   ```bash
   npx supabase login
   npx supabase functions deploy sync --project-ref <project-ref> --use-api
   ```
5. **Schedule** — SQL Editor → run `supabase/migrations/20261009000100_schedule.sql` (replace the project URL in it).
   It enables pg_cron + pg_net, keeps a random secret in Supabase Vault, and calls the function every 3 hours.

## Deploy (Vercel)

Import the repo in Vercel, framework "Vite", add the two `VITE_SUPABASE_*` environment variables, deploy.
`vercel.json` routes every path to the app. Then add the Vercel URL as the Site URL in Supabase Auth.

## Editing the roadmap

All content is in `src/data/roadmap.ts`. Lesson ids are `lane:title`, so renaming a lesson resets its manual progress.
Unlock rules are `UNLOCK_AT` and `SHEET_DONE` in `src/lib/progress.ts`.
