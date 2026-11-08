import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { CardRef } from '@/components/share/share-card';

/** Phones: capture the card as a PNG file at 1080 px wide. See share-image.web.ts for browsers. */
export async function captureCard(ref: RefObject<CardRef | null>, width: number, height: number) {
  if (!ref.current) throw new Error('The card isn’t ready yet.');
  const scale = 1080 / width / PixelRatio.get();
  return captureRef(ref, { format: 'png', quality: 1, width: width * scale, height: height * scale, result: 'tmpfile' });
}

/** The share sheet also has "Save image", so phones only need one button. */
export const canSaveSeparately = false;

export async function saveImage(_image: string, _name: string) {}

/** Opens the share sheet. Returns false if sharing isn't available. */
export async function shareImage(image: string, _name: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(image, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
  return true;
}
