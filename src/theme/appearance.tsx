import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildPalette, DEFAULT_ACCENT, isAccentName, type AccentName, type ColorScheme } from './colors';

const ACCENT_KEY = 'appearance.accent';

type Appearance = {
  scheme: ColorScheme;
  accent: AccentName;
  setAccent: (accent: AccentName) => void;
};

const AppearanceContext = createContext<Appearance | null>(null);

/**
 * Holds the user's accent choice (saved on this device). The look is dark-first (charcoal + coral), so
 * the app stays dark whatever the system setting; the light palette is kept for a future toggle.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const scheme: ColorScheme = 'dark';
  const [accent, setAccentState] = useState<AccentName>(DEFAULT_ACCENT);

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_KEY)
      .then((saved) => {
        if (isAccentName(saved)) setAccentState(saved);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<Appearance>(
    () => ({
      scheme,
      accent,
      setAccent: (next) => {
        setAccentState(next);
        AsyncStorage.setItem(ACCENT_KEY, next).catch(() => {});
      },
    }),
    [scheme, accent]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside <AppearanceProvider>.');
  return value;
}

/** Current colors: the dark palette with the user's accent. */
export function useTheme() {
  const { scheme, accent } = useAppearance();
  const colors = useMemo(() => buildPalette(scheme, accent), [scheme, accent]);
  return { scheme, colors };
}
