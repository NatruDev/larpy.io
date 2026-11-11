# Larpy

A social study tracker: focus timers, a study heatmap, streaks, and (later) friends, leagues and Wrapped.

Built with Expo (React Native) and Supabase. Day-to-day development happens in the browser; the same code runs on iPhone and Android through Expo Go.

## Run it

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npm run web            # opens the app in your browser
```

To try it on a phone, run `npx expo start`, install **Expo Go**, and scan the QR code.

## Deploy the web app (Vercel)

`vercel.json` builds the web app with `npx expo export --platform web` and serves `dist/`, sending every
path to the app. Import the GitHub repo on vercel.com (or run `npx vercel`), then add
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project settings (Production
and Preview) and redeploy. They're built into the app, so a change needs a new build; without them the app
stops with a "Supabase is not configured" error. In Supabase, set Authentication → URL Configuration → Site URL
to the site's address and add it to Redirect URLs.

## Landing page and waitlist

`site/` is the marketing page: plain HTML, CSS and JS, no build step. Preview it with
`python -m http.server 8940 --directory site`. Deploy it as a second Vercel project from this repo with
**Root Directory** set to `site` (framework preset "Other", no build command). Settings live at the top of
`site/main.js`: the waitlist URL, the app's URL (shows the "use the timer now" links) and social links.
Sign-ups go to a Google Sheet; setup is in [scripts/waitlist/README.md](scripts/waitlist/README.md).

## Run everything locally (no hosted Supabase)

Needs Docker Desktop running.

```bash
npx supabase start     # local Supabase; applies supabase/migrations automatically
npm run db:seed        # optional: demo accounts with a year of data (see supabase/seed.sql)
npm run web
```

`npm run db:seed` replaces only the demo accounts (`*@larpy.test`) and keeps your own.
`npx supabase db reset` rebuilds the local database from the migrations and loads the seed, and **wipes
everything else**, including your own local account.

`.env.local` points the app at the local server (`http://127.0.0.1:54321`) and overrides `.env`. Delete it to use your hosted project. Local tools: database browser at http://127.0.0.1:54323, test inbox at http://127.0.0.1:54324. Stop with `npx supabase stop`.

## Database

The schema lives in `supabase/migrations/`. Apply it to your hosted Supabase project with either:

- **SQL editor:** paste each migration file (oldest first) into the Supabase dashboard's SQL Editor and run it, or
- **CLI:** `npx supabase login`, `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push`.

`npm run test:db` runs the migrations in an in-memory Postgres and checks the security rules (who can see and change what). Run it after changing a migration.

`npm run db:types` regenerates `src/lib/database.types.ts` from the local database. Run it after changing a migration and commit the result with it. What the app can read and call, screen by screen, is in [docs/api.md](docs/api.md).

Timer sessions can only be started, paused and ended through database functions (`start_session`, `pause_session`, `resume_session`, `end_session`), which use the server clock. The app can't write session times directly. That keeps leaderboards honest.

## Where things live

| Path | What's in it |
|---|---|
| `src/app/` | Screens. Every file is a route (Expo Router). `sign-in`, `onboarding`, `(tabs)/` (Home, Focus, Stats, Ranks, Profile) for the signed-in app, `session` (the running timer and summary) and `u/[username]` (someone's profile). |
| `src/components/shell/` | The app frame: left rail and right rail on wide screens, bottom bar on phones. |
| `src/components/stats/` | Streak card, year heatmap, week bars, subject breakdown, recent sessions. |
| `src/components/celebrate/`, `src/components/share/`, `src/components/reminders/` | End-of-session celebration, share cards and share sheet, reminder ask and settings. |
| `src/components/feed/`, `src/components/profile/` | Post card (timeline bar, goal chip, photos, Respect), post list, composer, photo picker, profile view. |
| `src/hooks/` | Shared hooks, e.g. `useBreakpoint` (phone / tablet / desktop by window width), `useServerNow`. |
| `src/features/` | Feature logic kept out of screens, e.g. `timer/engine.ts` (pure timer math: rounds, breaks, time left), `stats/` (data hooks, date helpers), `feed/` (feed paging, posting, photo upload, Respect), `profile/` (profile pages, follow, block), `celebrate/` (what a finished session earned), `share/` (turning a card into an image) and `reminders/` (local study reminders, phones only). |
| `src/components/ui/` | Shared building blocks: `Screen`, `Text`, `Button` (flat pill), `Card`, `TextField`, `Chip`. |
| `src/theme/` | Colors (near-black neutrals, selectable accent (default Coral), named hues), Inter type styles, spacing. Use these instead of hard-coded colors. |
| `src/providers/` | App-wide state: who is signed in, and the running focus session (synced across devices). |
| `src/lib/` | Supabase client, generated database types (`database.types.ts`) and short names for them (`types.ts`), error messages. |
| `src/constants/brand.ts` | The app name. |
| `supabase/` | Migrations, demo data (`seed.sql`), database tests, local CLI config. |
| `site/`, `scripts/waitlist/` | The landing page, and the Apps Script that logs waitlist sign-ups to a Google Sheet. |

## Renaming the app

The name may change. Update `src/constants/brand.ts`, then `name`, `slug` and `scheme` in `app.json`.

## Checks

```bash
npx tsc --noEmit   # type check
npx expo lint      # lint
npm run test:db    # database rules
```
