-- Streakly milestone 1: profiles, subjects, study sessions, follows and reactions.
--
-- Anti-cheat rule: timer sessions are only created and changed through the functions at the bottom
-- (start / pause / resume / end), which stamp times with the server clock. Clients cannot insert
-- sessions or edit their times directly. Manual entries are allowed but marked source = 'manual'
-- so they can be excluded from rankings.

-- ---------------------------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until onboarding. Lowercase letters, digits and underscores only.
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 50),
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  daily_goal_minutes integer not null default 60 check (daily_goal_minutes between 5 and 1440),
  -- IANA name like 'America/New_York'. Streak days roll over at local midnight.
  time_zone text not null default 'UTC',
  -- Private profiles keep their sessions off the feed and away from other users.
  is_private boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per user, created automatically at sign-up.';

-- Rejects time zone names Postgres doesn't recognise.
create function public.validate_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.time_zone;
  return new;
exception when others then
  raise exception 'Unknown time zone: %', new.time_zone using errcode = '22023';
end;
$$;

create trigger profiles_validate_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function public.validate_time_zone();

-- Create a profile whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 50), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the current user may see this user's sessions and subjects.
create function public.can_view_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user = auth.uid()
    or exists (select 1 from public.profiles p where p.id = target_user and not p.is_private);
$$;

-- ---------------------------------------------------------------------------------------------
-- Subjects
-- ---------------------------------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null default '#6166DF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Archived subjects keep their history but no longer show up when starting a session.
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index subjects_unique_active_name on public.subjects (user_id, lower(trim(name)))
  where archived_at is null;
create index subjects_user_idx on public.subjects (user_id);

-- ---------------------------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------------------------

create type public.session_source as enum ('timer', 'manual');
create type public.pause_kind as enum ('pause', 'break');

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  source public.session_source not null default 'timer',
  -- The length the user aimed for, if any ("35% of 1h goal").
  goal_minutes integer check (goal_minutes between 1 and 1440),
  pomodoro_focus_minutes integer check (pomodoro_focus_minutes between 5 and 180),
  pomodoro_break_minutes integer check (pomodoro_break_minutes between 1 and 60),
  is_private boolean not null default false,
  started_at timestamptz not null default now(),
  -- Null while the session is running.
  ended_at timestamptz,
  -- Set while the session is paused or on a break.
  paused_at timestamptz,
  -- Total of all finished pauses and breaks.
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  focused_seconds integer generated always as (
    case
      when ended_at is null then null
      else greatest(0, floor(extract(epoch from (ended_at - started_at)))::integer - paused_seconds)
    end
  ) stored,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  constraint sessions_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint sessions_pomodoro_pair check ((pomodoro_focus_minutes is null) = (pomodoro_break_minutes is null)),
  constraint sessions_not_paused_when_ended check (ended_at is null or paused_at is null)
);

comment on column public.sessions.source is
  'timer = recorded live through the session functions; manual = typed in afterwards (does not count toward rankings).';

-- At most one running session per user. This is also what syncs the timer across devices.
create unique index sessions_one_active_per_user on public.sessions (user_id) where ended_at is null;
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_feed_idx on public.sessions (ended_at desc) where ended_at is not null and not is_private;

-- Each pause or break, so a post can draw its timeline bar.
create table public.session_pauses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  kind public.pause_kind not null default 'pause',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint session_pauses_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index session_pauses_session_idx on public.session_pauses (session_id, started_at);

-- ---------------------------------------------------------------------------------------------
-- Follows and reactions
-- ---------------------------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

create table public.reactions (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index reactions_user_idx on public.reactions (user_id);

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.sessions enable row level security;
alter table public.session_pauses enable row level security;
alter table public.follows enable row level security;
alter table public.reactions enable row level security;

-- Profiles: any signed-in user can see profiles; you can only edit your own.
create policy "Profiles are visible to signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Only these profile columns can be changed from the app.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, bio, daily_goal_minutes, time_zone, is_private, onboarded_at)
  on public.profiles to authenticated;

-- Subjects: you manage your own; others can see them unless your profile is private.
create policy "Subjects are visible when their owner is visible" on public.subjects
  for select to authenticated using (public.can_view_user(user_id));
create policy "Users add their own subjects" on public.subjects
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update their own subjects" on public.subjects
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete their own subjects" on public.subjects
  for delete to authenticated using (user_id = auth.uid());

-- Sessions: visible to the owner, and to everyone else when neither the session nor the profile is private.
-- No insert policy: sessions are created only through start_session / add_manual_session.
create policy "Sessions are visible to owner or when public" on public.sessions
  for select to authenticated
  using (user_id = auth.uid() or (not is_private and public.can_view_user(user_id)));
create policy "Users edit details of their own sessions" on public.sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (subject_id is null or exists (
      select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid()
    ))
  );
create policy "Users delete their own sessions" on public.sessions
  for delete to authenticated using (user_id = auth.uid());

-- Times can't be edited from the app; only subject, caption and privacy.
revoke update on public.sessions from authenticated;
grant update (subject_id, caption, is_private) on public.sessions to authenticated;
revoke insert on public.sessions from authenticated, anon;

create policy "Pauses are visible with their session" on public.session_pauses
  for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id));
revoke insert, update, delete on public.session_pauses from authenticated, anon;

-- Follows: public within the app; you can only follow or unfollow as yourself.
create policy "Follows are visible to signed-in users" on public.follows
  for select to authenticated using (true);
create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy "Users unfollow as themselves" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- Reactions: visible with the session; you can react to finished sessions you can see.
create policy "Reactions are visible with their session" on public.reactions
  for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id));
create policy "Users react as themselves" on public.reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sessions s where s.id = session_id and s.ended_at is not null)
  );
create policy "Users remove their own reactions" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Session functions (the only way to record timer time)
-- ---------------------------------------------------------------------------------------------

create function public.start_session(
  p_subject_id uuid default null,
  p_goal_minutes integer default null,
  p_pomodoro_focus_minutes integer default null,
  p_pomodoro_break_minutes integer default null,
  p_is_private boolean default false
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
begin
  if v_user is null then
    raise exception 'Sign in to start a session.' using errcode = '42501';
  end if;

  if p_subject_id is not null and not exists (
    select 1 from public.subjects
    where id = p_subject_id and user_id = v_user and archived_at is null
  ) then
    raise exception 'That subject was not found.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.sessions where user_id = v_user and ended_at is null) then
    raise exception 'You already have a session running. End it before starting a new one.'
      using errcode = '23505';
  end if;

  insert into public.sessions (
    user_id, subject_id, source, goal_minutes, pomodoro_focus_minutes, pomodoro_break_minutes, is_private
  )
  values (
    v_user, p_subject_id, 'timer', p_goal_minutes, p_pomodoro_focus_minutes, p_pomodoro_break_minutes,
    coalesce(p_is_private, false)
  )
  returning * into v_session;

  return v_session;
end;
$$;

create function public.pause_session(p_session_id uuid, p_kind public.pause_kind default 'pause')
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  update public.sessions
  set paused_at = now()
  where id = p_session_id and user_id = auth.uid() and ended_at is null and paused_at is null
  returning * into v_session;

  if v_session.id is null then
    raise exception 'No running session to pause.' using errcode = 'P0002';
  end if;

  insert into public.session_pauses (session_id, kind, started_at)
  values (p_session_id, coalesce(p_kind, 'pause'), v_session.paused_at);

  return v_session;
end;
$$;

-- Closes the open pause (if any) and adds its length to paused_seconds. Internal helper.
create function public.close_open_pause(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.session_pauses
  set ended_at = now()
  where session_id = p_session_id and ended_at is null;

  update public.sessions
  set paused_seconds = paused_seconds + greatest(0, floor(extract(epoch from (now() - paused_at)))::integer),
      paused_at = null
  where id = p_session_id and paused_at is not null;
end;
$$;

create function public.resume_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  if not exists (
    select 1 from public.sessions
    where id = p_session_id and user_id = auth.uid() and ended_at is null and paused_at is not null
  ) then
    raise exception 'No paused session to resume.' using errcode = 'P0002';
  end if;

  perform public.close_open_pause(p_session_id);

  select * into v_session from public.sessions where id = p_session_id;
  return v_session;
end;
$$;

create function public.end_session(p_session_id uuid, p_caption text default null)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  if not exists (
    select 1 from public.sessions
    where id = p_session_id and user_id = auth.uid() and ended_at is null
  ) then
    raise exception 'No running session to end.' using errcode = 'P0002';
  end if;

  perform public.close_open_pause(p_session_id);

  update public.sessions
  set ended_at = now(),
      caption = coalesce(nullif(trim(p_caption), ''), caption)
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

-- Logs study time after the fact. Marked 'manual' so rankings can leave it out.
create function public.add_manual_session(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_subject_id uuid default null,
  p_caption text default null,
  p_is_private boolean default false
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
begin
  if v_user is null then
    raise exception 'Sign in to log a session.' using errcode = '42501';
  end if;
  if p_ended_at <= p_started_at then
    raise exception 'The end time must be after the start time.' using errcode = '22023';
  end if;
  if p_ended_at > now() then
    raise exception 'Sessions can''t end in the future.' using errcode = '22023';
  end if;
  if p_ended_at - p_started_at > interval '12 hours' then
    raise exception 'A single session can be at most 12 hours.' using errcode = '22023';
  end if;
  if p_subject_id is not null and not exists (
    select 1 from public.subjects where id = p_subject_id and user_id = v_user
  ) then
    raise exception 'That subject was not found.' using errcode = 'P0002';
  end if;

  insert into public.sessions (user_id, subject_id, source, is_private, started_at, ended_at, caption)
  values (v_user, p_subject_id, 'manual', coalesce(p_is_private, false), p_started_at, p_ended_at,
          nullif(trim(p_caption), ''))
  returning * into v_session;

  return v_session;
end;
$$;

-- Only signed-in users may call the session functions; internal helpers are not callable at all.
revoke execute on function
  public.start_session(uuid, integer, integer, integer, boolean),
  public.pause_session(uuid, public.pause_kind),
  public.resume_session(uuid),
  public.end_session(uuid, text),
  public.add_manual_session(timestamptz, timestamptz, uuid, text, boolean)
  from public, anon;
grant execute on function
  public.start_session(uuid, integer, integer, integer, boolean),
  public.pause_session(uuid, public.pause_kind),
  public.resume_session(uuid),
  public.end_session(uuid, text),
  public.add_manual_session(timestamptz, timestamptz, uuid, text, boolean)
  to authenticated;

revoke execute on function public.close_open_pause(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_time_zone() from public, anon, authenticated;
