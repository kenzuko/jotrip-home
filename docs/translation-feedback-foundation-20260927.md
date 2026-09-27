# Open Phu Quoc - Translation feedback foundation

Build on the existing anonymous feedback engine (PR #148 and #156) before enabling the translator. Keep the sole active host cms.openphuquoc.com and do not change Weather, Airport, Transit, Marine or production DNS.

Vietnamese is canonical. English remains a human-reviewed editorial translation. Six AI-assisted versions: Korean (ko), Russian (ru), Lao (lo), Simplified Chinese (zh-CN), Traditional Chinese (zh-TW), and French (fr).

Every translated paragraph must have a stable article ID, segment ID and translation revision. A correction submission should store the visitor language, the exact text the visitor read, optional Vietnamese source, suggested wording, feedback timestamp and pending status. The existing anonymous rate limit, spam controls, private D1 queue, CMS role checks and 180-day retention apply. Do not collect accounts or email just for translation correction.

Once localized articles launch, show a small AI-translation note in the reading language and a correction link on those six locales only. The form must permit choosing a paragraph and proposing a correction or explaining an error. Never auto-apply a visitor suggestion. Compare to the source and current revision, group duplicates, show safe before/after diff, and retain editor approval, version history and rollback via the existing PR workflow.

Build order: 1) structured submission contract and D1 migration; 2) moderation queue and automated tests including spam, permissions and stale version; 3) provider-independent analysis interface and reviewed terminology memory; 4) activation on translated pages, only after the translator has passed editorial QA. No translator API key, new billable service or production merge is necessary to prepare this foundation.
