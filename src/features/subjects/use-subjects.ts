import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Subject } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { SubjectColors } from '@/theme';

/** Matches the length check on `subjects.name`. */
export const MAX_SUBJECT_LENGTH = 40;

/** The first palette color none of these subjects use yet, cycling once all are taken. */
function nextColor(subjects: Pick<Subject, 'color'>[]) {
  const used = new Set(subjects.map((s) => s.color.toLowerCase()));
  return SubjectColors.find((c) => !used.has(c.toLowerCase())) ?? SubjectColors[subjects.length % SubjectColors.length];
}

/** The signed-in user's active (not archived) subjects, oldest first, and a way to add one. */
export function useSubjects() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [result, setResult] = useState<{ userId: string; subjects: Subject[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
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
  const subjects = current?.subjects ?? [];

  /**
   * Adds a subject with the next unused color and returns it. A name you already have (any capitalization)
   * returns the existing subject instead of a duplicate, which the database would reject anyway.
   */
  async function addSubject(rawName: string): Promise<Subject> {
    const name = rawName.trim().slice(0, MAX_SUBJECT_LENGTH).trim();
    if (!userId) throw new Error('Sign in to add subjects.');
    if (!name) throw new Error('Give the subject a name.');

    const existing = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const { data, error } = await supabase
      .from('subjects')
      .insert({ name, color: nextColor(subjects) })
      .select('*')
      .single();
    if (error) throw error;

    const added = data as Subject;
    setResult((prev) => (prev && prev.userId === userId ? { userId, subjects: [...prev.subjects, added] } : prev));
    return added;
  }

  return { subjects, isLoading: !current, addSubject };
}
