import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { APP_NAME } from '@/constants/brand';
import { supabase } from '@/lib/supabase';

export const POST_MEDIA_BUCKET = 'post-media';
export const MAX_PHOTOS = 4;
// Phone photos are 3–8 MB; 1600 px wide JPEGs are a few hundred KB and still sharp in the feed.
const MAX_WIDTH = 1600;

export type PickedPhoto = { uri: string; width: number; height: number };

export type UploadedMedia = { kind: 'photo'; path: string; width: number; height: number };

/** Opens the photo library. On web this must run straight from a button press. */
export async function pickPhotos(limit: number): Promise<PickedPhoto[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Opens the camera for one photo (on a laptop browser this falls back to choosing a file). Null if cancelled. */
export async function takePhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error(`Camera access is off for ${APP_NAME}. Turn it on in your settings.`);
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

/** Shrinks a photo, saves it as JPEG and uploads it into the user's own folder. */
export async function uploadPhoto(userId: string, photo: PickedPhoto): Promise<UploadedMedia> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (photo.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH, height: null });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error('Couldn’t read that photo. Try another one.');

  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, decodeBase64(saved.base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  return { kind: 'photo', path, width: saved.width, height: saved.height };
}

export async function removeUploads(paths: string[]) {
  if (paths.length) await supabase.storage.from(POST_MEDIA_BUCKET).remove(paths);
}

/** Signed links to private files, valid for an hour. Missing files come back as null. */
export async function signMediaUrls(paths: string[]) {
  const urls = new Map<string, string>();
  if (!paths.length) return urls;
  const { data } = await supabase.storage.from(POST_MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
  }
  return urls;
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
