# Geoapify: only geocode and save missing Near Me coordinates

Scope: **no new map UI, no new Places API data source, no business-status changes**. Reads `data/views/location-index.json` and calls Geoapify only for utility/place addresses with no GPS and a usable street-level address. Hotels are excluded by default; broad areas are skipped. Existing GPS is never overwritten.

The operator's official site remains the source for the business identity/address. Geoapify only contributes a coordinate estimate. A result can be saved into the same canonical `data/entities/*.json` record **only** when Geoapify returns a building/amenity point with confidence >=0.85 and suitable building confidence, with exactly matching house number, same street, correct island and zone, a unique high-quality match and no conflicting point within 20 m. It is stored as `site_centroid`, **not** `exact_entrance`; `verified` and `operational_status` remain untouched. Street/area hits, ambiguous or duplicate results stay in the local review audit instead of becoming false pins.

## Setup once

1. Get the free key at https://myprojects.geoapify.com/ .
2. In `kenzuko/jotrip-home`, add `GEOAPIFY_API_KEY` under Settings > Secrets and variables > Actions. Never put it in the repository or this conversation.
3. When this draft PR is approved and merged, open GitHub Actions > **Near Me Geoapify GPS enrichment** > Run workflow. By default, it considers up to 50 missing addresses and makes at most 150 API requests. No daily crawler or Cloudflare build is started by this workflow.
4. Saved GPS and regenerated views go into a new **isolated data branch and draft PR**, not directly into `main`. Review then merge a verified data batch. When no strong matches exist, the job only uploads the audit report.

```sh
node scripts/test-geocode-geoapify.mjs
node scripts/geocode-geoapify.mjs --dry-run
GEOAPIFY_API_KEY='...' node scripts/geocode-geoapify.mjs --apply --limit=50 --budget=150
```

The script writes `.cache/near-go/geoapify-candidates.json` and `.cache/near-go/geoapify-cache.json` locally (the latter expires after 90 days). Both stay outside production. `--apply` writes qualifying coordinates to canonical data. Manually rebuild map and location views after local runs; the GitHub workflow handles this automatically. Credits are shared across your keys; current free allowance is 3,000 credits/day and the default job is capped at 150 requests. The report records weak/no-match results for better addresses or field feedback.

When publishing any Geoapify-derived coordinates, meet the provider/OSM attribution requirements (`Powered by Geoapify`, `© OpenStreetMap contributors`) on the relevant public surface. No undocumented APIs or Google paid services are used.

Docs: https://apidocs.geoapify.com/docs/geocoding/ ; pricing: https://www.geoapify.com/pricing/ .
