import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { APP_NAME } from '@/constants/brand';
import { useReminderSettings } from '@/features/reminders/use-reminders';
import { Hues, Spacing, withAlpha } from '@/theme';

import { formatHour } from './reminder-settings';

/**
 * The soft ask: explain reminders in our own words first, and only show the system prompt if they say
 * yes, so a "no" now doesn't lock reminders off for good. Shown once per device, after a finished session.
 */
export function ReminderAsk() {
  const { supported, settings, enable, update } = useReminderSettings();
  const [result, setResult] = useState<'on' | 'blocked' | null>(null);

  if (!supported || !settings) return null;
  if (settings.asked && !result) return null;

  if (result) {
    return (
      <Card>
        <Text color="textMuted">
          {result === 'on'
            ? `Done. You’ll get a nudge at ${formatHour(settings.hour)} on days you haven’t studied. Change it in Profile.`
            : `Notifications are off for ${APP_NAME}. You can turn them on in your phone’s settings, then in Profile.`}
        </Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: withAlpha(Hues.yellow, 0.16) }]}>
          <Ionicons name="notifications" size={18} color={Hues.yellow} />
        </View>
        <View style={styles.text}>
          <Text variant="bodyStrong">Want a nudge to keep your streak?</Text>
          <Text variant="caption" color="textMuted">
            One reminder at {formatHour(settings.hour)}, only on days you haven’t studied yet.
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button label="Not now" variant="secondary" onPress={() => update({ ...settings, asked: true })} style={styles.grow} />
        <Button label="Remind me" onPress={async () => setResult((await enable()) ? 'on' : 'blocked')} style={styles.grow} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  grow: { flex: 1 },
});
