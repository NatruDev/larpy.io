import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useRecentSessions } from '@/features/stats/use-stats';
import { formatDuration, formatTimeOfDay } from '@/lib/format';
import { Spacing, subjectColor, useTheme } from '@/theme';

function whenLabel(startedAt: string) {
  const start = new Date(startedAt);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = formatTimeOfDay(start.getTime());
  if (start.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (start.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export function RecentSessions() {
  const { colors, scheme } = useTheme();
  const { data } = useRecentSessions(8);

  if (!data) return <Text color="textMuted">Loading…</Text>;
  if (data.length === 0) return <Text color="textMuted">Finished sessions will be listed here.</Text>;

  return (
    <View style={styles.list}>
      {data.map((s) => {
        const focused = s.focused_seconds ?? 0;
        const hitGoal = !!s.goal_minutes && focused >= s.goal_minutes * 60;
        return (
          <View key={s.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: subjectColor(s.subject?.color, scheme, colors.borderStrong) }]} />
            <View style={styles.main}>
              <View style={styles.titleRow}>
                <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
                  {s.subject?.name ?? 'No subject'}
                </Text>
                {s.is_private ? <Ionicons name="lock-closed" size={13} color={colors.textMuted} accessibilityLabel="Private" /> : null}
                {s.source === 'manual' ? (
                  <Text variant="caption" color="textMuted">
                    Added by hand
                  </Text>
                ) : null}
              </View>
              <Text variant="caption" color="textMuted">
                {whenLabel(s.started_at)}
              </Text>
              {s.caption ? (
                <Text variant="caption" numberOfLines={2}>
                  {s.caption}
                </Text>
              ) : null}
            </View>
            <View style={styles.right}>
              <Text variant="bodyStrong" style={styles.value}>
                {formatDuration(focused)}
              </Text>
              {hitGoal ? (
                <View style={styles.goal}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  <Text variant="caption" color="textMuted">
                    Goal
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  main: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
  value: { fontVariant: ['tabular-nums'] },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
