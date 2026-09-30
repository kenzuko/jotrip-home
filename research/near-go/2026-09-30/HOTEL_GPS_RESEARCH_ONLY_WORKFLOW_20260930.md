# Hotel GPS candidate research - fail-closed workflow

Date: 2026-09-30. Scope: Open Phu Quoc canonical location index.

## Why

The old geocoding helper could write the first area/address candidate, producing wrong-brand hotel pins even when the geocoder's `matched_name` clearly identified another business. Batch 17 quarantined 27 legacy hotel pins, including Sentina incorrectly pointing at La Festa.

## Candidate discovery (no public data writes)

```bash
node scripts/geocode-google-maps.mjs --self-test
node scripts/geocode-google-maps.mjs --type=hotel --limit=15
node scripts/geocode-google-maps.mjs --type=hotel --ids=hotel_sentina,hotel_lotus --limit=2 --out=.cache/near-go/hotel-priority-candidates.json
```

Discovery uses `GOOGLE_MAPS_API_KEY` when supplied and the existing OSM fallbacks otherwise. Treat API quotas, provider terms and OSM attribution seriously. Defaults to 15 attempts; `--limit` must be 1 to 100. Results stay under `.cache/near-go/` and contain raw numeric candidates and status. This is a **research queue**, never a publication feed.

`NAMED_CANDIDATE_REVIEW` does not mean ACCEPT. `HOLD_BRAND_MISMATCH`, `HOLD_UNNAMED_POI`, `HOLD_ADDRESS_GEOCODE`, and `HOLD_AREA_OR_ROAD` must not publish. The legacy script rejects `--force`, `--apply`, and `--write`; it never updates `data/entities` itself.

## Evidence and promotion

1. Confirm the operator's exact hotel identity, branch and current canonical address/phone. A phone or address alone never proves GPS.
2. For non-first-party GPS, require at least one independent **exact-name numeric** hotel location in addition to named map business identity. A second numeric witness is preferred, especially for larger resorts.
3. Check candidate type, region, nearby hotel pins, brand collisions, and property/annex distinctions. Store any discrepancy, including alternative operator GPS.
4. Assign only the precision actually supported. A broad resort `site_centroid` must not become `exact_entrance` or unlock turn-by-turn routing as if it were a driveway.
5. Inspect source licensing. OSM-derived accepted data must retain ODbL provenance where applicable.
6. Create a dated immutable `research/near-go/YYYY-MM-DD/HOTEL_GPS_BATCH*_YYYYMMDD.json` evidence record with per-property ACCEPT/HOLD decisions, URLs and numeric locations.
7. Only a separately reviewed PR updates the canonical entity, `data/views/location-index.json`, `data/views/map-coverage.json` and an exact-evidence regression test. Run both Validate and Visual QA before merge.

The existing production-safe Weather/Airport/Transit and CMS architecture must remain untouched. Never equate a coordinate review with a live hotel operational check.
