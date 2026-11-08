import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ActiveSessionProvider } from '@/providers/active-session-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { AppearanceProvider, fontAssets, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <ActiveSessionProvider>
          <RootNavigator />
        </ActiveSessionProvider>
      </AuthProvider>
    </AppearanceProvider>
  );
}

function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { session, profile, isLoading } = useAuth();
  const { scheme, colors } = useTheme();
  const ready = (fontsLoaded || !!fontError) && !isLoading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;

  // Match the navigation chrome (screen backgrounds, transitions) to our palette.
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  // Only one group is reachable at a time; when sign-in state changes, the router moves to it.
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="u/[username]" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
