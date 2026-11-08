import { useCallback, useEffect, useState } from 'react';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { ProfilePage } from '@/lib/types';

/** Someone's profile page by username. `profile` is null when nobody has that username. */
export function useProfilePage(username: string | null | undefined) {
  const [reloads, setReloads] = useState(0);
  const token = `${username}|${reloads}`;
  const [state, setState] = useState<{ username: string; token: string; data: ProfilePage | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    supabase.rpc('get_profile', { p_username: username }).then(({ data, error: loadError }) => {
      if (cancelled) return;
      if (loadError) {
        setError(friendlyError(loadError));
        return;
      }
      setError(null);
      setState({ username, token, data: (data as unknown as ProfilePage | null) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [username, token]);

  const current = state && state.username === username ? state : null;
  return {
    profile: current?.data ?? null,
    isLoading: !current,
    error,
    reload: useCallback(() => setReloads((n) => n + 1), []),
  };
}

export async function setFollowing(me: string, them: string, on: boolean) {
  const { error } = on
    ? await supabase.from('follows').insert({ follower_id: me, followee_id: them })
    : await supabase.from('follows').delete().eq('follower_id', me).eq('followee_id', them);
  if (error) throw error;
}

export async function setBlocked(me: string, them: string, on: boolean) {
  const { error } = on
    ? await supabase.from('blocks').insert({ blocked_id: them })
    : await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', them);
  if (error) throw error;
}
