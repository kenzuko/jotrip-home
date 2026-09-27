# OPEN PHU QUOC - Near Me / GO UX handoff - 27/09/2026

Status: code on isolated branch, not deployed to production. Scope limited to Homepage navigation/copy, GO desktop navigation, Near Me desktop map UX and related tests. No changes to Weather, Airport, Transit engines, data ingestion, schema or source inventories.

## Approved behavior

- Open Phu Quoc is the primary search/filter system. The Near Me list and the native Leaflet map consume the same filtered records.
- Never silently switch a filtered map to a Google Maps search iframe. If the native basemap cannot load, keep the list usable and show a clear in-page fallback with an optional explicit Google search.
- The Google external search opens only after a visitor clicks. Its results do not inherit Open Phu Quoc's area/radius or verification filters. State this where the link is offered.
- Only use verified exact entrances for a direct directions claim. Site centroids, community coordinates and missing coordinates use explicit Google search, not invented exact directions. Community pins, when displayed, remain visually distinct and labeled uncertain.
- Radius search uses verified exact/site coordinates for measured distances. Unknown location rows stay in a separate group and are not falsely included in radius or map pins.
- GPS is strictly opt-in and scoped to the current page/session. Selecting an area is not equivalent to GPS. Correct the Homepage synchronous shared-area event so it does not discard a fresh GPS fix. Do not place coordinates in URLs or session storage.
- Near Me desktop at >=1200px: sticky filter column, scrollable list, sticky native map. Intermediate laptops: filter/list left and native map right. Phones: results before an opt-in map; keep existing accessibility controls.
- Persistent GO and Quanh đây navigation: wide Homepage app rail, middle-width Homepage top menu, GO/Near Me desktop headers and GO mobile dock.

## Approved copy

- Cáp treo: leading upcoming pause plus explicit afternoon windows. Generate from the canonical entity's windows rather than hardcoding a day's status. PUBLISHED_SCHEDULE is not a live operating confirmation.
- VinWonders: avoid implying the whole park closes when most games finish. Keep the park closing and ONCE show times separate.
- Preserve GO's conversational invitation, particularly “tụi mình tìm những chỗ phù hợp cho hôm nay.”
- Replace internal terms such as fallback, schema, technical GPS radius explanations and “khung này” with concrete user-facing information. Retain safety/uncertainty details when they change what someone can rely on.

## Preview QA gates

1. At desktop 1440x900, filter Pharmacy, Dương Đông, 5 km. Check that list count and map pins correspond; unknown-distance results are separate and never become false pins. Re-test category changes, full-island and search.
2. At mobile 390x844, show results before the map; confirm it does not load until explicitly opened.
3. With Leaflet blocked/offline, keep the filtered list visible and show native fallback. No Google iframe request or automatic navigation.
4. Check explicit Google search results are marked external, only opened on click and not represented as Open Phu Quoc-filtered.
5. Select a site-centroid venue: show honest location and do not promise an exact gate route. Community records are visually distinct. Verified exact entrances can use directions.
6. Test GPS grant/denial/outside-island and manual region selection on Homepage and Near Me. Browser back, selected category and area handoffs should remain consistent.
7. Cable cards at 11:25, 11:30, 13:35, 14:00, 15:30 and 17:25 must show correct pause, next window or last window.
8. Check both language and navigation on desktop, narrow MacBook and phone; no horizontal overflow.
9. Run full validation and visual QA in the PR. Review before merge; do not trigger Cloudflare production deployment until explicitly approved.

## Parallel-work precautions

Changes are branched from main at c5999376 and were checked against later main ef02683 (CMS Admin-only changes, no overlapping paths). Open draft PRs #106, #107 and #109 have adjacent Near Me / area work: reconcile before merge rather than overwriting their branches. A new PR here is a review candidate, not permission to merge other PRs.

## Cost guard

No changes to Cloudflare config or production. No Worker build on this feature branch. GitHub pull-request validation is allowed. Request production merge/deploy only after the owner accepts visual QA.
