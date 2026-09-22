# Open Phu Quoc CMS - Cloudflare Pages

## Architecture

- Public website: GitHub Pages / production domain.
- CMS runtime: Cloudflare Pages + Pages Functions.
- CMS target domain: `https://cms.openphuquoc.com/`.
- Login: GitHub OAuth.
- Session: encrypted HttpOnly cookie.
- Publishing: the signed-in user's GitHub OAuth token can write only whitelisted content files.

## Cloudflare Pages build

Create a **Pages** project, not a Worker project.

- Repository: `kenzuko/jotrip-home`
- Production branch: `main`
- Build command: `node scripts/build-cloudflare.mjs` (automatically rebuilds the public knowledge view and search index; no extra build commands needed).
- Build output directory: `dist`
- Root directory: blank

The `functions/` directory is deployed as Pages Functions. Static assets are copied to `dist/`.

## Roles

- `admin`: all CMS modules + user/role management.
- `editor`: homepage copy, stories, guide.
- `operator`: utilities / operational reference data.
- `viewer`: preview/read only.

Initial admin: `kenzuko`.

## Runtime secrets

Set these in Cloudflare Pages > Settings > Variables and Secrets:

- `CMS_SESSION_SECRET`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

Create a GitHub OAuth App after the Pages domain is known. Callback:

`https://cms.openphuquoc.com/api/cms/auth?action=callback`

During first testing you may temporarily use the `*.pages.dev` callback instead.

Never put the OAuth client secret in GitHub or frontend JavaScript.

## Editable files

- `data/home-copy.json`
- `data/content.json`
- `guide/data.json`
- `data/utilities.json`
- `cms/users.json` (admin only)

Live weather/airport feeds are intentionally not editable through CMS.


## Internal Analytics + D1

The CMS includes an admin-only read-only Analytics module.

The Pages project should bind the existing D1 database using one of these binding names:

- `ANALYTICS_DB` (preferred)
- `CMS_DB`
- `OPENPQ_DB`
- `DATA_DB`
- `DB`
- `METRICS_DB`

No manual migration is required for V1. The Analytics API creates its own tables with `CREATE TABLE IF NOT EXISTS`.

Current live inputs:

- Sea / Transit: normalized snapshot from `kenzuko/transit-jotrip`
- Aviation: `jotrip-airport-live.kenzuko.workers.dev`

Analytics is admin-only, read-only and stores only whitelisted operational fields. It intentionally does not persist customer names, phone numbers, email addresses, license plates, booking codes, payment data, session IDs or raw booking payloads.
