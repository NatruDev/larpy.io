import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { LOCAL_MODE } from './backend';
import type { Database } from './database.types';

// In local mode nothing talks to Supabase (see ./backend.ts). The client still exists so shared code
// type-checks, but it points nowhere and never signs in or refreshes.
const supabaseUrl = LOCAL_MODE ? 'http://localhost:1' : process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = LOCAL_MODE ? 'local-mode' : process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // AsyncStorage uses localStorage on web and on-device storage on iOS/Android.
    storage: AsyncStorage,
    autoRefreshToken: !LOCAL_MODE,
    persistSession: !LOCAL_MODE,
    // Lets sign-in links that open in the browser finish signing in. Native apps handle links differently.
    detectSessionInUrl: Platform.OS === 'web' && !LOCAL_MODE,
  },
});

// On phones, only refresh the sign-in token while the app is open.
if (Platform.OS !== 'web' && !LOCAL_MODE) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
