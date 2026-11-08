import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Hues, Spacing, withAlpha, type HueName } from '@/theme';

import { Switch } from './switch';
import { Text } from './text';

type ToggleRowProps = {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Leading icon in `hue` on a tint of it, for settings-style lists. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  hue?: HueName;
};

export function ToggleRow({ label, caption, value, onValueChange, disabled, icon, hue = 'coral' }: ToggleRowProps) {
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      {icon ? (
        <View style={[styles.badge, { backgroundColor: withAlpha(Hues[hue], 0.16) }]}>
          <Ionicons name={icon} size={17} color={Hues[hue]} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {caption ? (
          <Text variant="caption" color="textMuted">
            {caption}
          </Text>
        ) : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  text: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
