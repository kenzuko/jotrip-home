# Open Phu Quoc - Community Feedback V1
Date: 2026-09-27. Status: implementation branch / NOT DEPLOYED.

## Product lock
Anonymous corrections only; no user accounts, follows, comments or public user posts.
Surfaces: Near Me cards + missing-place proposal, Go recommendations, place detail,
Stories articles and Guide articles. Existing Weather feedback is untouched.

Reports are suggestions only. Do not overwrite canonical data, operator confirmations,
marine safety information, forecast actuals or Google/OSM data from incoming reports.
Only CMS admin/editor can mark review state; manual verification and the existing CMS
draft/review/publish process are still required to edit canonical data.

## Routes
- GET /api/feedback -> non-sensitive upload capability. No user credentials.
- POST /api/feedback -> multipart/form-data. JSON rejected; same-origin or strictly allowlisted official apex Origin, honeypot,
  5 reports/IP HMAC hash/hour, allowed issues, allowed entity types, field limits.
- Official openphuquoc.com and www.openphuquoc.com send directly to https://cms.openphuquoc.com/api/feedback with allowlisted CORS; untrusted origins are rejected. Preview workers.dev retains same-origin intake and stays disabled without its own secret.
- GET /api/cms/feedback?status=new&offset=0 -> existing CMS GitHub login and live role check; 50 items per page.
- PATCH /api/cms/feedback -> editor/admin only; status/note; does NOT publish data.
- GET /api/cms/feedback/photo?id=... -> authenticated CMS-only private image.
- GET /admin/feedback.html -> dedicated inbox UI. Access to data always checked API-side.

The rate-limit hash is HMAC-SHA256(daily date + connecting IP) using a secret. Raw
IP, reporter GPS, email, password and account identity are not stored in this table.
A missing rate secret or unavailable D1 fails closed (503), never accepts a report
that will be silently lost. Do not log form contents. Source page stores pathname
and an allowlisted article id only; arbitrary query parameters are discarded.

## Deployment prerequisites - DO NOT RUN UNTIL APPROVED
1. On the SAME existing openpq-cms D1 used by CMS/Worker, apply migration once:
   npx wrangler d1 migrations apply openpq-cms --remote --config=wrangler.pages.jsonc
   Review DB id/bindings first. Never drop/overwrite the existing database.
2. For production CMS Pages, the existing CMS_SESSION_SECRET is accepted as a domain-separated HMAC fallback for anti-spam, so an extra Cloudflare secret is not required if CMS login is already configured. A dedicated FEEDBACK_RATE_SECRET is preferred for long-term key separation; when configured it takes priority. To enable the raw Worker preview endpoint independently, set FEEDBACK_RATE_SECRET on openphuquoc-v3 (the public apex form uses the existing CMS Pages API directly). Never place secret values in Git.
3. CMS session and CMS_DB must be bound where /api/cms/feedback executes.
   When using the separate v3 Worker for these paths, explicitly bind the SAME
   existing CMS_SESSION_SECRET only after verifying access and deployment route.
4. Optional images: create a PRIVATE R2 bucket and attach binding FEEDBACK_IMAGES
   to the deployments that serve intake and moderation. Until binding exists,
   GET /api/feedback advertises photo_enabled=false and UI hides the attachment
   option. No public bucket URL or media auto-publication.
5. QA on preview: invalid issue 400; honeypot stores nothing; missing both secrets 503; official apex CORS allowed, arbitrary origins blocked;
   accepted report 201 with receipt; inbox 401 without session; viewer 403 on
   PATCH; editor can mark reviewing/resolved; verify D1 row and protected R2 object.
   Test mobile layout and ensure feedback buttons map to canonical entity_id.
6. Deploy/merge only after all four GitHub Actions suites, the extra Cloudflare Pages/Worker dry-run compilation and mobile feedback QA pass. On main, the existing CMS Pages publisher applies the additive migration before deploying; Worker publisher deploys its static shell without changing DNS.
   Never deploy unrelated Airport, Weather or Transit changes for this feature.

The migration file is `migrations/d1/0003_cms_place_feedback.sql`, matching the existing CMS Pages automatic migration directory. Applying it is additive; never re-create or replace the D1 database.

## Moderation & retention
Inbox offers new, reviewing, resolved, rejected with timestamp, editor and notes.
No report becomes verified through submission or a change of review status.
Use the existing CMS workflow to update the underlying entity if corroborated;
do not change canonical coordinates or operator status from an unverified report.

Retention: 180 days for all feedback records and private photos. The existing v3 Worker cron invokes daily cleanup at 20:00 UTC (03:00 Phú Quốc time), in batches of 100; if R2 is unavailable, image-bearing rows are retained for retry so no orphaned images are left behind. Bind the SAME D1 and optional R2 bucket to this Worker before enabling photo uploads. A public `/about/feedback-privacy.html` disclosure is linked from the form. CMS access is authenticated and images are never public.

## Testing
The lightweight node script scripts/test-place-feedback.mjs is called by
scripts/build-cloudflare.mjs before the expensive build step. Changes live on a
feature branch, without Cloudflare production deployment or automatic DB writes.

## Safe production smoke after merge

1. GET https://cms.openphuquoc.com/api/feedback should return `enabled:true` and `photo_enabled:false` until private R2 is explicitly bound. If disabled, check the existing CMS_SESSION_SECRET and exact CMS_DB binding; do not claim that public intake is live.
2. GET https://openphuquoc.com/nearme/ should serve the feedback buttons. The public apex form sends its request to the CMS Pages API with allowlisted CORS; it never sends a GitHub token, CMS login cookie or account identifier.
3. Submit one harmless correction in a controlled smoke test, verify its receipt in the authenticated CMS inbox, mark reviewing and delete the test report by exact ID after the test. No unverified feedback may update canonical data or marine safety status automatically.
4. Monitor CMS Pages and v3 Worker actions on the exact merged commit. If production flags or migrations are absent, leave the form fail-closed and correct only those bindings; do not modify DNS or increase the Cloudflare plan.
