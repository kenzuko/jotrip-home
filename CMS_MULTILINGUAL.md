# CMS multilingual rollout

Vietnamese remains the source of truth. The public language selector remembers a visitor's choice and recognizes the device language. Target order: English, Korean, Russian, Lao, Simplified Chinese, Traditional Chinese for Taiwan, French.

## Translation lifecycle

1. Configure `OPENAI_API_KEY` as a GitHub Actions repository secret. This is an API billing credential, separate from a ChatGPT subscription. Optionally set repository variable `OPENPQ_TRANSLATION_MODEL`; the default is `gpt-4o-mini`.
2. On a merged Vietnamese Story, knowledge source, or public HTML change, `cms-translate-stories.yml` prepares changed translations and opens an editorial PR. The first run processes all 34 Stories, 128 public knowledge articles and static strings from 29 public HTML pages, so review cost and API usage before enabling the secret.
3. Review local names, directions, travel conditions, timing, fares, uncertainty, image captions, and paragraph structure. Edit each translation as needed. Set individual Story/knowledge `status` to `published`. Static page catalog uses a top-level `status: published` after the entire catalog is reviewed.
4. Merge the translation PR. The existing CMS Pages workflow builds and publishes the catalogs. A Story or knowledge translation is shown only when its source hash still matches the current Vietnamese article. Missing, stale and unreviewed translations fall back to Vietnamese with a notice.

The Story catalog is `data/i18n/{locale}/stories.json`, the knowledge catalog is `data/i18n/{locale}/knowledge.json`, and the static HTML catalog is `data/i18n/{locale}/site-ui.json`. The pre-existing `ui.json`, `food.json` and `place-explainers.json` contracts are separate and unchanged.

## Current coverage boundary

Static HTML strings and the two article collections have translation catalogs. Airport keeps its existing language switch (Vietnamese, English, Korean, Russian, Simplified Chinese); the shared preference syncs with it. Lao, Traditional Chinese and French are not yet supported there. Text assembled dynamically by Weather, Transit, GO, Near Me, Food, Places, and live notices still needs module-level localization. Operational facts must come from their existing sources and must not be machine-translated at request time. The current PR stays draft until those surfaces, translated content, and mobile/desktop browser QA are complete.
