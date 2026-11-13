import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import type { TextStyle } from 'react-native';

/** Passed to `useFonts` in the root layout. */
export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  BebasNeue_400Regular,
};

// Custom fonts on native don't respond to `fontWeight`, so each weight is its own family.
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** Tall condensed numerals for the running timer. */
  clock: 'BebasNeue_400Regular',
} as const;

export const TextVariants = {
  /** Timer digits and hero numbers */
  display: { fontFamily: Fonts.bold, fontSize: 56, lineHeight: 64, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  title: { fontFamily: Fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof TextVariants;
