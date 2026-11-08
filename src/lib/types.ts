// Row shapes for the app, taken from the generated database types so they can't drift from the schema.
// After changing a migration, regenerate with `npm run db:types` (local Supabase must be running).
import type { Tables } from './database.types';

export type { Database, Enums, Json, Tables } from './database.types';

export type Profile = Tables<'profiles'>;
export type Session = Tables<'sessions'>;
export type SessionPause = Tables<'session_pauses'>;
export type Subject = Tables<'subjects'>;
export type DailyStats = Tables<'daily_stats'>;
export type Follow = Tables<'follows'>;
export type Reaction = Tables<'reactions'>;
export type Post = Tables<'posts'>;
export type PostMedia = Tables<'post_media'>;
export type Block = Tables<'blocks'>;

// What get_feed returns (one item per post). The generated types only know it as `Json`.
export type FeedItem = {
  post: Pick<Post, 'id' | 'author_id' | 'session_id' | 'caption' | 'created_at' | 'edited_at'>;
  author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  /** Null for a free post. */
  session:
    | (Pick<
        Session,
        | 'id'
        | 'source'
        | 'focused_seconds'
        | 'goal_minutes'
        | 'pomodoro_focus_minutes'
        | 'pomodoro_break_minutes'
        | 'started_at'
        | 'ended_at'
        | 'paused_seconds'
      > & {
        subject: Pick<Subject, 'id' | 'name' | 'color'> | null;
        pauses: Pick<SessionPause, 'kind' | 'started_at' | 'ended_at'>[];
      })
    | null;
  /** In order. Media waiting for moderation only shows up for its author. */
  media: Pick<PostMedia, 'id' | 'kind' | 'path' | 'thumbnail_path' | 'width' | 'height' | 'duration_seconds' | 'status'>[];
  reaction_count: number;
  reacted_by_me: boolean;
};

type ProfileHeader = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

// What get_profile returns (null when the username doesn't exist).
export type ProfilePage =
  | {
      /** Private profile, or a block either way: only the header. */
      hidden: true;
      profile: ProfileHeader;
      is_me: false;
      blocked_by_me: boolean;
    }
  | {
      hidden: false;
      profile: ProfileHeader & Pick<Profile, 'bio' | 'daily_goal_minutes' | 'created_at'>;
      is_me: boolean;
      blocked_by_me: false;
      /** Their local date ('YYYY-MM-DD'), for the heatmap. */
      today: string;
      streak_min_seconds: number;
      is_following: boolean;
      follows_me: boolean;
      followers: number;
      following: number;
      posts: number;
      current_streak: number;
      best_streak: number;
      total_seconds: number;
      heatmap: { day: string; seconds: number }[];
    };
