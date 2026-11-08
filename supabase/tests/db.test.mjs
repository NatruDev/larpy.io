// Runs every Larpy migration against PGlite (Postgres inside Node, no Docker needed) with a
// minimal stand-in for Supabase's auth schema,
// then checks the behaviour that matters: sign-up trigger, RLS, column grants, session functions.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

const migrationsDir = new URL('../migrations/', import.meta.url);
const db = new PGlite();

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
let passed = 0;
const failures = [];

async function as(user, sql, params) {
  // Each call: switch role + claims, run, switch back.
  const role = user ? 'authenticated' : 'anon';
  await db.exec(`reset role; set request.jwt.claim.sub = '${user ?? ''}'; set role ${role};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}
async function expectOk(name, fn) {
  try { const r = await fn(); passed++; return r; }
  catch (e) { failures.push(`${name}: unexpected error: ${e.message}`); }
}
async function expectFail(name, fn, pattern) {
  try { await fn(); failures.push(`${name}: expected an error but it succeeded`); }
  catch (e) {
    if (pattern && !pattern.test(e.message)) failures.push(`${name}: wrong error: ${e.message}`);
    else passed++;
  }
}
function check(name, cond, detail = '') {
  if (cond) passed++; else failures.push(`${name} ${detail}`);
}

// Supabase stand-ins
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;

  -- Just enough of Supabase Storage for the post-media bucket and its policies.
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
    name text, owner uuid default auth.uid(), created_at timestamptz default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`);

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(file, migrationsDir), 'utf8'));
}
passed++; // migration applied

// Sign-up trigger
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@x.com', '{"full_name":"Alice A"}'), ($2, 'b@x.com', '{}')`, [A, B]);
const profiles = (await db.query('select id, display_name, daily_goal_minutes from public.profiles order by id')).rows;
check('profiles created on sign-up', profiles.length === 2);
check('display name copied from sign-up', profiles[0].display_name === 'Alice A', JSON.stringify(profiles[0]));

// Profile edits
await expectOk('A sets username and time zone', () => as(A, `update public.profiles set username = 'alice', time_zone = 'America/New_York', onboarded_at = now() where id = $1`, [A]));
await expectFail('invalid username rejected', () => as(A, `update public.profiles set username = 'Al ice!' where id = $1`, [A]));
await expectFail('invalid time zone rejected', () => as(A, `update public.profiles set time_zone = 'Mars/Olympus' where id = $1`, [A]), /Unknown time zone/);
await expectFail('A cannot change created_at', () => as(A, `update public.profiles set created_at = now() where id = $1`, [A]), /permission denied/);
const hijack = await as(A, `update public.profiles set display_name = 'hacked' where id = $1`, [B]);
check('A cannot edit B profile', hijack.affectedRows === 0);
await expectOk('B takes a username', () => as(B, `update public.profiles set username = 'bob' where id = $1`, [B]));
await expectFail('duplicate username rejected', () => as(B, `update public.profiles set username = 'alice' where id = $1`, [B]), /duplicate|unique/);

// Subjects
const subj = await as(A, `insert into public.subjects (name, color) values ('Organic Chemistry', '#4A4FD6') returning id`);
const subjectId = subj.rows[0].id;
check('subject owner defaults to caller', (await db.query('select user_id from public.subjects')).rows[0].user_id === A);
await expectFail('duplicate active subject name rejected', () => as(A, `insert into public.subjects (name) values (' organic chemistry ')`), /duplicate|unique/);
await expectFail('A cannot add subject for B', () => as(A, `insert into public.subjects (user_id, name) values ($1, 'X')`, [B]), /row-level security/);

// Sessions: no direct writes
await expectFail('direct session insert blocked', () => as(A, `insert into public.sessions (user_id) values ($1)`, [A]), /permission denied/);

// Session lifecycle
const started = await expectOk('A starts a session', () => as(A, `select * from public.start_session($1, 60, 25, 5, false)`, [subjectId]));
const sessionId = started.rows[0].id;
check('session records owner time zone', started.rows[0].time_zone === 'America/New_York', `got ${started.rows[0].time_zone}`);
check('timer session starts with a heartbeat', started.rows[0].last_heartbeat_at !== null);
await db.query(`update public.sessions set last_heartbeat_at = now() - interval '3 minutes' where id = $1`, [sessionId]);
const beat = await expectOk('A sends a heartbeat', () => as(A, 'select public.heartbeat_session($1) as at', [sessionId]));
check('heartbeat moves forward', (await db.query('select last_heartbeat_at > now() - interval \'1 minute\' as fresh from public.sessions where id = $1', [sessionId])).rows[0].fresh && beat.rows[0].at !== null);
await expectFail('B cannot heartbeat A session', () => as(B, 'select public.heartbeat_session($1)', [sessionId]), /not found/);
await expectFail('A cannot set heartbeat directly', () => as(A, 'update public.sessions set last_heartbeat_at = now() where id = $1', [sessionId]), /permission denied/);
await expectFail('A cannot change session time zone', () => as(A, `update public.sessions set time_zone = 'UTC' where id = $1`, [sessionId]), /permission denied/);
await as(A, `update public.profiles set time_zone = 'Europe/Berlin' where id = $1`, [A]);
check('profile time zone change leaves session alone', (await db.query('select time_zone from public.sessions where id = $1', [sessionId])).rows[0].time_zone === 'America/New_York');
await expectFail('second running session blocked', () => as(A, `select * from public.start_session()`), /already have a session running/);
await expectFail('B cannot start with A subject', () => as(B, `select * from public.start_session($1)`, [subjectId]), /subject was not found/);
await expectFail('B cannot pause A session', () => as(B, `select * from public.pause_session($1)`, [sessionId]), /not found/);

// Simulate 40 minutes elapsed, then a pause that lasted 5 minutes.
await db.query(`update public.sessions set started_at = now() - interval '40 minutes' where id = $1`, [sessionId]);
await db.query(`update public.sessions set last_heartbeat_at = now() - interval '3 minutes' where id = $1`, [sessionId]);
await expectOk('A pauses (break)', () => as(A, `select * from public.pause_session($1, 'break')`, [sessionId]));
check('pausing counts as a heartbeat', (await db.query('select last_heartbeat_at > now() - interval \'1 minute\' as fresh from public.sessions where id = $1', [sessionId])).rows[0].fresh);
await expectFail('pausing twice fails', () => as(A, `select * from public.pause_session($1)`, [sessionId]), /already paused/);
await db.query(`update public.sessions set paused_at = now() - interval '5 minutes' where id = $1`, [sessionId]);
await db.query(`update public.session_pauses set started_at = now() - interval '5 minutes' where session_id = $1`, [sessionId]);
await expectOk('A resumes', () => as(A, `select * from public.resume_session($1)`, [sessionId]));
const ended = await expectOk('A ends with caption', () => as(A, `select * from public.end_session($1, '  Finished chapter 4  ')`, [sessionId]));
const s = ended.rows[0];
check('paused_seconds recorded', s.paused_seconds >= 299 && s.paused_seconds <= 301, `got ${s.paused_seconds}`);
check('focused_seconds = elapsed - paused', s.focused_seconds >= 2099 && s.focused_seconds <= 2101, `got ${s.focused_seconds}`);
check('caption trimmed', s.caption === 'Finished chapter 4', JSON.stringify(s.caption));
const pauses = (await db.query('select kind, ended_at from public.session_pauses where session_id = $1', [sessionId])).rows;
check('pause segment closed', pauses.length === 1 && pauses[0].kind === 'break' && pauses[0].ended_at !== null);
const endedAgain = await expectOk('ending twice returns the ended session', () => as(A, `select * from public.end_session($1)`, [sessionId]));
check('second end changes nothing', endedAgain.rows[0].ended_at.getTime() === s.ended_at.getTime());
check('heartbeat after end returns nothing', (await as(A, 'select public.heartbeat_session($1) as at', [sessionId])).rows[0].at === null);

// Editing finished sessions
await expectFail('A cannot rewrite session times', () => as(A, `update public.sessions set started_at = now() - interval '10 hours' where id = $1`, [sessionId]), /permission denied/);
await expectOk('A can edit caption', () => as(A, `update public.sessions set caption = 'Edited' where id = $1`, [sessionId]));
const bSubj = (await as(B, `insert into public.subjects (name) values ('Spanish') returning id`)).rows[0].id;
await expectFail('A cannot attach B subject', () => as(A, `update public.sessions set subject_id = $1 where id = $2`, [bSubj, sessionId]), /row-level security/);

// Visibility
check('B sees A public session', (await as(B, 'select id from public.sessions where id = $1', [sessionId])).rows.length === 1);
check('B sees pause segments', (await as(B, 'select id from public.session_pauses where session_id = $1', [sessionId])).rows.length === 1);
await as(A, `update public.profiles set is_private = true where id = $1`, [A]);
check('private profile hides sessions', (await as(B, 'select id from public.sessions where user_id = $1', [A])).rows.length === 0);
check('private profile hides subjects', (await as(B, 'select id from public.subjects where user_id = $1', [A])).rows.length === 0);
check('owner still sees own sessions', (await as(A, 'select id from public.sessions where user_id = $1', [A])).rows.length === 1);
await as(A, `update public.profiles set is_private = false where id = $1`, [A]);
await as(A, `update public.sessions set is_private = true where id = $1`, [sessionId]);
check('private session hidden', (await as(B, 'select id from public.sessions where id = $1', [sessionId])).rows.length === 0);
await as(A, `update public.sessions set is_private = false where id = $1`, [sessionId]);

// Running sessions are visible to others (for "focusing now")
const active = (await as(A, 'select id from public.start_session()')).rows[0].id;
check('B sees A running session (focusing now)', (await as(B, 'select id from public.sessions where id = $1', [active])).rows.length === 1);

// Follows
await expectOk('B follows A', () => as(B, 'insert into public.follows (follower_id, followee_id) values ($1, $2)', [B, A]));
await expectFail('B cannot follow on behalf of A', () => as(B, 'insert into public.follows (follower_id, followee_id) values ($1, $2)', [A, B]), /row-level security/);
await expectFail('no self-follow', () => as(A, 'insert into public.follows (follower_id, followee_id) values ($1, $1)', [A]), /follows_not_self/);

// Manual sessions
await expectFail('manual session in the future rejected', () => as(B, `select * from public.add_manual_session(now(), now() + interval '1 hour')`), /future/);
await expectFail('manual session over 12h rejected', () => as(B, `select * from public.add_manual_session(now() - interval '13 hours', now())`), /12 hours/);
const manual = await expectOk('manual session saved', () => as(B, `select * from public.add_manual_session(now() - interval '2 hours', now() - interval '1 hour', $1)`, [bSubj]));
check('manual session flagged', manual.rows[0].source === 'manual' && manual.rows[0].focused_seconds === 3600, JSON.stringify(manual.rows[0]));
check('manual session gets owner time zone, no heartbeat', manual.rows[0].time_zone === 'UTC' && manual.rows[0].last_heartbeat_at === null, JSON.stringify(manual.rows[0]));

// Abandoned sessions (no heartbeat for 15 minutes) end at their last heartbeat
await expectFail('clients cannot run the stale sweep', () => as(A, 'select public.end_stale_sessions()'), /permission denied/);
await db.query(`update public.sessions set started_at = now() - interval '60 minutes', last_heartbeat_at = now() - interval '20 minutes' where id = $1`, [active]);
const restarted = await expectOk('start closes the stale session first', () => as(A, 'select * from public.start_session()'));
const stale = (await db.query('select ended_at, focused_seconds, (ended_at = last_heartbeat_at) as at_heartbeat from public.sessions where id = $1', [active])).rows[0];
check('stale session ended at last heartbeat', stale.ended_at !== null && stale.at_heartbeat, JSON.stringify(stale));
check('stale session credits time only up to heartbeat', stale.focused_seconds >= 2399 && stale.focused_seconds <= 2401, `got ${stale.focused_seconds}`);

// Stale while paused: the open pause is closed at the heartbeat too.
const pausedSession = restarted.rows[0].id;
await as(A, `select * from public.pause_session($1)`, [pausedSession]);
// Two updates: changing paused_at counts as a heartbeat, so set the heartbeat afterwards.
await db.query(`update public.sessions set started_at = now() - interval '60 minutes', paused_at = now() - interval '30 minutes' where id = $1`, [pausedSession]);
await db.query(`update public.sessions set last_heartbeat_at = now() - interval '20 minutes' where id = $1`, [pausedSession]);
await db.query(`update public.session_pauses set started_at = now() - interval '30 minutes' where session_id = $1`, [pausedSession]);
check('sweep ends stale sessions', (await db.query('select public.end_stale_sessions() as n')).rows[0].n === 1);
const sp = (await db.query('select focused_seconds, paused_seconds, paused_at from public.sessions where id = $1', [pausedSession])).rows[0];
check('stale paused session: pause closed at heartbeat', sp.paused_at === null && sp.paused_seconds >= 599 && sp.paused_seconds <= 601 && sp.focused_seconds >= 1799 && sp.focused_seconds <= 1801, JSON.stringify(sp));
check('stale pause row closed', (await db.query('select count(*)::int as n from public.session_pauses where session_id = $1 and ended_at is null', [pausedSession])).rows[0].n === 0);

// Coming back late to a stale session can't claim the time.
const late = (await as(A, 'select id from public.start_session()')).rows[0].id;
await db.query(`update public.sessions set started_at = now() - interval '60 minutes', last_heartbeat_at = now() - interval '20 minutes' where id = $1`, [late]);
check('heartbeat on a stale session ends it instead', (await as(A, 'select public.heartbeat_session($1) as at', [late])).rows[0].at === null);
const lateEnd = await expectOk('ending a stale session late returns it as ended', () => as(A, 'select * from public.end_session($1)', [late]));
check('late end keeps the heartbeat end time', lateEnd.rows[0].ended_at.getTime() === lateEnd.rows[0].last_heartbeat_at.getTime());
check('late session ended at heartbeat', (await db.query('select ended_at = last_heartbeat_at as ok from public.sessions where id = $1', [late])).rows[0].ok);

// Discarding a session (delete)
const discard = (await as(A, 'select id from public.start_session()')).rows[0].id;
const notMine = await as(B, 'delete from public.sessions where id = $1', [discard]);
check('B cannot delete A session', notMine.affectedRows === 0);
const mine = await as(A, 'delete from public.sessions where id = $1', [discard]);
check('A can discard own session', mine.affectedRows === 1);

// Daily stats: a cache that always matches sessions
const totalsMatch = async (user) => {
  const r = (await db.query(`select
      (select coalesce(sum(focused_seconds), 0) from public.sessions where user_id = $1 and ended_at is not null)::int as sessions,
      (select coalesce(sum(focused_seconds), 0) from public.daily_stats where user_id = $1)::int as daily`, [user])).rows[0];
  return Math.abs(r.sessions - r.daily) <= 2 ? true : r;
};
check('daily stats match sessions (A)', (await totalsMatch(A)) === true, JSON.stringify(await totalsMatch(A)));
check('daily stats match sessions (B)', (await totalsMatch(B)) === true, JSON.stringify(await totalsMatch(B)));

const dayStat = async (user, day) =>
  (await db.query('select focused_seconds from public.daily_stats where user_id = $1 and day = $2::date', [user, day])).rows[0]?.focused_seconds ?? 0;

// Crossing midnight in UTC (B's time zone): 23:30 → 00:45
const overnight = (await as(B, `select id from public.add_manual_session('2026-10-10 23:30Z', '2026-10-11 00:45Z')`)).rows[0].id;
check('overnight session split across days', (await dayStat(B, '2026-10-10')) === 1800 && (await dayStat(B, '2026-10-11')) === 2700,
  `${await dayStat(B, '2026-10-10')} / ${await dayStat(B, '2026-10-11')}`);

// Crossing midnight in Berlin (A's time zone, UTC+2): 21:30Z → 22:30Z is 23:30 → 00:30 local
await as(A, `select public.add_manual_session('2026-10-09 21:30Z', '2026-10-09 22:30Z')`);
check('split uses the session time zone', (await dayStat(A, '2026-10-09')) === 1800 && (await dayStat(A, '2026-10-10')) === 1800,
  `${await dayStat(A, '2026-10-09')} / ${await dayStat(A, '2026-10-10')}`);

// A pause that straddles midnight is taken off each side: 23:00 → 01:00 Berlin, paused 23:45 → 00:15
const split = (await as(A, 'select id from public.start_session()')).rows[0].id;
await as(A, 'select public.pause_session($1)', [split]);
await as(A, 'select public.resume_session($1)', [split]);
await as(A, 'select public.end_session($1)', [split]);
await db.query(`update public.session_pauses set started_at = '2026-10-05 21:45Z', ended_at = '2026-10-05 22:15Z' where session_id = $1`, [split]);
await db.query(`update public.sessions set started_at = '2026-10-05 21:00Z', ended_at = '2026-10-05 23:00Z', paused_seconds = 1800, time_zone = 'Europe/Berlin' where id = $1`, [split]);
check('pause across midnight split correctly', (await dayStat(A, '2026-10-05')) === 2700 && (await dayStat(A, '2026-10-06')) === 2700,
  `${await dayStat(A, '2026-10-05')} / ${await dayStat(A, '2026-10-06')}`);
check('daily stats still match sessions after edits (A)', (await totalsMatch(A)) === true, JSON.stringify(await totalsMatch(A)));

// Deleting a session removes its days
await as(B, 'delete from public.sessions where id = $1', [overnight]);
check('deleted session leaves no daily stats', (await dayStat(B, '2026-10-10')) === 0 && (await dayStat(B, '2026-10-11')) === 0);

// Privacy and write protection
check('B cannot read A daily stats', (await as(B, 'select * from public.daily_stats where user_id = $1', [A])).rows.length === 0);
check('A reads own daily stats', (await as(A, 'select * from public.daily_stats where user_id = $1', [A])).rows.length > 0);
await expectFail('daily stats are read-only', () => as(A, `insert into public.daily_stats (user_id, day, focused_seconds) values ($1, '2026-01-01', 99999)`, [A]), /permission denied/);

// Streaks: B studies today, yesterday and the day before (current 3), and had a 5-day run three weeks ago (best 5)
await as(B, `select public.add_manual_session(now() - interval '90 seconds', now() - interval '10 seconds')`);
for (const daysAgo of [1, 2, 20, 21, 22, 23, 24]) {
  // B's time zone is UTC, so build the days from UTC midnight (not the test machine's local midnight).
  const noon = `(date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') - interval '${daysAgo} days' + interval '12 hours'`;
  await as(B, `select public.add_manual_session(${noon}, ${noon} + interval '10 minutes')`);
}
const summary = (await as(B, 'select public.get_my_summary() as s')).rows[0].s;
check('current streak counts today, yesterday, day before', summary.current_streak === 3, JSON.stringify(summary));
check('best streak remembers the longer run', summary.best_streak === 5, `got ${summary.best_streak}`);
check('summary has today and a 7-day week', summary.today_seconds >= 80 && summary.week.length === 7, JSON.stringify(summary.week));
await expectFail('signed-out visitors get no summary', () => as(null, 'select public.get_my_summary()'), /permission denied/);

// Time per subject
const subjectsA = (await as(A, 'select * from public.get_subject_totals()')).rows;
check('subject totals include named subjects', subjectsA.some((r) => r.name === 'Organic Chemistry' && Number(r.focused_seconds) > 0), JSON.stringify(subjectsA));
check('subject totals only cover the caller', (await as(B, 'select * from public.get_subject_totals()')).rows.every((r) => r.name !== 'Organic Chemistry'));

// Posts: made from a session, or free
const bStats = async () => (await db.query('select coalesce(sum(focused_seconds), 0)::int as n from public.daily_stats where user_id = $1', [B])).rows[0].n;
await expectFail('direct post insert blocked', () => as(A, `insert into public.posts (author_id, caption) values ($1, 'hi')`, [A]), /permission denied/);
const post = await expectOk('A posts a session', () => as(A, `select * from public.create_post($1, '  Chapter 4 done  ')`, [sessionId]));
const postId = post.rows[0].id;
check('post links its session, caption trimmed', post.rows[0].session_id === sessionId && post.rows[0].caption === 'Chapter 4 done', JSON.stringify(post.rows[0]));
await expectFail('a session is posted once', () => as(A, 'select public.create_post($1)', [sessionId]), /already posted/);
await expectFail('B cannot post A session', () => as(B, 'select public.create_post($1)', [sessionId]), /not found/);
const runningA = (await as(A, 'select id from public.start_session()')).rows[0].id;
await expectFail('running session cannot be posted', () => as(A, 'select public.create_post($1)', [runningA]), /Finish the session/);
await as(A, 'delete from public.sessions where id = $1', [runningA]);
const shortSession = (await as(A, 'select id from public.start_session()')).rows[0].id;
await as(A, 'select public.end_session($1)', [shortSession]);
await db.query(`update public.sessions set started_at = ended_at - interval '2 minutes' where id = $1`, [shortSession]);
await expectFail('sessions under 5 minutes cannot be posted', () => as(A, 'select public.create_post($1)', [shortSession]), /5 minutes/);
const privateSession = (await as(A, `select id from public.add_manual_session(now() - interval '3 hours', now() - interval '2 hours', null, null, true)`)).rows[0].id;
await expectFail('private session cannot be posted', () => as(A, 'select public.create_post($1)', [privateSession]), /private/);
const manualSession = (await as(A, `select id from public.add_manual_session(now() - interval '5 hours', now() - interval '4 hours')`)).rows[0].id;
await expectFail('manual session cannot be posted', () => as(A, 'select public.create_post($1)', [manualSession]), /timed with the focus timer/);

await expectFail('empty free post rejected', () => as(B, `select public.create_post(null, '   ')`), /text or a photo/);
await expectFail('caption over 500 characters rejected', () => as(B, `select public.create_post(null, repeat('x', 501))`), /check constraint/);
const statsBefore = await bStats();
const freePost = await expectOk('B makes a text post', () => as(B, `select * from public.create_post(null, 'Exam week, wish me luck')`));
const freeId = freePost.rows[0].id;
check('free post has no session', freePost.rows[0].session_id === null);
check('posting never changes stats', (await bStats()) === statsBefore);

// Post media: upload to your own folder first, then attach
const upload = (user, name) => as(user, `insert into storage.objects (bucket_id, name) values ('post-media', $1)`, [name]);
const media = (items) => JSON.stringify(items);
await expectOk('A uploads into own folder', () => upload(A, `${A}/desk.jpg`));
await expectFail('A cannot upload into B folder', () => upload(A, `${B}/x.jpg`), /row-level security/);
await upload(B, `${B}/notes.jpg`);
await expectFail('files must be uploaded first', () => as(A, `select public.create_post(null, 'x', $1)`, [media([{ kind: 'photo', path: `${A}/missing.jpg` }])]), /wasn.t found/);
await expectFail('cannot attach someone else\'s file', () => as(A, `select public.create_post(null, 'x', $1)`, [media([{ kind: 'photo', path: `${B}/notes.jpg` }])]), /wasn.t found/);
await expectFail('up to 4 photos', () => as(A, `select public.create_post(null, 'x', $1)`, [media([0, 1, 2, 3, 4].map((i) => ({ kind: 'photo', path: `${A}/p${i}.jpg` })))]), /up to 4 photos/);
const deskPhoto = [{ kind: 'photo', path: `${A}/desk.jpg`, width: 1600, height: 1200 }];
const photoPost = await expectOk('A posts a photo with no text', () => as(A, `select * from public.create_post(null, null, $1)`, [media(deskPhoto)]));
const photoPostId = photoPost.rows[0].id;
check('photo is ready at once', (await db.query('select status from public.post_media where post_id = $1', [photoPostId])).rows[0]?.status === 'ready');
await expectFail('a file belongs to one post', () => as(A, `select public.create_post(null, 'again', $1)`, [media(deskPhoto)]), /duplicate|unique/);
await expectFail('timelapse needs a thumbnail', () => as(A, `select public.create_post(null, 'x', $1)`, [media([{ kind: 'timelapse', path: `${A}/lapse.mp4` }])]), /thumbnail/);
await upload(A, `${A}/lapse.mp4`);
await upload(A, `${A}/lapse.jpg`);
const lapse = [{ kind: 'timelapse', path: `${A}/lapse.mp4`, thumbnail_path: `${A}/lapse.jpg`, width: 1080, height: 1920, duration_seconds: 30 }];
const lapseId = (await expectOk('A posts a timelapse', () => as(A, `select * from public.create_post(null, 'Two hours in 30 seconds', $1)`, [media(lapse)]))).rows[0].id;
check('timelapse waits for moderation', (await db.query('select status from public.post_media where post_id = $1', [lapseId])).rows[0]?.status === 'pending');
check('others cannot see media waiting for moderation', (await as(B, 'select id from public.post_media where post_id = $1', [lapseId])).rows.length === 0);
check('author sees own pending media', (await as(A, 'select id from public.post_media where post_id = $1', [lapseId])).rows.length === 1);
await expectFail('direct media insert blocked', () => as(A, `insert into public.post_media (post_id, kind, path, position) values ($1, 'photo', 'x', 1)`, [photoPostId]), /permission denied/);

// Reading files: only your own, or through a post you can see
await upload(A, `${A}/unposted.jpg`);
const canRead = async (user, name) => (await as(user, 'select name from storage.objects where name = $1', [name])).rows.length === 1;
check('B can read a posted photo', await canRead(B, `${A}/desk.jpg`));
check('B cannot read an unposted upload', !(await canRead(B, `${A}/unposted.jpg`)));
check('B cannot read a timelapse waiting for moderation', !(await canRead(B, `${A}/lapse.mp4`)));
check('A reads own uploads', (await as(A, 'select name from storage.objects where name like $1', [`${A}/%`])).rows.length === 4);

// Editing posts
await expectOk('B edits own caption', () => as(B, `update public.posts set caption = ' Exam week! ' where id = $1`, [freeId]));
const edited = (await db.query('select caption, edited_at from public.posts where id = $1', [freeId])).rows[0];
check('edit is trimmed and stamped', edited.caption === 'Exam week!' && edited.edited_at !== null, JSON.stringify(edited));
check('A cannot edit B post', (await as(A, `update public.posts set caption = 'hacked' where id = $1`, [freeId])).affectedRows === 0);
await expectFail('a free post cannot be emptied', () => as(B, `update public.posts set caption = '' where id = $1`, [freeId]), /needs some text/);
await expectFail('a post keeps its session', () => as(A, 'update public.posts set session_id = null where id = $1', [postId]), /permission denied/);

// The feed
const feed = async (user, scope = 'following') => (await as(user, 'select public.get_feed($1) as f', [scope])).rows[0].f;
const item = (f, id) => f.find((i) => i.post.id === id);
const bFeed = await feed(B);
check('Following shows people you follow and yourself', [postId, photoPostId, lapseId, freeId].every((id) => item(bFeed, id)), JSON.stringify(bFeed.map((i) => i.post.id)));
check('newest first', bFeed.every((x, i) => i === 0 || bFeed[i - 1].post.created_at >= x.post.created_at));
const sessionCard = item(bFeed, postId);
check('session post carries the session numbers', sessionCard.session?.focused_seconds === s.focused_seconds && sessionCard.session.subject?.name === 'Organic Chemistry' && sessionCard.session.pauses.length === 1, JSON.stringify(sessionCard.session));
check('session post has its author', sessionCard.author.username === 'alice');
check('free post has no session in the feed', item(bFeed, freeId).session === null);
check('pending media is left off the card', item(bFeed, lapseId).media.length === 0 && item(await feed(A), lapseId).media.length === 1);
check('photo comes with its size', item(bFeed, photoPostId).media[0]?.width === 1600);
const aFeed = await feed(A);
check('Following leaves out people you don\'t follow', !item(aFeed, freeId) && !!item(aFeed, postId));
check('Global includes everyone', !!item(await feed(A, 'global'), freeId));
const bobsPosts = (await as(A, 'select public.get_feed(p_author_id => $1) as f', [B])).rows[0].f;
check('author filter shows only that person', bobsPosts.length > 0 && bobsPosts.every((i) => i.post.author_id === B), JSON.stringify(bobsPosts.map((i) => i.post.author_id)));

// Paging one post at a time, with two posts sharing a timestamp
await db.query('update public.posts set created_at = (select created_at from public.posts where id = $1) where id = $2', [postId, freeId]);
const everything = await feed(B, 'global');
const seen = [];
let cursor = null;
for (let i = 0; i < 20; i++) {
  const page = (await as(B, 'select public.get_feed($1, $2, $3, $4) as f', ['global', cursor?.created_at ?? null, cursor?.id ?? null, 1])).rows[0].f;
  if (!page.length) break;
  seen.push(page[0].post.id);
  cursor = page[0].post;
}
check('paging returns every post exactly once', seen.length === everything.length && new Set(seen).size === seen.length, `${seen.length} of ${everything.length}`);

// Hiding posts
await as(A, 'update public.sessions set is_private = true where id = $1', [sessionId]);
check('making a posted session private hides its post', !item(await feed(B), postId));
check('author still sees it', !!item(await feed(A), postId));
await as(A, 'update public.sessions set is_private = false where id = $1', [sessionId]);
await as(A, 'update public.profiles set is_private = true where id = $1', [A]);
check('private profile hides posts', (await as(B, 'select id from public.posts where author_id = $1', [A])).rows.length === 0);
check('private profile page shows only the header', (await as(B, `select public.get_profile('alice') as p`)).rows[0].p.hidden === true);
await as(A, 'update public.profiles set is_private = false where id = $1', [A]);

// Reactions (on posts)
await expectOk('B reacts to A post', () => as(B, 'insert into public.reactions (post_id) values ($1)', [postId]));
await expectFail('B cannot react twice', () => as(B, 'insert into public.reactions (post_id) values ($1)', [postId]), /duplicate|unique/);
await expectFail('B cannot react as A', () => as(B, 'insert into public.reactions (post_id, user_id) values ($1, $2)', [postId, A]), /row-level security/);
const reactedB = item(await feed(B), postId);
check('feed shows the count and my reaction', reactedB.reaction_count === 1 && reactedB.reacted_by_me === true, JSON.stringify(reactedB));
const reactedA = item(await feed(A), postId);
check('others see the count, not as theirs', reactedA.reaction_count === 1 && reactedA.reacted_by_me === false);

// Profile pages
const prof = (await as(B, `select public.get_profile(' ALICE ') as p`)).rows[0].p;
check('profile by username', prof && prof.hidden === false && prof.is_following === true && prof.followers === 1 && prof.posts === 3, JSON.stringify(prof));
check('profile has streak, total and heatmap', typeof prof.current_streak === 'number' && prof.total_seconds > 0 && prof.heatmap.length > 0, JSON.stringify(prof));
check('profile gives their local today', /^\d{4}-\d{2}-\d{2}$/.test(prof.today) && prof.streak_min_seconds === 60, JSON.stringify(prof.today));
check('unknown username returns null', (await as(B, `select public.get_profile('nobody_here') as p`)).rows[0].p === null);
await expectFail('signed-out visitors get no profiles', () => as(null, `select public.get_profile('alice')`), /permission denied/);

// Blocks
await expectOk('A blocks B', () => as(A, 'insert into public.blocks (blocked_id) values ($1)', [B]));
check('blocking ends follows both ways', (await db.query('select count(*)::int as n from public.follows where (follower_id = $1 and followee_id = $2) or (follower_id = $2 and followee_id = $1)', [A, B])).rows[0].n === 0);
check('blocked person sees none of the blocker\'s posts', (await feed(B, 'global')).every((i) => i.post.author_id !== A));
check('blocker sees none of the blocked person\'s posts', (await feed(A, 'global')).every((i) => i.post.author_id !== B));
check('blocked person sees none of the blocker\'s sessions', (await as(B, 'select id from public.sessions where user_id = $1', [A])).rows.length === 0);
check('blocked person cannot read the blocker\'s files', !(await canRead(B, `${A}/desk.jpg`)));
await expectFail('blocked person cannot follow', () => as(B, 'insert into public.follows (follower_id, followee_id) values ($1, $2)', [B, A]), /row-level security/);
await expectFail('blocked person cannot react', () => as(B, 'insert into public.reactions (post_id) values ($1)', [photoPostId]), /row-level security/);
check('nobody can see who blocked them', (await as(B, 'select * from public.blocks')).rows.length === 0);
const seenByBlocked = (await as(B, `select public.get_profile('alice') as p`)).rows[0].p;
check('blocked person gets only the header', seenByBlocked.hidden === true && seenByBlocked.blocked_by_me === false);
check('blocker can see they blocked them', (await as(A, `select public.get_profile('bob') as p`)).rows[0].p.blocked_by_me === true);
await expectFail('no self-block', () => as(A, 'insert into public.blocks (blocked_id) values ($1)', [A]), /blocks_not_self/);
await expectOk('A unblocks B', () => as(A, 'delete from public.blocks where blocked_id = $1', [B]));
await expectOk('B can follow again after unblock', () => as(B, 'insert into public.follows (follower_id, followee_id) values ($1, $2)', [B, A]));

// Feed and posting need an account
await expectFail('signed-out visitors cannot read the feed', () => as(null, 'select public.get_feed()'), /permission denied/);
await expectFail('signed-out visitors cannot post', () => as(null, `select public.create_post(null, 'hi')`), /permission denied/);
check('signed-out visitors see no posts', (await as(null, 'select id from public.posts')).rows.length === 0);

// Deleting a session deletes its post; reactions go with it
await as(A, 'delete from public.sessions where id = $1', [sessionId]);
check('deleting a session deletes its post', (await db.query('select count(*)::int as n from public.posts where id = $1', [postId])).rows[0].n === 0);
check('and its reactions', (await db.query('select count(*)::int as n from public.reactions where post_id = $1', [postId])).rows[0].n === 0);

// Signed-out visitors
check('anon sees no profiles', (await as(null, 'select id from public.profiles')).rows.length === 0);
await expectFail('anon cannot start a session', () => as(null, 'select * from public.start_session()'), /permission denied/);
await expectFail('helper not callable', () => as(A, 'select public.close_open_pause($1)', [active]), /permission denied/);

// Deleting an account cascades
await db.query('delete from auth.users where id = $1', [B]);
check('account deletion removes data', (await db.query('select count(*)::int as n from public.sessions where user_id = $1', [B])).rows[0].n === 0);

console.log(`${passed} checks passed`);
if (failures.length) {
  console.log(`${failures.length} FAILED:\n- ` + failures.join('\n- '));
  process.exit(1);
}
