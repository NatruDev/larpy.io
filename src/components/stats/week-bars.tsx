import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { dayLong } from '@/features/stats/dates';
import { formatDuration, formatGoal } from '@/lib/format';
import { Fonts, Spacing, useTheme } from '@/theme';

const PLOT_HEIGHT = 132;
const BAR_WIDTH = 22;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Props = {
  week: { day: string; seconds: number }[];
  today: string;
  goalSeconds: number;
};

/** Focus per day this week (Mon–Sun) against the daily goal line. One series, so no legend. */
export function WeekBars({ week, today, goalSeconds }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(goalSeconds, ...week.map((d) => d.seconds)) * 1.12;
  const goalY = (goalSeconds / max) * PLOT_HEIGHT;
  const shown = selected ?? today;
  const shownSeconds = week.find((d) => d.day === shown)?.seconds ?? 0;

  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={selected ? 'text' : 'textMuted'} style={styles.caption}>
        {dayLong(shown)}: {shownSeconds ? formatDuration(shownSeconds) : 'no study'}
        {shownSeconds >= goalSeconds ? ', goal reached' : ''}
      </Text>

      <View style={[styles.plot, { height: PLOT_HEIGHT, borderBottomColor: colors.borderStrong }]}>
        {/* Daily goal reference line */}
        <View style={[styles.goalLine, { bottom: goalY, borderTopColor: colors.borderStrong }]} pointerEvents="none">
          <Text variant="caption" color="textMuted" style={styles.goalLabel}>
            Goal {formatGoal(goalSeconds / 60)}
          </Text>
        </View>

        {week.map((d) => {
          const height = d.seconds > 0 ? Math.max(4, (d.seconds / max) * PLOT_HEIGHT) : 0;
          const future = d.day > today;
          return (
            <Pressable
              key={d.day}
              accessibilityLabel={`${dayLong(d.day)}: ${d.seconds ? formatDuration(d.seconds) : 'no study'}`}
              onPress={() => setSelected(d.day === selected ? null : d.day)}
              onHoverIn={() => setSelected(d.day)}
              onHoverOut={() => setSelected((s) => (s === d.day ? null : s))}
              disabled={future}
              style={styles.column}>
              {height > 0 ? (
                <View
                  style={[
                    styles.bar,
                    { height, backgroundColor: colors.accent },
                    d.day === shown && selected !== null && { opacity: 1 },
                    selected !== null && d.day !== shown && { opacity: 0.45 },
                  ]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.letters}>
        {week.map((d, i) => (
          <Text
            key={d.day}
            variant="caption"
            color={d.day === today ? 'text' : 'textMuted'}
            style={[styles.letter, d.day === today && styles.today]}>
            {LETTERS[i]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  caption: { fontFamily: Fonts.semibold },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  goalLabel: { position: 'absolute', right: 0, top: -18, fontSize: 11 },
  column: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: BAR_WIDTH, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  letters: { flexDirection: 'row' },
  letter: { flex: 1, textAlign: 'center', fontFamily: Fonts.bold },
  today: { fontFamily: Fonts.bold },
});
