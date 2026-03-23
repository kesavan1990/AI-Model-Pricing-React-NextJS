# Pricing update architecture

To avoid API rate limits from the frontend, pricing is updated via the repo instead of calling Vizra from the browser.

## Defined timeline

| Item | Schedule | Details |
|------|----------|---------|
| **Automated run** | **Daily at 06:00 UTC** | `.github/workflows/update-pricing.yml` triggers at `cron: '0 6 * * *'`. |
| **Manual run** | On demand | GitHub Actions → **Update pricing** → **Run workflow**. |
| **Output** | After each run | `public/pricing.json` is updated and committed only if content changed. |
| **Pricing history (server)** | **After Update pricing completes** (`workflow_run` on `main`) **+** daily **12:00 AM IST** (`30 18 * * *` UTC) **+** manual | `.github/workflows/update-pricing-history.yml` appends to `public/pricing-history.json`. Uses **`concurrency: update-pricing-history`** so overlapping runs don’t race. See [Pricing history (daily snapshots)](#pricing-history-daily-snapshots-without-opening-the-app). |

**CI runtime:** The **Update pricing**, **Update pricing history**, and **Deploy to GitHub Pages** workflows all use **Node.js 22** in Actions so `npm ci` / build behavior matches.

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

---

## Where daily updates actually run (important)

**Opening or closing the app on your computer does not update prices.**  
Daily updates happen only when **GitHub Actions** runs the **Update pricing** workflow on **GitHub’s servers** (see `.github/workflows/update-pricing.yml`). That workflow:

1. Checks out your repo on GitHub  
2. Runs `node scripts/update-pricing.js` (fetches Vizra)  
3. Commits `public/pricing.json` **only if the file content changed**  
4. Pushing to `main` triggers **Deploy to GitHub Pages** (if you use that workflow), so the live site can pick up new data  

So for “daily without opening the app” to work, **all** of the following must be true on **GitHub** (not only on your laptop):

---

## Troubleshooting: daily pricing not updating

### 1. GitHub Actions must be enabled

- Repo → **Settings** → **Actions** → **General** → allow Actions (not “Disable actions”).  
- **Forks:** Actions are often **off** until you turn them on. Enable Actions for the fork, then re-save.

### 2. The workflow file must be on the **default branch**

Scheduled runs use the **default branch** (usually `main`). If `.github/workflows/update-pricing.yml` exists only locally or on another branch, **cron will never run**. Push `main` (or your default) so the workflow is on GitHub.

### 3. Check whether the job ran or failed

- Repo → **Actions** → **Update pricing**  
- Open the latest run (scheduled or manual).  
- If it’s **red**: open the failed step — often **API timeout**, **429**, or **schema validation**; the script exits without writing/committing (by design).  
- If it’s **green** but you see **“No pricing changes”**: Vizra returned the same data as the repo; **no new commit** is normal (prices didn’t change).

### 4. “No commit” ≠ broken

The workflow **does not** create an empty commit every day. It only commits when `public/pricing.json` **differs** from the previous version. If prices are unchanged, the site still serves the correct file; the “updated” date in JSON may stay the same until something changes upstream.

### 5. Scheduled runs can be delayed

GitHub may delay `cron` jobs during high load. The schedule is **06:00 UTC** (`0 6 * * *`), not necessarily exactly 06:00:00.

### 6. Deploy / live site

After a successful commit to `main`, **Deploy to GitHub Pages** should run (see `.github/workflows/deploy-pages.yml`). If Pages is set to deploy from **GitHub Actions**, confirm the deploy workflow also succeeds. If you host elsewhere, you must deploy or copy `public/pricing.json` yourself.

### 7. Local folder not connected to GitHub

If this project folder is **not** a clone of the GitHub repo (or you never push), **only your machine** has changes; GitHub will not run anything. Push to the remote that hosts the live app.

### Quick verification

1. **Actions → Update pricing → Run workflow** (manual).  
2. If it succeeds and changes exist, you should see a new commit `chore: update pricing.json from Vizra API`.  
3. If manual works but schedule never appears, re-check **Actions enabled**, **default branch**, and **workflow file on that branch**.

---

## Pricing history (daily snapshots without opening the app)

The **Pricing History** modal merges two sources:

| Source | When it fills | Where it lives |
|--------|----------------|----------------|
| **Server** | Automated; no need to open the site | `public/pricing-history.json` on the deployed host (e.g. GitHub Pages) |
| **Browser** | When someone loads the app in that browser | `localStorage` (per device) |

If you only see history **after** you’ve opened the app, the **server file** is missing, not deployed, or the workflow never committed it. The UI calls `getServerHistory()` in `src/api.js` (fetches `pricing-history.json` with the same base path as `pricing.json` on GitHub Pages). A failed or missing fetch yields `[]`, so you only see **local** snapshots.

### Automated server history

- **Workflow:** [`.github/workflows/update-pricing-history.yml`](../.github/workflows/update-pricing-history.yml) — runs **`workflow_run`** after **[Update pricing](../.github/workflows/update-pricing.yml)** completes on `main` (so the snapshot uses the repo’s current `public/pricing.json`), plus a **daily cron** at **12:00 AM IST** (`30 18 * * *` UTC) as a fallback, and **workflow_dispatch**.
- **Script:** `scripts/update-pricing-history.js` — appends one entry per IST calendar day (deduped), caps at 90 days, writes `public/pricing-history.json`.
- **Deploy:** A push to `main` (including the history commit) should run **Deploy to GitHub Pages** so the live site serves the updated JSON.

### Troubleshooting (no daily rows until I open the app)

1. **GitHub → Actions → Update pricing history** — confirm runs are **green**. Fix failures (e.g. no pricing data, script error).
2. **Repo file** — ensure `public/pricing-history.json` exists on `main` and grows over time (workflow commits `chore: add daily pricing snapshot to history`).
3. **Live URL** — open `https://<user>.github.io/<repo>/pricing-history.json` (e.g. `…/AI-Model-Pricing-React-NextJS/pricing-history.json`). If this **404s** or is empty `[]`, the deployed build doesn’t include the file or Actions aren’t updating it.
4. **Actions on fork** — forks often have Actions disabled; enable them for scheduled and `workflow_run` triggers.
5. **Not the same as local folder** — pushing from your machine is required; GitHub cannot run workflows on code that never reached the remote.

### Manual recovery

- **Actions → Update pricing history → Run workflow** to append today’s snapshot (if not already present), then confirm deploy succeeded.
- Or run locally: `node scripts/update-pricing-history.js`, commit `public/pricing-history.json`, push.
