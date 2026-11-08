-- Finishes milestone 1: two session columns the rollups and the timer will rely on.
--
-- time_zone: the owner's time zone when the session started. Daily totals and streaks bucket by this,
--   so changing your profile time zone later never reshuffles past days.
-- last_heartbeat_at: the running timer pings this about once a minute (heartbeat_session). A scheduled
--   job (milestone 3) will end sessions whose heartbeat stopped, counting time only up to the last ping.

alter table public.sessions
  add column time_zone text not null default 'UTC',
  add column last_heartbeat_at timestamptz;

comment on column public.sessions.time_zone is
  'Owner''s IANA time zone when the session started. Used to assign the session to local days.';
comment on column public.sessions.last_heartbeat_at is
  'Last sign of life from a running timer. Null for manual sessions.';

-- Existing rows (local test data only at this point) take the owner's current time zone.
update public.sessions s
set time_zone = p.time_zone
from public.profiles p
where p.id = s.user_id;

-- Fill both columns on insert, whichever function created the session.
create function public.set_session_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select p.time_zone into new.time_zone from public.profiles p where p.id = new.user_id;
  new.time_zone := coalesce(new.time_zone, 'UTC');
  if new.source = 'timer' then
    new.last_heartbeat_at := now();
  end if;
  return new;
end;
$$;

create trigger sessions_set_defaults
  before insert on public.sessions
  for each row execute function public.set_session_defaults();

-- Pausing or resuming also counts as a sign of life.
create function public.touch_session_heartbeat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ended_at is null and new.source = 'timer' then
    new.last_heartbeat_at := now();
  end if;
  return new;
end;
$$;

create trigger sessions_touch_heartbeat
  before update of paused_at on public.sessions
  for each row execute function public.touch_session_heartbeat();

-- Used by the stale-session job to find timers that stopped pinging.
create index sessions_running_heartbeat_idx on public.sessions (last_heartbeat_at)
  where ended_at is null;

create function public.heartbeat_session(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  update public.sessions
  set last_heartbeat_at = now()
  where id = p_session_id and user_id = auth.uid() and ended_at is null
  returning last_heartbeat_at into v_at;

  if v_at is null then
    raise exception 'No running session.' using errcode = 'P0002';
  end if;

  return v_at;
end;
$$;

revoke execute on function public.heartbeat_session(uuid) from public, anon;
grant execute on function public.heartbeat_session(uuid) to authenticated;

revoke execute on function public.set_session_defaults() from public, anon, authenticated;
revoke execute on function public.touch_session_heartbeat() from public, anon, authenticated;
