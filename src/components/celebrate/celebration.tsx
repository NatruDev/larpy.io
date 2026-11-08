import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import type { Celebration as CelebrationData } from '@/features/celebrate/use-celebration';
import { Fonts, Hues, Radius, Spacing, withAlpha, type HueName } from '@/theme';

type Badge = { key: string; label: string; icon: ComponentProps<typeof Ionicons>['name']; hue: HueName };

/** The end-of-session moment: the streak ticking up, then a badge for each thing the session earned. */
export function Celebration({ data }: { data: CelebrationData }) {
  const { streak, extended } = data;
  // Show yesterday's number first, then tick up, so the +1 is something you see happen.
  const [shown, setShown] = useState(extended ? Math.max(0, streak - 1) : streak);

  useEffect(() => {
    if (shown === streak) return;
    const timer = setTimeout(() => setShown(streak), 700);
    return () => clearTimeout(timer);
  }, [shown, streak]);

  const badges: Badge[] = [];
  if (extended) badges.push({ key: 'streak', label: streak === 1 ? 'Streak started' : 'Streak +1', icon: 'flame', hue: 'orange' });
  if (data.bestYet) badges.push({ key: 'best', label: 'Best streak yet', icon: 'trophy', hue: 'yellow' });
  if (data.dailyGoalHit) badges.push({ key: 'daily', label: 'Daily goal reached', icon: 'checkmark-circle', hue: 'green' });
  if (data.sessionGoalHit) badges.push({ key: 'session', label: 'Session goal hit', icon: 'flag', hue: 'coral' });

  const title =
    streak === 0 ? 'Session saved' : extended && streak === 1 ? 'Day 1. Here we go.' : `${streak}-day streak`;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.flame, { backgroundColor: withAlpha(Hues.orange, 0.16) }]}>
        <Ionicons name="flame" size={30} color={Hues.orange} />
        <Animated.Text key={shown} entering={ZoomIn.springify()} style={[styles.number, { color: Hues.orange }]}>
          {shown}
        </Animated.Text>
      </View>
      <Text variant="title" style={styles.center}>
        {title}
      </Text>
      {badges.length ? (
        <View style={styles.badges}>
          {badges.map((b, i) => (
            <Animated.View
              key={b.key}
              entering={FadeInDown.delay(500 + i * 150)}
              style={[styles.badge, { backgroundColor: withAlpha(Hues[b.hue], 0.16) }]}>
              <Ionicons name={b.icon} size={15} color={Hues[b.hue]} />
              <Text variant="label" style={{ color: Hues[b.hue] }}>
                {b.label}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.md },
  flame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  number: { fontFamily: Fonts.extrabold, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
});
