import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getLocalProfile, LOCAL_USER_ID, localReady } from '@/features/local/local-store';
import { LOCAL_MODE } from '@/lib/backend';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until we know whether someone is signed in (and have loaded their profile). */
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data as Profile;
}

/** Uses Supabase accounts, or in local mode one profile kept on this device. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return LOCAL_MODE ? <LocalAuthProvider>{children}</LocalAuthProvider> : <RemoteAuthProvider>{children}</RemoteAuthProvider>;
}

// Local mode has no sign-in: there is always one "signed in" user, and the profile exists once onboarding
// is done. Only `user.id` is read from the session, so a minimal stand-in is enough.
const LOCAL_SESSION = { user: { id: LOCAL_USER_ID, email: undefined } } as unknown as Session;

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    localReady().then(() => {
      setProfile(getLocalProfile());
      setLoaded(true);
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    await localReady();
    setProfile(getLocalProfile());
  }, []);

  // There is no account to sign out of; this clears the profile so onboarding shows again.
  const signOut = useCallback(async () => {
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session: LOCAL_SESSION, profile, isLoading: !loaded, refreshProfile, signOut }),
    [profile, loaded, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function RemoteAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Remembers which user the loaded profile belongs to, so a stale profile is never shown.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      isLoading: !sessionLoaded || !profileLoaded,
      refreshProfile,
      signOut,
    }),
    [session, profile, sessionLoaded, profileLoaded, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
