import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import type { PickedPhoto } from '@/features/feed/media';
import { createPost, MAX_CAPTION } from '@/features/feed/posts';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { Spacing } from '@/theme';

import { PhotoStrip } from './photo-strip';

/** A free post: text, photos or both, with no session behind it. */
export function Composer() {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !text.trim() && photos.length === 0;

  async function post() {
    if (!session || empty) return;
    setPosting(true);
    setError(null);
    try {
      await createPost({ userId: session.user.id, caption: text, photos });
      setText('');
      setPhotos([]);
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <TextField
        label="New post"
        value={text}
        onChangeText={setText}
        placeholder="How's studying going?"
        maxLength={MAX_CAPTION}
        multiline
        editable={!posting}
        error={error}
      />
      <View style={styles.footer}>
        <PhotoStrip photos={photos} onChange={setPhotos} disabled={posting} />
        <Button label={posting ? 'Posting…' : 'Post'} onPress={post} disabled={empty || posting} style={styles.button} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md },
  button: { minWidth: 120 },
});
