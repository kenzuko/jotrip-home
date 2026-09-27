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
- POST /api/feedback -> multipart/form-data. JSON rejected; origin gate, honeypot,
  5 reports/IP HMAC hash/hour, allowed issues, allowed entity types, field limits.
- GET /api/cms/feedback?status=new -> existing CMS GitHub login and live role check.
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
   npx wrangler d1 execute openpq-cms --remote --file=migrations/20260927_cms_place_feedback.sql
   Review DB id/bindings first. Never drop/overwrite the existing database.
2. Configure FEEDBACK_RATE_SECRET as a strong independent secret on whichever
   deployment serves /api/feedback (CMS Pages AND/OR v3 Worker as applicable):
   npx wrangler secret put FEEDBACK_RATE_SECRET --name openphuquoc-v3
   Use the dashboard for Pages secrets. Never place values in Git.
3. CMS session and CMS_DB must be bound where /api/cms/feedback executes.
   When using the separate v3 Worker for these paths, explicitly bind the SAME
   existing CMS_SESSION_SECRET only after verifying access and deployment route.
4. Optional images: create a PRIVATE R2 bucket and attach binding FEEDBACK_IMAGES
   to the deployments that serve intake and moderation. Until binding exists,
   GET /api/feedback advertises photo_enabled=false and UI hides the attachment
   option. No public bucket URL or media auto-publication.
5. QA on preview: invalid issue 400; honeypot stores nothing; missing secret 503;
   accepted report 201 with receipt; inbox 401 without session; viewer 403 on
   PATCH; editor can mark reviewing/resolved; verify D1 row and protected R2 object.
   Test mobile layout and ensure feedback buttons map to canonical entity_id.
6. Deploy/merge only after the existing build suite and manual preview QA pass.
   Never deploy unrelated Airport, Weather or Transit changes for this feature.

## Moderation & retention
Inbox offers new, reviewing, resolved, rejected with timestamp, editor and notes.
No report becomes verified through submission or a change of review status.
Use the existing CMS workflow to update the underlying entity if corroborated;
do not change canonical coordinates or operator status from an unverified report.

Operational follow-up: agree and implement a retention/deletion policy for
closed reports and R2 images before public launch. Access to submitted photos
is restricted to authenticated CMS personnel. Publish/update a short privacy
notice adjacent to the form before enabling public intake.

## Testing
The lightweight node script scripts/test-place-feedback.mjs is called by
scripts/build-cloudflare.mjs before the expensive build step. Changes live on a
feature branch, without Cloudflare production deployment or automatic DB writes.
