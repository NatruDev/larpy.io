import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { APP_NAME } from '@/constants/brand';
import { friendlyError } from '@/lib/errors';
import { openedFromBadLink, supabase } from '@/lib/supabase';
import { Radius, Spacing, useTheme } from '@/theme';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export default function SignInScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    openedFromBadLink ? 'That email link has expired or was already used. Request a new one below.' : null
  );
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';
  const isForgot = mode === 'forgot';

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

  async function sendResetLink() {
    setError(null);
    setNotice(null);
    const address = email.trim();
    if (!address) {
      setError('Enter the email you signed up with.');
      return;
    }
    setBusy(true);
    try {
      // On phones there's no page to land on, so the link opens the web app (the Site URL) instead.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        address,
        Platform.OS === 'web' ? { redirectTo: `${window.location.origin}/reset-password` } : undefined
      );
      if (resetError) throw resetError;
      setPassword('');
      setMode('sign-in');
      // Same message whether or not the account exists, so this form can't be used to look people up.
      setNotice(`If there's an account for ${address}, we've emailed it a link to choose a new password.`);
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
          {isForgot ? (
            <View style={styles.forgotHeader}>
              <Text variant="heading">Reset your password</Text>
              <Text variant="caption" color="textMuted">
                Enter your email and we’ll send you a link to choose a new one.
              </Text>
            </View>
          ) : (
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
          )}

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@school.edu"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={isForgot ? sendResetLink : undefined}
          />
          {isForgot ? null : (
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
          )}
          {mode === 'sign-in' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => switchMode('forgot')}
              hitSlop={8}
              style={styles.forgotLink}>
              <Text variant="label" color="accentText">
                Forgot password?
              </Text>
            </Pressable>
          ) : null}

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

          {isForgot ? (
            <>
              <Button label={busy ? 'Sending…' : 'Send reset link'} onPress={sendResetLink} disabled={busy} />
              <Button
                label="Back to sign in"
                variant="secondary"
                onPress={() => switchMode('sign-in')}
                disabled={busy}
              />
            </>
          ) : (
            <Button
              label={busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
              onPress={submit}
              disabled={busy}
            />
          )}
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
  forgotHeader: { gap: Spacing.xs },
  forgotLink: { alignSelf: 'flex-end', marginTop: -Spacing.sm },
  notice: { padding: Spacing.md, borderRadius: Radius.sm },
});
