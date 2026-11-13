import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase is not configured. Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart `npx expo start`.'
  );
}

// Email links land with their result in the address bar (#access_token=…&type=recovery, or #error_code=…).
// Read it once here, before Supabase signs the link in and clears it. Web only: native apps don't open these links.
const openingHash =
  Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)) : null;

/** True when the app was opened from a password reset email. */
export const openedFromRecoveryLink = openingHash?.get('type') === 'recovery';

/** True when the app was opened from an email link that had expired or was already used. */
export const openedFromBadLink = !!openingHash?.get('error_code');

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // AsyncStorage uses localStorage on web and on-device storage on iOS/Android.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Lets sign-in links that open in the browser finish signing in. Native apps handle links differently.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// On phones, only refresh the sign-in token while the app is open.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
