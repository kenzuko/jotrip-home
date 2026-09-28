# Open Phu Quoc - Domain Unification Test Plan

Status: LAB ONLY - do not merge until all gates are green.

## Goal

Make `https://openphuquoc.com` the only public identity seen by visitors and search engines while preserving the existing CMS, D1, Weather, Airport, Transit and publishing architecture.

This branch is deliberately isolated from content/data work running in parallel.

## Non-goals

- Do not change DNS.
- Do not change production Cloudflare routes.
- Do not modify content data.
- Do not redesign Weather, Airport or Transit.
- Do not migrate D1.
- Do not merge while parallel data branches are still moving unless the final rebase is clean and all regression tests pass.

## Test stages

### Stage 0 - Baseline characterization

Confirm the current architecture still exists before touching routing:

- Worker runtime `openphuquoc-v3`.
- CMS Pages runtime.
- D1 binding `CMS_DB` on both relevant runtimes.
- Admin continues to call `/api/cms/*`.
- Existing CMS draft/review/direct-edit/rollback tests pass.

### Stage 1 - Domain contract

Automated target gates:

1. Shared SEO canonical origin is `https://openphuquoc.com`.
2. Worker metadata does not identify `cms.openphuquoc.com` as the public site.
3. sitemap.xml and robots.txt advertise only the public origin.
4. SEO regression tests reject CMS-host canonical URLs.
5. Admin explicitly carries `noindex`.

Run:

```bash
node scripts/test-domain-unification-preflight.mjs
node scripts/test-domain-unification-preflight.mjs --strict
```

Audit mode documents current pending items without breaking the lab.
Strict mode becomes a required gate before merge.

### Stage 2 - CMS regression

Must remain green after domain work:

- access/roles
- local draft + review proposal
- edit-state conflict detection
- direct text-only edit
- inline edit
- review diff
- rollback
- quality/task center
- admin JavaScript syntax

No content file should be changed by this branch.

### Stage 3 - Cloudflare dry build

Build both runtimes without deploying:

- Pages Functions bundle
- Worker dry-run bundle
- static dist validation

This proves route changes compile while production remains untouched.

### Stage 4 - Preview end-to-end

On a non-production preview, verify:

- homepage and public modules render
- story/guide canonical URL is public origin
- sitemap contains only public-origin URLs
- `/admin/` loads and is noindex
- login callback works on the preview configuration
- draft save does not publish
- proposal flow creates PR as before
- direct inline text edit behaves as before
- Weather/Airport/Transit routes remain unchanged
- no public data regression

### Stage 5 - Rebase against live main

Because other workstreams are changing data/CMS concurrently:

1. Fetch the newest `main`.
2. Rebase/merge main into this lab branch.
3. Confirm this branch still has no data-file diffs.
4. Run all domain + CMS + Cloudflare dry-build tests again.
5. Review diff for routing/SEO files only.

If main moved after the last green run, the previous green result is invalid for merge.

### Stage 6 - Production cutover

Only after stages 0-5 are green:

- update GitHub OAuth callback
- attach final Cloudflare route/custom domain
- verify production `openphuquoc.com`
- enable path-preserving 301 from legacy public CMS URLs
- submit/check public sitemap in Search Console

## Merge gate

Merge is allowed only when:

- strict domain contract PASS
- CMS regression PASS
- Cloudflare dry builds PASS
- preview E2E PASS
- branch rebased against latest main
- zero unintended changes under content/data paths
- production cutover checklist is ready

Until then this branch stays isolated and has no effect on the running CMS.
