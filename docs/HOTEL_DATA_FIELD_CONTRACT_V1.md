# Open Phu Quoc Hotel Data Field Contract V1

Date: 2026-10-01

## 1. Canonical identity

`data/entities/hotels.json` remains the public canonical directory.

Fields such as `name`, `address`, `phone`, `room_count`, `star_rating`, `operational_status` and `map` must not be overwritten merely because a different public source has another value.

The current official accommodation list is the preferred source for the regulatory/directory scope when available.

## 2. Scoped enrichment

`data/hotel-enrichment.json` stores additional evidence that is useful but may describe a different scope, date or contact channel.

Supported groups:

- `website`: exact operator/owner site already promoted to canonical website after verification.
- `contacts[]`: operator, booking, hotline, tourism-profile, registry or other scoped contacts.
- `capacity[]`: room/villa/unit evidence with an explicit source scope.
- `star_claims[]`: non-canonical star claims unless they come from the current official classification authority.
- `operations`: check-in/out, expected opening and other sourced operational facts.
- `amenity_claims[]`: sourced amenity/service claims. These are evidence, not a guarantee that the service is available now.
- `review_state`: research disposition only. It is not the public operational status.
- `conflicts[]`: fail-closed rules for identity/address/contact/capacity cases.

## 3. Promotion rules

A scoped value may move into a public canonical field only after review establishes that the source describes the same field and same scope.

Examples:

- Directory phone and reservation hotline may both be correct. Keep both with scopes; do not force one into the other.
- Official room count and a resort marketing count may describe different phases, villas or accommodation units.
- Legal/official address and guest-facing operator address may differ.
- OTA/Google/operator star claims do not replace official classification automatically.
- Recruitment or pre-opening material does not prove that a hotel is already operating.

## 4. Website rule

Only an exact-property operator/owner website may populate canonical `website`.

Known wrong, stale or cross-property domains remain rejected. A matching hotel name by itself is insufficient.

## 5. GPS rule

Hotel enrichment never promotes GPS.

Hotel GPS continues to use the independent fail-closed workflow, including HOLD and quarantine. A website/contact/capacity match does not prove a site centroid or entrance coordinate.

## 6. Coverage

The 2026-10-01 V9 pass reviewed all 166 canonical hotel entities.

An entity may remain canonical-only if no additional public field is safe enough to add. Canonical-only does not mean unreviewed.

## 7. Build guard

`scripts/test-hotel-enrichment.mjs` validates:

- canonical/enrichment IDs,
- coverage totals,
- verified website promotion,
- rejected domains,
- scoped contact/capacity/star evidence,
- amenity evidence and dates,
- conflict source/rule integrity.

This guard runs in the V3 pull-request validation workflow.
