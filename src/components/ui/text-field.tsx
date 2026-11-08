import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius, Spacing, useTheme } from '@/theme';

import { Text } from './text';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function TextField({ label, error, hint, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.surface;

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          rest.multiline && styles.multiline,
          { backgroundColor: colors.surface, borderColor, color: colors.text },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs + 2 },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md + 2,
    fontFamily: Fonts.medium,
    fontSize: 15,
    // The colored border shows focus, so drop the browser's default outline.
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  // Room for a few lines, with the same breathing room above and below the text as at the sides.
  multiline: {
    minHeight: 112,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    lineHeight: 22,
    // Android centers multiline text vertically by default.
    textAlignVertical: 'top',
  },
});
