# Geoapify GPS lookup - Near Me research only

This tool ingests `data/views/location-index.json` and selects utility/place rows **without GPS** and with a usable address. Hotels are excluded until their separate GPS audit (`--include-hotels`). Vague area descriptions go into `skipped` instead of receiving a fake precise pin. Coordinates are geocoding **suggestions**, not operating-status or entrance verification.

## Setup (once)

1. Register the Geoapify Free account at https://myprojects.geoapify.com/ and create an API key.
2. GitHub repository > Settings > Secrets and variables > Actions > New repository secret. Name it `GEOAPIFY_API_KEY`; paste the key. Do not put it in a JSON file or browser JavaScript.
3. After QA and merge, run **Near Me Geoapify GPS research** in GitHub Actions with `workflow_dispatch`. It also runs daily at 02:15 Vietnam time after merging to `main`.

## Commands

```sh
node scripts/test-geocode-geoapify.mjs
node scripts/geocode-geoapify.mjs --dry-run
GEOAPIFY_API_KEY=... node scripts/geocode-geoapify.mjs --limit=50 --budget=150
```

Outputs (local working directory only): `.cache/near-go/geoapify-candidates.json` and `.cache/near-go/geoapify-cache.json`. The workflow uploads the first as a review artifact and persists the latter as an Actions cache. It does **not** commit updated maps or trigger Cloudflare. The cache lasts 90 days; changes to address/name produce a new query hash. Default maximum is 50 addresses and 150 requests per run, with hard cap 1,000 per run. The Geoapify free plan provides **3,000 credits/day shared across all project keys**; avoid repeated manual runs on the same day if another project consumes credits.

## Review gate

Before accepting any suggestion, compare the specific branch with its official operator website if one exists. Keep exact entrance separate from a building/site centroid. A street or locality result must never be treated as the business pin. Preserve source, timestamp, address and ranking evidence. Only a human-approved result can be merged into canonical entities and regenerated views. Geocoding never proves that a business is currently open. Existing OSM fuel stations may stay as community candidates with UNKNOWN operation and user feedback, as authorized.

The web UI must preserve `© OpenStreetMap contributors` and the Geoapify Free attribution (`Powered by Geoapify` linked to https://www.geoapify.com/) wherever Geoapify data is presented, according to applicable terms. Do not print/log the API key or call undocumented Geoapify/VinFast endpoints.

Official docs: https://apidocs.geoapify.com/docs/geocoding/ ; pricing: https://www.geoapify.com/pricing/ ; attribution: https://www.geoapify.com/.
