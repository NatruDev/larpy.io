import { createContext, useContext } from 'react';

import type { Session, SessionPause, Subject } from '@/lib/types';

export type SessionWithSubject = Session & { subject: Pick<Subject, 'id' | 'name' | 'color'> | null };

export type StartOptions = {
  subject: Pick<Subject, 'id' | 'name' | 'color'> | null;
  goalMinutes: number | null;
  focusMinutes: number | null;
  breakMinutes: number | null;
  isPrivate: boolean;
};

export type ActiveSessionState = {
  /** The signed-in user's running session, if any (on any device). */
  session: SessionWithSubject | null;
  pauses: SessionPause[];
  isLoading: boolean;
  /** Server clock minus this device's clock, in ms. Add it to Date.now() for server time. */
  offsetMs: number;
  busy: boolean;
  error: string | null;
  /** The last session this device saw finish, for the summary screen. */
  lastEnded: SessionWithSubject | null;
  /** Goes up whenever a session ends or is discarded; stats screens refetch when it changes. */
  statsVersion: number;
  start: (options: StartOptions) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  discard: () => Promise<void>;
  dismissEnded: () => void;
  clearError: () => void;
};

/** Shared by the Supabase provider and the local-mode one, so every screen reads the timer the same way. */
export const ActiveSessionContext = createContext<ActiveSessionState | null>(null);

export function useActiveSession() {
  const value = useContext(ActiveSessionContext);
  if (!value) throw new Error('useActiveSession must be used inside <ActiveSessionProvider>.');
  return value;
}
