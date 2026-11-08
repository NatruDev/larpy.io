import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Fonts, Radius, Spacing, useTheme } from '@/theme';

const INDICATOR = 18;
const TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };

type QuickLengthsProps<T> = {
  options: readonly { value: T; label: string }[];
  /** A value not in `options` (e.g. dialed by hand) hides the indicator. */
  value: T;
  onChange: (value: T) => void;
};

/** Evenly spaced length shortcuts under the dial; a small bar slides to the selected one. */
export function QuickLengths<T>({ options, value, onChange }: QuickLengthsProps<T>) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const index = options.findIndex((o) => o.value === value);
  const itemWidth = width / options.length;

  const x = useSharedValue(0);
  const visible = useSharedValue(0);

  useEffect(() => {
    if (!width) return;
    if (index >= 0) {
      const target = index * itemWidth + (itemWidth - INDICATOR) / 2;
      // Appear in place rather than sliding in from wherever it was hidden.
      x.set(visible.get() === 0 ? target : withTiming(target, TIMING));
    }
    visible.set(withTiming(index >= 0 ? 1 : 0, TIMING));
  }, [index, itemWidth, width, x, visible]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: visible.get(),
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Quick lengths"
      style={styles.row}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {options.map((o, i) => {
        const selected = i === index;
        return (
          <Pressable
            key={o.label}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text style={[styles.label, { color: selected ? colors.accentText : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { backgroundColor: colors.accent }, indicatorStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'stretch' },
  item: { flex: 1, alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  pressed: { opacity: 0.6 },
  label: { fontFamily: Fonts.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  indicator: { position: 'absolute', left: 0, bottom: 2, width: INDICATOR, height: 3, borderRadius: Radius.pill },
});
