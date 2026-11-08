import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Fonts, Hues, Spacing, withAlpha, type HueName } from '@/theme';

type StatTileProps = {
  label: string;
  value: string;
  detail?: string;
  /** Small icon beside the label, drawn in `hue` on a tint of it. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  hue?: HueName;
  children?: ReactNode;
  style?: ViewStyle;
};

/** Label, a big value (proportional figures), an optional detail line and extra content like a meter. */
export function StatTile({ label, value, detail, icon, hue = 'coral', children, style }: StatTileProps) {
  const color = Hues[hue];
  return (
    <Card style={[styles.tile, style]}>
      <View style={styles.header}>
        {icon ? (
          <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.16) }]}>
            <Ionicons name={icon} size={14} color={color} />
          </View>
        ) : null}
        <Text variant="label" color="textMuted">
          {label}
        </Text>
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {detail ? (
        <Text variant="caption" color="textMuted">
          {detail}
        </Text>
      ) : null}
      {children ? <View style={styles.extra}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 2, padding: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: Fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  extra: { marginTop: Spacing.sm },
});
