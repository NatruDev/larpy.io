import renderToCanvas from 'html2canvas-pro';
import type { RefObject } from 'react';

import type { CardRef } from '@/components/share/share-card';

/** Browsers: render the card at 1080 px wide and return it as a PNG data URI. */
export async function captureCard(ref: RefObject<CardRef | null>, width: number, _height: number) {
  const node = ref.current as unknown as HTMLElement | null;
  if (!node) throw new Error('The card isn’t ready yet.');
  const canvas = await renderToCanvas(node, { scale: 1080 / width, backgroundColor: null, useCORS: true, logging: false });
  return canvas.toDataURL('image/png');
}

export const canSaveSeparately = true;

/** Downloads the image. */
export async function saveImage(image: string, name: string) {
  const a = document.createElement('a');
  a.href = image;
  a.download = `${name}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Opens the system share sheet with the image, where the browser supports sharing files (most phones,
 * Chrome and Edge on Windows). Returns false otherwise, so the caller can offer a download instead.
 */
export async function shareImage(image: string, name: string, title: string) {
  const blob = await (await fetch(image)).blob();
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title });
  } catch (e) {
    // Closing the share sheet counts as done, not as a failure.
    if (e instanceof DOMException && e.name === 'AbortError') return true;
    throw e;
  }
  return true;
}
