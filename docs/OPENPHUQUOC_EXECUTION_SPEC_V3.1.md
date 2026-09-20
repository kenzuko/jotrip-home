# OPEN PHU QUOC - EXECUTION SPEC V3.1

Updated: 2026-09-19

## Product principle

Open Phu Quoc is a small destination operating system for people who are in, are coming to, or are planning Phu Quoc.

Core product:

Search + Today + Live + Map + Utilities + Destination Knowledge

The homepage is an experience layer. It must not become a second weather, airport, ferry or transport engine.

## Data layers

- data/sources: raw/curated source material and source manifests
- data/entities: normalized stable entities
- data/live: normalized volatile operational state
- data/views: UI-ready composed views
- data/meta: contracts, schema versions and freshness rules

Raw handbook corpus must never be rendered directly as product UI.

## Stable IDs

All normalized entities use immutable prefixed IDs such as:

- zone_north
- zone_central_west
- zone_south
- place_hon_thom
- activity_cable_car_hon_thom
- food_bun_quay
- utility_airport_lost_found

Names, labels and slugs may change. IDs must not.

## Live contract

Every live record must expose source and time semantics separately:

- observed_at
- source_updated_at
- fetched_at
- freshness
- status
- source
- confidence
- fallback

Allowed status values:

normal | advisory | watch | disrupted | unavailable | unknown

Allowed freshness values:

fresh | aging | stale | unknown

A stale or failed source must not be presented as current live truth.

## Homepage rule

Homepage consumes normalized view objects. It does not fetch raw providers and independently interpret domain logic.

Target views:

- data/views/island-status.json
- data/views/today-feed.json
- data/views/tonight.json
- data/views/home.json
- data/views/search-index.json

## Search

Search is cross-module command/navigation, not article search. It covers places, activities, food, hotels/stay, guides, utilities, live modules, itineraries and zones.

Vietnamese diacritics must be optional for query matching.

## Desktop shell

Desktop layout:

left navigation | main workspace | contextual rail

The first viewport must expose useful status and actions, not only a hero.

## Mobile

Mobile is a separate composition using Today, Explore, Search, Live and More. Desktop sidebars must not simply collapse into a narrow page.

## Migration policy

The V3 data layer is introduced alongside existing production files. Legacy files are not removed until views and UI have migrated and QA passes.

## P0 order

1. Architecture and contracts
2. Data foundation
3. Entity normalization
4. R3 normalization completion
5. Cross-module search
6. Desktop app shell
7. Homepage views
8. Weather V2 adapter
9. Airport adapter
10. Transport adapter
11. Explore browser
12. Place detail
13. Mobile composition
14. QA and cleanup
