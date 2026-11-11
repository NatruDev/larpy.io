import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Subject } from '@/lib/types';
import { Fonts, OnSubject, Spacing, subjectColor, useTheme } from '@/theme';

const SIZE = 52;

type SubjectPickerProps = {
  subjects: Pick<Subject, 'id' | 'name' | 'color'>[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Shows a "New" circle at the end that calls this. */
  onAdd?: () => void;
  /** Highlights the "New" circle while its form is open. */
  adding?: boolean;
};

/**
 * A row of subject circles (initial in the subject's color); the picked one fills in. "None" comes first,
 * and "New" last when `onAdd` is given.
 */
export function SubjectPicker({ subjects, selectedId, onSelect, onAdd, adding = false }: SubjectPickerProps) {
  const { colors, scheme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Subject">
      <Option
        label="None"
        selected={selectedId === null}
        color={colors.textMuted}
        fill={colors.borderStrong}
        onPress={() => onSelect(null)}>
        <Ionicons name="remove" size={22} color={selectedId === null ? colors.text : colors.textMuted} />
      </Option>
      {subjects.map((s) => {
        const color = subjectColor(s.color, scheme, colors.accent);
        const selected = s.id === selectedId;
        return (
          <Option key={s.id} label={s.name} selected={selected} color={color} onPress={() => onSelect(s.id)}>
            <Text style={[styles.initial, { color: selected ? OnSubject : color }]}>
              {s.name.slice(0, 1).toUpperCase()}
            </Text>
          </Option>
        );
      })}
      {onAdd ? (
        <Option
          label="New"
          role="button"
          selected={adding}
          color={colors.textMuted}
          fill={colors.borderStrong}
          onPress={onAdd}>
          <Ionicons name="add" size={24} color={adding ? colors.text : colors.textMuted} />
        </Option>
      ) : null}
    </ScrollView>
  );
}

type OptionProps = {
  label: string;
  selected: boolean;
  color: string;
  /** Fill when selected; defaults to `color`. */
  fill?: string;
  /** "button" for actions like New, which aren't a choice in the radio group. */
  role?: 'radio' | 'button';
  onPress: () => void;
  children: ReactNode;
};

function Option({ label, selected, color, fill = color, role = 'radio', onPress, children }: OptionProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={role === 'button' ? 'New subject' : label}
      accessibilityState={role === 'radio' ? { checked: selected } : { expanded: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      {/* The ring keeps a gap around the filled circle so the selection reads at a glance. */}
      <View style={[styles.ring, { borderColor: selected ? color : 'transparent' }]}>
        <View
          style={[
            styles.circle,
            selected ? { backgroundColor: fill } : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          {children}
        </View>
      </View>
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.label, { color: selected ? colors.text : colors.textMuted }, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  option: { width: 68, alignItems: 'center', gap: Spacing.xs + 2 },
  pressed: { opacity: 0.7 },
  ring: { padding: 3, borderRadius: (SIZE + 10) / 2, borderWidth: 2 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 24 },
  label: { textAlign: 'center' },
  labelSelected: { fontFamily: Fonts.semibold },
});
