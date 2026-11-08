// Larpy landing page: the live timer, the example heatmap, and the waitlist form.

const CONFIG = {
  // The Google Apps Script web app URL (ends in /exec). See scripts/waitlist/README.md.
  waitlistUrl: '',
  // The web app on Vercel. Leave empty to hide the "use the timer now" links.
  appUrl: '',
  // Leave a url empty to hide that link.
  socials: [
    { label: 'TikTok', url: '' },
    { label: 'Instagram', url: '' },
  ],
};

const STORAGE_KEY = 'larpy.waitlist';

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeSaved(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private windows can block storage; the page works without it.
  }
}

/* ---------- Links and small bits ---------- */

function setupLinks() {
  if (CONFIG.appUrl) {
    document.querySelectorAll('[data-app-link]').forEach((a) => {
      a.href = CONFIG.appUrl;
      a.hidden = false;
    });
    document.querySelectorAll('[data-app-link-wrap]').forEach((el) => (el.hidden = false));
  }

  const socials = document.querySelector('[data-socials]');
  CONFIG.socials
    .filter((s) => s.url)
    .forEach((s) => {
      const a = document.createElement('a');
      a.href = s.url;
      a.textContent = s.label;
      a.rel = 'noopener';
      a.target = '_blank';
      socials.append(a);
    });

  document.querySelector('[data-year]').textContent = String(new Date().getFullYear());

  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // The example posts' Respect buttons toggle, like the real ones.
  document.querySelectorAll('.respect').forEach((button) => {
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      const count = button.querySelector('[data-count]');
      count.textContent = String(Number(count.textContent) + (on ? 1 : -1));
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-on', on);
    });
  });
}

/* ---------- Live timer ---------- */

function setupTimer() {
  const NS = 'http://www.w3.org/2000/svg';
  const C = 120;
  const R = 104;
  const digits = document.querySelector('[data-digits]');
  const ends = document.querySelector('[data-ends]');
  const phase = document.querySelector('[data-phase]');
  const elapsedPath = document.querySelector('[data-elapsed]');
  const handle = document.querySelector('[data-handle]');
  const ticks = document.querySelector('[data-ticks]');
  const presets = document.querySelectorAll('[data-minutes]');

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(C + Math.sin(a) * 86));
    line.setAttribute('y1', String(C - Math.cos(a) * 86));
    line.setAttribute('x2', String(C + Math.sin(a) * 94));
    line.setAttribute('y2', String(C - Math.cos(a) * 94));
    ticks.append(line);
  }

  let durationMs = 25 * 60 * 1000;
  let startedAt = Date.now();
  let doneAt = 0;

  function point(fraction) {
    const a = fraction * Math.PI * 2;
    return [C + Math.sin(a) * R, C - Math.cos(a) * R];
  }

  function format(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0');
    return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    const now = Date.now();
    const elapsed = now - startedAt;
    const fraction = Math.min(1, elapsed / durationMs);
    const remaining = durationMs - elapsed;

    if (remaining <= 0) {
      if (!doneAt) doneAt = now;
      digits.textContent = 'Done';
      ends.textContent = 'session saved';
      phase.textContent = 'Day 24';
      // Start a fresh one a few seconds later, so the demo keeps going.
      if (now - doneAt > 4000) restart(durationMs);
    } else {
      digits.textContent = format(remaining);
      const end = new Date(startedAt + durationMs);
      ends.textContent = `ends ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      phase.textContent = 'Focusing';
    }
    document.title = remaining > 0 && document.hidden ? `${format(remaining)} Biology | Larpy` : 'Larpy | Lock in and prove it';

    const [x, y] = point(fraction);
    handle.setAttribute('cx', x.toFixed(2));
    handle.setAttribute('cy', y.toFixed(2));
    if (fraction <= 0) elapsedPath.setAttribute('d', '');
    else if (fraction >= 1) elapsedPath.setAttribute('d', `M${C} ${C - R}A${R} ${R} 0 1 1 ${C - 0.01} ${C - R}Z`);
    else elapsedPath.setAttribute('d', `M${C} ${C}L${C} ${C - R}A${R} ${R} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`);
  }

  function restart(ms) {
    durationMs = ms;
    startedAt = Date.now();
    doneAt = 0;
    render();
  }

  presets.forEach((button) => {
    button.addEventListener('click', () => {
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      restart(Number(button.dataset.minutes) * 60 * 1000);
    });
  });

  render();
  setInterval(render, 250);
}

/* ---------- Example heatmap ---------- */

// Small seeded random generator, so the example year looks the same on every visit.
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setupHeatmap() {
  const grid = document.querySelector('[data-heatmap]');
  const random = seeded(2026);
  const goal = 120; // minutes
  const streak = 23;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 53 columns of weeks starting on Sunday, ending with this week.
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - 52 * 7);

  let minutesTotal = 0;
  let daysStudied = 0;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < 53 * 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const cell = document.createElement('i');
    const daysAgo = Math.round((today - day) / 86400000);

    if (daysAgo < 0) {
      cell.className = 'future';
      frag.append(cell);
      continue;
    }

    // The habit gets stronger through the year; weekends are lighter; a few exam stretches run hot.
    const progress = 1 - daysAgo / 371;
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const exam = [300, 210, 120, 45].some((d) => daysAgo >= d && daysAgo < d + 16);
    let chance = 0.3 + progress * 0.45 - (weekend ? 0.18 : 0) + (exam ? 0.3 : 0);
    if (daysAgo < streak) chance = 1;
    if (daysAgo === streak) chance = 0;

    let minutes = 0;
    if (random() < chance) {
      minutes = Math.round((15 + random() ** 1.8 * 120) * (exam ? 1.6 : 1) * (0.75 + progress * 0.4));
      if (daysAgo === 0) minutes = 100;
    }
    if (minutes) {
      minutesTotal += minutes;
      daysStudied += 1;
      const level = minutes < goal * 0.4 ? 1 : minutes < goal * 0.8 ? 2 : minutes < goal * 1.3 ? 3 : 4;
      cell.className = `h${level}`;
    }
    if (daysAgo === 0) cell.classList.add('today');
    frag.append(cell);
  }

  grid.append(frag);
  document.querySelector('[data-streak]').textContent = String(streak);
  document.querySelector('[data-year-hours]').textContent = `${Math.round(minutesTotal / 60)}h`;
  document.querySelector('[data-year-days]').textContent = String(daysStudied);
}

/* ---------- Waitlist ---------- */

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/**
 * Sends the fields to the Apps Script as a plain form post (no CORS preflight). If the browser won't let
 * us read the reply, it sends once more without reading it; the sheet ignores repeat emails.
 */
async function send(fields) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(CONFIG.waitlistUrl, {
      method: 'POST',
      body: new URLSearchParams(fields),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error('bad_response');
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      await fetch(CONFIG.waitlistUrl, {
        method: 'POST',
        body: new URLSearchParams(fields),
        mode: 'no-cors',
        signal: controller.signal,
      });
      return { ok: true };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function context() {
  const params = new URLSearchParams(window.location.search);
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // Older browsers: leave it empty.
  }
  return {
    utm_source: params.get('utm_source') || params.get('ref') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    referrer: document.referrer || '',
    time_zone: timeZone,
    page: window.location.pathname,
  };
}

/** Replaces a form with the "you're on the list" card and its optional question. */
function showJoined(form, saved, { already = false, focus = false } = {}) {
  const node = document.getElementById('joined').content.firstElementChild.cloneNode(true);
  if (already) node.querySelector('[data-joined-text]').textContent = 'You’re already on the list.';
  const status = node.querySelector('[data-studying-status]');
  const chips = node.querySelectorAll('[data-studying]');

  const press = (value) => chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.studying === value)));
  if (saved.studyingFor) press(saved.studyingFor);
  else chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));

  chips.forEach((chip) => {
    chip.addEventListener('click', async () => {
      const value = chip.dataset.studying;
      press(value);
      status.classList.remove('is-error');
      status.textContent = 'Saving…';
      try {
        await send({ action: 'update', email: saved.email, studying_for: value });
        writeSaved({ ...saved, studyingFor: value });
        saved.studyingFor = value;
        status.textContent = 'Saved. Thanks!';
      } catch {
        status.classList.add('is-error');
        status.textContent = 'That didn’t save, but you’re still on the list.';
      }
    });
  });

  // Shared computers: let the next person join with their own email.
  node.querySelector('[data-reset]').addEventListener('click', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing saved, nothing to clear.
    }
    window.location.reload();
  });

  form.replaceWith(node);
  if (focus) node.focus();
}

function setupWaitlist() {
  const forms = document.querySelectorAll('[data-waitlist]');
  const saved = readSaved();
  if (saved && saved.email) {
    forms.forEach((form) => showJoined(form, saved));
    return;
  }

  forms.forEach((form) => {
    const input = form.querySelector('input[type=email]');
    const button = form.querySelector('button[type=submit]');
    const status = form.querySelector('[data-status]');
    const defaultNote = status.textContent;

    const setStatus = (text, isError) => {
      status.textContent = text;
      status.classList.toggle('is-error', Boolean(isError));
    };

    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        input.removeAttribute('aria-invalid');
        setStatus(defaultNote, false);
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = input.value.trim().toLowerCase();

      if (!EMAIL.test(email) || email.length > 254) {
        input.setAttribute('aria-invalid', 'true');
        setStatus('Enter an email address, like name@school.edu.', true);
        input.focus();
        return;
      }
      if (!CONFIG.waitlistUrl) {
        console.warn('Waitlist: set CONFIG.waitlistUrl in site/main.js to your Apps Script /exec URL.');
        setStatus('The waitlist isn’t connected yet. Try again soon.', true);
        return;
      }

      button.disabled = true;
      const label = button.textContent;
      button.textContent = 'Joining…';
      setStatus(defaultNote, false);

      try {
        const result = await send({
          action: 'join',
          email,
          website: form.querySelector('input[name=website]').value,
          ...context(),
        });
        if (!result.ok) {
          if (result.error === 'invalid_email') {
            input.setAttribute('aria-invalid', 'true');
            setStatus('That email doesn’t look right. Check it and try again.', true);
          } else {
            setStatus('Something went wrong on our side. Try again in a minute.', true);
          }
          return;
        }
        const entry = { email, studyingFor: '' };
        writeSaved(entry);
        // Swap every form on the page, so the bottom one doesn't ask again.
        document.querySelectorAll('[data-waitlist]').forEach((f) =>
          showJoined(f, entry, { already: Boolean(result.already), focus: f === form })
        );
      } catch {
        setStatus('Couldn’t reach the waitlist. Check your connection and try again.', true);
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });
}

setupLinks();
setupTimer();
setupHeatmap();
setupWaitlist();
