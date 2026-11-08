import { useEffect } from 'react';
import { Platform } from 'react-native';

import { APP_NAME } from '@/constants/brand';

/** Sets the browser tab title on web (no-op on phones). `null` means the plain app name. */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.title = title ?? APP_NAME;
  }, [title]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return () => {
      document.title = APP_NAME;
    };
  }, []);
}
