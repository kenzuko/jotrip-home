# Open Phu Quoc - i18n, selector and Weather freshness audit

Date: 2026-10-02
Branch: `fix/i18n-selector-weather-contract-20261002`
Status: audit/implementation branch only - DO NOT deploy or merge until reviewed.

## Non-negotiable runtime rule

Vietnamese public documents remain Static Assets first. A language selector is never a reason to add `/`, `/weather`, `/guide`, `/airport`, `/transit`, or other default-locale documents to `run_worker_first`.

Worker-first remains limited to localized `/en/*`, dynamic article/meta routes, APIs and Weather data endpoints that require edge logic.

## 1. Translation layer

Current English release has three complementary layers:

1. `data/i18n/en/ui.json` - keyed UI catalog.
2. `data/i18n/en/site-shell.json` + `core/en-full-site.js` - reviewed compatibility/presentation layer covering legacy public shell strings and DOM rendered after hydration.
3. Typed translated content overlays for stories, knowledge, food and place explainers.

`test-en-full-site.mjs` audits public HTML/JS plus the dynamic `data/home-copy.json` fields that are written after load. This guard must stay in release CI.

Long-term Brain migration rule: new UI and Brain-generated labels should use stable i18n keys. Text matching in `en-full-site.js` is transitional compatibility only; it must not become the canonical contract for new Brain output.

Dynamic Brain payloads must separate factual values from display copy so translation never mutates weather values, timestamps, provenance, status codes or operational decisions.

## 2. Language selector

Root cause of the 2026-10-02 performance incident: default Vietnamese public pages were routed through Worker-first solely so the Worker HTML rewriter could inject the selector. That converted a UI concern into a whole-site routing change.

Safe design:

- Selector is a tiny static enhancement bundled with public HTML.
- It mounts into `[data-language-slot]` when present or the public header as fallback.
- It can render reviewed VI/EN without fetching the full locale catalog on Vietnamese pages.
- On `/en/*`, `OpenPQI18n` may enhance the same control and enforce content availability.
- Exactly one control is allowed; client runtime must deduplicate/preserve a server fallback.
- Manual language choice writes the first-party preference cookie client-side; EN navigation may still pass `?lang=en` through the Worker.
- Default VI navigation does not need Worker execution.

Branch implementation:

- `core/language-switcher.js` now has a static VI/EN fallback and no longer requires `OpenPQI18n` merely to mount.
- `scripts/inject-static-language-switcher.mjs` injects the tiny selector script into built public HTML, not source routing.
- `scripts/build-cloudflare.mjs` runs that build-time injection after copying Static Assets.

## 3. Weather delayed forecast diagnosis

The `204 minutes` message was primarily a freshness-contract mismatch, not proof that the Weather data engine stopped.

Observed contracts:

- Weather Lab dashboard explicitly says: `watch cycle every 30 minutes; rebuild when short or medium model cycle changes`.
- The current UI marks forecast data unusable once `dashboard-data.json.generated_at` is older than 2.5 hours (150 minutes).
- The Weather edge accepts a complete LIVE dashboard up to 6 hours (360 minutes), while also verifying model cycles and future forecast frames.

Therefore `generated_at` is being used for two different meanings:

1. snapshot build time; and
2. forecast validity/freshness.

Those are not equivalent. A dashboard can legitimately remain unchanged between model-cycle releases while still containing the freshest valid forecast cycle.

Example on 2026-10-02:

- old displayed dashboard generated around 04:23 local;
- UI reached 204 minutes and suppressed forecast slots;
- a newer dashboard was published around 07:56;
- the engine policy itself is cycle-driven rather than rebuild-every-30-minutes.

### Brain contract required

The Brain should publish explicit freshness fields instead of leaving each UI to infer freshness from `generated_at`:

```json
{
  "generated_at": "...",
  "source_cycle_at": "...",
  "next_expected_check_at": "...",
  "fresh_until": "...",
  "freshness": "FRESH | AGING | STALE",
  "forecast_valid": true,
  "reason": "LATEST_MODEL_CYCLE | WAITING_NEW_CYCLE | SOURCE_DELAY | PIPELINE_DELAY"
}
```

The public UI should consume that contract:

- FRESH: normal forecast.
- AGING + forecast_valid: keep forecast visible, show last cycle/update note.
- STALE or forecast_valid=false: suppress current-forecast claim and show reference-only state.

Until Brain owns this contract, do not independently change the UI 150-minute gate or Edge 360-minute gate in production. First align them under one tested policy.

## Release gates before merge

1. VI homepage/weather direct Static Assets path remains unchanged.
2. No new default-locale public path is added to `run_worker_first`.
3. Selector appears exactly once on VI and EN mobile/desktop.
4. Switching VI <-> EN preserves the corresponding public route and query parameters.
5. Full English residue audit passes after dynamic hydration.
6. Weather factual values are identical before/after translation.
7. Weather freshness status is tested against model-cycle behavior, not snapshot age alone.
8. Mobile performance smoke includes blank-screen time / DOMContentLoaded / key data hydration, not only visual success.
