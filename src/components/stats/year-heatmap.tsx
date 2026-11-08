import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { addDays, dayLong, monthLong, monthShort } from '@/features/stats/dates';
import { heatmapStart } from '@/features/stats/use-stats';
import { formatDuration } from '@/lib/format';
import { Fonts, Spacing, useTheme } from '@/theme';

const WEEKS = 53;
const GAP = 2;
const LABEL_WIDTH = 30;
const MONTH_ROW = 18;
const MIN_CELL = 7;
const MAX_CELL = 16;
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

type Props = {
  /** Focused seconds per 'YYYY-MM-DD' */
  totals: Map<string, number>;
  today: string;
  goalSeconds: number;
  minSeconds: number;
};

/** Darkness = how close the day came to the daily goal (quarters), so the scale means the same every day. */
function level(seconds: number, goalSeconds: number) {
  if (seconds <= 0) return 0;
  const ratio = seconds / goalSeconds;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

export function YearHeatmap({ totals, today, goalSeconds, minSeconds }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const start = heatmapStart(today);
  const fit = Math.floor((width - LABEL_WIDTH - GAP * (WEEKS - 1)) / WEEKS);
  const scrolls = width > 0 && fit < MIN_CELL;
  const cell = scrolls ? 11 : Math.max(MIN_CELL, Math.min(MAX_CELL, fit));

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d))
  );
  const activeDays = [...totals.entries()].filter(([day, s]) => day >= start && day <= today && s >= minSeconds).length;

  const caption = selected
    ? `${dayLong(selected)}: ${totals.get(selected) ? formatDuration(totals.get(selected)!) : 'no study'}`
    : `${activeDays} ${activeDays === 1 ? 'day' : 'days'} studied in the last year`;

  // Day names stay put on the left, outside the part that may scroll on narrow screens.
  const dayLabels = (
    <View style={{ width: LABEL_WIDTH, gap: GAP, paddingTop: MONTH_ROW }}>
      {ROW_LABELS.map((label, i) => (
        <View key={i} style={{ height: cell, justifyContent: 'center' }}>
          <Text variant="caption" color="textMuted" style={styles.rowLabel}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );

  const grid = (
    <View>
      {/* Month names above the first week of each month */}
      <View style={[styles.row, { height: MONTH_ROW }]}>
        {columns.map((days, w) => {
          const show = w === 0 ? false : monthShort(days[0]) !== monthShort(columns[w - 1][0]);
          return (
            <View key={w} style={{ width: cell, marginRight: w < WEEKS - 1 ? GAP : 0 }}>
              {show ? (
                <Text variant="caption" color="textMuted" style={styles.monthLabel}>
                  {monthShort(days[0])}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.row}>
        {columns.map((days, w) => (
          <View key={w} style={{ gap: GAP, marginRight: w < WEEKS - 1 ? GAP : 0 }}>
            {days.map((day) => {
              if (day > today) return <View key={day} style={{ width: cell, height: cell }} />;
              const seconds = totals.get(day) ?? 0;
              const isSelected = day === selected;
              return (
                <Pressable
                  key={day}
                  accessibilityLabel={`${dayLong(day)}: ${seconds ? formatDuration(seconds) : 'no study'}`}
                  onPress={() => setSelected(isSelected ? null : day)}
                  onHoverIn={() => setSelected(day)}
                  onHoverOut={() => setSelected((s) => (s === day ? null : s))}
                  hitSlop={GAP / 2}
                  style={[
                    { width: cell, height: cell, borderRadius: Math.max(2, cell / 5) },
                    { backgroundColor: colors.heat[level(seconds, goalSeconds)] },
                    isSelected && { borderWidth: 2, borderColor: colors.text },
                    day === today && !isSelected && { borderWidth: 1.5, borderColor: colors.textMuted },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width === 0 ? null : (
          <>
            {dayLabels}
            {scrolls ? (
              <ScrollView
                horizontal
                ref={scroller}
                style={styles.scroller}
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
                {grid}
              </ScrollView>
            ) : (
              grid
            )}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color={selected ? 'text' : 'textMuted'} style={styles.caption}>
          {caption}
        </Text>
        <View style={styles.legend} accessibilityLabel="Darker squares mean closer to your daily goal">
          <Text variant="caption" color="textMuted">
            Less
          </Text>
          {colors.heat.map((c, i) => (
            <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
          ))}
          <Text variant="caption" color="textMuted">
            Goal
          </Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => setShowTable((v) => !v)}>
        <Text variant="caption" color="accentText" style={styles.tableToggle}>
          {showTable ? 'Hide table' : 'Show as table'}
        </Text>
      </Pressable>
      {showTable ? <MonthTable totals={totals} today={today} start={start} minSeconds={minSeconds} /> : null}
    </View>
  );
}

function MonthTable({ totals, today, start, minSeconds }: { totals: Map<string, number>; today: string; start: string; minSeconds: number }) {
  const { colors } = useTheme();
  const months = new Map<string, { seconds: number; days: number }>();
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const key = day.slice(0, 7);
    const entry = months.get(key) ?? { seconds: 0, days: 0 };
    const s = totals.get(day) ?? 0;
    entry.seconds += s;
    if (s >= minSeconds) entry.days += 1;
    months.set(key, entry);
  }
  const rows = [...months.entries()].reverse();

  return (
    <View style={[styles.table, { borderColor: colors.border }]}>
      <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
        <Text variant="caption" color="textMuted" style={styles.tableMonth}>
          Month
        </Text>
        <Text variant="caption" color="textMuted" style={styles.tableNum}>
          Days studied
        </Text>
        <Text variant="caption" color="textMuted" style={styles.tableNum}>
          Focused
        </Text>
      </View>
      {rows.map(([key, v]) => (
        <View key={key} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
          <Text variant="caption" style={styles.tableMonth}>
            {monthLong(`${key}-01`)}
          </Text>
          <Text variant="caption" style={styles.tableNum}>
            {v.days}
          </Text>
          <Text variant="caption" style={styles.tableNum}>
            {v.seconds ? formatDuration(v.seconds) : '–'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  row: { flexDirection: 'row' },
  monthLabel: { position: 'absolute', left: 0, width: 44, fontSize: 11 },
  scroller: { flex: 1 },
  rowLabel: { fontSize: 10.5 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  caption: { fontFamily: Fonts.semibold },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendCell: { width: 11, height: 11, borderRadius: 2 },
  tableToggle: { fontFamily: Fonts.bold },
  table: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableMonth: { flex: 2 },
  tableNum: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
