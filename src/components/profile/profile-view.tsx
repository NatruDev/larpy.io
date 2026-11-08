import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/feed/avatar';
import { EmptyFeed, PostList } from '@/components/feed/post-list';
import { YearHeatmap } from '@/components/stats/year-heatmap';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useFeed } from '@/features/feed/use-feed';
import { setBlocked, setFollowing, useProfilePage } from '@/features/profile/use-profile';
import { friendlyError } from '@/lib/errors';
import { formatTotal } from '@/lib/format';
import type { ProfilePage } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { Fonts, Hues, Spacing, useTheme, withAlpha, type HueName } from '@/theme';

type Props = {
  username: string | null | undefined;
  /** Show a back button (profile pages opened from the feed). */
  showBack?: boolean;
  /** Extra content under the header, e.g. settings on your own profile. */
  children?: ReactNode;
};

/** A person's profile: header, numbers, follow button, heatmap and their posts. */
export function ProfileView({ username, showBack, children }: Props) {
  const { profile, isLoading, error, reload } = useProfilePage(username);
  const visible = profile && !profile.hidden ? profile : null;
  const feed = useFeed({ scope: 'global', authorId: visible?.profile.id ?? null, enabled: !!visible });

  return (
    <Screen>
      {showBack ? <BackButton /> : null}
      {isLoading ? (
        <Text color="textMuted">{error ?? 'Loading profile…'}</Text>
      ) : !profile ? (
        <EmptyFeed title="Profile not found" body={`Nobody goes by @${username}.`} />
      ) : (
        <>
          <Header page={profile} onChanged={reload} />
          {children}
          {visible ? (
            <>
              <Card style={styles.card}>
                <Text variant="heading">Last 12 months</Text>
                <YearHeatmap
                  totals={new Map(visible.heatmap.map((d) => [d.day, d.seconds]))}
                  today={visible.today}
                  goalSeconds={visible.profile.daily_goal_minutes * 60}
                  minSeconds={visible.streak_min_seconds}
                />
              </Card>
              <Text variant="heading">Posts</Text>
              <PostList
                feed={feed}
                empty={
                  <EmptyFeed
                    title="No posts yet"
                    body={visible.is_me ? 'Post a session from the summary when you finish, or share an update on Home.' : 'Nothing posted yet.'}
                  />
                }
              />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function BackButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.back}>
      <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      <Text variant="label" color="textMuted">
        Back
      </Text>
    </Pressable>
  );
}

function Header({ page, onChanged }: { page: ProfilePage; onChanged: () => void }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const [busy, setBusy] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = page;
  const name = profile.display_name || profile.username;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirmingBlock(false);
      onChanged();
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Avatar name={profile.display_name} username={profile.username} url={profile.avatar_url} size={64} />
        <View style={styles.names}>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <Text color="textMuted">@{profile.username}</Text>
        </View>
      </View>

      {page.hidden ? (
        <>
          <Text color="textMuted">
            {page.blocked_by_me
              ? `You blocked @${profile.username}. You won’t see each other’s posts or sessions.`
              : 'This profile is private.'}
          </Text>
          {page.blocked_by_me && me ? (
            <Button
              label="Unblock"
              variant="secondary"
              disabled={busy}
              onPress={() => run(() => setBlocked(me, profile.id, false))}
            />
          ) : null}
        </>
      ) : (
        <>
          {page.profile.bio ? <Text>{page.profile.bio}</Text> : null}
          <View style={styles.numbers}>
            <Stat icon="flame" hue="orange" label="day streak" value={String(page.current_streak)} />
            <Stat icon="time" hue="blue" label="studied" value={formatTotal(page.total_seconds)} />
            <Stat icon="people" hue="violet" label={page.followers === 1 ? 'follower' : 'followers'} value={String(page.followers)} />
            <Stat icon="person-add" hue="teal" label="following" value={String(page.following)} />
          </View>
          {!page.is_me && me ? (
            <View style={styles.actions}>
              <Button
                label={page.is_following ? 'Following' : page.follows_me ? 'Follow back' : 'Follow'}
                variant={page.is_following ? 'secondary' : 'primary'}
                icon={page.is_following ? 'checkmark' : 'person-add'}
                disabled={busy}
                onPress={() => run(() => setFollowing(me, profile.id, !page.is_following))}
                style={styles.grow}
              />
              <Button label="Block" variant="secondary" disabled={busy} onPress={() => setConfirmingBlock((v) => !v)} />
            </View>
          ) : null}
          {confirmingBlock && me ? (
            <View style={styles.confirm}>
              <Text variant="label">
                Block @{profile.username}? You’ll stop following each other and won’t see each other’s posts or
                sessions. They won’t be told.
              </Text>
              <View style={styles.actions}>
                <Button label="Cancel" variant="secondary" onPress={() => setConfirmingBlock(false)} style={styles.grow} />
                <Button
                  label="Block"
                  disabled={busy}
                  onPress={() => run(() => setBlocked(me, profile.id, true))}
                  style={styles.grow}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

function Stat({ icon, hue, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; hue: HueName; label: string; value: string }) {
  return (
    <View style={styles.number}>
      <View style={[styles.badge, { backgroundColor: withAlpha(Hues[hue], 0.16) }]}>
        <Ionicons name={icon} size={14} color={Hues[hue]} />
      </View>
      <View>
        <Text style={styles.numberValue}>{value}</Text>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  card: { gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  names: { flex: 1 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  number: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numberValue: { fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: Spacing.md },
  grow: { flex: 1 },
  confirm: { gap: Spacing.sm },
});
