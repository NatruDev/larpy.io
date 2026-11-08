import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { computeTimer } from '@/features/timer/engine';
import { clockSeconds, phaseLabel, sessionTitle } from '@/features/timer/labels';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useServerNow } from '@/hooks/use-server-now';
import { formatClock } from '@/lib/format';
import { useActiveSession } from '@/providers/active-session-provider';
import { Fonts, Radius, Spacing, subjectColor, useTheme } from '@/theme';

/** Shown on every tab while a session runs (started here or on another device). Opens the timer. */
export function ActiveSessionBanner() {
  const { colors, scheme } = useTheme();
  const { session, pauses, offsetMs } = useActiveSession();
  const now = useServerNow(offsetMs, !!session);
  const state = session ? computeTimer(session, pauses, now) : null;

  useDocumentTitle(session && state ? sessionTitle(state, session.subject?.name) : null);

  if (!session || !state) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open the running session"
      onPress={() => router.push('/session')}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: colors.accentSoft },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.dot, { backgroundColor: subjectColor(session.subject?.color, scheme, colors.accent) }]} />
      <View style={styles.text}>
        <Text variant="label" numberOfLines={1}>
          {session.subject?.name ?? 'Focus session'}
        </Text>
        <Text variant="caption" color="accentText">
          {phaseLabel(state)}
        </Text>
      </View>
      <Text style={[styles.clock, { color: colors.accentText }]}>{formatClock(clockSeconds(state))}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.accentText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  pressed: { opacity: 0.85 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1 },
  clock: { fontFamily: Fonts.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
});
