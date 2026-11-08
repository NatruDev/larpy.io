import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '@/theme';

type IconButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
  variant?: 'primary' | 'secondary';
  size?: number;
  disabled?: boolean;
  /** Nudges the glyph right; play triangles look off-center when centered exactly. */
  opticalOffset?: number;
};

/** Round flat button with an icon, e.g. play, plus, minus. Primary doubles as the coral FAB. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  onLongPress,
  variant = 'primary',
  size = 48,
  disabled,
  opticalOffset = 0,
}: IconButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const face = disabled ? colors.border : primary ? colors.accent : colors.borderStrong;
  const glyph = disabled ? colors.textMuted : primary ? colors.onAccent : colors.text;
  const radius = size / 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width: size, height: size }}>
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            { width: size, height: size, borderRadius: radius, backgroundColor: face },
            pressed && !disabled && styles.pressed,
          ]}>
          <Ionicons name={icon} size={size * 0.45} color={glyph} style={{ marginLeft: opticalOffset }} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
