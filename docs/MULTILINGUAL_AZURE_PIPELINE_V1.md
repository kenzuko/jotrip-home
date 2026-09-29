# Open Phu Quoc - Multilingual Azure Pipeline V1

## Safety model

- Vietnamese is the source of truth.
- Azure output is always `machine_draft`.
- Machine translation never enables a locale or publishes content.
- `plan` and `translate` without `--apply` make no API call and write no file.
- Reviewed or published translations cannot be overwritten without the explicit `--force-machine-overwrite` flag.
- URLs, placeholders, times, dates, measurements and phone numbers are protected and restored after translation. A changed lock blocks the run.
- Secrets are read only from environment variables and must never be committed.

## Environment

```bash
export AZURE_TRANSLATOR_KEY="..."
export AZURE_TRANSLATOR_REGION="..." # required for regional or multi-service resources
export AZURE_TRANSLATOR_ENDPOINT="https://api.cognitive.microsofttranslator.com" # optional
```

The default integration uses Azure Translator REST API v3.0. Each request is capped below the service limit at 25 strings and 5,000 total characters.

## Inspect before spending quota

```bash
npm run i18n:inventory
node scripts/i18n-pipeline.mjs plan --family food --locale en
```

The plan reports field count, character count, target path and maximum request count. It does not contact Azure.

## Create one machine draft

```bash
node scripts/i18n-pipeline.mjs translate --family food --locale en --apply
```

Supported families:

- `ui`
- `stories`
- `knowledge`
- `food`

Supported targets:

- `en`
- `ko`
- `ru`
- `lo`
- `zh-Hans`
- `zh-Hant`
- `fr`

The command writes the locale file, updates the private translation memory and changes only that lifecycle target to `machine_draft`.

## Build all English drafts in GitHub Actions

Add repository Actions secrets:

- `AZURE_TRANSLATOR_KEY` - required.
- `AZURE_TRANSLATOR_REGION` - required only for a regional or multi-service resource; use the exact Azure resource region.

Then run the manual workflow **Build English machine drafts**. It translates UI, Food, Stories and Knowledge, validates the results, creates a separate review branch and opens a pull request. It does not enable or publish English.

## Required review path

1. Generate `machine_draft`.
2. Run `npm run i18n:check` and the existing i18n tests.
3. Review content and patch corrections.
4. Set lifecycle state to `human_review` with reviewer metadata.
5. Run visual QA for the locale and relevant surfaces.
6. Explicitly enable the locale/surfaces in `data/i18n/locales.json`.
7. Set lifecycle state to `published` with publication metadata.
8. Build again. Only then may routing, sitemap and language switcher expose it.

## Do not run all languages blindly

Start with English on one family, review the produced structure and terminology, then expand. Azure is the throughput layer, not the editorial authority.
