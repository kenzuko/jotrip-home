# Shared Weather Context API v1 - proposal

Status: draft shared contract plus runtime implementation on `docs/shared-weather-context-contract-20260926`. The endpoint is not deployed or merged. Product consumers for GO and Near Me remain separate follow-up work.

## Purpose and boundaries

GO needs forecast context across a planned arrival-to-finish interval. Near Me needs weather context only when a selected place or activity is meaningfully weather-sensitive. Both should use one shared adapter over canonical Weather products.

The adapter returns source evidence and coverage. It does not decide whether an activity is safe, unsafe, open or cancelled. It must not change the Weather page or Weather core, and it must never send the full forecast grid to a browser.

## Endpoint contract

POST /api/context/v1/weather/window

Use a same-origin, read-only request. POST batches candidate windows without putting destination coordinates in a URL. Do not persist submitted coordinates or itinerary data. Host and request-size protections must follow the existing Worker policy.

### Request shape

{
  "schema_version": "openpq-weather-window-request-v1",
  "items": [
    {
      "entity_id": "place_example",
      "location": {
        "lat": 10.0191,
        "lon": 104.015,
        "precision": "verified_point"
      },
      "activity_scope": "outdoor",
      "window": {
        "from": "2026-09-26T15:30:00+07:00",
        "to": "2026-09-26T17:00:00+07:00"
      }
    }
  ]
}

Request rules:

- Limit a batch to 20 items. Reject non-finite/out-of-range coordinates, timestamps without an offset, reversed windows, and windows longer than 24 hours.
- Coordinates must come from a current canonical destination or a location deliberately selected by the user. The API validates numeric bounds but does not treat arbitrary coordinates as a verified attraction.
- Precision describes the destination input. The current draft accepts `verified_point`, `site_centroid`, `area_anchor`, `user_selected` and `unknown`; confirm these values with the shared Geo owner before consumers depend on them.
- Never pass a marine route as an island point. Until a route-aware source exists, return an explicit unknown reason.
- Do not include the user's origin GPS when only destination weather is needed.

### Response shape

{
  "schema_version": "openpq-weather-window-context-v1",
  "checked_at": "2026-09-26T08:40:00Z",
  "source_status": "OK",
  "items": [
    {
      "entity_id": "place_example",
      "status": "OK",
      "reason_codes": [],
      "target": {
        "lat": 10.0191,
        "lon": 104.015,
        "precision": "verified_point"
      },
      "source": {
        "product": "JOTRIP_ECMWF_SPATIAL",
        "upstream_schema": "weather-scene-forecast-v1",
        "model_run": "2026-09-25T18:00:00Z",
        "generated_at": "2026-09-26T05:29:49Z",
        "display_interpolation": "RENDER_ONLY"
      },
      "temporal_coverage": {
        "requested_from": "2026-09-26T08:30:00Z",
        "requested_to": "2026-09-26T10:00:00Z",
        "status": "IN_WINDOW_FRAMES",
        "frame_cadence_hours": null,
        "interpolation_applied": false
      },
      "frames": [
        {
          "valid_at": "2026-09-26T09:00:00Z",
          "lead_hours": 15,
          "native_cell": {
            "cell_id": "grid_10.00_104.00",
            "lat": 10.0,
            "lon": 104.0,
            "distance_from_target_km": 2.7
          },
          "values": {
            "rain_mm": null,
            "wind_kmh": null,
            "gust_kmh": null,
            "wave_hs_m": null,
            "wave_direction_deg": null,
            "wave_period_s": null
          }
        }
      ],
      "spatial_scope": "NATIVE_GRID_CELL",
      "assessment": null
    }
  ]
}

Nulls in the example mean values are omitted from the example; a runtime response must preserve the actual values or nulls from the selected forecast frame.

### Status vocabulary

- Overall source status: OK, PARTIAL, UNAVAILABLE or INVALID. PARTIAL means at least one requested item has unsupported scope; source failure/invalidity is reported as UNAVAILABLE/INVALID.
- Per-item status: OK, PARTIAL, UNKNOWN or UNAVAILABLE. BRACKET_ONLY is PARTIAL because no frame falls inside the requested window.
- Temporal coverage: IN_WINDOW_FRAMES, BRACKET_ONLY, NO_COVERAGE or NOT_EVALUATED. Use NOT_EVALUATED when the source is unavailable/invalid or the requested scope is unsupported; use NO_COVERAGE only after a valid forecast was read and no useful frame covers the window.
- Spatial scope for forecast values: NATIVE_GRID_CELL.
- Reason codes should distinguish upstream unavailable, invalid manifest/schema, no native cell, no in-window frame, route source unsupported and input rejected. Do not collapse these into a generic “weather bad” status.

## Sampling and time rules

1. Read the canonical Weather manifest. Accept only its allowlisted forecast path and the exact weather-scene-forecast-v1 schema.
2. Validate runtime status, source run, generated time, frame shape and finite cell coordinates. Preserve null as missing; never convert it to zero.
3. For each requested item and each returned frame, select the nearest native cell by great-circle distance. Do not bilinearly interpolate or relabel the cell as the exact attraction point.
4. Return the selected cell coordinate and target-to-cell distance per frame. Grid coverage can change by forecast lead, so one location field for all frames is insufficient.
5. Return actual frames whose valid_time falls inside the requested interval. If none fall inside but frames exist before and after, return the nearest bracketing frames with BRACKET_ONLY and do not claim they represent conditions inside the interval. If no useful frame exists, return NO_COVERAGE.
6. Never synthesize hourly values from a coarser cadence. Report the cadence observed in returned frames. Preserve the runtime's actual cadence and lead horizon.
7. A 0-6 hour nowcast is a different product. Do not silently substitute or blend regional compact nowcast into a destination forecast. Add it only as a separately versioned field after its point/route scope and freshness rules are agreed.
8. Keep model_run, valid_at, generated_at and checked_at distinct. Generated time does not prove forecast validity or freshness.
9. Missing upstream, invalid schema, missing frames and unsupported route scope must produce explicit status and reason codes. Weather failure must not block Near Me search or all GO results.

## Spatial meaning

The canonical forecast is a native grid, not a site-level observation. Its short and medium frames can have different coverage and spacing. The inspected runtime requested 0.5-degree short-grid coverage, while later frames used a narrower set of cells. The adapter must disclose the selected cell and distance per frame.

Until Weather owners approve a spatial representativeness policy, describe returned values as forecast context from a nearby native grid cell, never as a verified point forecast at the venue. Do not hide large target-to-cell distances behind a point-shaped UI.

This proposal sets no nearest-cell distance cutoff or confidence bucket. Weather owners must define these from the forecast product and activity's spatial scale. Returning a distance does not itself claim that the cell represents the destination.

## Decision rules

- Assessment is null in v1. Do not emit SAFE, BEST, MARGINAL, AVOID, LOW, WATCH or HIGH from this adapter.
- GO may later use a reviewed activity rule to adjust ranking or mark CHECK. Do not hard-block an ordinary outdoor activity using an unapproved threshold.
- Closures and marine permissions remain sourced from current notices and operator evidence, not inferred from weather.
- Missing or disconnected lightning data means unknown, not “no lightning.”

## Current implementation and verification

The draft automated test covers canonical-manifest allowlisting, malformed frame rejection, sampled native cells and distances, null values, in-window and bracket-only coverage, missing horizon coverage, marine unknown, basic input rejection, streamed and declared body-size caps, origin/method/content-type checks and source outage. The current Pages build and Worker route validation run the test.

The test does not yet cover every malformed upstream shape, cell movement between frames, or product-consumer behavior. GO candidate ranking and Near Me essential-service fallback belong in their respective product PRs. Do not treat a successful API sample as a safety assessment or freshness guarantee.

## Decisions before consumers rely on the contract

1. Weather owner defines whether a selected nearby cell is representative for each activity and whether any distance cutoff is needed. Until then expose distance and do not imply a verified venue-point forecast.
2. Confirm destination precision vocabulary with the shared Geo owner.
3. Weather owner confirms whether units are stable contract fields or adapter-derived metadata.
4. Define route-aware marine context separately from land-point forecast.
5. No freshness cutoff or stale-data decision is added here. Consumers must keep `generated_at`, `model_run`, `valid_at` and `checked_at` distinct; a readable source or `status: OK` means only that the sample was returned, never that conditions are current, safe or suitable.
