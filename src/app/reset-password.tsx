import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { Spacing, useTheme } from '@/theme';

const MIN_PASSWORD = 6;

/** Reached only from a password reset email (see the recovery guard in the root layout). */
export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const { session, endRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSaved(true);
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setBusy(false);
    }
  }

  // The link didn't sign anyone in: it expired, was already used, or was opened in a different browser.
  if (!session) {
    return (
      <Screen>
        <View style={styles.center}>
          <Card style={styles.card}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} />
            <Text variant="heading">This reset link didn’t work</Text>
            <Text color="textMuted">
              Links work once and expire after an hour. Go back to sign in and choose Forgot password? to get a new
              one.
            </Text>
            <Button label="Back to sign in" onPress={endRecovery} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (saved) {
    return (
      <Screen>
        <View style={styles.center}>
          <Card style={styles.card}>
            <Ionicons name="checkmark-circle" size={40} color={colors.accent} />
            <Text variant="heading">Password updated</Text>
            <Text color="textMuted">Use your new password next time you sign in.</Text>
            <Button label="Continue" onPress={endRecovery} />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text variant="heading">Choose a new password</Text>
            {session.user.email ? (
              <Text variant="caption" color="textMuted">
                For {session.user.email}
              </Text>
            ) : null}
          </View>
          <TextField
            label="New password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            secureTextEntry
            autoFocus
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            label="Confirm new password"
            value={confirm}
            onChangeText={(text) => {
              setConfirm(text);
              setError(null);
            }}
            placeholder="Type it again"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={save}
            error={error}
          />
          <Button label={busy ? 'Saving…' : 'Save new password'} onPress={save} disabled={busy} />
          <Button label="Not now" variant="secondary" onPress={endRecovery} disabled={busy} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingVertical: Spacing.xl },
  card: { gap: Spacing.lg, padding: Spacing.xl },
  header: { gap: Spacing.xs },
});
