-- Milestone 3 (focus timer): closing abandoned sessions, and live session updates for cross-device sync.
--
-- A running timer sends a heartbeat about once a minute. If the heartbeats stop for 15 minutes (tab
-- closed, laptop asleep, phone locked in a browser), the session ends at its last heartbeat, so only
-- time the app could vouch for is counted. This runs:
--   * every 5 minutes from pg_cron, for everyone, and
--   * at the start of every session function, for the caller, so coming back late can't claim time.
--
-- The session functions are also made safe to call twice or from two devices: acting on a session that
-- has already ended returns it as it is instead of raising. (Raising would also roll back the stale
-- sweep that just ended it.)

create function public.end_stale_sessions(
  p_user_id uuid default null,
  p_after interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, last_heartbeat_at
    from public.sessions
    where ended_at is null
      and source = 'timer'
      and last_heartbeat_at < now() - p_after
      and (p_user_id is null or user_id = p_user_id)
    for update skip locked
  loop
    update public.session_pauses
    set ended_at = greatest(started_at, r.last_heartbeat_at)
    where session_id = r.id and ended_at is null;

    update public.sessions
    set paused_seconds = paused_seconds + case
          when paused_at is null then 0
          else greatest(0, floor(extract(epoch from (r.last_heartbeat_at - paused_at)))::integer)
        end,
        paused_at = null,
        ended_at = greatest(started_at, r.last_heartbeat_at)
    where id = r.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.end_stale_sessions(uuid, interval) from public, anon, authenticated;

create or replace function public.start_session(
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

  perform public.end_stale_sessions(v_user);

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

-- Returns the session unchanged if it has already ended.
create or replace function public.pause_session(p_session_id uuid, p_kind public.pause_kind default 'pause')
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  perform public.end_stale_sessions(auth.uid());

  select * into v_session from public.sessions where id = p_session_id and user_id = auth.uid();
  if v_session.id is null then
    raise exception 'That session was not found.' using errcode = 'P0002';
  end if;
  if v_session.ended_at is not null then
    return v_session;
  end if;
  if v_session.paused_at is not null then
    raise exception 'The session is already paused.' using errcode = '55000';
  end if;

  update public.sessions set paused_at = now() where id = p_session_id
  returning * into v_session;

  insert into public.session_pauses (session_id, kind, started_at)
  values (p_session_id, coalesce(p_kind, 'pause'), v_session.paused_at);

  return v_session;
end;
$$;

-- Returns the session unchanged if it has already ended.
create or replace function public.resume_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  perform public.end_stale_sessions(auth.uid());

  select * into v_session from public.sessions where id = p_session_id and user_id = auth.uid();
  if v_session.id is null then
    raise exception 'That session was not found.' using errcode = 'P0002';
  end if;
  if v_session.ended_at is not null then
    return v_session;
  end if;
  if v_session.paused_at is null then
    raise exception 'The session isn''t paused.' using errcode = '55000';
  end if;

  perform public.close_open_pause(p_session_id);

  select * into v_session from public.sessions where id = p_session_id;
  return v_session;
end;
$$;

-- Ending an already-ended session returns it as it is (safe from two devices at once).
create or replace function public.end_session(p_session_id uuid, p_caption text default null)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  perform public.end_stale_sessions(auth.uid());

  select * into v_session from public.sessions where id = p_session_id and user_id = auth.uid();
  if v_session.id is null then
    raise exception 'That session was not found.' using errcode = 'P0002';
  end if;
  if v_session.ended_at is not null then
    return v_session;
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

-- Returns the server time of the heartbeat, or null if the session has ended.
create or replace function public.heartbeat_session(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  perform public.end_stale_sessions(auth.uid());

  update public.sessions
  set last_heartbeat_at = now()
  where id = p_session_id and user_id = auth.uid() and ended_at is null
  returning last_heartbeat_at into v_at;

  if v_at is null and not exists (
    select 1 from public.sessions where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'That session was not found.' using errcode = 'P0002';
  end if;

  return v_at;
end;
$$;

-- Schedule the sweep where pg_cron exists (Supabase local and hosted; not the in-memory test database).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('end-stale-sessions', '*/5 * * * *', 'select public.end_stale_sessions()');
  end if;
end;
$$;

-- Broadcast session changes so a timer started or paused on one device updates the others.
-- Row-level security still applies: people only receive changes to sessions they can see.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sessions;
  end if;
end;
$$;
