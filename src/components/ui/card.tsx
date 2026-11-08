import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

/** A dark sheet with a hairline edge on the black background. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
