import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { dayLong } from '@/features/stats/dates';
import { Fonts, Spacing, useTheme } from '@/theme';

type WeekStripProps = {
  days: string[];
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  /** Subject colors studied on each day, already adjusted for the color scheme */
  dotsByDay: Map<string, string[]>;
  /** Shown at the right of the month header, e.g. the streak */
  right?: ReactNode;
};

const MAX_DOTS = 4;

/** Month header (year in the accent) over a Mon–Sun strip; today is circled, dots show subjects studied. */
export function WeekStrip({ days, today, selected, onSelect, dotsByDay, right }: WeekStripProps) {
  const { colors } = useTheme();
  const date = new Date(`${selected}T00:00:00Z`);
  const month = date.toLocaleDateString([], { month: 'long', timeZone: 'UTC' });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {month} <Text variant="title" color="accentText">{date.getUTCFullYear()}</Text>
        </Text>
        {right}
      </View>
      <View style={styles.days}>
        {days.map((day) => {
          const isToday = day === today;
          const isSelected = day === selected;
          const dots = dotsByDay.get(day) ?? [];
          const weekday = new Date(`${day}T00:00:00Z`).toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' });
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${dayLong(day)}${isToday ? ', today' : ''}, ${dots.length ? `${dots.length} subjects` : 'nothing studied'}`}
              onPress={() => onSelect(day)}
              style={({ pressed }) => [styles.day, pressed && styles.pressed]}>
              <Text variant="caption" color="textMuted">
                {weekday}
              </Text>
              <View
                style={[
                  styles.date,
                  isToday && { backgroundColor: colors.accent },
                  isSelected && !isToday && { borderColor: colors.borderStrong, borderWidth: 2 },
                ]}>
                <Text variant="bodyStrong" color={isToday ? 'onAccent' : 'text'} style={styles.dateText}>
                  {Number(day.slice(8))}
                </Text>
              </View>
              <View style={styles.dots}>
                {dots.slice(0, MAX_DOTS).map((c, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: c, borderColor: colors.background }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: Spacing.xs, minHeight: 44, paddingVertical: Spacing.xs, borderRadius: 12 },
  pressed: { opacity: 0.6 },
  date: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontFamily: Fonts.bold, fontSize: 17, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', height: 10, alignItems: 'center' },
  // Overlapping dots, like beads on a string.
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, marginHorizontal: -1.5 },
});
