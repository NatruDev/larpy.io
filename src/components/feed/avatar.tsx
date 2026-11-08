import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Fonts, useTheme } from '@/theme';

type AvatarProps = { name: string | null; username: string | null; url?: string | null; size?: number };

function initials(name: string | null, username: string | null) {
  const source = name?.trim() || username || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
}

/** Profile photo, or initials on the accent tint until people can upload one. */
export function Avatar({ name, username, url, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (url) return <Image source={{ uri: url }} style={round} contentFit="cover" accessibilityIgnoresInvertColors />;
  return (
    <View style={[styles.fallback, round, { backgroundColor: colors.accentSoft }]}>
      <Text color="accentText" style={{ fontFamily: Fonts.extrabold, fontSize: size * 0.38 }}>
        {initials(name, username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
