# OPEN PHU QUOC INTELLIGENCE CORE - BLUEPRINT V1

Status: DESIGN LOCK
Date: 2026-10-01
Production impact: NONE

## Principle

One brain. One canonical truth plane. Many independent consumers.

OpenPhuQuoc, Weather Lab, Airport Live, Transit Live, JoTrip Ops and future apps are consumers. They may fail or be turned off without stopping the production data system.

## Target

```text
External sources
      |
      v
openpq-core
collect -> normalize -> truth -> decision
      |
      v
canonical operational store
versioned data + history + Last Known Good
      |
      v
openpq-runtime
stable read contracts + cache + explicit stale/degraded state
      |
      +--> openphuquoc.com
      +--> Weather Lab
      +--> Airport Live
      +--> Transit Live
      +--> JoTrip Ops
      +--> future apps / AI / partner API
```

## Boundaries

### openpq-core

Owns:
- scheduler
- source adapters
- collection
- validation
- normalization
- source health
- freshness
- conflict/truth rules
- decision engine
- Island State
- canonical publication
- retry / DLQ metadata

Does not own public UI.

### Canonical store

Target storage: R2 when integration starts.

Publish immutable versions first, then atomically move the manifest pointer.

Example:

```text
transit/v/20261001T103000Z/network.json
transit/v/20261001T103000Z/health.json
transit/manifest.json -> active_version=20261001T103000Z
```

Last Known Good is never relabeled Fresh.

### openpq-runtime

Read plane only.

May:
- read manifest
- read active object
- expose stable API
- cache
- expose provenance/freshness
- fall back to LKG according to policy

Must not:
- crawl upstream sources
- own cron
- run forecasting
- decide source truth independently

### Consumers

May render, search, filter and present.

Must not:
- collect shared production data
- create another canonical store
- create production cron for shared operational datasets
- silently reinterpret stale data as current

Labs may experiment. Promotion to production requires moving the adapter/logic into Core.

## Scheduler

One orchestration system. A frequent scheduler tick checks dataset due-times.

A tick does not mean every dataset runs.

Retryable work should be isolated by job and must not block unrelated datasets.

## Island State

Core produces a derived island-level contract from normalized canonical inputs.

The homepage eventually consumes Island State instead of reconstructing truth from many independent APIs.

## Failures

- source failure -> retry / verified alternate / degraded
- adapter failure -> isolated failure, unrelated adapters continue
- dataset stops updating -> LKG ages to stale
- Core failure -> Runtime continues serving canonical LKG
- Runtime failure -> Core continues collecting/publishing
- storage temporary read failure -> degraded edge LKG cache if available
- full Cloudflare failure -> future offsite DR hook, not active multi-cloud in V1

## Current dependencies to remove during migration

- `transit/app.js` reads `raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json`.
- `functions/_shared/go-live.js` still reads `weather.openphuquoc.com`.
- Weather edge currently reaches Jotrip-Lab branches directly.
- Airport OpenPQ UI is independent of Jotrip-Airport frontend, but its live transport/fallback must migrate into canonical Core ownership.

## Migration

1. Design/contracts only.
2. Core + Runtime skeleton with no production route.
3. Transit adapter shadow output.
4. Weather adapters shadow output.
5. Airport adapter shadow output.
6. Island State.
7. Shadow comparison.
8. Consumer cutover one by one.
9. Disable old production cron only after verified cutover.
10. Kill-test all lab repos and consumers.

## No-cutover rule

Until the platform passes shadow and failure tests:

- no production deploy
- no merge into production main
- no production DNS
- no existing cron shutdown
- no consumer switch
- no lab repo archive
