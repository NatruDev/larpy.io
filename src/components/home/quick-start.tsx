import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/format';
import type { Subject } from '@/lib/types';
import { OnSubject, Spacing, subjectColor, useTheme } from '@/theme';

const SIZE = 60;
const STROKE = 4;

type QuickStartProps = {
  todaySeconds: number;
  goalMinutes: number;
  subjects: Pick<Subject, 'id' | 'name' | 'color'>[];
};

/** Today's goal ring, then one circle per subject that opens Focus with that subject picked. */
export function QuickStart({ todaySeconds, goalMinutes, subjects }: QuickStartProps) {
  const { colors, scheme } = useTheme();
  const ratio = goalMinutes > 0 ? Math.min(1, todaySeconds / (goalMinutes * 60)) : 0;
  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <View
        style={styles.item}
        accessibilityRole="progressbar"
        accessibilityLabel={`Daily goal: ${formatDuration(todaySeconds)} of ${goalMinutes} minutes`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
        <View style={styles.circle}>
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            {ratio > 0 ? (
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                stroke={colors.accent}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference * ratio} ${circumference}`}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ) : null}
          </Svg>
          <Ionicons name={ratio >= 1 ? 'checkmark' : 'flag'} size={22} color={colors.accent} />
        </View>
        <Text variant="caption" style={styles.label} numberOfLines={2}>
          {ratio >= 1 ? 'Goal done' : `${formatDuration(todaySeconds)} today`}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {subjects.map((s) => {
        const color = subjectColor(s.color, scheme, colors.textMuted);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`Start ${s.name}`}
            onPress={() => router.navigate({ pathname: '/focus', params: { subject: s.id } })}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={[styles.circle, { backgroundColor: colors.background }]}>
              <Text variant="heading" style={{ color }}>
                {s.name.slice(0, 1).toUpperCase()}
              </Text>
              <View style={[styles.play, { backgroundColor: color, borderColor: colors.surface }]}>
                <Ionicons name="play" size={9} color={OnSubject} />
              </View>
            </View>
            <Text variant="caption" style={styles.label} numberOfLines={2}>
              {s.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.lg, alignItems: 'flex-start', paddingHorizontal: Spacing.xs },
  item: { width: 72, alignItems: 'center', gap: Spacing.sm },
  pressed: { opacity: 0.6 },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: Spacing.xs },
  play: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 1,
  },
});
