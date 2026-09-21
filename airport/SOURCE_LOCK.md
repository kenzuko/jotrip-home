# Open Phu Quoc Airport - Source Lock

**Canonical product source:** `kenzuko/jotrip-home/airport/`

**Last upstream sync source:** `kenzuko/Jotrip-Airport`

**Upstream commit synced:** `98f4c9595936771b6e38147474ff0e0e45556bb3`

**Synced into Open Phu Quoc:** 21/09/2026

## Rules

- `/airport` inside `jotrip-home` is the production source for Open Phu Quoc.
- `airport.openphuquoc.com` and `kenzuko/Jotrip-Airport` may be used as an upstream/lab reference only.
- Open Phu Quoc must not depend on the standalone Airport frontend being online.
- When a newer Airport feature is intentionally imported, copy the required source into `jotrip-home/airport/`, preserve Open Phu Quoc branding and navigation, then update the upstream SHA in this file.
- Do not overwrite Open Phu Quoc-specific shell, metadata, arrival content, resilience guards, or navigation with the standalone Airport wrapper.
- Runtime data APIs may remain external services, but the Open Phu Quoc frontend must keep bounded waits and a local/fallback path so a stalled endpoint cannot freeze the page.
- Airport changes must pass browser QA on desktop and mobile, including drawer open/close and stale overlay recovery.

## Current Open Phu Quoc resilience layer

- Live API wait is bounded.
- Snapshot fallback wait is bounded.
- Drawer/backdrop state is repaired on page restore, navigation history, visibility return and uncaught errors.
- Browser QA checks Airport at 1366x768, 1440x900, 390x844 and 430x932.
