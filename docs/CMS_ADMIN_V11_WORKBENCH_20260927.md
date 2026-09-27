# CMS Admin V1.1 - navigation & triage QA
Date: 27/09/2026 | Scope: admin-only frontend, no shared engines or configuration.

## Root cause
The original .site-link was absolutely positioned at the sidebar bottom. V1 set it
to position:sticky inside an overflowing aside. The link could float over
the lower navigation entries (owner screenshot). V1.1 makes the sidebar a
three-region flex layout: stationary heading, dedicated scrollable nav,
stationary footer link. The collapsed sidebar uses the same principle.
On mobile the nav scrolls horizontally while the public-site link stays visible.

## Workflow polish
- Replace schema jargon in sidebar descriptions with natural, local-first
  Vietnamese without changing cms/schema.json or the API contract.
- Quality tasks use a human name only if the existing quality evidence clearly
  leads with it; raw entity ID remains visibly available as secondary metadata.
- Add read-only client-side filters: Tất cả / Ưu tiên / Đang làm.
  No writes to D1, published data or review proposals.
- Preserve all current role checks, draft-save behavior, PR publishing,
  existing deep-links and specialist Weather/Airport/Transit engines.
- Accessibility: aria-expanded on collapse, aria-current on active item,
  44px+ footer touch target, private-mode localStorage error tolerance.

## QA gate & release policy
One grouped commit on a dedicated branch; a single pull request triggers
existing unit and Playwright QA. Test desktop heights 900/600, iPhone-width
navigation and footer non-overlap, task labels, filters, role boundaries.
Only a successful preview is published by branch build. Production must be
explicitly approved after review and checks; do not change Cloudflare settings,
DNS, wrangler config, workflows, API secrets or unrelated repos.
Rollback: revert the V1.1 commit/merge only after the owner authorizes it.
