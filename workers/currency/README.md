# Open Phu Quoc Currency Worker

Currency is intentionally isolated from Weather, Airport, Transit, Cano and CMS logic.

## Source of truth

Primary source: Vietcombank XML exchange-rate feed.

The worker normalizes:

- currency
- cash_buy
- transfer_buy
- sell
- source_updated_at
- fetched_at

No rate is estimated or synthesized.

## Runtime

- Scheduled fetch: every 5 minutes.
- Cache: up to 5 minutes.
- D1 only inserts a new snapshot when Vietcombank source_updated_at changes.
- If Vietcombank is temporarily unavailable, the API may return the latest D1 snapshot with data_status=cached.
- If neither live nor stored data exists, the API returns unavailable instead of fake values.

## Routes

- GET /api/exchange-rates
- GET /api/exchange-rates/history?range=30d&currencies=USD,KRW,CNY
- GET /api/exchange-rates/health

## Deployment boundary

Do not merge this worker into the Weather or Airport collector.

Recommended deployment is a dedicated Worker, then route /api/exchange-rates* from openphuquoc.com to it. The static Currency UI already targets that stable route, so frontend code does not need to know the Worker hostname.

Create the D1 database, apply schema.sql, copy wrangler.example.jsonc to the deployment config and replace the database id.
