import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { Text } from './text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Small color dot before the label, e.g. a subject's color. */
  dotColor?: string;
  disabled?: boolean;
};

/** A toggleable soft pill, used for picking goals, subjects and presets. */
export function Chip({ label, selected, onPress, dotColor, disabled }: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.borderStrong, borderColor: colors.borderStrong },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant="label" color={selected ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
