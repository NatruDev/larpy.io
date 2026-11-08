/**
 * Larpy waitlist: receives sign-ups from the landing page (site/) and logs them to this Google Sheet.
 * Setup steps are in scripts/waitlist/README.md.
 *
 * The page sends a plain form post with:
 *   action        'join' (default) or 'update'
 *   email         required
 *   studying_for  optional, one of STUDYING_FOR
 *   website       honeypot; real people leave it empty
 *   utm_source, utm_medium, utm_campaign, referrer, time_zone, page   optional context
 *
 * Replies with JSON: { ok: true } / { ok: true, already: true } / { ok: false, error: '...' }.
 */

const SHEET_NAME = 'Waitlist';
const HEADERS = ['Joined at', 'Email', 'Studying for', 'Source', 'Medium', 'Campaign', 'Referrer', 'Time zone', 'Page'];
const STUDYING_FOR = ['High school', 'University', 'Exam prep', 'Learning on my own'];
const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

function doPost(e) {
  const p = (e && e.parameter) || {};

  // Bots fill every field; pretend it worked and log nothing.
  if (p.website) return reply_({ ok: true });

  const email = String(p.email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return reply_({ ok: false, error: 'invalid_email' });

  const studyingFor = STUDYING_FOR.indexOf(p.studying_for) >= 0 ? p.studying_for : '';

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return reply_({ ok: false, error: 'busy' });
  try {
    const sheet = sheet_();
    const row = findRow_(sheet, email);

    if (p.action === 'update') {
      if (row && studyingFor) sheet.getRange(row, 3).setValue(studyingFor);
      return reply_({ ok: true });
    }

    if (row) return reply_({ ok: true, already: true });

    sheet.appendRow([
      new Date(),
      email,
      studyingFor,
      cell_(p.utm_source, 100),
      cell_(p.utm_medium, 100),
      cell_(p.utm_campaign, 100),
      cell_(p.referrer, 300),
      cell_(p.time_zone, 64),
      cell_(p.page, 200),
    ]);
    return reply_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/** Opening the /exec URL in a browser shows this, which is a quick way to check the deployment. */
function doGet() {
  return reply_({ ok: true, service: 'larpy-waitlist' });
}

function sheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** The sheet row holding this email, or 0. */
function findRow_(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const found = sheet
    .getRange(2, 2, last - 1, 1)
    .createTextFinder(email)
    .matchCase(false)
    .matchEntireCell(true)
    .findNext();
  return found ? found.getRow() : 0;
}

/**
 * Free text from the page, trimmed and shortened. A leading = + - or @ would make Sheets treat it as a
 * formula, so those get a leading apostrophe and stay plain text.
 */
function cell_(value, max) {
  const text = String(value || '').trim().slice(0, max);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
