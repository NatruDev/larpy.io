import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, Radius, Spacing, useTheme } from '@/theme';

import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'lg';
  icon?: ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
};

/** Soft, flat pill button. Primary is the accent; secondary is a raised charcoal fill. */
export function Button({ label, variant = 'primary', size = 'md', icon, disabled, style, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';

  const face = disabled ? colors.border : primary ? colors.accent : colors.borderStrong;
  const textColor = disabled ? 'textMuted' : primary ? 'onAccent' : 'text';
  const iconColor = disabled ? colors.textMuted : primary ? colors.onAccent : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      // Name it by its label only; otherwise the icon's font glyph gets read out too. `rest` can override.
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={style}
      {...rest}>
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            size === 'lg' && styles.faceLarge,
            { backgroundColor: face },
            disabled && styles.faceDisabled,
            pressed && !disabled && styles.facePressed,
          ]}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={iconColor} /> : null}
          <Text
            variant="bodyStrong"
            color={textColor}
            numberOfLines={1}
            style={[styles.label, size === 'lg' && styles.labelLarge]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  faceLarge: { minHeight: 56, paddingHorizontal: Spacing.xxl },
  faceDisabled: { opacity: 0.6 },
  facePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  label: { fontFamily: Fonts.semibold, fontSize: 16 },
  labelLarge: { fontSize: 17 },
});
