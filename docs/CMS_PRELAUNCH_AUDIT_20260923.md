# Open Phu Quoc CMS - Prelaunch audit and upgrade plan
Date: 2026-09-23
Status: Design proposal and first CI patch. Not approved for production. No DNS changes.

## The product question

Open Phu Quoc should help a traveler complete a task, not simply read more articles. A useful first pilot is "Ăn gì quanh tôi lúc này?" across Food, Near Me, Today and the existing weather engine. Each suggestion must explain *why it fits*, show the uncertainty of its inputs, and offer a next action such as directions or calling the venue. An empty result is better than inventing an operating restaurant.

## Verified baseline (main, 23/09/2026)

- `cms/schema.json` exposes home, stories, guide, utilities, venues, users, analytics. There is no dedicated editorial module for `data/food.json`.
- `data/food.json` has five detailed dishes. `data/entities/food.json` has six canonical food entities. The overlap requires an explicit ID relationship rather than assuming that names match.
- `data/entities/destination-venues.json` has ten active entities, all `ATTRACTION`; it is not yet a usable inventory of restaurants.
- Near Me has `LOCAL_FOOD`, `RESTAURANT` and `CAFE` discovery categories, but these currently fall back to external directory searches when there is no internal venue coverage.
- `functions/api/cms/publish.js` writes directly to `main`; `admin/admin.js` saves drafts in local browser storage. A human review stage and shared draft history are not yet implemented.
- `scripts/validate-knowledge.mjs` checks article structure and source presence. It does not prove live details are current or that a proposed itinerary is practical.
- A CMS Pages workflow succeeded on 22/09, but its explicit Cloudflare deploy step was skipped after an HTTP 404 Pages inventory response. The independent check did find 128 articles and admin v21 live. Separate *build passed*, *deploy performed* and *live verified* statuses.
- Both `pages.yml` and `cms-pages-publish.yml` hardcoded 128 published articles. This patch replaces fixed count checks with a consistency check against all approved `READY_PUBLIC` objects.

## Hard objections before public launch

1. Do not ship more "intelligent" suggestions before the underlying local dataset can answer one task reliably. A beautiful wheel with no verified venues is entertainment, not a Phu Quoc decision utility.
2. Do not overload `ACTIVE`. Editorial approval, real-world venue operation and source freshness are independent states. "Published" must not imply "open now".
3. Do not silently treat the presence of a URL as verification. Each time-sensitive claim needs a source, observed or checked time, expiry/recheck policy and a fallback state.
4. Do not ingest Google Places into a permanent independent database without reviewing its terms. Store independently verified first-party facts and approved identifiers; link out for maps/directions.
5. Do not place operational edits for marine, flights or weather into the long-lived editorial article workflow. Continue using the specialist normalized data feeds; CMS consumes their safe summaries.
6. Do not count a green build as a verified deployment. The deployment and post-deploy probe need their own visible statuses.
7. Do not publish more articles just to raise coverage numbers. The launch requirement should be **complete traveler decisions in a few representative situations**.

## Proposed data contract for food pilot

Maintain canonical stable IDs and separate durable editorial data from volatile observation data.

**Dish**: `dish_id`, localized name and aliases, category, taste, typical allergens, typical serving times, preparation and provenance. Allergens are educational descriptions, never a guarantee about a specific kitchen.

**Venue**: `venue_id`, legal/display names, category, precise address, `lat/lon` with precision/source/verification, phone, first-party images and rights, accessibility and seating attributes. Operational status must allow `UNKNOWN`, `ACTIVE`, `TEMPORARILY_CLOSED`, `CLOSED`.

**Venue dish relationship**: `venue_id` + `dish_id`, currently offered or unconfirmed, price range with currency, portion basis, verified time and source. If an item is not linked to a verified venue, it can still be an editorial article but not a nearby dining recommendation.

**Service hours**: timezone, windows and exceptions, source type, checked time. Derive "possibly serving now" from published schedule; reserve "confirmed open" for a recent observation or operator confirmation. Never infer venue opening from attraction opening.

**Editorial workflow**: `DRAFT` -> `IN_REVIEW` -> `APPROVED` -> `PUBLISHED` -> `ARCHIVED`. This is separate from operating status. Each change has actor, timestamp, source, diff and revert path. Begin with GitHub draft PRs and a reviewer; consider D1-backed shared drafts only if needed for concurrent editing.

**Traveler response**: query intent, location permission, time of day, party needs, budget, confirmed venue candidates and plain-language reason. If no candidate meets the evidence threshold, say so and offer an external-map search or broadened filter. Do not pretend that a directory result is independently verified.

## Bug fixes delivered on the draft PR (still unreleased)

- Public knowledge CI no longer hardcodes 128. The published view must match exactly the approved READY_PUBLIC source IDs and must not expose internal research fields. The CMS nav also stops claiming a permanently fixed article count.
- The Near Me venue normalizer rejects missing, invalid and out-of-island coordinates, normalizes CMS zone codes and preserves unverified coordinate provenance rather than claiming every venue pin is exact.
- All ten current attraction rows are linked to their existing canonical place IDs. Near Me merges duplicate pins and retains independent food/cafe/restaurant venues.
- CMS session, content and private Analytics routes now resolve the user's *current* main-branch role, not just the role in an old encrypted session cookie; disabled users are denied.
- GitHub-built CMS bundles include the exact source commit. The CMS Pages job verifies that commit on the public hostname after its own deploy and fails rather than showing green when Pages discovery/deploy was skipped. A successful independent read of old live content is not equivalent to a deploy by this workflow.
- Automated tests cover venue coordinate/area/duplicate regressions and role demotion, account disablement, permissions-source outage and anonymous requests.

**External blocker left intentionally untouched:** The last main-branch CMS deployment workflow could not list the Cloudflare Pages projects (HTTP 404). Repository code cannot supply a correct Cloudflare account ID, missing Pages scope or the correct project/domain mapping. Until the user-authorized GitHub Actions secrets or Cloudflare configuration are corrected, a CMS Pages deployment by that explicit workflow cannot be marked verified. Do not print or commit any secret values.

**Architectural decisions for the next discussion:** Shared CMS drafts/review and direct-to-main publishing; how to reconcile the five detailed dish articles with six canonical food entities; how to obtain, legally retain and refresh independently verified restaurant data. These are not claimed to be implemented by this bugfix PR.

## Implementation order, gated by approval

**P0 - Publication and provenance**: repair hardcoded count checks (this PR), record separate build/deploy/live health, audit direct-to-main publish, display missing and stale evidence in CMS, preserve existing domain and specialized tools.

**P1 - First-party food data**: add a CMS dish module, stable dish-to-venue relationships and purpose-built forms; capture a modest set of real, independently checked venues across Dương Đông, An Thới and the north. Store unavailable fields as unknown. Reuse existing Food and Near Me pages; do not create a separate app.

**P2 - One real decision**: test "Ăn gì quanh tôi lúc này?" on mobile with budget, dietary constraints, approximate travel time, food availability and fallback states. Never promise an allergy-safe dish solely from a category tag.

**P3 - Contextual composition**: only after P2 is credible, connect existing Weather and Today summaries to suggest suitable places during rain, or available late-day activities. Do not duplicate Weather/Airport logic.

## Release checklist

- Exact published articles equal reviewed source IDs, not a frozen expected count.
- Search, location and page routes do not point to missing or archived items.
- No stale or incomplete venue is labeled "đang mở" or "đã xác minh".
- All released pilot venues have a traceable source, checked address/location, and usable directions; unknown hours and prices are visibly unknown.
- Public copy is natural Vietnamese and useful without internal quality jargon. Internationalization is checked for the intended visitor languages.
- At least three real-world scenario scripts are tested on iPhone and desktop, including a no-result or source-outage case.
- The build passed, correct deployment occurred, and the *public domain* was independently checked after that deployment. A skipped deployment never masquerades as deployment success.

This document describes proposed upgrades, not claims that P1-P3 are implemented.
