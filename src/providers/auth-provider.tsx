import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { openedFromRecoveryLink, supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until we know whether someone is signed in (and have loaded their profile). */
  isLoading: boolean;
  /** True after opening a password reset link, until the new password is saved or skipped. */
  recovering: boolean;
  endRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [recovering, setRecovering] = useState(openedFromRecoveryLink);
  // Remembers which user the loaded profile belongs to, so a stale profile is never shown.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchProfile(userId)
      .then((p) => !cancelled && setLoaded({ userId, profile: p }))
      .catch(() => !cancelled && setLoaded({ userId, profile: null }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profileLoaded = !userId || loaded?.userId === userId;
  const profile = userId && loaded?.userId === userId ? loaded.profile : null;

  const refreshProfile = useCallback(async () => {
    if (userId) setLoaded({ userId, profile: await fetchProfile(userId) });
  }, [userId]);

  const endRecovery = useCallback(() => setRecovering(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      isLoading: !sessionLoaded || !profileLoaded,
      recovering,
      endRecovery,
      refreshProfile,
      signOut,
    }),
    [session, profile, sessionLoaded, profileLoaded, recovering, endRecovery, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
