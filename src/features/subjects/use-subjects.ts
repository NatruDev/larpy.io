import { useEffect, useState } from 'react';

import { getLocalSubjects, localReady } from '@/features/local/local-store';
import { LOCAL_MODE } from '@/lib/backend';
import { supabase } from '@/lib/supabase';
import type { Subject } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

/** The signed-in user's active (not archived) subjects, oldest first. */
export function useSubjects() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [result, setResult] = useState<{ userId: string; subjects: Subject[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    if (LOCAL_MODE) {
      localReady().then(() => {
        if (!cancelled) setResult({ userId, subjects: getLocalSubjects() });
      });
      return () => {
        cancelled = true;
      };
    }
    supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at')
      .then(({ data }) => {
        if (!cancelled) setResult({ userId, subjects: (data as Subject[] | null) ?? [] });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = result && result.userId === userId ? result : null;
  return { subjects: current?.subjects ?? [], isLoading: !current };
}
