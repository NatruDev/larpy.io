# Waitlist: Google Sheet + Apps Script

The landing page (`site/`) posts each sign-up to a Google Apps Script web app, which adds a row to a
Google Sheet. No server or database of ours is involved, and it costs nothing. Download the sheet as
Excel anytime (File → Download → Microsoft Excel).

## What gets logged

| Column | From |
|---|---|
| Joined at | When the row was added |
| Email | The form (lowercased; repeats are ignored) |
| Studying for | The optional question after joining: High school, University, Exam prep, Learning on my own |
| Source, Medium, Campaign | `utm_source` / `utm_medium` / `utm_campaign` in the page link (`?ref=` also fills Source) |
| Referrer | The page that linked to the site, if the browser shares it |
| Time zone | The visitor's time zone, e.g. `America/New_York` |
| Page | The path they signed up on |

Use tagged links in your bios and videos to see which ones bring sign-ups, e.g.
`https://<your-site>/?utm_source=tiktok&utm_campaign=first-video`.

## Setup (about 5 minutes)

1. Create a Google Sheet, e.g. "Larpy waitlist".
2. **Extensions → Apps Script.** Delete what's there, paste all of [`Code.gs`](Code.gs), and save.
3. **Deploy → New deployment.** Click the gear next to "Select type" and pick **Web app**.
   - Description: `Waitlist`
   - Execute as: **Me**
   - Who has access: **Anyone** (the landing page posts without signing in)
4. Click **Deploy**, then **Authorize access** and allow it for your Google account. Google warns that the
   app isn't verified, because it's your own script: choose Advanced → Go to (project name).
5. Copy the **Web app URL** (it ends in `/exec`). Open it in a browser; you should see
   `{"ok":true,"service":"larpy-waitlist"}`.
6. Paste the URL into `waitlistUrl` at the top of [`site/main.js`](../../site/main.js), and redeploy the site.

The first sign-up creates a **Waitlist** tab with a bold, frozen header row.

## Changing the script later

Edit `Code.gs` here first, paste it into the Apps Script editor, then **Deploy → Manage deployments →
(pencil) → Version: New version → Deploy**. Editing the existing deployment keeps the same `/exec` URL;
"New deployment" would make a new URL and the site would need updating.

## Notes

- The web app runs as you, so it can only touch the sheet it's attached to.
- Anyone who finds the URL can add rows. The honeypot field and the email check stop basic bots, and
  repeat emails are skipped. If junk shows up, delete those rows.
- Values starting with `=`, `+`, `-` or `@` are saved as plain text, so nobody can slip a formula into the
  sheet.
- People can ask to be removed by replying to any email (the site says so). Delete their row.
