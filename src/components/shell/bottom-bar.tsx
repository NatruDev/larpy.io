import Ionicons from '@expo/vector-icons/Ionicons';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Fonts, Hues, Spacing, useTheme } from '@/theme';

import { NAV_ITEMS, type NavItem } from './nav-items';
import { StartFocusButton } from './start-focus-button';

/** Phone tab bar. Focus sits in the middle as a raised play button. */
export function BottomBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sides = NAV_ITEMS.filter((item) => item.name !== 'focus');
  const left = sides.slice(0, 2);
  const right = sides.slice(2);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
        },
      ]}>
      {left.map((item) => (
        <TabTrigger key={item.name} name={item.name} asChild>
          <BarItem item={item} />
        </TabTrigger>
      ))}
      <View style={styles.center}>
        <TabTrigger name="focus" asChild>
          <StartFocusButton size={58} />
        </TabTrigger>
      </View>
      {right.map((item) => (
        <TabTrigger key={item.name} name={item.name} asChild>
          <BarItem item={item} />
        </TabTrigger>
      ))}
    </View>
  );
}

function BarItem({ item, isFocused, onPress, onLongPress }: TabTriggerSlotProps & { item: NavItem }) {
  const { colors } = useTheme();
  const hue = Hues[item.hue];

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isFocused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}>
      <Ionicons name={isFocused ? item.activeIcon : item.icon} size={24} color={isFocused ? hue : colors.textMuted} />
      <Text variant="caption" style={[styles.label, { color: isFocused ? hue : colors.textMuted }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.xs },
  // Lifts the play button above the bar.
  center: { flex: 1, alignItems: 'center', marginTop: -Spacing.xl },
  label: { fontFamily: Fonts.semibold, fontSize: 11 },
});
