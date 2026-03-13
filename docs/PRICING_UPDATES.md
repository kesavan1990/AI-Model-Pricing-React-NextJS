# Pricing update architecture

To avoid API rate limits from the frontend, pricing is updated via the repo instead of calling Vizra from the browser.

## Defined timeline

| Item | Schedule | Details |
|------|----------|---------|
| **Automated run** | **Daily at 06:00 UTC** | `.github/workflows/update-pricing.yml` triggers at `cron: '0 6 * * *'`. |
| **Manual run** | On demand | GitHub Actions → **Update pricing** → **Run workflow**. |
| **Output** | After each run | `pricing.json` is updated and committed only if content changed. |

The frontend loads `pricing.json` (with cache-busting); it does not call the Vizra API on normal page load. See [PRICING_SCENARIOS.md](PRICING_SCENARIOS.md) for when the UI uses this file vs cache vs API.

**Scope:** The pricing update includes **all providers** (Gemini, OpenAI, Anthropic, Mistral) and **all model types** (text/chat, image, audio, video). The script does not filter by model type; it preserves `modelType` and alternate pricing (e.g. per-image, per-minute, per-second) when the API provides them, and allows models with 0/0 token pricing when they have type or alternate pricing.

## Features at a glance (safeguards)

| Feature | Implemented | Where |
|--------|-------------|--------|
| **1. Commit only if pricing changed** | Yes | Workflow: `git add public/pricing.json` then `if git diff --staged --quiet -- public/pricing.json; then echo "No pricing changes"; else git commit ... git push; fi`. Keeps commit history clean when the Action runs daily. |
| **2. API failure protection** | Yes | Script: on timeout, non-OK status (e.g. 429), empty response, or malformed JSON → `console.error(...)` and `process.exit(1)`. No file is written, so the workflow never commits bad data. Invalid or empty `models`-style response is rejected (no valid Gemini/OpenAI → exit 1). |
| **3. Data validation before writing JSON** | Yes | Script: each model is validated (missing input/output price → skipped; NaN and negative prices → skipped). `validateModel()` / `validateAndFilter()`; then payload is validated against `schemas/pricing.schema.json`. Only valid data is written. |

## Flow

```
GitHub Action (scheduled / manual)
   ↓
Fetches Vizra API → scripts/update-pricing.js
   ↓
Validates payload against schemas/pricing.schema.json → writes public/pricing.json
   ↓
Frontend loads pricing.json from public/ (no direct Vizra call on page load)
```

## How it works

- **`.github/workflows/update-pricing.yml`** runs daily (06:00 UTC) and on manual trigger. It runs `node scripts/update-pricing.js`, which fetches from Vizra, normalizes provider names and units (same logic as the frontend), and writes `public/pricing.json`.
- **Commit only if changed:** The workflow keeps the commit history clean: it runs `git add public/pricing.json`, then `if git diff --staged --quiet -- public/pricing.json; then echo "No pricing changes"; else git commit -m "chore: update pricing.json from Vizra API"; git push; fi`. So when the Action runs daily, it only commits when the file content has changed.
- **Frontend** (`src/app.js` → `src/pricingService.js`, `src/api.js`) loads `pricing.json` first, then falls back to localStorage cache, then embedded defaults. Optional "Refresh from web" still calls Vizra once per click (user-initiated). See [README](../README.md#code-structure) for the `src/` module layout.
- **Cache-busting:** See [Cache-busting in frontend](#cache-busting-in-frontend) below.

## API failure handling

The update script (`scripts/update-pricing.js`) guards against bad data so the workflow does not commit a broken `pricing.json`:

| Condition | Behavior |
|-----------|----------|
| **API timeout** | Fetch aborts after 30s; script logs "Pricing fetch failed: API timeout" and exits with code 1. |
| **Rate limit (429)** | Script treats non-OK status as error, logs rate limit, exits 1. No commit. |
| **Other non-OK status** | Logs "API error: &lt;status&gt;" and exits 1. |
| **Empty response** | If the response body is empty, throws and exits 1. |
| **Malformed JSON** | If `JSON.parse` fails, logs "Malformed JSON from API" and exits 1. |
| **No usable data** | If the API returns invalid structure (e.g. not an array of models), or parsing yields no Gemini/OpenAI models, or no valid models remain after validation, logs an error and exits 1. No file is written. |

On any of these failures the script exits with `process.exit(1)`, so the workflow step fails and the "Commit and push if changed" step is never run — **API failure protection** ensures no bad `pricing.json` is ever committed.

## Validation (before writing)

Before writing `public/pricing.json`, the script validates every model. Invalid entries are **skipped** (not written). A model is valid only if:

| Check | Rule |
|-------|------|
| **Missing input/output price** | Each model must have valid `input` and `output` (numbers). Missing or invalid → skipped (equivalent to `if (!model.inputPrice \|\| !model.outputPrice) continue;`). |
| **NaN** | `input`, `output`, and if present `cachedInput` must be finite numbers. `NaN` or non-numeric → skipped. |
| **Negative prices** | All price fields must be ≥ 0. Negative → skipped. |
| **At least one price or type** | Token pricing (one of `input`/`output`/`cachedInput` &gt; 0) **or** `modelType` or alternate pricing (`pricingPerImage`, etc.). Image/audio/video with 0/0 token pricing are included when the API provides type or per-unit pricing. |

After filtering, if there are no valid Gemini or OpenAI models, the script exits with code 1 and does not write the file. This **data validation before writing JSON** ensures only valid pricing data is committed.

## JSON schema validation (before writing)

Before writing `public/pricing.json`, the full payload is validated against **`schemas/pricing.schema.json`** using [Ajv](https://ajv.js.org/). This prevents corrupted datasets:

- **Required root keys:** `updated`, `gemini`, `openai`, `anthropic`, `mistral` (no extra top-level keys).
- **Each model** must have `name` (non-empty string), `input` (number ≥ 0), `output` (number ≥ 0); optional `cachedInput` (number ≥ 0 or null). No extra properties on model objects.
- **Types and constraints** are enforced (e.g. arrays only for provider lists, numbers for prices).

If schema validation fails, the script logs the first error path and message, exits with code 1, and does **not** write the file. The workflow therefore never commits invalid or malformed `pricing.json`. Run locally with `npm run update-pricing` (or `node scripts/update-pricing.js` after `npm ci`) so the schema and Ajv dependency are available.

## Cache-busting in frontend

Browsers may cache `pricing.json`, which can show stale pricing after updates. The frontend uses a cache-busting query so the UI gets the latest data:

**Recommended fetch pattern:**

```js
fetch(`pricing.json?t=${Date.now()}`)
```

This guarantees the UI shows the latest pricing after workflow updates. The app implements this in `getPricingJsonUrl()` in `src/api.js`: the URL is built with `?t=<timestamp>` (e.g. `pricing.json?t=1699123456789`), and `getPricing()` uses that URL. Each load therefore requests a unique URL and avoids serving stale cached pricing.

## Local run

From the repo root:

```bash
node scripts/update-pricing.js
```

This overwrites `pricing.json` with the current Vizra response. On API failure the script exits with code 1 and does not write the file.

## Manual workflow run

In GitHub: **Actions → Update pricing → Run workflow**.
