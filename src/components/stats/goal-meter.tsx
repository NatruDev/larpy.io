import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** Progress toward a goal: accent fill on a lighter track of the same hue. */
export function GoalMeter({ value, goal, height = 8 }: { value: number; goal: number; height?: number }) {
  const { colors } = useTheme();
  const ratio = goal > 0 ? Math.min(1, value / goal) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.accentSoft }]}>
      {ratio > 0 ? (
        <View style={[styles.fill, { width: `${ratio * 100}%`, borderRadius: height / 2, backgroundColor: colors.accent }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch', overflow: 'hidden' },
  fill: { height: '100%' },
});
