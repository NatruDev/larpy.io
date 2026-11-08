-- Demo data for local development.
--
-- Loaded automatically after the migrations by `npx supabase db reset` (which wipes everything else),
-- or on its own with `npm run db:seed` (keeps your own account; replaces only the demo accounts).
-- Never runs against the hosted project: `db push` doesn't seed.
--
-- Every demo account signs in with the password  larpy-demo
--
--   maya@larpy.test    main account: a year of history, a 3-week streak, follows four friends
--   priya@, sam@, leo@, ava@larpy.test    friends with their own history, posts, follows and reactions
--   jordan@larpy.test  private profile: nothing of theirs should show up for anyone else
--
-- Dates are relative to now(), so the heatmap and streak always look current, and the random seed is
-- fixed, so every reset gives the same shape of data.

-- Start clean so this file can be re-run. Cascades to profiles, subjects, sessions, posts, follows, reactions.
delete from auth.users where email like '%@larpy.test';

create temp table seed_users (
  id uuid primary key,
  email text not null,
  full_name text not null,
  username text not null,
  time_zone text not null,
  daily_goal_minutes integer not null,
  is_private boolean not null,
  bio text,
  -- Chance of studying on a weekday (weekends are lower) and how far back history goes.
  consistency numeric not null,
  history_days integer not null,
  subjects text[] not null
);

insert into seed_users values
  ('00000000-0000-4000-8000-000000000001', 'maya@larpy.test', 'Maya Chen', 'maya', 'America/New_York', 90, false,
   'Pre-med. Powered by cold brew.', 0.85, 364, array['Biology', 'Chemistry', 'Physics', 'Spanish']),
  ('00000000-0000-4000-8000-000000000002', 'priya@larpy.test', 'Priya Raman', 'priya', 'Europe/London', 120, false,
   'Law school, year two.', 0.9, 300, array['Contract Law', 'Economics', 'History']),
  ('00000000-0000-4000-8000-000000000003', 'sam@larpy.test', 'Sam Okafor', 'sam', 'America/Chicago', 60, false,
   null, 0.6, 200, array['Calculus', 'Computer Science', 'Physics']),
  ('00000000-0000-4000-8000-000000000004', 'leo@larpy.test', 'Leo Martins', 'leo', 'Europe/Berlin', 45, false,
   'Philosophy and too much coffee.', 0.45, 150, array['Philosophy', 'German']),
  ('00000000-0000-4000-8000-000000000005', 'ava@larpy.test', 'Ava Kim', 'ava', 'Asia/Seoul', 180, false,
   'Stats major. Exams in December.', 0.75, 250, array['Statistics', 'Machine Learning', 'English']),
  ('00000000-0000-4000-8000-000000000006', 'jordan@larpy.test', 'Jordan Lee', 'jordan', 'America/Los_Angeles', 60, true,
   null, 0.7, 120, array['Design', 'Art History']);

-- ---------------------------------------------------------------------------------------------
-- Accounts (the on_auth_user_created trigger creates each profile)
-- ---------------------------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue reads these as strings, so they must be '' rather than null.
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('larpy-demo', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name),
  now() - make_interval(days => u.history_days + 1), now(),
  '', '', '', ''
from seed_users u;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email',
  now(), now() - make_interval(days => u.history_days + 1), now()
from seed_users u;

update public.profiles p
set username = u.username,
    time_zone = u.time_zone,
    daily_goal_minutes = u.daily_goal_minutes,
    is_private = u.is_private,
    bio = u.bio,
    onboarded_at = now() - make_interval(days => u.history_days + 1),
    created_at = now() - make_interval(days => u.history_days + 1)
from seed_users u
where p.id = u.id;

-- Colors are the first entries of SubjectPalette in src/theme/colors.ts, in order.
insert into public.subjects (user_id, name, color, created_at)
select u.id, s.name, (array['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4'])[s.n],
  now() - make_interval(days => u.history_days + 1) + make_interval(mins => s.n::integer)
from seed_users u, unnest(u.subjects) with ordinality as s(name, n);

-- ---------------------------------------------------------------------------------------------
-- Sessions: 1-3 per study day, all finished, all within one local day
-- ---------------------------------------------------------------------------------------------

do $$
declare
  u record;
  v_subjects uuid[];
  v_today date;
  v_day date;
  v_cursor timestamp; -- local wall-clock time of the next session's start
  v_start timestamptz;
  v_end timestamptz;
  v_minutes integer;  -- focused minutes
  v_source public.session_source;
  v_focus integer;
  v_break integer;
  v_breaks integer;
  v_pause_at integer;
  v_pause_len integer;
  v_session uuid;
  v_captions text[] := array[
    'Finally finished the problem set', 'Flashcards, round two', 'Library grind', 'Chapter 7 done',
    'Slow start, strong finish', 'Practice exam, felt good', 'Lab report draft', 'Review for Friday''s quiz',
    'Rewrote my notes from lecture', 'Group study, then solo'
  ];
begin
  perform setseed(0.42);

  for u in select * from seed_users order by id loop
    select array_agg(id order by created_at) into v_subjects from public.subjects where user_id = u.id;
    v_today := (now() at time zone u.time_zone)::date;

    for i in reverse u.history_days..0 loop
      v_day := v_today - i;
      -- Maya studies every day for the last three weeks, so she has a live streak.
      if not (u.username = 'maya' and i <= 20)
         and random() > u.consistency * (case when extract(isodow from v_day) >= 6 then 0.6 else 1 end) then
        continue;
      end if;

      v_cursor := v_day + time '08:00' + make_interval(mins => floor(random() * 240)::integer);

      for n in 1..(1 + floor(random() * 3)::integer) loop
        v_minutes := 20 + floor(random() * 100)::integer;
        v_source := case when random() < 0.07 then 'manual' else 'timer' end;
        v_focus := null;
        v_break := null;
        v_breaks := 0;
        v_pause_len := 0;

        if v_source = 'timer' and random() < 0.35 then
          -- Pomodoro: a break after every focus block except the last.
          if random() < 0.6 then v_focus := 25; v_break := 5; else v_focus := 50; v_break := 10; end if;
          v_breaks := ceil(v_minutes::numeric / v_focus)::integer - 1;
        elsif v_source = 'timer' and random() < 0.3 then
          v_pause_len := 2 + floor(random() * 9)::integer;
          v_pause_at := 1 + floor(random() * (v_minutes - 1))::integer;
        end if;

        v_start := v_cursor at time zone u.time_zone;
        v_end := v_start + make_interval(mins => v_minutes + coalesce(v_breaks * v_break, 0) + v_pause_len);

        -- Keep sessions in the past and on their own local day.
        exit when v_end > now() - interval '10 minutes'
               or (v_end at time zone u.time_zone)::date <> v_day;

        insert into public.sessions (
          user_id, subject_id, source, goal_minutes, pomodoro_focus_minutes, pomodoro_break_minutes,
          is_private, started_at, ended_at, paused_seconds, caption, created_at
        )
        values (
          u.id,
          v_subjects[1 + floor(random() * array_length(v_subjects, 1))::integer],
          v_source,
          case when v_source = 'timer' and random() < 0.7
            then (array[30, 45, 60, 90, 120])[1 + floor(random() * 5)::integer] end,
          v_focus,
          v_break,
          random() < 0.08,
          v_start,
          v_end,
          (coalesce(v_breaks * v_break, 0) + v_pause_len) * 60,
          case when random() < 0.25 then v_captions[1 + floor(random() * array_length(v_captions, 1))::integer] end,
          v_end
        )
        returning id into v_session;

        insert into public.session_pauses (session_id, kind, started_at, ended_at)
        select v_session, 'break',
          v_start + make_interval(mins => k * v_focus + (k - 1) * v_break),
          v_start + make_interval(mins => k * (v_focus + v_break))
        from generate_series(1, v_breaks) k;

        if v_pause_len > 0 then
          insert into public.session_pauses (session_id, kind, started_at, ended_at)
          values (v_session, 'pause', v_start + make_interval(mins => v_pause_at),
                  v_start + make_interval(mins => v_pause_at + v_pause_len));
        end if;

        v_cursor := (v_end at time zone u.time_zone) + make_interval(mins => 20 + floor(random() * 160)::integer);
      end loop;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Posts, follows and reactions (no photos: the seed has no files to point at)
-- ---------------------------------------------------------------------------------------------

-- About 60% of the last month's public timed sessions get posted (Post is on by default), a few minutes
-- after they end, with the session note as the caption.
insert into public.posts (author_id, session_id, caption, created_at)
select s.user_id, s.id, s.caption, least(now(), s.ended_at + make_interval(mins => 1 + floor(random() * 20)::integer))
from public.sessions s
join seed_users u on u.id = s.user_id
where s.ended_at > now() - interval '30 days'
  and not s.is_private
  and s.source = 'timer'
  and s.focused_seconds >= public.post_min_session_seconds()
  and random() < 0.6;

-- A few free posts with no session behind them.
insert into public.posts (author_id, caption, created_at)
select u.id, c.caption, now() - make_interval(hours => c.hours_ago)
from (values
  ('maya', 'Three weeks without missing a day. Not stopping now.', 8),
  ('priya', 'Moot court on Friday. Send coffee.', 30),
  ('sam', 'Anyone else taking the calc midterm on Tuesday?', 52),
  ('ava', 'Grayscale phone during study hours is a game changer.', 75),
  ('leo', 'Reading Kant on a train was a choice.', 120),
  ('jordan', 'Private account, so nobody else should ever see this.', 20)
) as c(username, caption, hours_ago)
join seed_users u on u.username = c.username;

insert into public.follows (follower_id, followee_id, created_at)
select f.id, t.id, now() - interval '60 days'
from (values
  ('maya', 'priya'), ('maya', 'sam'), ('maya', 'leo'), ('maya', 'ava'),
  ('priya', 'maya'), ('priya', 'ava'),
  ('sam', 'maya'), ('sam', 'leo'), ('sam', 'priya'),
  ('leo', 'maya'),
  ('ava', 'maya'), ('ava', 'priya'), ('ava', 'sam'),
  ('jordan', 'maya')
) as pair(follower, followee)
join seed_users f on f.username = pair.follower
join seed_users t on t.username = pair.followee;

-- Reactions on the last two weeks of posts from public profiles.
insert into public.reactions (post_id, user_id, created_at)
select p.id, r.id, least(now(), p.created_at + random() * interval '6 hours')
from public.posts p
join seed_users author on author.id = p.author_id and not author.is_private
join seed_users r on r.id <> p.author_id
where p.created_at > now() - interval '14 days'
  and random() < 0.35;

drop table seed_users;
