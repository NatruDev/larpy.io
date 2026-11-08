import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatTimeOfDay } from '@/lib/format';
import type { SessionPause } from '@/lib/types';
import { Spacing, useTheme } from '@/theme';

type Props = {
  startedAt: string;
  endedAt: string;
  pauses: Pick<SessionPause, 'kind' | 'started_at' | 'ended_at'>[];
  color: string;
};

type Segment = { focus: boolean; ms: number };

/** Focus blocks in the subject color, breaks and pauses as gaps, from start time to end time. */
export function TimelineBar({ startedAt, endedAt, pauses, color }: Props) {
  const { colors } = useTheme();
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);

  const segments: Segment[] = [];
  let cursor = start;
  for (const p of [...pauses].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const from = Math.max(cursor, Date.parse(p.started_at));
    const to = Math.min(end, p.ended_at ? Date.parse(p.ended_at) : end);
    if (from > cursor) segments.push({ focus: true, ms: from - cursor });
    if (to > from) segments.push({ focus: false, ms: to - from });
    cursor = Math.max(cursor, to);
  }
  if (end > cursor) segments.push({ focus: true, ms: end - cursor });

  const breaks = pauses.length;
  const label = `Studied from ${formatTimeOfDay(start)} to ${formatTimeOfDay(end)}${
    breaks ? ` with ${breaks} ${breaks === 1 ? 'break' : 'breaks'}` : ''
  }`;

  return (
    <View accessible accessibilityLabel={label} style={styles.wrap}>
      <View style={styles.bar}>
        {segments.map((s, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { flexGrow: s.ms },
              { backgroundColor: s.focus ? color : colors.borderStrong },
            ]}
          />
        ))}
      </View>
      <View style={styles.times}>
        <Text variant="caption" color="textMuted">
          {formatTimeOfDay(start)}
        </Text>
        <Text variant="caption" color="textMuted">
          {formatTimeOfDay(end)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  bar: { flexDirection: 'row', gap: 2, height: 10 },
  segment: { flexBasis: 0, minWidth: 2, borderRadius: 3 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
});
