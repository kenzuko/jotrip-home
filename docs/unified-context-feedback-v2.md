# Open Phu Quoc - Unified contextual feedback V2 (27/09/2026)

## One engine, one moderation queue

Extend the **existing** V1 feedback system on the sole live host `cms.openphuquoc.com`.
Do not create a second translation-feedback service or cross-origin intake endpoint.
`GET/POST /api/feedback`, `GET/PATCH /api/cms/feedback`, the same CMS role
checks, daily HMAC anti-spam, optional private R2 evidence and 180-day anonymous
report cleanup remain authoritative. No visitor accounts.

## Contextual, low-visibility placements

- Home: one quiet text action in the footer. No fixed floating button over mobile navigation.
- GO: existing buttons on individual recommendations; an unobtrusive footer action for page-level feedback.
- Near Me: preserve per-location correction and the explicit missing-place proposal.
- Stories and Guide article pages: a quiet action after the article, sharing the existing dialog.
- Guide landing: quiet footer action.
- On the six future AI-translated article locales (ko, ru, lo, zh-CN, zh-TW, fr):
  replace the article action with a small localized disclosure and a correction button
  **only when** `<body data-ai-translation="true">` (or an element marked
  `data-translation-ai="true"`) and the document `lang` matches.
  No AI-translation disclosure for vi/en or untranslated content.
  When a translation renderer switches locale or content in place, call
  `window.OpenPQFeedback.refresh()`.
- Weather, Airport, Transit and other specialized modules remain unchanged.
  A later approved surface may reuse the same public dialog in read-only correction mode,
  not modify operational facts.

## Structured translation feedback

Use `data-openpq-feedback` and `data-feedback-type="article"` as before.
The shared client can prefill up to 500 characters of a user-selected paragraph
and sends: `language`, optional `source_revision`, `quoted_text`,
`suggested_text`, `details`, article ID/name and same-origin source path.
For the future translator, set the real document language and optionally
`document.body.dataset.translationRevision`; never invent a revision or
claim a translation was AI-generated unless it was. Existing vi/en pages
continue to submit regular article feedback without these required fields.

The backend permits `issue=translation` only on articles and only in
the six supported target locales. Its schema/GET readiness check fails
closed until migration `0004_unified_feedback_i18n.sql` has applied.
Legacy reports default to `language=vi`.

The **same** protected inbox accepts translation and location reports. Editors can filter by
status/category/language, compare the quoted and suggested sentences, supply a
verified final correction, and write a meaningful resolution note. A resolved
translation atomically stores reviewer-approved text in
`cms_translation_corrections`; reopening or rejecting removes that approved
entry. Raw community reports expire after 180 days; reviewed text is retained
without identifying the reporter (disclosed in the feedback privacy page).
These entries are a *correction library*, not automatically applied translation memory:
a future translation engine must map them to the source passage/revision first.
No live publication, no AI API calls, no unreviewed edits.

## Release gates

- Apply the additive D1 migration using the existing sole CMS Pages
  publisher **before** its new backend is available.
- Keep feedback intake same-origin; no DNS, new Worker, plan upgrade,
  Cloudflare secret, or extra cron needed.
- `node scripts/test-place-feedback.mjs` must pass both legacy and translation scenarios.
- Visual QA must verify mobile Near Me, vi article, simulated translated ko article,
  protected CMS filters and safe rendering of user-provided text.
- Deploy once from reviewed `main` after CI and public smoke: submit a harmless
  report, confirm it in the official CMS D1 queue, remove the test record.
  Do not mark production complete just because a PR/preview passed.
