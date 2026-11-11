import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Composer } from '@/components/feed/composer';
import { EmptyFeed, PostList } from '@/components/feed/post-list';
import { StreakCard } from '@/components/stats/streak-card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { useFeed, type FeedScope } from '@/features/feed/use-feed';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useAuth } from '@/providers/auth-provider';
import { Spacing } from '@/theme';

const SCOPES = [
  { value: 'following', label: 'Following' },
  { value: 'global', label: 'Everyone' },
] as const;

export default function HomeScreen() {
  const { profile } = useAuth();
  const breakpoint = useBreakpoint();
  const firstName = profile?.display_name?.split(' ')[0];
  const [scope, setScope] = useState<FeedScope>('following');
  const feed = useFeed({ scope });

  return (
    <Screen title={firstName ? `Hi, ${firstName}` : 'Home'}>
      {/* On desktop the streak card lives in the right rail instead. */}
      {breakpoint !== 'desktop' ? <StreakCard /> : null}
      <Composer />
      <View style={styles.bar}>
        <View style={styles.grow}>
          <Segmented options={SCOPES} value={scope} onChange={setScope} accessibilityLabel="Whose posts to show" />
        </View>
        <IconButton
          icon="refresh"
          variant="secondary"
          size={40}
          accessibilityLabel="Refresh the feed"
          onPress={feed.refresh}
          disabled={feed.refreshing}
        />
      </View>
      <PostList
        feed={feed}
        empty={
          scope === 'following' ? (
            <EmptyFeed
              title="Nothing here yet"
              body="Posts from you and the people you follow show up here. See what everyone else is studying and follow a few people."
              action={<Button label="See everyone" variant="secondary" onPress={() => setScope('global')} />}
            />
          ) : (
            <EmptyFeed
              title="No posts yet"
              body="Finish a focus session and post it, or share an update above."
              action={<Button label="Start a focus session" icon="play" onPress={() => router.navigate('/focus')} />}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  grow: { flex: 1 },
});
