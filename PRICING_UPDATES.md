# Price update flow

Pricing is **automated**: a GitHub Action runs daily (and on manual trigger), fetches the latest from the Vizra API, and updates `pricing.json` in the repo. The frontend then loads that file so pricing stays up to date without manual edits.

## Safeguards (all implemented)

- **1. Commit only if pricing changed** — Workflow uses `git diff --staged --quiet -- pricing.json`; if no diff, it logs "No pricing changes" and does not commit. Keeps history clean on daily runs.
- **2. API failure protection** — If the pricing API fails (timeout, rate limit, empty/invalid response), the script logs an error and exits with code 1. No file is written, so bad data is never committed.
- **3. Data validation before writing JSON** — Missing input/output price, NaN, and negative prices are rejected (invalid models skipped). Payload is also validated against `schemas/pricing.schema.json`. Only valid data is written.

Details: [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md) (including the exact workflow pattern and validation rules).

## Flow

```
GitHub Action (daily 06:00 UTC / manual)
     ↓
scripts/update-pricing.js fetches Vizra API
     ↓
Writes pricing.json (normalized, deduped)
     ↓
Commit and push if changed
     ↓
App loads pricing.json on open (or cache / embedded default)
```

## How the app gets data

1. **Initial load**: Loads `pricing.json` from the host first using a cache-busting URL (`pricing.json?t=${Date.now()}`) so the browser does not serve stale cached pricing; then falls back to localStorage cache, then embedded defaults. On non-GitHub hosts, the app may also call the Vizra API once to fill Anthropic/Mistral if missing.

2. **"Refresh from web"**: On GitHub Pages, reloads `pricing.json`. Elsewhere, fetches the Vizra API and updates all providers.

3. **pricing.json** is updated automatically by the workflow. The workflow **commits and pushes only when the file content has changed** (`git diff --staged --quiet`); otherwise it skips commit and logs "No pricing changes". You can also run the script locally (see below).

## API failure handling

The script exits with code 1 (and does not write `pricing.json`) on:

- **API timeout** — request aborts after 30 seconds
- **Rate limit** — HTTP 429 or any non-OK status
- **Empty response** — response body empty
- **Malformed JSON** — invalid JSON from the API
- **No usable data** — response parses but has no Gemini/OpenAI models, or no valid models remain after validation

When the script fails, the workflow step fails too, so no bad `pricing.json` is committed. See [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md) for the full table.

## Validation (before writing)

Before writing, each model is validated. Invalid models are **skipped**; only valid ones are written. Rules:

- **Missing fields** — must have non-empty `name`, and both `input` and `output` (numbers).
- **NaN** — `input`, `output`, and if present `cachedInput` must be finite numbers; NaN → skipped.
- **Negative values** — all price fields must be ≥ 0; negative → skipped.
- At least one of `input` or `output` must be &gt; 0.

If no valid Gemini/OpenAI models remain after validation, the script exits 1 and does not write the file. Full details: [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md#validation-before-writing).

## JSON schema validation

The payload is validated against **`schemas/pricing.schema.json`** before write. This prevents corrupted datasets (wrong shape, extra keys, invalid types). On schema failure the script exits 1 and does not write the file. See [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md#json-schema-validation-before-writing).

## Running the script locally

To refresh `pricing.json` yourself (from repo root, after `npm ci` or `npm install`):

```bash
npm run update-pricing
# or: node scripts/update-pricing.js
```

On success, commit and push `pricing.json` if needed. On failure the script exits 1 and does not overwrite the file. You can also use **Actions → Update pricing → Run workflow** in GitHub.

## Vizra API

[Vizra.ai](https://vizra.ai/ai-llm-model-pricing) provides a free API with pricing for 284+ AI models. The app uses `https://vizra.ai/api/v1/pricing/ai-models`. Full architecture: [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md).
