import { useCallback, useEffect, useState } from 'react';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

import { onPostsChanged } from './events';
import { signMediaUrls } from './media';
import { setRespect } from './posts';

export type FeedScope = 'following' | 'global';

type Media = FeedItem['media'][number];
/** A feed item with signed links for its files. */
export type FeedPost = Omit<FeedItem, 'media'> & {
  media: (Media & { url: string | null; thumbnail_url: string | null })[];
};

const PAGE_SIZE = 20;

async function fetchPage(scope: FeedScope, authorId: string | null, before?: FeedItem['post']) {
  const { data, error } = await supabase.rpc('get_feed', {
    p_scope: scope,
    p_author_id: authorId ?? undefined,
    p_before_at: before?.created_at,
    p_before_id: before?.id,
    p_limit: PAGE_SIZE,
  });
  if (error) throw error;
  const items = data as unknown as FeedItem[];
  const paths = items.flatMap((i) => i.media.flatMap((m) => [m.path, m.thumbnail_path].filter((p): p is string => !!p)));
  const urls = await signMediaUrls(paths);
  return items.map<FeedPost>((i) => ({
    ...i,
    media: i.media.map((m) => ({
      ...m,
      url: urls.get(m.path) ?? null,
      thumbnail_url: m.thumbnail_path ? (urls.get(m.thumbnail_path) ?? null) : null,
    })),
  }));
}

function dedupe(items: FeedPost[]) {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.post.id) ? false : (seen.add(i.post.id), true)));
}

type Options = {
  scope: FeedScope;
  /** One person's posts (a profile page). */
  authorId?: string | null;
  /** Wait for something before loading, e.g. the profile's id. */
  enabled?: boolean;
};

/**
 * A feed, 20 posts at a time. Reloads when any post is created or deleted in the app. Keeps showing the
 * current posts while a reload is in flight.
 */
export function useFeed({ scope, authorId = null, enabled = true }: Options) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const key = `${scope}|${authorId ?? ''}`;
  const [reloads, setReloads] = useState(0);
  const token = `${key}|${reloads}`;
  const [state, setState] = useState<{ key: string; token: string; items: FeedPost[]; done: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => onPostsChanged(() => setReloads((n) => n + 1)), []);

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    fetchPage(scope, authorId).then(
      (items) => {
        if (cancelled) return;
        setState({ key, token, items, done: items.length < PAGE_SIZE });
        setError(null);
      },
      (e) => {
        if (!cancelled) setError(friendlyError(e));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, scope, authorId, key, token]);

  const current = state?.key === key ? state : null;

  const loadMore = useCallback(async () => {
    if (!current || current.done || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(scope, authorId, current.items.at(-1)?.post);
      setState((prev) =>
        prev && prev.key === key
          ? { ...prev, items: dedupe([...prev.items, ...page]), done: page.length < PAGE_SIZE }
          : prev
      );
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setLoadingMore(false);
    }
  }, [current, loadingMore, scope, authorId, key]);

  const patch = useCallback((postId: string, change: (item: FeedPost) => FeedPost) => {
    setState((prev) => prev && { ...prev, items: prev.items.map((i) => (i.post.id === postId ? change(i) : i)) });
  }, []);

  /** Shows the change straight away, then undoes it if the server says no. */
  const toggleRespect = useCallback(
    async (item: FeedPost) => {
      if (!userId) return;
      const on = !item.reacted_by_me;
      const id = item.post.id;
      patch(id, (i) => ({ ...i, reacted_by_me: on, reaction_count: i.reaction_count + (on ? 1 : -1) }));
      try {
        await setRespect(id, userId, on);
      } catch (e) {
        patch(id, (i) => ({ ...i, reacted_by_me: !on, reaction_count: i.reaction_count + (on ? -1 : 1) }));
        setError(friendlyError(e as Error));
      }
    },
    [patch, userId]
  );

  return {
    /** Null until the first page arrives. */
    items: current?.items ?? null,
    done: current?.done ?? false,
    refreshing: !!current && current.token !== token,
    loadingMore,
    error,
    loadMore,
    refresh: useCallback(() => setReloads((n) => n + 1), []),
    toggleRespect,
  };
}

export type Feed = ReturnType<typeof useFeed>;
