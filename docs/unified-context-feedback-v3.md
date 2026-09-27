# Open Phu Quoc Feedback Engine V3 - integration and release handoff

## Current product

This extends **the existing anonymous, same-origin** Feedback V2 on
`https://cms.openphuquoc.com`. One endpoint (`/api/feedback`), one CMS queue
(`/admin/feedback.html`), one Cloudflare Pages publisher and one D1.
No separate feedback app, login requirement, new Cloudflare service or
translation API charge. No changes to Weather, Airport or Transit logic.

## Compact and contextual interface

- Existing per-venue GO and Near Me reporting remains intact; missing-place
  proposals stay separate from ordinary issues.
- One unobtrusive footer entry on Home, GO, Guide, Stories listing and Guide library;
  one article-level entry after Stories or Guide articles. No persistent floating
  control obscuring the map or mobile bottom navigation.
- On **confirmed** AI-translated articles in `ko`, `ru`, `lo`, `zh-CN`,
  `zh-TW`, `fr`, one small localized notice replaces the article feedback
  entry. The *entire correction form*, not just the notice, is localized.
- The future translation renderer MUST set the real `document.documentElement.lang`,
  mark `document.body.dataset.aiTranslation="true"` only for genuinely
  AI-generated content, set the source revision if available and call
  `window.OpenPQFeedback.refresh()` after a locale/content change.
  Include `/core/feedback-i18n.js` before `/core/place-feedback.js`.
  Never show an AI notice on untranslated, Vietnamese or English content.

## Smart triage, not crowd-verified truth

- Submission computes a privacy-safe, stable 24-hex similarity fingerprint
  of issue, entity/source, language and the specific topic. No raw IP, name,
  GPS or reporter identity enters the fingerprint.
- CMS lists the count of matching reports (while retaining every original),
  opens all related submissions in one click and can sort by repeated issue.
  This signals **attention**, not verification. Distinct arbitrary general
  reports cannot be grouped only because they share a page.
- An editor sees the report's language, selected excerpt and proposed wording,
  then can populate (but must check) a final approved sentence. Resolving
  translation issues requires the final text and a 10+ character review note.
- Staff-approved corrections are stored separately from expiring raw feedback.
  The restricted, read-only endpoint
  `GET /api/cms/feedback/corrections?language=ko&source_path=...&q=...&offset=0`
  provides an indexed phrase library in the same CMS screen. No public route
  exposes the review history.

## Hard safety rules

Public submissions do **not** update articles, live weather, GPS, ticket prices,
marine confirmations or schedules. A repeated assertion is not ground truth.
Reviewed sentences can be reused by a future translation engine **only** when
article ID, language, exact source excerpt and original revision match; ambiguous
or conflicting historical corrections must go back to human review. The library
does not train a model or silently change existing pages.

No paid AI API or Workers AI binding is enabled by this release. Classification,
similarity grouping and reviewed-text suggestions run without a model. Optional
AI grammar assistance can be added behind an explicit administrator action and
cost limit after a provider is selected.

Existing anti-spam, role authorization, same-origin validation, private-image
controls and the 180-day cleanup remain in place. The approved phrase library
retains editorial text without reporter metadata. The international privacy
summary is linked from localized feedback forms.

## QA and production acceptance

The existing CMS Pages workflow applies
`migrations/d1/0005_feedback_smart_triage.sql` before deployment.
`scripts/test-place-feedback.mjs` must cover V1/V2 regressions, 51
similar reports, related browsing, safe priority sorting, locale validation,
privileged correction lookup and raw-report cleanup.
`scripts/visual-qa-place-feedback.mjs` must cover mobile Near Me,
six translated-article dialogs, one small disclosure, CMS grouping and
the approved-correction screen. The existing CMS Control Room and V3
validation suites must remain green. Only after merge and real
Cloudflare Pages smoke verify live intake + D1 persistence and test-record
cleanup should V3 be called live.
