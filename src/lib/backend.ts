// Which backend the app talks to.
//
// Local mode keeps everything on this device (localStorage on the web, device storage on phones): no
// accounts, no feed, but the timer, stats, streaks and share cards all work. It's on when
// EXPO_PUBLIC_LOCAL_MODE=true, or when no Supabase project is configured (the hosted web build until the
// database goes live). With Supabase configured, the app uses it as normal.
export const LOCAL_MODE =
  process.env.EXPO_PUBLIC_LOCAL_MODE === 'true' ||
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
