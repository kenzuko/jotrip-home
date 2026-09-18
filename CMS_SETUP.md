# Open Phu Quoc CMS - activation

The CMS UI, role model and Netlify functions are already in the repository.

## Runtime

- Public website: GitHub Pages / production domain.
- CMS runtime: Netlify project `openphuquoc-preview`.
- Admin URL after deployment: `https://openphuquoc-preview.netlify.app/admin/`.
- Login: GitHub OAuth.
- Session: encrypted HttpOnly cookie.
- Publishing: the signed-in user's GitHub OAuth token writes only whitelisted content files.

## Roles

- `admin`: all CMS modules + user/role management.
- `editor`: homepage copy, stories, guide.
- `operator`: utilities / operational reference data.
- `viewer`: preview/read only.

Initial admin: `kenzuko`.

## Netlify environment

`CMS_SESSION_SECRET` is already stored as a secret in the Netlify project.

Create a GitHub OAuth App and set these two Netlify secrets:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

OAuth callback URL:

`https://openphuquoc-preview.netlify.app/api/cms/auth?action=callback`

The OAuth request uses only `public_repo read:user`.

Never put the client secret in GitHub or frontend JavaScript.

## Editable files

- `data/home-copy.json`
- `data/content.json`
- `guide/data.json`
- `data/utilities.json`
- `cms/users.json` (admin only)

Live weather/airport feeds are intentionally not editable through CMS.
