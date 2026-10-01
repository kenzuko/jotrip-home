# OpenPQ Intelligence Platform - Design Only

Status: design branch only. No production wiring, deploy, DNS, cron or cutover.

The platform separates the production brain from consumer UIs.

- Core = collect, normalize, truth, decide, publish.
- Canonical store = versioned operational truth + history + Last Known Good.
- Runtime = read-only serving plane over canonical data.
- Consumers = OpenPhuQuoc, Weather Lab, Airport Live, Transit Live, JoTrip Ops, future apps.

Hard rule: consumers must not own shared production collectors, canonical truth or production cron.

Current production remains unchanged until shadow validation and cutover gates pass.

See:
- docs/architecture/OPENPQ_INTELLIGENCE_CORE_BLUEPRINT_V1.md
- platform/contracts/dataset-envelope.schema.json
- platform/contracts/runtime-api-v1.md
- platform/contracts/failover-policy-v1.md
- platform/config/datasets.v1.json
