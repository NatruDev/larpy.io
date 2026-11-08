-- Milestone 5: posts, post media, blocks, and the feed.
--
-- People choose to post. A post is either made from one of their finished sessions (the card reads its
-- numbers from that session, so the study time on a post can't be edited) or a free post with no session.
-- Posts never feed stats, streaks or rankings: those only read sessions.
--
-- Photos (and, in milestone 6, timelapses) are files in the private `post-media` storage bucket, under
-- '<user id>/…', listed in post_media. Posts are only created through create_post, which checks the session
-- and the files. Reactions move from sessions to posts.

-- ---------------------------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- You only see your own block list; nobody can find out who blocked them.
create policy "Users see who they blocked" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "Users block as themselves" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "Users unblock as themselves" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());
revoke update on public.blocks from authenticated, anon;

-- Blocking ends follows in both directions.
create function public.blocks_remove_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_remove_follows
  after insert on public.blocks
  for each row execute function public.blocks_remove_follows();

-- The one visibility rule every policy uses now also hides people on either side of a block.
create or replace function public.can_view_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user = auth.uid()
    or (
      exists (select 1 from public.profiles p where p.id = target_user and not p.is_private)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = target_user)
           or (b.blocker_id = target_user and b.blocked_id = auth.uid())
      )
    );
$$;

-- You can't follow someone you can't see (private, or blocked either way).
drop policy "Users follow as themselves" on public.follows;
create policy "Users follow people they can see" on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and public.can_view_user(followee_id));

-- ---------------------------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- Null for a free post. A session can be posted once; deleting the session deletes its post.
  session_id uuid unique references public.sessions (id) on delete cascade,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

comment on table public.posts is
  'Feed posts. Made from a session (numbers come from the session) or free. Created only by create_post.';

create index posts_feed_idx on public.posts (created_at desc, id desc);
create index posts_author_idx on public.posts (author_id, created_at desc, id desc);

create type public.media_kind as enum ('photo', 'timelapse');
create type public.media_status as enum ('pending', 'ready', 'rejected');

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  kind public.media_kind not null,
  -- Object name in the post-media bucket, always '<author id>/…'.
  path text not null unique,
  -- Timelapses: the still shown before the video plays.
  thumbnail_path text unique,
  width integer check (width between 1 and 10000),
  height integer check (height between 1 and 10000),
  duration_seconds numeric(6, 2) check (duration_seconds > 0),
  position smallint not null check (position between 0 and 9),
  -- Photos are ready at once. Timelapses wait for moderation (milestone 6) before others can see them.
  status public.media_status not null default 'ready',
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

-- Tidy captions and stamp edits. A free post can't be edited down to nothing.
create function public.posts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.caption := nullif(trim(new.caption), '');
  if new.caption is distinct from old.caption then
    new.edited_at := now();
  end if;
  if new.session_id is null and new.caption is null
     and not exists (select 1 from public.post_media m where m.post_id = new.id) then
    raise exception 'A post needs some text or a photo.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger posts_before_update
  before update on public.posts
  for each row execute function public.posts_before_update();

alter table public.posts enable row level security;
alter table public.post_media enable row level security;

-- A post is visible when its author is (public profile, no block either way) and, for a session post,
-- the session is still public. Making a posted session private hides its post too.
create policy "Posts are visible with their author and session" on public.posts
  for select to authenticated
  using (
    author_id = auth.uid()
    or (
      public.can_view_user(author_id)
      and (posts.session_id is null or exists (
        select 1 from public.sessions s where s.id = posts.session_id and not s.is_private
      ))
    )
  );
create policy "Users edit their own posts" on public.posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Users delete their own posts" on public.posts
  for delete to authenticated using (author_id = auth.uid());

-- Only the caption is editable; posts are created through create_post.
revoke insert, update on public.posts from authenticated, anon;
grant update (caption) on public.posts to authenticated;

-- Media shows with its post; media waiting for moderation only to its author.
create policy "Media is visible with its post once ready" on public.post_media
  for select to authenticated
  using (exists (
    select 1 from public.posts p
    where p.id = post_media.post_id and (post_media.status = 'ready' or p.author_id = auth.uid())
  ));
revoke insert, update, delete on public.post_media from authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- Reactions move from sessions to posts (nothing has used them yet, so they start empty)
-- ---------------------------------------------------------------------------------------------

drop table public.reactions;

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index reactions_user_idx on public.reactions (user_id);

alter table public.reactions enable row level security;

create policy "Reactions are visible with their post" on public.reactions
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = reactions.post_id));
create policy "Users react to posts they can see" on public.reactions
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = reactions.post_id));
create policy "Users remove their own reactions" on public.reactions
  for delete to authenticated using (user_id = auth.uid());
revoke update on public.reactions from authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- Storage: the post-media bucket
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4'])
on conflict (id) do nothing;

-- The owner of an object named '<user id>/…', or null if the name doesn't start with a user id.
create function public.storage_owner(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy "Users upload post media into their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-media' and public.storage_owner(name) = auth.uid());
-- Readable by the owner, or by anyone who can see a post the file is attached to (the post_media
-- policies decide that), so unposted uploads and files on hidden posts stay private.
create policy "Post media is readable with its post" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and (
      public.storage_owner(name) = auth.uid()
      or exists (select 1 from public.post_media m where m.path = objects.name or m.thumbnail_path = objects.name)
    )
  );
create policy "Users delete their own post media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-media' and public.storage_owner(name) = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Creating posts
-- ---------------------------------------------------------------------------------------------

-- A session needs at least this much focus to be posted, so quick test sessions don't become posts.
create function public.post_min_session_seconds()
returns integer
language sql
immutable
as $$ select 300 $$;

-- p_media: [{ kind: 'photo' | 'timelapse', path, thumbnail_path?, width?, height?, duration_seconds? }],
-- uploaded to post-media beforehand. Up to 4 photos and 1 timelapse, shown in the order given.
create function public.create_post(
  p_session_id uuid default null,
  p_caption text default null,
  p_media jsonb default '[]'
)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_caption text := nullif(trim(p_caption), '');
  v_media jsonb := coalesce(p_media, '[]'::jsonb);
  v_session public.sessions;
  v_post public.posts;
begin
  if v_user is null then
    raise exception 'Sign in to post.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_media) <> 'array' then
    raise exception 'Media must be a list.' using errcode = '22023';
  end if;

  if p_session_id is not null then
    select * into v_session from public.sessions where id = p_session_id and user_id = v_user;
    if not found then
      raise exception 'That session was not found.' using errcode = 'P0002';
    end if;
    if v_session.ended_at is null then
      raise exception 'Finish the session before posting it.' using errcode = '22023';
    end if;
    if v_session.is_private then
      raise exception 'This session is private. Make it public to post it.' using errcode = '22023';
    end if;
    -- Only live-timed sessions can be posted; time typed in afterwards stays in your stats.
    if v_session.source <> 'timer' then
      raise exception 'Only sessions timed with the focus timer can be posted.' using errcode = '22023';
    end if;
    if v_session.focused_seconds < public.post_min_session_seconds() then
      raise exception 'Sessions need at least 5 minutes of focus to be posted.' using errcode = '22023';
    end if;
    if exists (select 1 from public.posts where session_id = p_session_id) then
      raise exception 'This session is already posted.' using errcode = '23505';
    end if;
  elsif v_caption is null and jsonb_array_length(v_media) = 0 then
    raise exception 'Add some text or a photo to post.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_media) m
    where jsonb_typeof(m) <> 'object' or coalesce(m ->> 'kind', '') not in ('photo', 'timelapse')
       or m ->> 'path' is null or (m ->> 'kind' = 'timelapse' and m ->> 'thumbnail_path' is null)
  ) then
    raise exception 'Each file needs a kind (photo or timelapse) and a path; a timelapse also needs a thumbnail.'
      using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_media) m where m ->> 'kind' = 'photo') > 4 then
    raise exception 'Posts can have up to 4 photos.' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_media) m where m ->> 'kind' = 'timelapse') > 1 then
    raise exception 'Posts can have one timelapse.' using errcode = '22023';
  end if;
  -- Every file must be in the caller's folder and already uploaded.
  if exists (
    select 1
    from jsonb_array_elements(v_media) m
    cross join lateral (values (m ->> 'path'), (m ->> 'thumbnail_path')) f(path)
    where f.path is not null
      and (public.storage_owner(f.path) is distinct from v_user
           or not exists (select 1 from storage.objects o where o.bucket_id = 'post-media' and o.name = f.path))
  ) then
    raise exception 'One of the files wasn''t found. Upload it again.' using errcode = 'P0002';
  end if;

  insert into public.posts (author_id, session_id, caption)
  values (v_user, p_session_id, v_caption)
  returning * into v_post;

  insert into public.post_media (post_id, kind, path, thumbnail_path, width, height, duration_seconds, position, status)
  select v_post.id, (m ->> 'kind')::public.media_kind, m ->> 'path', m ->> 'thumbnail_path',
    (m ->> 'width')::integer, (m ->> 'height')::integer, (m ->> 'duration_seconds')::numeric, (n - 1)::smallint,
    case when m ->> 'kind' = 'timelapse' then 'pending' else 'ready' end::public.media_status
  from jsonb_array_elements(v_media) with ordinality as t(m, n);

  return v_post;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reading the feed
-- ---------------------------------------------------------------------------------------------

-- A page of posts, newest first, ready to draw. Runs as the caller, so the row-level security above
-- decides what's visible. Following = people you follow plus yourself; p_author_id = one person's posts
-- (their profile page), whatever the scope. For the next page, pass the last post's created_at and id.
create function public.get_feed(
  p_scope text default 'following',
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20,
  p_author_id uuid default null
)
returns json
language sql
stable
set search_path = ''
as $$
  select coalesce(json_agg(page.item order by page.created_at desc, page.id desc), '[]'::json)
  from (
    select p.created_at, p.id, json_build_object(
      'post', json_build_object(
        'id', p.id, 'author_id', p.author_id, 'session_id', p.session_id, 'caption', p.caption,
        'created_at', p.created_at, 'edited_at', p.edited_at),
      'author', (
        select json_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name,
                                 'avatar_url', a.avatar_url)
        from public.profiles a where a.id = p.author_id),
      -- Null for free posts.
      'session', (
        select json_build_object(
          'id', s.id, 'source', s.source, 'focused_seconds', s.focused_seconds, 'goal_minutes', s.goal_minutes,
          'pomodoro_focus_minutes', s.pomodoro_focus_minutes, 'pomodoro_break_minutes', s.pomodoro_break_minutes,
          'started_at', s.started_at, 'ended_at', s.ended_at, 'paused_seconds', s.paused_seconds,
          'subject', (select json_build_object('id', sj.id, 'name', sj.name, 'color', sj.color)
                      from public.subjects sj where sj.id = s.subject_id),
          'pauses', coalesce((
            select json_agg(json_build_object('kind', sp.kind, 'started_at', sp.started_at, 'ended_at', sp.ended_at)
                            order by sp.started_at)
            from public.session_pauses sp where sp.session_id = s.id), '[]'::json))
        from public.sessions s where s.id = p.session_id),
      'media', coalesce((
        select json_agg(json_build_object(
                 'id', m.id, 'kind', m.kind, 'path', m.path, 'thumbnail_path', m.thumbnail_path,
                 'width', m.width, 'height', m.height, 'duration_seconds', m.duration_seconds, 'status', m.status)
               order by m.position)
        from public.post_media m where m.post_id = p.id), '[]'::json),
      'reaction_count', (select count(*) from public.reactions r where r.post_id = p.id),
      'reacted_by_me', exists (select 1 from public.reactions r where r.post_id = p.id and r.user_id = auth.uid())
    ) as item
    from public.posts p
    where (case
             when p_author_id is not null then p.author_id = p_author_id
             when p_scope = 'global' then true
             else p.author_id = auth.uid()
               or p.author_id in (select f.followee_id from public.follows f where f.follower_id = auth.uid())
           end)
      and (p_before_at is null
           or p.created_at < p_before_at
           or (p.created_at = p_before_at and p.id < p_before_id))
    order by p.created_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) page;
$$;

-- ---------------------------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------------------------

-- Current and best streak for a user, given their "today". Runs as the caller, so for anyone but
-- yourself it only returns numbers when called from a function allowed to read their daily_stats.
create function public.user_streaks(p_user_id uuid, p_today date)
returns table (current_streak integer, best_streak integer)
language sql
stable
set search_path = ''
as $$
  -- Runs of consecutive qualifying days. The current one must reach today or yesterday (today isn't
  -- over yet, so not having studied today doesn't break it).
  with q as (
    select day from public.daily_stats
    where user_id = p_user_id and focused_seconds >= public.streak_min_seconds()
  ),
  runs as (
    select max(day) as last_day, count(*)::integer as len
    from (select day, day - (row_number() over (order by day))::integer as grp from q) islands
    group by grp
  )
  select coalesce(max(len) filter (where last_day >= p_today - 1), 0), coalesce(max(len), 0)
  from runs;
$$;

create or replace function public.get_my_summary()
returns json
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_goal integer;
  v_today date;
  v_week_start date;
  v_min integer := public.streak_min_seconds();
  v_current integer;
  v_best integer;
begin
  if v_user is null then
    raise exception 'Sign in to see your stats.' using errcode = '42501';
  end if;

  select time_zone, daily_goal_minutes into v_tz, v_goal from public.profiles where id = v_user;
  v_today := (now() at time zone v_tz)::date;
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);
  select current_streak, best_streak into v_current, v_best from public.user_streaks(v_user, v_today);

  return json_build_object(
    'today', v_today,
    'time_zone', v_tz,
    'daily_goal_minutes', v_goal,
    'streak_min_seconds', v_min,
    'current_streak', v_current,
    'best_streak', v_best,
    'today_seconds', coalesce((
      select focused_seconds from public.daily_stats where user_id = v_user and day = v_today
    ), 0),
    'week', (
      select json_agg(json_build_object('day', d.day::date, 'seconds', coalesce(ds.focused_seconds, 0)) order by d.day)
      from generate_series(v_week_start::timestamp, (v_week_start + 6)::timestamp, interval '1 day') as d(day)
      left join public.daily_stats ds on ds.user_id = v_user and ds.day = d.day::date
    ),
    'total_seconds', coalesce((select sum(focused_seconds) from public.daily_stats where user_id = v_user), 0),
    'active_days', (
      select count(*) from public.daily_stats where user_id = v_user and focused_seconds >= v_min
    )
  );
end;
$$;

-- Someone's profile page: header, follow counts, streak, totals and the last year's heatmap.
-- Null if the username doesn't exist. Private profiles, and people on either side of a block, get only
-- the header with hidden = true. Totals include all of their sessions; only the details stay private.
create function public.get_profile(p_username text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_p public.profiles;
  v_today date;
  v_current integer;
  v_best integer;
begin
  if v_me is null then
    raise exception 'Sign in to see profiles.' using errcode = '42501';
  end if;

  select * into v_p from public.profiles where username = lower(trim(p_username));
  if not found then
    return null;
  end if;

  if not public.can_view_user(v_p.id) then
    return json_build_object(
      'profile', json_build_object('id', v_p.id, 'username', v_p.username, 'display_name', v_p.display_name,
                                   'avatar_url', v_p.avatar_url),
      'hidden', true,
      'is_me', false,
      'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = v_me and b.blocked_id = v_p.id)
    );
  end if;

  v_today := (now() at time zone v_p.time_zone)::date;
  select current_streak, best_streak into v_current, v_best from public.user_streaks(v_p.id, v_today);

  return json_build_object(
    'profile', json_build_object('id', v_p.id, 'username', v_p.username, 'display_name', v_p.display_name,
                                 'avatar_url', v_p.avatar_url, 'bio', v_p.bio,
                                 'daily_goal_minutes', v_p.daily_goal_minutes, 'created_at', v_p.created_at),
    'hidden', false,
    'is_me', v_p.id = v_me,
    'blocked_by_me', false,
    -- Their local date, so the heatmap and streak line up with their days.
    'today', v_today,
    'streak_min_seconds', public.streak_min_seconds(),
    'is_following', exists (select 1 from public.follows f where f.follower_id = v_me and f.followee_id = v_p.id),
    'follows_me', exists (select 1 from public.follows f where f.follower_id = v_p.id and f.followee_id = v_me),
    'followers', (select count(*) from public.follows f where f.followee_id = v_p.id),
    'following', (select count(*) from public.follows f where f.follower_id = v_p.id),
    'posts', (
      select count(*) from public.posts po
      where po.author_id = v_p.id
        and (v_p.id = v_me or po.session_id is null
             or exists (select 1 from public.sessions s where s.id = po.session_id and not s.is_private))
    ),
    'current_streak', v_current,
    'best_streak', v_best,
    'total_seconds', coalesce((select sum(focused_seconds) from public.daily_stats where user_id = v_p.id), 0),
    'heatmap', coalesce((
      select json_agg(json_build_object('day', ds.day, 'seconds', ds.focused_seconds) order by ds.day)
      from public.daily_stats ds
      where ds.user_id = v_p.id and ds.day > v_today - 365
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.blocks_remove_follows() from public, anon, authenticated;
revoke execute on function public.posts_before_update() from public, anon, authenticated;
revoke execute on function public.create_post(uuid, text, jsonb) from public, anon;
revoke execute on function public.get_feed(text, timestamptz, uuid, integer, uuid) from public, anon;
revoke execute on function public.get_profile(text) from public, anon;
revoke execute on function public.user_streaks(uuid, date) from public, anon;
grant execute on function public.create_post(uuid, text, jsonb) to authenticated;
grant execute on function public.get_feed(text, timestamptz, uuid, integer, uuid) to authenticated;
grant execute on function public.get_profile(text) to authenticated;
grant execute on function public.user_streaks(uuid, date) to authenticated;
