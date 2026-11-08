import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { Text } from './text';

type SegmentedProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** A row of mutually exclusive options, e.g. This week / This month / All time. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.wrap, { backgroundColor: colors.background }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && { backgroundColor: colors.borderStrong }]}>
            <Text variant="label" color={active ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4, gap: 4 },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
});
