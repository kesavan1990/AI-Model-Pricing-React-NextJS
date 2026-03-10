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

- **Workflow:** [`.github/workflows/update-pricing.yml`](.github/workflows/update-pricing.yml) — **(1) Commit only if pricing changed:** `if git diff --staged --quiet -- pricing.json; then echo "No pricing changes"; else git commit ... git push; fi` so daily runs keep history clean.
- **Script:** [`scripts/update-pricing.js`](scripts/update-pricing.js) — **(2) API failure protection:** on timeout, rate limit, empty/malformed response, or no valid data → exits with code 1 and does not write (no bad commits). **(3) Data validation before writing:** missing input/output price, NaN, negative prices → invalid models skipped; then payload validated against [`schemas/pricing.schema.json`](schemas/pricing.schema.json). See [PRICING_UPDATES.md](PRICING_UPDATES.md) and [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md).

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

## Benchmark pipeline (second dataset)

The app loads **two datasets**: `pricing.json` (daily) and `benchmarks.json` (weekly). The UI merges them by **model name** and **provider**. The benchmark script fetches **LMSYS Chatbot Arena** (overall quality / ELO) and **Hugging Face Open LLM Leaderboard** (MMLU, reasoning, etc.), merges with pricing models, and writes `benchmarks.json`. Script: `npm run update-benchmarks`. Workflow: [`.github/workflows/update-benchmarks.yml`](.github/workflows/update-benchmarks.yml) (weekly, Sunday 03:00 UTC). See [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

| Source / Metric | Update frequency |
|------------------|------------------|
| Pricing          | Daily (06:00 UTC) |
| Arena leaderboard| Weekly (Sun 03:00 UTC) |
| HF leaderboard   | Weekly (Sun 03:00 UTC) |

---

## What’s in the app

- **Top navigation bar** — Overview, Model Comparison, Calculators (Pricing, Prompt cost, Context window, Production cost), Benchmarks, Recommend. Jump between sections without scrolling. Production cost simulator is under Calculators. See [Top navigation bar](docs/UI.md#top-navigation-bar).
- **KPI summary cards** — On Home: total models, cheapest (by blended cost), costliest, largest context. See [KPI summary cards](docs/UI.md#kpi-summary-cards).
- **Pricing grid** — Gemini, OpenAI, Anthropic, Mistral (input/output/cached per 1M tokens).
- **Dark mode / light mode** — Toggle in the header (☀️/🌙). Preference is saved and respects system `prefers-color-scheme` on first visit. See [docs/UI.md](docs/UI.md#dark-mode-and-light-mode).
- **Model comparison table** — On the **Compare** tab: single table **Model | Provider | Input | Output | Context** (all models in one view). **Provider filter**: All, Google, OpenAI, Anthropic, Mistral. **Default sort**: grouped by provider with cheapest first in each group. **Sort by**: Default, Input price, Output price, or Context (largest first). **Export**: CSV and PDF of the current table (respects filter and sort). **Cheapest highlight**: row with lowest blended cost has green tint and 🟢 Cheapest badge. See [Model comparison table](docs/UI.md#model-comparison-table).
- **Calculators** — **Cost calculator** (input: Prompt tokens, Output tokens, Model → output: Estimated cost; see [docs/UI.md](docs/UI.md#cost-calculator)), prompt cost from text, context-window check, **production cost simulator** (per request, daily, monthly, per annum; see [Production cost simulator](docs/UI.md#production-cost-simulator)). **Export**: CSV and PDF of the **current** calculator result (Pricing, Prompt cost, Context window, or Production cost, depending on the active sub-tab). **Hover tooltips (?)**: labels in all calculator sections have a (?) with brief explanations (e.g. prompt tokens, output tokens, context window). See [Calculator tooltips](docs/UI.md#calculator-tooltips).
- **Benchmarks** — MMLU, code, reasoning, arena-style. Data from `benchmarks.json` (weekly pipeline); merged with pricing by model. **Export**: CSV and PDF of the full benchmark table. See [Model benchmark dashboard](docs/UI.md#model-benchmark-dashboard) and [Benchmark pipeline](docs/BENCHMARKS.md).
- **Recommend** — Find the right model by use case (e.g. cheap summarization, best quality for code). Considers **all four providers** (Gemini, OpenAI, Anthropic, Mistral). Results are **diversified**: at most 2 models per provider, then top 6 by score, so you see a mix of providers rather than one. Doc search fetches official docs for all four. See [Recommend module](docs/UI.md#recommend-module).
- **Pricing history** — Daily snapshots (12:00 AM IST), compare two dates, export CSV/PDF.
- **Refresh from web** — Reload pricing (from `pricing.json` on GitHub Pages, or from Vizra when run locally).
- **Mobile-friendly layout** — Responsive CSS at `@media (max-width: 768px)`: KPI cards and nav stack, pricing grid and calculators single column, full-width controls. See [Mobile-friendly layout](docs/UI.md#mobile-friendly-layout).

## Code structure

Front-end logic is split into ES modules under `src/` for clearer code and easier debugging:

| File | Role |
|------|------|
| **`src/api.js`** | Fetch layer: `getPricing()` uses `getPricingJsonUrl()` which returns `pricing.json?t=${Date.now()}` so the browser does not cache stale pricing (see [Cache-busting](docs/PRICING_UPDATES.md#cache-busting-in-frontend)); `fetchVizraPricing()`, `getPricingJsonUrl()`, `isGitHubPages()`, `fetchWithCors()` for doc search. |
| **`src/pricingService.js`** | Load, cache, normalize: `loadPricing()`, `DEFAULT_PRICING`, `parseVizraResponse()`, `comparePrices()`, `dedupeModelsByName`, history (getHistory, saveToHistory, cleanupHistoryToDailyOnly), cache helpers. |
| **`src/calculator.js`** | Pure logic: cost (`calcCost`, `calcCostOpenAI`, `calcCostForEntry`), context windows, benchmarks, model lists (`getUnifiedCalcModels`, `getAllModels`), recommendations (`getRecommendations`, `scoreModelForUseCase`), doc search helpers, `estimatePromptTokens`. |
| **`src/render.js`** | UI: `renderTables()`, `updateKPIs()` (KPI cards), `renderModelComparisonTable()` (Model \| Provider \| Input \| Output \| Context; provider filter, sort by Default/Input/Output/Context, group by provider + cheapest first, cheapest-row highlight), `setComparisonProviderFilter()`, `setComparisonSortBy()`, `renderBenchmarkDashboard()`, `renderHistoryList()`, `renderRecommendations()`, toasts, `setLastUpdated`, CSV/PDF export helpers, `formatHistoryDate`. |
| **`src/app.js`** | App entry: state (gemini/openai/anthropic/mistral), `loadPricing`, `refreshFromWeb`, daily capture, history compare, calculator handlers, event wiring; imports the modules above. |

`index.html` contains markup only: it links to **`css/styles.css`** for all styles and to **`src/app.js`** as the app entry (`<script type="module" src="src/app.js"></script>`). No inline CSS or app logic.

## Hosting

Static only (HTML/CSS/JS). No server or database. See [HOSTING.md](HOSTING.md) for GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.

## Docs

- [docs/UI.md](docs/UI.md) — UI overview: **Dark mode / light mode**, **KPI cards** (layout and alignment), **Export toolbar alignment** (right-aligned CSV/PDF across Home, Model comparison, Calculators, Benchmarks), **Tab panel visibility** (Calculators panel flex only when active so Benchmarks/Recommend show correctly), **Favicon** (inline SVG to avoid 404), **Cost calculator**, **Production cost simulator** (formula, per request/annum), **Calculators export** (CSV/PDF of current result), **Model comparison table** (provider filter, grouping, sort by Input/Output/Context, cheapest highlight, export), **Model benchmark dashboard** (benchmark pipeline, update frequency, export CSV/PDF), **Recommend module** (all four providers, provider diversity: at most 2 per provider then top 6; doc search for Gemini, OpenAI, Anthropic, Mistral).
- [docs/BENCHMARKS.md](docs/BENCHMARKS.md) — Benchmark pipeline: `benchmarks.json`, weekly workflow, merge with pricing by model.
- [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md) — Pricing update architecture and flow.
- [docs/PRICING_SCENARIOS.md](docs/PRICING_SCENARIOS.md) — How pricing is loaded in each scenario (first load, refresh, GitHub vs local).
