import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/feed/avatar';
import { ReminderSettings } from '@/components/reminders/reminder-settings';
import { YearHeatmap } from '@/components/stats/year-heatmap';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { clearLocalData } from '@/features/local/local-store';
import { heatmapStart, useDailyTotals, useStatsSummary } from '@/features/stats/use-stats';
import { formatGoal, formatTotal } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { Fonts, Spacing } from '@/theme';

/** Profile in local mode: your numbers and year, the settings that apply, and a way to start over. */
export function LocalProfile() {
  const { profile, signOut } = useAuth();
  const { data: summary } = useStatsSummary();
  const { data: totals } = useDailyTotals(summary ? heatmapStart(summary.today) : null);
  const [confirming, setConfirming] = useState(false);
  const name = profile?.display_name || profile?.username || 'You';

  async function clearAll() {
    await clearLocalData();
    // The simplest clean slate in a browser is a reload; elsewhere, going back to onboarding is enough.
    if (Platform.OS === 'web') window.location.reload();
    else await signOut();
  }

  return (
    <Screen>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Avatar name={profile?.display_name ?? null} username={profile?.username ?? null} size={64} />
          <View style={styles.names}>
            <Text variant="title" numberOfLines={1}>
              {name}
            </Text>
            {profile?.username ? <Text color="textMuted">@{profile.username}</Text> : null}
          </View>
        </View>
        {summary ? (
          <View style={styles.numbers}>
            <Number value={String(summary.current_streak)} label="day streak" />
            <Number value={formatTotal(summary.total_seconds)} label="studied" />
            <Number value={String(summary.active_days)} label={summary.active_days === 1 ? 'day studied' : 'days studied'} />
          </View>
        ) : null}
      </Card>

      {summary ? (
        <Card style={styles.card}>
          <Text variant="heading">Last 12 months</Text>
          <YearHeatmap
            totals={totals ?? new Map()}
            today={summary.today}
            goalSeconds={summary.daily_goal_minutes * 60}
            minSeconds={summary.streak_min_seconds}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="heading">Settings</Text>
        <View style={styles.rows}>
          <Row label="Daily goal" value={profile ? formatGoal(profile.daily_goal_minutes) : '–'} />
          <Row label="Time zone" value={profile?.time_zone ?? '–'} />
          <Row label="Saved in" value="This browser" />
        </View>
        <ReminderSettings />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Your data</Text>
        <Text color="textMuted">
          Accounts aren’t live yet, so your profile and sessions are kept only in this browser. Clearing your
          browser’s site data deletes them. Save anything you want to keep with Share it after a session.
        </Text>
        {confirming ? (
          <View style={styles.confirm}>
            <Text variant="label">Delete your profile and every session on this device? This can’t be undone.</Text>
            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={() => setConfirming(false)} style={styles.grow} />
              <Button label="Delete everything" onPress={clearAll} style={styles.grow} />
            </View>
          </View>
        ) : (
          <Button label="Clear data on this device" variant="secondary" icon="trash-outline" onPress={() => setConfirming(true)} />
        )}
      </Card>
    </Screen>
  );
}

function Number({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text style={styles.numberValue}>{value}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
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
  card: { gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  names: { flex: 1 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xl },
  numberValue: { fontFamily: Fonts.extrabold, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  rows: { gap: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  confirm: { gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.md },
  grow: { flex: 1 },
});
