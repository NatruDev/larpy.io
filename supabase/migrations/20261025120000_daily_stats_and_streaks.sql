-- Milestone 4: streaks and stats.
--
-- daily_stats is a cache of focused time per user per local day, derived only from sessions. A trigger
-- recomputes the affected days whenever a session ends, changes or is deleted, in the same transaction,
-- so it can never drift from sessions. It can always be rebuilt with
-- refresh_daily_stats().
--
-- Days are local to the session's own time_zone. A session that crosses midnight is split across both
-- days, minus the pauses that fall on each side.

-- ---------------------------------------------------------------------------------------------
-- Subject colors: move to the validated, colorblind-safe palette (same order, new values).
-- ---------------------------------------------------------------------------------------------

update public.subjects
set color = case upper(color)
  when '#6166DF' then '#2A78D6'
  when '#E9683A' then '#EB6834'
  when '#22A570' then '#1BAF7A'
  when '#D4458C' then '#EDA100'
  when '#2B8FD6' then '#E87BA4'
  when '#C99A1E' then '#008300'
  when '#8A5CD1' then '#6250D6'
  when '#2BA3A3' then '#E34948'
  else color
end;

alter table public.subjects alter column color set default '#2A78D6';

-- ---------------------------------------------------------------------------------------------
-- Splitting sessions into local days
-- ---------------------------------------------------------------------------------------------

-- Focused seconds per (session, local day) for a user's ended sessions touching [p_from, p_to].
create function public.session_day_parts(p_user_id uuid, p_from date, p_to date)
returns table (session_id uuid, source public.session_source, subject_id uuid, day date, focused_seconds integer)
language sql
stable
set search_path = ''
as $$
  with s as (
    select
      s.id, s.source, s.subject_id, s.started_at, s.ended_at, s.time_zone, s.focused_seconds,
      (s.started_at at time zone s.time_zone)::date as first_day,
      (s.ended_at at time zone s.time_zone)::date as last_day
    from public.sessions s
    where s.user_id = p_user_id
      and s.ended_at is not null
      and (s.ended_at at time zone s.time_zone)::date >= p_from
      and (s.started_at at time zone s.time_zone)::date <= p_to
  ),
  parts as (
    select
      s.*,
      g.day::date as day,
      greatest(s.started_at, g.day at time zone s.time_zone) as win_start,
      least(s.ended_at, (g.day + interval '1 day') at time zone s.time_zone) as win_end
    from s
    cross join lateral generate_series(s.first_day::timestamp, s.last_day::timestamp, interval '1 day') as g(day)
  )
  select
    p.id,
    p.source,
    p.subject_id,
    p.day,
    case
      -- Same-day sessions (almost all of them) use the exact stored total.
      when p.first_day = p.last_day then p.focused_seconds
      else greatest(0,
        floor(extract(epoch from (p.win_end - p.win_start)))::integer
        - coalesce((
            select floor(sum(extract(epoch from (
              least(coalesce(sp.ended_at, p.ended_at), p.win_end) - greatest(sp.started_at, p.win_start)
            ))))::integer
            from public.session_pauses sp
            where sp.session_id = p.id
              and sp.started_at < p.win_end
              and coalesce(sp.ended_at, p.ended_at) > p.win_start
          ), 0))
    end
  from parts p
  where p.day between p_from and p_to;
$$;

-- ---------------------------------------------------------------------------------------------
-- daily_stats
-- ---------------------------------------------------------------------------------------------

create table public.daily_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  focused_seconds integer not null default 0,
  -- Live-timed focus only (no manual entries). Rankings use this.
  timer_focused_seconds integer not null default 0,
  sessions_count integer not null default 0,
  primary key (user_id, day)
);

comment on table public.daily_stats is
  'Cache of focused time per user per local day. Derived from sessions by trigger; never written directly.';

alter table public.daily_stats enable row level security;

create policy "Users read their own daily stats" on public.daily_stats
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.daily_stats from authenticated, anon;

-- Rebuilds a user's daily_stats rows for a range of local days from sessions.
create function public.refresh_daily_stats(p_user_id uuid, p_from date, p_to date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Account being deleted: its rows are going away with it.
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  delete from public.daily_stats where user_id = p_user_id and day between p_from and p_to;

  insert into public.daily_stats (user_id, day, focused_seconds, timer_focused_seconds, sessions_count)
  select
    p_user_id,
    p.day,
    sum(p.focused_seconds),
    coalesce(sum(p.focused_seconds) filter (where p.source = 'timer'), 0),
    count(distinct p.session_id)
  from public.session_day_parts(p_user_id, p_from, p_to) p
  group by p.day
  having sum(p.focused_seconds) > 0;
end;
$$;

create function public.sessions_refresh_daily_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.ended_at is not null then
    perform public.refresh_daily_stats(
      old.user_id,
      (old.started_at at time zone old.time_zone)::date,
      (old.ended_at at time zone old.time_zone)::date
    );
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.ended_at is not null then
    perform public.refresh_daily_stats(
      new.user_id,
      (new.started_at at time zone new.time_zone)::date,
      (new.ended_at at time zone new.time_zone)::date
    );
  end if;
  return null;
end;
$$;

-- Only changes that affect time trigger a refresh (not heartbeats or captions).
create trigger sessions_daily_stats
  after insert or delete or update of started_at, ended_at, paused_seconds, source, time_zone
  on public.sessions
  for each row execute function public.sessions_refresh_daily_stats();

revoke execute on function public.refresh_daily_stats(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.sessions_refresh_daily_stats() from public, anon, authenticated;
revoke execute on function public.session_day_parts(uuid, date, date) from public, anon;
grant execute on function public.session_day_parts(uuid, date, date) to authenticated;

-- Fill daily_stats for sessions that already exist.
select public.refresh_daily_stats(u.user_id, u.first_day, u.last_day)
from (
  select
    user_id,
    min((started_at at time zone time_zone)::date) as first_day,
    max((ended_at at time zone time_zone)::date) as last_day
  from public.sessions
  where ended_at is not null
  group by user_id
) u;

-- ---------------------------------------------------------------------------------------------
-- Reading stats
-- ---------------------------------------------------------------------------------------------

-- A day counts toward the streak with at least this much focus.
create function public.streak_min_seconds()
returns integer
language sql
immutable
as $$ select 60 $$;

-- The signed-in user's headline numbers. "Today" and "this week" use the profile's current time zone;
-- weeks start on Monday. Running sessions are not included (the app adds the live one itself).
create function public.get_my_summary()
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

  -- Streaks: runs of consecutive qualifying days. The current one must reach today or yesterday
  -- (today isn't over yet, so not having studied today doesn't break it).
  with q as (
    select day from public.daily_stats where user_id = v_user and focused_seconds >= v_min
  ),
  runs as (
    select max(day) as last_day, count(*)::integer as len
    from (select day, day - (row_number() over (order by day))::integer as grp from q) islands
    group by grp
  )
  select
    coalesce(max(len) filter (where last_day >= v_today - 1), 0),
    coalesce(max(len), 0)
  into v_current, v_best
  from runs;

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

-- Focused time per subject for the signed-in user between two local days (inclusive; nulls = all time).
create function public.get_subject_totals(p_from date default null, p_to date default null)
returns table (subject_id uuid, name text, color text, focused_seconds bigint)
language sql
stable
set search_path = ''
as $$
  select p.subject_id, s.name, s.color, sum(p.focused_seconds)::bigint
  from public.session_day_parts(auth.uid(), coalesce(p_from, '0001-01-01'::date), coalesce(p_to, '9999-12-31'::date)) p
  left join public.subjects s on s.id = p.subject_id
  group by p.subject_id, s.name, s.color
  having sum(p.focused_seconds) > 0
  order by 4 desc;
$$;

revoke execute on function public.get_my_summary() from public, anon;
revoke execute on function public.get_subject_totals(date, date) from public, anon;
grant execute on function public.get_my_summary() to authenticated;
grant execute on function public.get_subject_totals(date, date) to authenticated;
