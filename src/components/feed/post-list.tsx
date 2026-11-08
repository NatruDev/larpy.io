import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { Feed } from '@/features/feed/use-feed';
import { useAuth } from '@/providers/auth-provider';
import { Spacing } from '@/theme';

import { PostCard } from './post-card';

type Props = {
  feed: Feed;
  /** Shown when there are no posts at all. */
  empty: ReactNode;
};

/** The posts of a feed, then "Load more" until the end. */
export function PostList({ feed, empty }: Props) {
  const { session } = useAuth();
  const me = session?.user.id;

  if (!feed.items) {
    return feed.error ? <Text color="danger">{feed.error}</Text> : <Text color="textMuted">Loading posts…</Text>;
  }
  if (feed.items.length === 0) return <>{empty}</>;

  return (
    <View style={styles.list}>
      {feed.error ? (
        <Text variant="caption" color="danger">
          {feed.error}
        </Text>
      ) : null}
      {feed.items.map((item) => (
        <PostCard key={item.post.id} item={item} isMine={item.post.author_id === me} onToggleRespect={feed.toggleRespect} />
      ))}
      {feed.done ? (
        <Text variant="caption" color="textMuted" style={styles.end}>
          You’re all caught up.
        </Text>
      ) : (
        <Button
          label={feed.loadingMore ? 'Loading…' : 'Load more'}
          variant="secondary"
          onPress={feed.loadMore}
          disabled={feed.loadingMore}
        />
      )}
    </View>
  );
}

/** A friendly empty state for feeds. */
export function EmptyFeed({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <Text color="textMuted">{body}</Text>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.lg },
  end: { textAlign: 'center', paddingVertical: Spacing.sm },
});
