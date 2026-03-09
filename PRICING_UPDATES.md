# Price update flow

How pricing data is kept up to date without a backend or manual edits.

## Flow

```
Vizra API (https://vizra.ai/api/v1/pricing/ai-models)
  → All LLM pricing (Gemini, OpenAI, Anthropic, Mistral, and more)
        ↓
Scraper script (scripts/update-pricing.mjs)
        ↓
GitHub Action (daily)
        ↓
Update pricing.json (gemini, openai, anthropic, mistral)
        ↓
Commit to repo
        ↓
Frontend loads updated data
```

## Steps

1. **Pricing source: Vizra API**  
   The script fetches [Vizra’s pricing API](https://vizra.ai/api/v1/pricing/ai-models) (`GET https://vizra.ai/api/v1/pricing/ai-models`). It returns 284+ models from 9 providers. We map **Google** → `gemini`, **OpenAI** → `openai`, **Anthropic** → `anthropic`, **Mistral** → `mistral` and write those four arrays to `pricing.json`.

2. **Scraper script**  
   `scripts/update-pricing.mjs` fetches the Vizra API once, normalizes to per-1M token costs (input/output), and writes `pricing.json` with keys: `updated`, `gemini`, `openai`, `anthropic`, `mistral`.

3. **GitHub Action (daily)**  
   `.github/workflows/update-pricing.yml` runs on a schedule and on manual trigger. It runs the script, then commits and pushes `pricing.json` only if it changed.

4. **Frontend**  
   The app loads `pricing.json` and uses all four provider arrays in the pricing grid, calculators (pricing, prompt cost, context window, production cost), benchmarks, and “Find the right model” recommendation. “Refresh from web” fetches the Vizra API only—no other pricing sources.

## Do we need GitHub Actions?

**No.** Pricing comes only from the Vizra API. The app works without it: initial load uses `pricing.json` (or cache/default); "Refresh from web" fetches Vizra from the browser. **Optional:** Keep the workflow to update `pricing.json` daily (fresh data on first visit, fallback if Vizra is down). You can delete `.github/workflows/update-pricing.yml` and rely on "Refresh from web", or run the script locally to refresh the file.

## Running locally (optional)

From the repo root:

```bash
node scripts/update-pricing.mjs
```

This updates `pricing.json` locally. Commit and push yourself, or rely on the GitHub Action to do it on schedule.

## Manual run

In your GitHub repo: **Actions** → **Update pricing** → **Run workflow**.

## Vizra API

[Vizra.ai](https://vizra.ai/ai-llm-model-pricing) provides a free API with real-time pricing for 284+ AI models. Data is updated daily. The frontend and the update script both use `https://vizra.ai/api/v1/pricing/ai-models`; the script runs in GitHub Actions, and “Refresh from web” calls it from the browser when possible.
