import { UNIQUE_VIOLATION } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Post } from '@/lib/types';

import { notifyPostsChanged } from './events';
import { removeUploads, uploadPhoto, type PickedPhoto, type UploadedMedia } from './media';

/** Sessions need this much focus to be posted (matches post_min_session_seconds() in the database). */
export const POST_MIN_SESSION_SECONDS = 5 * 60;
export const MAX_CAPTION = 500;

type NewPost = {
  userId: string;
  /** Leave out for a free post. */
  sessionId?: string;
  caption: string;
  photos: PickedPhoto[];
};

/** Uploads the photos, then creates the post. If posting fails, the uploads are removed again. */
export async function createPost({ userId, sessionId, caption, photos }: NewPost) {
  const media: UploadedMedia[] = [];
  try {
    for (const photo of photos) media.push(await uploadPhoto(userId, photo));
    const { data, error } = await supabase.rpc('create_post', {
      p_session_id: sessionId,
      p_caption: caption.trim() || undefined,
      p_media: media,
    });
    if (error) throw error;
    notifyPostsChanged();
    return data as Post;
  } catch (e) {
    await removeUploads(media.map((m) => m.path)).catch(() => {});
    throw e;
  }
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
  notifyPostsChanged();
}

/** Gives or takes back Respect. Giving it twice is harmless. */
export async function setRespect(postId: string, userId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('reactions').insert({ post_id: postId })
    : await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', userId);
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}
