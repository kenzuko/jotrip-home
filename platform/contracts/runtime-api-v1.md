# OpenPQ Runtime API v1 - Design Contract

Status: design only.

## Runtime principles

Runtime is a read plane, not a collector and not a decision engine.

Every response must preserve canonical provenance and freshness.

Proposed stable routes:

```text
GET /api/v1/system/health
GET /api/v1/island/now

GET /api/v1/weather/current
GET /api/v1/weather/forecast
GET /api/v1/weather/marine
GET /api/v1/weather/groundtruth

GET /api/v1/airport/live
GET /api/v1/airport/health

GET /api/v1/transit/network
GET /api/v1/transit/health
```

## Response rules

- Never change source timestamps to cache/runtime timestamps.
- LKG must be identified as cached/stale when freshness thresholds are exceeded.
- Missing remains missing.
- Runtime must never fabricate departures, seats, weather observations or source verification.
- A dataset failure must not change unrelated routes to 500.
- Runtime implementation should remain independently deployable from Core.

## Consumer rule

Consumers may transform presentation, but may not reinterpret canonical status or freshness into a more optimistic state.
