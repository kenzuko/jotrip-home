# Open Phu Quoc - Feedback V1

**Sole live public website:** https://cms.openphuquoc.com

The bare domain `openphuquoc.com` is not an active deployment. Do not use it for feedback,
production readiness checks, health monitors, CORS allowlists, or DNS assumptions.

## Current scope

- Anonymous corrections on Near Me, Go, place details, Stories and Guide; no account required.
- Feedback is **unverified** until staff check it. It does not automatically overwrite
  location pins, operating hours, marine confirmations, articles or live module data.
- CMS admin/editor controls the review queue and must write a reason when closing an item.

## API on the single live CMS hostname

- `GET /api/feedback`: readiness and optional private-image capability.
- `POST /api/feedback`: same-origin multipart form (requests from other Origins fail 403).
- `GET /api/cms/feedback?status=new&offset=0`: authenticated queue, 50 items/page.
- `PATCH /api/cms/feedback`: authorized editor/admin only.
- `GET /api/cms/feedback/photo?id=...`: authenticated image endpoint when R2 is enabled.
- `/admin/feedback.html`: review queue.
- `/about/feedback-privacy.html`: data-use explanation.

The browser uses the relative URL `/api/feedback` from `cms.openphuquoc.com`.
There is **no public cross-origin CORS route** or inactive-apex fallback.

## Security and lifecycle

Additive migration `migrations/d1/0003_cms_place_feedback.sql` was applied on
27/09/2026. Store no raw IP, email or reporter GPS. Limit to 5 messages/hour per
daily HMAC pseudonym. `FEEDBACK_RATE_SECRET` is preferred; existing
`CMS_SESSION_SECRET` supports a domain-separated HMAC fallback. Unconfigured
intake fails closed. Private R2 photos are off until separately enabled.
A daily Worker task deletes records and their protected photos after 180 days,
when the required D1/R2 bindings are available.

## Verified release and checks

PR #148 built the feedback feature; PR #155 fixed build order and added a live
CMS smoke test. The latter submitted an anonymous report through the deployed
CMS Pages API, verified it was present in the correct D1 table and removed the
test record. Additional CMS Pages deployments also succeeded.

`scripts/test-place-feedback.mjs` verifies backend behavior and same-origin
protection. `scripts/smoke-place-feedback-live.mjs` uses only the live CMS host
and performs a real submit/read/delete check. Do not report an apex-domain
timeout as a CMS incident. No DNS, billing, Weather, Airport or Transit changes
are necessary for this feature.
