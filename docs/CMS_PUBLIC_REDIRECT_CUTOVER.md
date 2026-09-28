# CMS public redirect cutover

Goal: keep `cms.openphuquoc.com` as the technical/admin hostname while making `openphuquoc.com` the only anonymous public website.

## Behaviour

- Anonymous GET/HEAD requests to public paths on `cms.openphuquoc.com` return a path-preserving 301 to `https://openphuquoc.com`.
- Authenticated CMS sessions are allowed through so editors can keep using inline editing on the CMS hostname.
- Technical routes stay on the CMS hostname and are always noindex:
  - `/admin/*`
  - `/api/*`
  - `/weather/data/*`
  - `/data/meta/*`
  - required static assets
- Unknown non-GET/HEAD public requests on the CMS hostname return 404 instead of being redirected.

## Root-domain cutover

The public origin should be the Cloudflare Worker `openphuquoc-v3`, not GitHub Pages. The Worker owns dynamic public APIs and Weather edge paths in addition to the static assets.

Use a Cloudflare Worker Custom Domain for `openphuquoc.com`. Do not keep the old `openphuquoc.com -> cms.openphuquoc.com` redirect after cutover.

Do not change the GitHub OAuth callback. It remains:

`https://cms.openphuquoc.com/api/cms/auth?action=callback`
