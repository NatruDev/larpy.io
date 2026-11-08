import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useReminderSettings } from '@/features/reminders/use-reminders';
import { Spacing } from '@/theme';

const HOURS = [17, 18, 19, 20, 21, 22];

/** "7 PM" in the device's own clock style. */
export function formatHour(hour: number) {
  return new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' });
}

/** Daily reminder on/off and time, for the settings list. */
export function ReminderSettings() {
  const { supported, settings, update, enable } = useReminderSettings();

  if (!supported) {
    return (
      <Text variant="caption" color="textMuted">
        Study reminders work in the phone app.
      </Text>
    );
  }
  if (!settings) return null;

  return (
    <View style={styles.wrap}>
      <ToggleRow
        icon="notifications"
        hue="yellow"
        label="Daily reminder"
        caption={`At ${formatHour(settings.hour)}, only on days you haven’t studied yet.`}
        value={settings.enabled}
        onValueChange={(on) => (on ? enable() : update({ ...settings, enabled: false }))}
      />
      {settings.enabled ? (
        <View style={styles.hours}>
          {HOURS.map((h) => (
            <Chip key={h} label={formatHour(h)} selected={settings.hour === h} onPress={() => update({ ...settings, hour: h })} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
