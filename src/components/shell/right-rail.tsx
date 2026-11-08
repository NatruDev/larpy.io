import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakCard } from '@/components/stats/streak-card';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { LOCAL_MODE } from '@/lib/backend';
import { Spacing, useTheme } from '@/theme';

/**
 * Desktop-only right column: streak and today, plus social panels that fill in with the feed
 * (milestone 5).
 */
export function RightRail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.rail, { borderLeftColor: colors.border }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <StreakCard />

      {/* Social panels need accounts; local mode shows only the streak. */}
      {LOCAL_MODE ? null : (
        <>
          <Card>
            <Text variant="heading">Studying now</Text>
            <Text variant="caption" color="textMuted">
              When people you follow start a session, they show up here.
            </Text>
          </Card>

          <Card>
            <Text variant="heading">Top today</Text>
            <Text variant="caption" color="textMuted">
              The day&apos;s top studiers among your friends will be listed here.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { width: 320, flexGrow: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  content: { padding: Spacing.lg, gap: Spacing.lg },
});
