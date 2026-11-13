// Turns Supabase / Postgres errors into messages people can act on.

type MaybeError = { message?: string; code?: string; status?: number } | null | undefined;

/** Supabase Auth error codes (`error.code`) and what to tell people. */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match.',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  email_address_invalid: 'That email address doesn’t look right. Check it and try again.',
  email_address_not_authorized: 'We can’t send email to this address yet. Try a different email.',
  weak_password: 'That password is too easy to guess. Use at least 6 characters, mixing letters and numbers.',
  same_password: 'That’s your current password. Choose a new one.',
  signup_disabled: 'New accounts are closed right now. Try again later.',
  user_banned: 'This account has been suspended.',
  otp_expired: 'That email link has expired or was already used. Request a new one.',
  session_not_found: 'You’ve been signed out. Sign in again.',
  session_expired: 'You’ve been signed out. Sign in again.',
  refresh_token_not_found: 'You’ve been signed out. Sign in again.',
  refresh_token_already_used: 'You’ve been signed out. Sign in again.',
  // The whole project can only send so many emails an hour (a few, on Supabase's built-in sender).
  over_email_send_rate_limit: 'We’ve sent too many emails in the last hour. Try again in a little while.',
  over_request_rate_limit: 'Too many attempts from this device. Wait a few minutes and try again.',
  request_timeout: 'The server took too long to answer. Try again.',
};

export function friendlyError(error: MaybeError, fallback = 'Something went wrong. Try again.') {
  if (!error) return fallback;
  const message = error.message ?? '';

  // "For security purposes, you can only request this after 42 seconds." Comes before the code check because
  // it shares a rate-limit code with the hourly cap, but tells you exactly how long to wait.
  const wait = /only request this after (\d+) seconds?/i.exec(message);
  if (wait) return `You just asked for an email. Wait ${wait[1]} seconds, then try again.`;

  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];

  // Older servers send no code, only the message.
  if (/invalid login credentials/i.test(message)) return AUTH_MESSAGES.invalid_credentials;
  if (/email not confirmed/i.test(message)) return AUTH_MESSAGES.email_not_confirmed;
  if (/user already registered/i.test(message)) return AUTH_MESSAGES.user_already_exists;
  if (/password should be at least/i.test(message)) return 'Use a password with at least 6 characters.';
  if (/should be different from the old password/i.test(message)) return AUTH_MESSAGES.same_password;
  if (/email rate limit/i.test(message)) return AUTH_MESSAGES.over_email_send_rate_limit;
  if (/rate limit/i.test(message) || error.status === 429) return AUTH_MESSAGES.over_request_rate_limit;
  if (/network|fetch/i.test(message)) return 'Can’t reach the server. Check your connection.';
  if (error.status && error.status >= 500) return 'The server ran into a problem. Try again in a moment.';

  return message || fallback;
}

/** Postgres unique-violation code, e.g. a taken username. */
export const UNIQUE_VIOLATION = '23505';
