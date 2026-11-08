
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id"?: string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_stats": {
                  Row: {
                    "day": string,"focused_seconds": number,"sessions_count": number,"timer_focused_seconds": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"focused_seconds"?: number,"sessions_count"?: number,"timer_focused_seconds"?: number,"user_id": string
                  }
                  Update: {
                    "day"?: string,"focused_seconds"?: number,"sessions_count"?: number,"timer_focused_seconds"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_stats_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"followee_id": string,"follower_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followee_id": string,"follower_id": string
                  }
                  Update: {
                    "created_at"?: string,"followee_id"?: string,"follower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_media": {
                  Row: {
                    "created_at": string,"duration_seconds": number | null,"height": number | null,"id": string,"kind": Database["public"]['Enums']["media_kind"],"path": string,"position": number,"post_id": string,"status": Database["public"]['Enums']["media_status"],"thumbnail_path": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_seconds"?: number | null,"height"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["media_kind"],"path": string,"position": number,"post_id": string,"status"?: Database["public"]['Enums']["media_status"],"thumbnail_path"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"duration_seconds"?: number | null,"height"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"path"?: string,"position"?: number,"post_id"?: string,"status"?: Database["public"]['Enums']["media_status"],"thumbnail_path"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"caption": string | null,"created_at": string,"edited_at": string | null,"id": string,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"caption"?: string | null,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"session_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"caption"?: string | null,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string,"daily_goal_minutes": number,"display_name": string | null,"id": string,"is_private": boolean,"onboarded_at": string | null,"time_zone": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"daily_goal_minutes"?: number,"display_name"?: string | null,"id": string,"is_private"?: boolean,"onboarded_at"?: string | null,"time_zone"?: string,"username"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"daily_goal_minutes"?: number,"display_name"?: string | null,"id"?: string,"is_private"?: boolean,"onboarded_at"?: string | null,"time_zone"?: string,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_pauses": {
                  Row: {
                    "ended_at": string | null,"id": string,"kind": Database["public"]['Enums']["pause_kind"],"session_id": string,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["pause_kind"],"session_id": string,"started_at"?: string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["pause_kind"],"session_id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_pauses_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "caption": string | null,"created_at": string,"ended_at": string | null,"focused_seconds": number | null,"goal_minutes": number | null,"id": string,"is_private": boolean,"last_heartbeat_at": string | null,"paused_at": string | null,"paused_seconds": number,"pomodoro_break_minutes": number | null,"pomodoro_focus_minutes": number | null,"source": Database["public"]['Enums']["session_source"],"started_at": string,"subject_id": string | null,"time_zone": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"ended_at"?: string | null,"focused_seconds"?: never,"goal_minutes"?: number | null,"id"?: string,"is_private"?: boolean,"last_heartbeat_at"?: string | null,"paused_at"?: string | null,"paused_seconds"?: number,"pomodoro_break_minutes"?: number | null,"pomodoro_focus_minutes"?: number | null,"source"?: Database["public"]['Enums']["session_source"],"started_at"?: string,"subject_id"?: string | null,"time_zone"?: string,"user_id": string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"ended_at"?: string | null,"focused_seconds"?: never,"goal_minutes"?: number | null,"id"?: string,"is_private"?: boolean,"last_heartbeat_at"?: string | null,"paused_at"?: string | null,"paused_seconds"?: number,"pomodoro_break_minutes"?: number | null,"pomodoro_focus_minutes"?: number | null,"source"?: Database["public"]['Enums']["session_source"],"started_at"?: string,"subject_id"?: string | null,"time_zone"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_manual_session":
{ Args: { "p_caption"?: string,"p_ended_at": string,"p_is_private"?: boolean,"p_started_at": string,"p_subject_id"?: string }; Returns: {
              "caption": string | null,
"created_at": string,
"ended_at": string | null,
"focused_seconds": number | null,
"goal_minutes": number | null,
"id": string,
"is_private": boolean,
"last_heartbeat_at": string | null,
"paused_at": string | null,
"paused_seconds": number,
"pomodoro_break_minutes": number | null,
"pomodoro_focus_minutes": number | null,
"source": Database["public"]['Enums']["session_source"],
"started_at": string,
"subject_id": string | null,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_view_user":
{ Args: { "target_user": string }; Returns: boolean
                           },
"close_open_pause":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"create_post":
{ Args: { "p_caption"?: string,"p_media"?: Json,"p_session_id"?: string }; Returns: {
              "author_id": string,
"caption": string | null,
"created_at": string,
"edited_at": string | null,
"id": string,
"session_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "posts"
        isOneToOne: true
        isSetofReturn: false
      } },
"end_session":
{ Args: { "p_caption"?: string,"p_session_id": string }; Returns: {
              "caption": string | null,
"created_at": string,
"ended_at": string | null,
"focused_seconds": number | null,
"goal_minutes": number | null,
"id": string,
"is_private": boolean,
"last_heartbeat_at": string | null,
"paused_at": string | null,
"paused_seconds": number,
"pomodoro_break_minutes": number | null,
"pomodoro_focus_minutes": number | null,
"source": Database["public"]['Enums']["session_source"],
"started_at": string,
"subject_id": string | null,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"end_stale_sessions":
{ Args: { "p_after"?: string,"p_user_id"?: string }; Returns: number
                           },
"get_feed":
{ Args: { "p_author_id"?: string,"p_before_at"?: string,"p_before_id"?: string,"p_limit"?: number,"p_scope"?: string }; Returns: Json
                           },
"get_my_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_profile":
{ Args: { "p_username": string }; Returns: Json
                           },
"get_subject_totals":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: {
              "color": string,"focused_seconds": number,"name": string,"subject_id": string
            }[]
                           },
"heartbeat_session":
{ Args: { "p_session_id": string }; Returns: string
                           },
"pause_session":
{ Args: { "p_kind"?: Database["public"]['Enums']["pause_kind"],"p_session_id": string }; Returns: {
              "caption": string | null,
"created_at": string,
"ended_at": string | null,
"focused_seconds": number | null,
"goal_minutes": number | null,
"id": string,
"is_private": boolean,
"last_heartbeat_at": string | null,
"paused_at": string | null,
"paused_seconds": number,
"pomodoro_break_minutes": number | null,
"pomodoro_focus_minutes": number | null,
"source": Database["public"]['Enums']["session_source"],
"started_at": string,
"subject_id": string | null,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"post_min_session_seconds":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"refresh_daily_stats":
{ Args: { "p_from": string,"p_to": string,"p_user_id": string }; Returns: undefined
                           },
"resume_session":
{ Args: { "p_session_id": string }; Returns: {
              "caption": string | null,
"created_at": string,
"ended_at": string | null,
"focused_seconds": number | null,
"goal_minutes": number | null,
"id": string,
"is_private": boolean,
"last_heartbeat_at": string | null,
"paused_at": string | null,
"paused_seconds": number,
"pomodoro_break_minutes": number | null,
"pomodoro_focus_minutes": number | null,
"source": Database["public"]['Enums']["session_source"],
"started_at": string,
"subject_id": string | null,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"session_day_parts":
{ Args: { "p_from": string,"p_to": string,"p_user_id": string }; Returns: {
              "day": string,"focused_seconds": number,"session_id": string,"source": Database["public"]['Enums']["session_source"],"subject_id": string
            }[]
                           },
"start_session":
{ Args: { "p_goal_minutes"?: number,"p_is_private"?: boolean,"p_pomodoro_break_minutes"?: number,"p_pomodoro_focus_minutes"?: number,"p_subject_id"?: string }; Returns: {
              "caption": string | null,
"created_at": string,
"ended_at": string | null,
"focused_seconds": number | null,
"goal_minutes": number | null,
"id": string,
"is_private": boolean,
"last_heartbeat_at": string | null,
"paused_at": string | null,
"paused_seconds": number,
"pomodoro_break_minutes": number | null,
"pomodoro_focus_minutes": number | null,
"source": Database["public"]['Enums']["session_source"],
"started_at": string,
"subject_id": string | null,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"storage_owner":
{ Args: { "p_name": string }; Returns: string
                           },
"streak_min_seconds":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"user_streaks":
{ Args: { "p_today": string,"p_user_id": string }; Returns: {
              "best_streak": number,"current_streak": number
            }[]
                           }
          }
          Enums: {
            "media_kind": "photo"|"timelapse","media_status": "pending"|"ready"|"rejected","pause_kind": "pause"|"break","session_source": "timer"|"manual"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "media_kind": ["photo", "timelapse"],"media_status": ["pending", "ready", "rejected"],"pause_kind": ["pause", "break"],"session_source": ["timer", "manual"]
          }
        }
} as const
