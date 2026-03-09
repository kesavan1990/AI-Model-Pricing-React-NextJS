# Price update flow

Pricing is **automated**: a GitHub Action runs daily (and on manual trigger), fetches the latest from the Vizra API, and updates `pricing.json` in the repo. The frontend then loads that file so pricing stays up to date without manual edits.

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

1. **Initial load**: Loads `pricing.json` from the host first, then falls back to localStorage cache, then embedded defaults. On non-GitHub hosts, the app may also call the Vizra API once to fill Anthropic/Mistral if missing.

2. **"Refresh from web"**: On GitHub Pages, reloads `pricing.json`. Elsewhere, fetches the Vizra API and updates all providers.

3. **pricing.json** is updated automatically by the workflow. You can also run the script locally (see below).

## Running the script locally

To refresh `pricing.json` yourself:

```bash
node scripts/update-pricing.js
```

Then commit and push `pricing.json` if needed. Or use **Actions → Update pricing → Run workflow** in GitHub.

## Vizra API

[Vizra.ai](https://vizra.ai/ai-llm-model-pricing) provides a free API with pricing for 284+ AI models. The app uses `https://vizra.ai/api/v1/pricing/ai-models`. Full architecture: [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md).
