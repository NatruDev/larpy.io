import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';

import type { HueName } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type NavItem = {
  /** Matches the TabTrigger name and the route file in src/app/(tabs)/ */
  name: 'home' | 'focus' | 'stats' | 'ranks' | 'profile';
  href: Href;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  /** Each tab has its own color for its icon and selected state. */
  hue: HueName;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { name: 'home', hue: 'coral', href: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'focus', hue: 'orange', href: '/focus', label: 'Focus', icon: 'timer-outline', activeIcon: 'timer' },
  { name: 'stats', hue: 'blue', href: '/stats', label: 'Stats', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  { name: 'ranks', hue: 'yellow', href: '/ranks', label: 'Ranks', icon: 'trophy-outline', activeIcon: 'trophy' },
  { name: 'profile', hue: 'violet', href: '/profile', label: 'Profile', icon: 'person-circle-outline', activeIcon: 'person-circle' },
];
