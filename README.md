# AI Model Pricing App

A static web app to compare and calculate pricing for AI models (Google Gemini, OpenAI, Anthropic, Mistral). Includes pricing tables, prompt-cost and production-cost calculators, benchmarks, pricing history, and export.

## Live pricing (automated)

Pricing is **not manually maintained**. The app uses an automated pipeline so `pricing.json` stays up to date as providers change (e.g. OpenAI GPT-4 updates, new Gemini tiers).

### Pipeline

```
GitHub Action (daily at 06:00 UTC, or manual run)
     ↓
Node script fetches latest from Vizra API
     ↓
Normalizes and writes pricing.json
     ↓
Commits and pushes if changed
     ↓
Deployed site (e.g. GitHub Pages) serves updated pricing on next load
```

- **Workflow:** [`.github/workflows/update-pricing.yml`](.github/workflows/update-pricing.yml) — runs the script, then commits and pushes only when `pricing.json` has changed (`git diff --staged --quiet`), so no empty commits on every run.
- **Script:** [`scripts/update-pricing.js`](scripts/update-pricing.js) — fetches [Vizra API](https://vizra.ai/api/v1/pricing/ai-models), normalizes and deduplicates, validates each model (required fields, no NaN/negatives), then **validates the payload against [`schemas/pricing.schema.json`](schemas/pricing.schema.json)** before writing. This prevents corrupted datasets (wrong shape, extra keys, invalid types). On API failure, validation failure, or schema failure it exits with code 1. See [PRICING_UPDATES.md](PRICING_UPDATES.md#api-failure-handling), [validation](PRICING_UPDATES.md#validation-before-writing), and [JSON schema](PRICING_UPDATES.md#json-schema-validation).

### Run the update locally

From the repo root (install deps first if needed: `npm ci`):

```bash
npm run update-pricing
# or: node scripts/update-pricing.js
```

Then commit and push `pricing.json` if you want, or rely on the daily Action.

### Trigger the workflow manually

In the repo: **Actions → Update pricing → Run workflow**.

---

## What’s in the app

- **Pricing grid** — Gemini, OpenAI, Anthropic, Mistral (input/output/cached per 1M tokens).
- **Calculators** — Prompt cost, context-window, production cost.
- **Benchmarks** — MMLU, code, reasoning, arena-style.
- **Find the right model** — Filter by use case and cost.
- **Pricing history** — Daily snapshots (12:00 AM IST), compare two dates, export CSV/PDF.
- **Refresh from web** — Reload pricing (from `pricing.json` on GitHub Pages, or from Vizra when run locally).

## Code structure

Front-end logic is split into ES modules under `src/` for clearer code and easier debugging:

| File | Role |
|------|------|
| **`src/api.js`** | Fetch layer: `getPricing()` (pricing.json with cache-busting `?t=<timestamp>` so the browser does not show old pricing), `fetchVizraPricing()`, `getPricingJsonUrl()`, `isGitHubPages()`, `fetchWithCors()` for doc search. |
| **`src/pricingService.js`** | Load, cache, normalize: `loadPricing()`, `DEFAULT_PRICING`, `parseVizraResponse()`, `comparePrices()`, `dedupeModelsByName`, history (getHistory, saveToHistory, cleanupHistoryToDailyOnly), cache helpers. |
| **`src/calculator.js`** | Pure logic: cost (`calcCost`, `calcCostOpenAI`, `calcCostForEntry`), context windows, benchmarks, model lists (`getUnifiedCalcModels`, `getAllModels`), recommendations (`getRecommendations`, `scoreModelForUseCase`), doc search helpers, `estimatePromptTokens`. |
| **`src/render.js`** | UI: `renderTables()`, `renderBenchmarkDashboard()`, `renderHistoryList()`, `renderRecommendations()`, toasts, `setLastUpdated`, CSV/PDF export helpers, `formatHistoryDate`. |
| **`src/app.js`** | App entry: state (gemini/openai/anthropic/mistral), `loadPricing`, `refreshFromWeb`, daily capture, history compare, calculator handlers, event wiring; imports the modules above. |

`index.html` loads only `<script type="module" src="src/app.js"></script>`. No inline app logic.

## Hosting

Static only (HTML/CSS/JS). No server or database. See [HOSTING.md](HOSTING.md) for GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.

## Docs

- [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md) — Pricing update architecture and flow.
- [docs/PRICING_SCENARIOS.md](docs/PRICING_SCENARIOS.md) — How pricing is loaded in each scenario (first load, refresh, GitHub vs local).
