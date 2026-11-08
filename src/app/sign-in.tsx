import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { APP_NAME } from '@/constants/brand';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Radius, Spacing, useTheme } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Enter your email and a password.');
      return;
    }
    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: Platform.OS === 'web' ? { emailRedirectTo: window.location.origin } : undefined,
        });
        if (signUpError) throw signUpError;
        // With email confirmation on, there is no session until the link is clicked.
        if (!data.session) {
          setNotice(`We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`);
          setMode('sign-in');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.brand}>
          <Text variant="title" style={styles.brandName}>
            {APP_NAME}
          </Text>
          <Text color="textMuted" style={styles.centerText}>
            Time your study sessions, keep your streak going, and study alongside friends.
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={[styles.segment, { backgroundColor: colors.background }]}>
            {(['sign-in', 'sign-up'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => switchMode(m)}
                style={[styles.segmentItem, mode === m && { backgroundColor: colors.surface }]}>
                <Text variant="label" color={mode === m ? 'text' : 'textMuted'}>
                  {m === 'sign-in' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@school.edu"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
            secureTextEntry
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            onSubmitEditing={submit}
          />

          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          {notice ? (
            <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
              <Text variant="caption" color="accentText">
                {notice}
              </Text>
            </View>
          ) : null}

          <Button
            label={busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            onPress={submit}
            disabled={busy}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: Spacing.xl, paddingVertical: Spacing.xl },
  brand: { alignItems: 'center', gap: Spacing.sm },
  brandName: { fontSize: 34, lineHeight: 40 },
  centerText: { textAlign: 'center', maxWidth: 340 },
  card: { gap: Spacing.lg, padding: Spacing.xl },
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm + 2 },
  notice: { padding: Spacing.md, borderRadius: Radius.sm },
});
