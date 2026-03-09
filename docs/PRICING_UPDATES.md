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
- **Frontend** (`src/app.js` → `src/pricingService.js`, `src/api.js`) loads `pricing.json` first, then falls back to localStorage cache, then embedded defaults. Optional "Refresh from web" still calls Vizra once per click (user-initiated). See [README](../README.md#code-structure) for the `src/` module layout.

## Local run

From the repo root:

```bash
node scripts/update-pricing.js
```

This overwrites `pricing.json` with the current Vizra response.

## Manual workflow run

In GitHub: **Actions → Update pricing → Run workflow**.
