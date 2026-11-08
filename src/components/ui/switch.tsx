import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { OnSubject, Radius, useTheme, withAlpha } from '@/theme';

const WIDTH = 50;
const HEIGHT = 30;
const PADDING = 2;
const THUMB = HEIGHT - PADDING * 2;
const TRAVEL = WIDTH - THUMB - PADDING * 2;

type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

/**
 * On/off switch drawn by us rather than the platform's, so it looks the same everywhere and matches the
 * theme. (On web the built-in one also gets a grey box from the browser when disabled.) The caller shows
 * the disabled state, e.g. ToggleRow dims the whole row.
 */
export function Switch({ value, onValueChange, accessibilityLabel, disabled }: SwitchProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);
  const offColor = withAlpha(colors.text, 0.2);
  const onColor = colors.accent;

  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) }));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.get() * TRAVEL }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      // react-native-web only maps the aria props for this role.
      aria-checked={value}
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, { backgroundColor: OnSubject }, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: WIDTH, height: HEIGHT, borderRadius: Radius.pill, padding: PADDING },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
