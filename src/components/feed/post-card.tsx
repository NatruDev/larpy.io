import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { deletePost } from '@/features/feed/posts';
import type { FeedPost } from '@/features/feed/use-feed';
import { friendlyError } from '@/lib/errors';
import { formatDuration, formatGoal, formatTimeAgo } from '@/lib/format';
import { Fonts, Radius, Spacing, subjectColor, useTheme, withAlpha } from '@/theme';

import { Avatar } from './avatar';
import { TimelineBar } from './timeline-bar';

type Props = {
  item: FeedPost;
  isMine: boolean;
  onToggleRespect: (item: FeedPost) => void;
};

export function PostCard({ item, isMine, onToggleRespect }: Props) {
  const { post, author, session } = item;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();

  async function remove() {
    setDeleting(true);
    try {
      await deletePost(post.id);
    } catch (e) {
      setError(friendlyError(e as Error));
      setDeleting(false);
    }
  }

  const openAuthor = () =>
    author.username && router.push({ pathname: '/u/[username]', params: { username: author.username } });

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${author.display_name || author.username}'s profile`}
          onPress={openAuthor}
          style={styles.author}>
          <Avatar name={author.display_name} username={author.username} url={author.avatar_url} />
          <View style={styles.authorText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {author.display_name || author.username}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              @{author.username} · {formatTimeAgo(post.created_at)}
              {post.edited_at ? ' · edited' : ''}
            </Text>
          </View>
        </Pressable>
        {isMine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            onPress={() => setConfirmingDelete((v) => !v)}
            hitSlop={8}
            style={styles.menu}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {session ? <SessionBlock session={session} /> : null}
      {post.caption ? <Text>{post.caption}</Text> : null}
      {item.media.length ? <MediaGrid media={item.media} /> : null}

      <View style={styles.footer}>
        <RespectButton count={item.reaction_count} active={item.reacted_by_me} onPress={() => onToggleRespect(item)} />
      </View>

      {confirmingDelete ? (
        <View style={[styles.confirm, { borderTopColor: colors.border }]}>
          <Text variant="label">
            Delete this post?{session ? ' The session stays in your stats.' : ''}
          </Text>
          <View style={styles.confirmButtons}>
            <Button label="Keep it" variant="secondary" onPress={() => setConfirmingDelete(false)} style={styles.grow} />
            <Button label={deleting ? 'Deleting…' : 'Delete'} onPress={remove} disabled={deleting} style={styles.grow} />
          </View>
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function SessionBlock({ session }: { session: NonNullable<FeedPost['session']> }) {
  const { colors, scheme } = useTheme();
  const focused = session.focused_seconds ?? 0;
  const color = subjectColor(session.subject?.color, scheme, colors.accent);
  const goal = session.goal_minutes;
  const goalText = goal
    ? focused >= goal * 60
      ? `Hit ${formatGoal(goal)} goal`
      : `${Math.floor((focused / (goal * 60)) * 100)}% of ${formatGoal(goal)} goal`
    : null;

  return (
    <View style={styles.session}>
      <View style={styles.chips}>
        <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.16) }]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text variant="label">{session.subject?.name ?? 'No subject'}</Text>
        </View>
        {session.pomodoro_focus_minutes ? (
          <Text variant="caption" color="textMuted">
            Pomodoro {session.pomodoro_focus_minutes}/{session.pomodoro_break_minutes}
          </Text>
        ) : null}
      </View>
      <View style={styles.stats}>
        <Text style={[styles.duration, { color: colors.text }]}>{formatDuration(focused)}</Text>
        {goalText ? (
          <View style={[styles.goal, { backgroundColor: colors.accentSoft }]}>
            {goal && focused >= goal * 60 ? <Ionicons name="checkmark-circle" size={14} color={colors.accentText} /> : null}
            <Text variant="label" color="accentText">
              {goalText}
            </Text>
          </View>
        ) : null}
      </View>
      {session.ended_at ? (
        <TimelineBar startedAt={session.started_at} endedAt={session.ended_at} pauses={session.pauses} color={color} />
      ) : null}
    </View>
  );
}

function MediaGrid({ media }: { media: FeedPost['media'] }) {
  const { colors } = useTheme();
  const single = media.length === 1;

  return (
    <View style={styles.grid}>
      {media.map((m) => {
        const ratio = single && m.width && m.height ? Math.min(1.8, Math.max(0.75, m.width / m.height)) : 1;
        const source = m.kind === 'timelapse' ? m.thumbnail_url : m.url;
        return (
          <View
            key={m.id}
            style={[styles.tile, single ? styles.tileFull : styles.tileHalf, { aspectRatio: ratio, backgroundColor: colors.border }]}>
            {source ? (
              <Image source={{ uri: source }} style={styles.fill} contentFit="cover" accessibilityLabel="Post photo" />
            ) : null}
            {m.kind === 'timelapse' ? (
              <View style={[styles.badge, { backgroundColor: colors.text }]}>
                <Ionicons name="play" size={12} color={colors.background} />
                <Text variant="caption" style={{ color: colors.background }}>
                  {m.status === 'pending' ? 'Timelapse · waiting for review' : 'Timelapse'}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RespectButton({ count, active, onPress }: { count: number; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${active ? 'Take back' : 'Give'} Respect. ${count} so far.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.respect,
        { backgroundColor: active ? colors.accent : colors.borderStrong },
        pressed && styles.respectPressed,
      ]}>
      <Ionicons name={active ? 'ribbon' : 'ribbon-outline'} size={16} color={active ? colors.onAccent : colors.text} />
      <Text variant="label" color={active ? 'onAccent' : 'text'}>
        Respect{count > 0 ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  authorText: { flex: 1 },
  menu: { padding: Spacing.xs },
  session: { gap: Spacing.sm },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  stats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md },
  duration: { fontFamily: Fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tile: { borderRadius: Radius.md, overflow: 'hidden' },
  tileFull: { width: '100%' },
  tileHalf: { width: '49%' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  badge: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  respect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  respectPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  confirm: { gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  grow: { flex: 1 },
});
