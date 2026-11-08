import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, useTheme } from '@/theme';

import { Text } from './text';

type ScreenProps = {
  title?: string;
  children: ReactNode;
  /** Pinned below the scrolling content, e.g. a primary action that should never scroll out of view. */
  footer?: ReactNode;
};

/** Standard screen: safe-area aware, scrollable, and phone-width on wide browsers. */
export function Screen({ title, children, footer }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          {title ? <Text variant="title">{title}</Text> : null}
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View style={styles.footerWrap}>
          <View style={styles.footer}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.lg + Spacing.xs,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  footerWrap: { alignItems: 'center' },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.lg + Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
});
