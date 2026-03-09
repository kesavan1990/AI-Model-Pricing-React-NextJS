# Pricing update architecture

To avoid API rate limits from the frontend, pricing is updated via the repo instead of calling Vizra from the browser.

## Flow

```
GitHub Action (scheduled / manual)
   ↓
Fetches Vizra API → scripts/update-pricing.js
   ↓
Writes pricing.json (normalized schema)
   ↓
Frontend loads pricing.json (no direct Vizra call on page load)
```

## How it works

- **`.github/workflows/update-pricing.yml`** runs daily (06:00 UTC) and on manual trigger. It runs `node scripts/update-pricing.js`, which fetches from Vizra, normalizes provider names and units (same logic as the frontend), and writes `pricing.json` at the repo root.
- **Commit only if changed:** The workflow commits and pushes only when `pricing.json` has actually changed. It uses `git add pricing.json` then `git diff --staged --quiet -- pricing.json`; if there is no diff (same content as HEAD), it skips commit and push and logs "No pricing changes". This avoids empty commits on every run.
- **Frontend** (`src/app.js` → `src/pricingService.js`, `src/api.js`) loads `pricing.json` first, then falls back to localStorage cache, then embedded defaults. Optional "Refresh from web" still calls Vizra once per click (user-initiated). See [README](../README.md#code-structure) for the `src/` module layout.

## API failure handling

The update script (`scripts/update-pricing.js`) guards against bad data so the workflow does not commit a broken `pricing.json`:

| Condition | Behavior |
|-----------|----------|
| **API timeout** | Fetch aborts after 30s; script logs "Pricing fetch failed: API timeout" and exits with code 1. |
| **Rate limit (429)** | Script treats non-OK status as error, logs rate limit, exits 1. No commit. |
| **Other non-OK status** | Logs "API error: &lt;status&gt;" and exits 1. |
| **Empty response** | If the response body is empty, throws and exits 1. |
| **Malformed JSON** | If `JSON.parse` fails, logs "Malformed JSON from API" and exits 1. |
| **No usable data** | If parsing yields no Gemini/OpenAI models, logs "No pricing data in response" and exits 1. |

On any of these failures the script exits with `process.exit(1)`, so the workflow step fails and the "Commit and push if changed" step is never run — no bad `pricing.json` is committed.

## Local run

From the repo root:

```bash
node scripts/update-pricing.js
```

This overwrites `pricing.json` with the current Vizra response. On API failure the script exits with code 1 and does not write the file.

## Manual workflow run

In GitHub: **Actions → Update pricing → Run workflow**.
