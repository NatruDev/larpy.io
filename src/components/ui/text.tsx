import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { TextVariants, useTheme, type TextVariant } from '@/theme';

type TextColor = 'text' | 'textMuted' | 'accentText' | 'onAccent' | 'danger';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[TextVariants[variant], { color: colors[color] }, style]} {...rest} />;
}
