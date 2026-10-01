# OpenPQ Failover Policy v1

Status: design only.

## Failure hierarchy

### Upstream source unavailable

1. Record source failure.
2. Retry according to adapter policy.
3. Use a verified alternate only if it has equivalent semantics.
4. Otherwise publish degraded/partial state.
5. Never relabel an alternate source as the failed source.

### Adapter/job failure

1. Isolate the failed job.
2. Retry without blocking unrelated jobs.
3. After retry exhaustion, send job metadata to DLQ.
4. Keep canonical Last Known Good.
5. Allow freshness to age naturally.

### Core unavailable

Runtime continues serving the canonical store.

No new canonical data is produced until Core recovers.

### Runtime unavailable

Core continues collecting and publishing.

Runtime can be rolled back independently.

### Canonical store temporary read failure

Runtime may serve an edge Last Known Good cache when available.

It must identify the result as degraded/cache fallback and preserve original timestamps.

### Consumer unavailable

No impact on Core, canonical store, Runtime or other consumers.

### Platform-wide Cloudflare failure

No active multi-cloud in V1.

Architecture must leave room for a future offsite disaster-recovery snapshot, but that backup must not become a second active production brain.

## Key invariant

Backup is data continuity and code rollback, not a second independent truth engine.
