import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useSubjectTotals, type SubjectRange } from '@/features/stats/use-stats';
import { formatDuration } from '@/lib/format';
import { Spacing, subjectColor, useTheme } from '@/theme';

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
] as const;

/**
 * Part-to-whole: one stacked bar (2px surface gaps between segments) plus a list that is both the legend
 * and the table of values, so identity never relies on color alone.
 */
export function SubjectBreakdown({ today }: { today: string }) {
  const { colors, scheme } = useTheme();
  const [range, setRange] = useState<SubjectRange>('week');
  const { data } = useSubjectTotals(range, today);
  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + r.seconds, 0);
  const colorOf = (c: string | null) => (c ? subjectColor(c, scheme, colors.accent) : colors.borderStrong);

  return (
    <View style={styles.wrap}>
      <Segmented options={RANGES} value={range} onChange={setRange} accessibilityLabel="Time range" />

      {total === 0 ? (
        <Text color="textMuted">{data ? 'No study time in this range yet.' : 'Loading…'}</Text>
      ) : (
        <>
          <View style={[styles.bar, { backgroundColor: colors.surface }]} accessibilityElementsHidden>
            {rows.map((r) => (
              <View
                key={r.subject_id ?? 'none'}
                style={[styles.segment, { flex: r.seconds, backgroundColor: colorOf(r.color) }]}
              />
            ))}
          </View>

          <View style={styles.list}>
            {rows.map((r) => (
              <View key={r.subject_id ?? 'none'} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: colorOf(r.color) }]} />
                <Text variant="bodyStrong" style={styles.name} numberOfLines={1}>
                  {r.name ?? 'No subject'}
                </Text>
                <Text variant="caption" color="textMuted" style={styles.percent}>
                  {Math.round((r.seconds / total) * 100)}%
                </Text>
                <Text variant="bodyStrong" style={styles.value}>
                  {formatDuration(r.seconds)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  segment: { height: '100%' },
  list: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1 },
  percent: { width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  value: { minWidth: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
