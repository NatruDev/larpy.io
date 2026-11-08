import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { RecentSessions } from '@/components/stats/recent-sessions';
import { StreakCard } from '@/components/stats/streak-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useAuth } from '@/providers/auth-provider';
import { Spacing } from '@/theme';

/** Home in local mode: no feed yet, so it's your streak, a way to start, and your recent sessions. */
export function LocalHome() {
  const { profile } = useAuth();
  const breakpoint = useBreakpoint();
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <Screen title={firstName ? `Hi, ${firstName}` : 'Home'}>
      {/* On desktop the streak card lives in the right rail instead. */}
      {breakpoint !== 'desktop' ? <StreakCard /> : null}
      <Card style={styles.card}>
        <Text variant="heading">Your sessions stay in this browser</Text>
        <Text color="textMuted">
          The feed and friends arrive when accounts go live. Until then, every session is saved here, and
          Share it on the summary saves a card you can post anywhere.
        </Text>
        <Button label="Start a focus session" icon="play" onPress={() => router.navigate('/focus')} />
      </Card>
      <Card style={styles.card}>
        <Text variant="heading">Recent sessions</Text>
        <RecentSessions />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
});
