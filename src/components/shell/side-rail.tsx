import Ionicons from '@expo/vector-icons/Ionicons';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { APP_NAME } from '@/constants/brand';
import { Fonts, Hues, Radius, Spacing, useTheme, withAlpha } from '@/theme';

import { NAV_ITEMS, type NavItem } from './nav-items';

/** Left nav for tablet and desktop widths: icon + label rows, split from the content by a hairline. */
export function SideRail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: colors.background,
          borderRightColor: colors.border,
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: colors.accent }]}>
          <Text style={[styles.markLetter, { color: colors.onAccent }]}>{APP_NAME[0]}</Text>
        </View>
        <Text style={styles.brandName}>{APP_NAME}</Text>
      </View>

      <View style={styles.items}>
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} asChild>
            <RailItem item={item} />
          </TabTrigger>
        ))}
      </View>

      <TabTrigger name="focus" asChild>
        <StartFocus />
      </TabTrigger>
    </View>
  );
}

function RailItem({ item, isFocused, onPress, onLongPress }: TabTriggerSlotProps & { item: NavItem }) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const hue = Hues[item.hue];

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isFocused }}
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.item,
        isFocused ? { backgroundColor: withAlpha(hue, 0.14) } : hovered && { backgroundColor: colors.surface },
      ]}>
      <Ionicons name={isFocused ? item.activeIcon : item.icon} size={22} color={hue} />
      <Text
        variant="bodyStrong"
        style={[styles.itemLabel, isFocused ? { color: hue, fontFamily: Fonts.bold } : { color: colors.text }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function StartFocus({ onPress, onLongPress }: TabTriggerSlotProps) {
  return <Button label="Start focusing" icon="play" onPress={onPress} onLongPress={onLongPress} />;
}

const styles = StyleSheet.create({
  rail: {
    width: 232,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xl,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.sm },
  mark: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLetter: { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 22 },
  brandName: { fontFamily: Fonts.bold, fontSize: 20, letterSpacing: -0.3 },
  items: { flex: 1, gap: Spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    borderRadius: Radius.md - 4,
  },
  itemLabel: { fontSize: 15 },
});
