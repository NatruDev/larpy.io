import { StyleSheet, View } from 'react-native';

import { ProfileView } from '@/components/profile/profile-view';
import { ReminderSettings } from '@/components/reminders/reminder-settings';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatGoal } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { Spacing } from '@/theme';

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();

  return (
    <ProfileView username={profile?.username}>
      <Card>
        <Text variant="heading">Settings</Text>
        <View style={styles.rows}>
          <Row label="Daily goal" value={profile ? formatGoal(profile.daily_goal_minutes) : '–'} />
          <Row label="Time zone" value={profile?.time_zone ?? '–'} />
          <Row label="Email" value={session?.user.email ?? '–'} />
        </View>
        <View style={styles.reminders}>
          <ReminderSettings />
        </View>
        <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.signOut} />
      </Card>
    </ProfileView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text color="textMuted">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.sm, marginTop: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  signOut: { marginTop: Spacing.sm },
  reminders: { marginTop: Spacing.md },
});
