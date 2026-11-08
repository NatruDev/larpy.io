// Turns Supabase / Postgres errors into messages people can act on.

type MaybeError = { message?: string; code?: string; status?: number } | null | undefined;

export function friendlyError(error: MaybeError, fallback = 'Something went wrong. Try again.') {
  if (!error) return fallback;
  const message = error.message ?? '';

  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox for the link.';
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Use a password with at least 6 characters.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/network|fetch/i.test(message)) return 'Can’t reach the server. Check your connection.';

  return message || fallback;
}

/** Postgres unique-violation code, e.g. a taken username. */
export const UNIQUE_VIOLATION = '23505';
