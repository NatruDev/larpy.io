import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MAX_PHOTOS, pickPhotos, type PickedPhoto } from '@/features/feed/media';
import { Radius, Spacing, useTheme } from '@/theme';

type Props = {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
};

const SIZE = 72;

/** Picked photos as thumbnails with a remove button, plus an "Add photo" tile while there's room. */
export function PhotoStrip({ photos, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const room = MAX_PHOTOS - photos.length;

  async function add() {
    const picked = await pickPhotos(room);
    if (picked.length) onChange([...photos, ...picked].slice(0, MAX_PHOTOS));
  }

  return (
    <View style={styles.row}>
      {photos.map((p, i) => (
        <View key={`${p.uri}-${i}`}>
          <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${i + 1}`}
            disabled={disabled}
            onPress={() => onChange(photos.filter((_, j) => j !== i))}
            hitSlop={8}
            style={[styles.remove, { backgroundColor: colors.text }]}>
            <Ionicons name="close" size={14} color={colors.background} />
          </Pressable>
        </View>
      ))}
      {room > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          disabled={disabled}
          onPress={add}
          style={({ pressed }) => [
            styles.thumb,
            styles.add,
            { backgroundColor: colors.borderStrong },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {photos.length ? 'Add' : 'Photo'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: { width: SIZE, height: SIZE, borderRadius: Radius.md },
  add: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
