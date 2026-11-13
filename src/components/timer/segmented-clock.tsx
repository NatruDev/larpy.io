import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatClock } from '@/lib/format';
import { Fonts, useTheme } from '@/theme';

type Props = {
  seconds: number;
  /** Font size of the digits; the labels and colons scale from it. */
  size: number;
};

const UNITS = ['Hrs', 'Mins', 'Secs'] as const;

/** Big condensed HH:MM:SS with the unit name centered under each pair of digits. */
export function SegmentedClock({ seconds, size }: Props) {
  const { colors } = useTheme();
  const s = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0'));

  const digit = { fontSize: size, lineHeight: size * 0.92, color: colors.text };
  const label = { fontSize: Math.round(size * 0.22), lineHeight: Math.round(size * 0.26), color: colors.text };

  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={formatClock(s)} style={styles.row}>
      {parts.map((value, i) => (
        <View key={UNITS[i]} style={styles.row}>
          {i > 0 ? <Text style={[styles.digits, digit, { marginHorizontal: size * 0.03 }]}>:</Text> : null}
          <View style={styles.group}>
            <Text style={[styles.digits, digit]}>{value}</Text>
            <Text style={[styles.label, label]}>{UNITS[i]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  group: { alignItems: 'center' },
  digits: { fontFamily: Fonts.clock, fontVariant: ['tabular-nums'], includeFontPadding: false },
  label: { fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
});
