import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { APP_NAME } from '@/constants/brand';
import { pickPhotos, takePhoto } from '@/features/feed/media';
import { canSaveSeparately, captureCard, saveImage, shareImage } from '@/features/share/share-image';
import { addDays, startOfWeek } from '@/features/stats/dates';
import { useDailyTotals, type StatsSummary } from '@/features/stats/use-stats';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { SessionPause } from '@/lib/types';
import type { SessionWithSubject } from '@/providers/active-session-provider';
import { useAuth } from '@/providers/auth-provider';
import { Radius, Spacing, useTheme } from '@/theme';

import { CARD_HEIGHT, CARD_WIDTH, ShareCard, type CardDesign, type CardRef } from './share-card';

const DESIGNS = [
  { value: 'session', label: 'Session' },
  { value: 'streak', label: 'Streak' },
  { value: 'year', label: 'Year' },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  session: SessionWithSubject;
  summary: StatsSummary;
};

/** Pick a card design, then save it as an image or share it. */
export function ShareSheet({ visible, onClose, session, summary }: Props) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [design, setDesign] = useState<CardDesign>('session');
  const [background, setBackground] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pauses, setPauses] = useState<Pick<SessionPause, 'kind' | 'started_at' | 'ended_at'>[]>([]);
  const preview = useRef<CardRef>(null);
  // Browsers export from a full-size copy kept off screen, so a shrunken preview never shrinks the image.
  const offscreen = useRef<CardRef>(null);
  const { width: windowWidth } = useWindowDimensions();
  const room = windowWidth - (Spacing.lg + Spacing.xl) * 2;
  const scale = Math.min(1, room / CARD_WIDTH);
  const { data: totals } = useDailyTotals(addDays(startOfWeek(summary.today), -19 * 7));

  // The timeline bar on the session card needs the session's breaks.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    supabase
      .from('session_pauses')
      .select('kind, started_at, ended_at')
      .eq('session_id', session.id)
      .order('started_at')
      .then(({ data }) => {
        if (!cancelled && data) setPauses(data);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, session.id]);

  const name = `${APP_NAME.toLowerCase()}-${design}-${summary.today}`;
  const cardData = { session, pauses, summary, totals: totals ?? new Map(), username: profile?.username ?? null };

  async function chooseBackground(source: 'library' | 'camera') {
    setMessage(null);
    try {
      const photo = source === 'library' ? (await pickPhotos(1))[0] : await takePhoto();
      if (photo) setBackground(photo.uri);
    } catch (e) {
      setMessage({ text: friendlyError(e as Error, 'Couldn’t open the camera.'), error: true });
    }
  }

  async function run(kind: 'save' | 'share') {
    setBusy(kind);
    setMessage(null);
    try {
      const image = await captureCard(Platform.OS === 'web' ? offscreen : preview, CARD_WIDTH, CARD_HEIGHT);
      if (kind === 'save') {
        await saveImage(image, name);
        setMessage({ text: 'Saved to your downloads.', error: false });
      } else if (!(await shareImage(image, name, 'My study session'))) {
        // No share sheet here (e.g. Firefox): download it so it can be posted by hand.
        await saveImage(image, name);
        setMessage({ text: 'This browser can’t open a share sheet, so the image was downloaded instead.', error: false });
      }
    } catch (e) {
      setMessage({ text: friendlyError(e as Error, 'Couldn’t make the image. Try again.'), error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={[styles.backdrop, { backgroundColor: colors.background }]} onPress={onClose} />
      {Platform.OS === 'web' ? (
        <View style={styles.offscreen} pointerEvents="none" aria-hidden>
          <ShareCard ref={offscreen} design={design} data={cardData} background={background} />
        </View>
      ) : null}
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="heading">Share your session</Text>
            <Segmented options={DESIGNS} value={design} onChange={setDesign} accessibilityLabel="Card design" />
            <View style={[styles.preview, { width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }]}>
              <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
                <ShareCard ref={preview} design={design} data={cardData} background={background} />
              </View>
            </View>
            <View style={styles.backgrounds}>
              <Button label="Photo" variant="secondary" icon="image-outline" onPress={() => chooseBackground('library')} style={styles.grow} />
              <Button label="Camera" variant="secondary" icon="camera-outline" onPress={() => chooseBackground('camera')} style={styles.grow} />
              {background ? (
                <Button label="Remove" variant="secondary" icon="close" onPress={() => setBackground(null)} style={styles.grow} />
              ) : null}
            </View>
            {message ? (
              <Text variant="caption" color={message.error ? 'danger' : 'textMuted'} style={styles.message}>
                {message.text}
              </Text>
            ) : null}
            <View style={styles.buttons}>
              {canSaveSeparately ? (
                <Button
                  label={busy === 'save' ? 'Saving…' : 'Save image'}
                  variant="secondary"
                  icon="download-outline"
                  onPress={() => run('save')}
                  disabled={!!busy}
                  style={styles.grow}
                />
              ) : null}
              <Button
                label={busy === 'share' ? 'Opening…' : 'Share'}
                icon="share-outline"
                onPress={() => run('share')}
                disabled={!!busy}
                style={styles.grow}
              />
            </View>
            <Button label="Close" variant="secondary" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.85 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  sheet: { width: '100%', maxWidth: CARD_WIDTH + Spacing.xl * 2, maxHeight: '100%', borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  content: { padding: Spacing.xl, gap: Spacing.md },
  preview: { alignSelf: 'center' },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  message: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  backgrounds: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
});
