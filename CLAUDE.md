# Larpy

A social study tracker for students: focus timer (with Pomodoro), streaks, a study heatmap and a feed of
posts. The name lives in `src/constants/brand.ts` and `app.json`; the local Supabase project is `larpy`.

@AGENTS.md
@docs/README.md

## Stack

- Expo (React Native) + TypeScript, Expo Router, one codebase for web, iOS and Android.
- Supabase: Postgres, auth, storage, realtime. Schema in `supabase/migrations/`.
- Web is a desktop dashboard (left rail, content, right rail); phones get bottom tabs.
- `site/` is the landing page (plain HTML/CSS/JS); `scripts/waitlist/` logs sign-ups to a Google Sheet.

## Rules that matter

- **This repo is public.** Plans, competitor notes and decision logs stay in `docs/`, which is not tracked.
  Never commit secrets: only the Supabase URL and publishable key belong in `.env`.
- **Sessions are the source of truth.** Streaks, heatmap, stats and leaderboards are all derived from
  `public.sessions`; a post made from a session reads its numbers from that session. Rollup tables are
  caches that must be rebuildable from sessions.
- **The server owns the clock.** Timer sessions are only created and changed through
  `start_session` / `pause_session` / `resume_session` / `end_session`. Never let the client write
  session times. Manual entries are `source = 'manual'` and don't count toward rankings.
- **Days are local.** Streak and daily totals use the user's `time_zone`, not UTC.
- **Every table gets row-level security** in the same migration that creates it, plus coverage in
  `supabase/tests/db.test.mjs`. Run `npm run test:db` after any migration change, then `npm run db:types`.
- Use the theme in `src/theme/` and UI pieces in `src/components/ui/` — no hard-coded colors.

## Working agreements

- Don't commit or create branches unless asked.
- Design comes from the designer's `test-update-ui` branch. To bring it in, merge that branch into `main`
  (keep all functionality on conflicts), then restyle any `main`-only screens to match. Don't edit
  `test-update-ui` directly.
- Checks before calling a task done: `npx tsc --noEmit`, `npx expo lint`, `npm run test:db`.
