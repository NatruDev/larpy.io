import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MAX_SUBJECT_LENGTH } from '@/features/subjects/use-subjects';
import { friendlyError } from '@/lib/errors';
import { Spacing } from '@/theme';

type Props = {
  /** Saves the subject; throw to show the error under the field. */
  onAdd: (name: string) => Promise<void>;
  onCancel: () => void;
};

/** Inline form under the subject picker for adding a subject without leaving the Focus screen. */
export function NewSubjectForm({ onAdd, onCancel }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    if (!name.trim()) {
      setError('Give the subject a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(name);
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label="New subject"
        placeholder="e.g. Organic Chemistry"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        autoFocus
        autoCapitalize="words"
        maxLength={MAX_SUBJECT_LENGTH}
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} style={styles.grow} />
        <Button label={busy ? 'Adding…' : 'Add subject'} onPress={save} disabled={busy} style={styles.grow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md },
  grow: { flex: 1 },
});
