# AI Model Pricing App

A static web app to compare and calculate pricing for AI models (Google Gemini, OpenAI, Anthropic, Mistral). Includes KPI cards, pricing grid, model comparison table, cost-vs-performance chart, calculators (pricing, prompt cost, context window, production cost), benchmarks, recommend-by-use-case, pricing history, and export (CSV/PDF).

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
- **Script:** [`scripts/update-pricing.js`](scripts/update-pricing.js) — **(2) API failure protection:** on timeout, rate limit, empty/malformed response, or no valid data → exits with code 1 and does not write (no bad commits). **(3) Data validation before writing:** missing input/output price, NaN, negative prices → invalid models skipped; then payload validated against [`schemas/pricing.schema.json`](schemas/pricing.schema.json). **[`scripts/update-pricing.mjs`](scripts/update-pricing.mjs)** (if used) validates that the API returned at least one model before writing; **empty dataset → throw, do not overwrite.** See [PRICING_UPDATES.md](PRICING_UPDATES.md) and [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md).

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

The app loads **two datasets**: `pricing.json` (daily) and `benchmarks.json` (weekly). The UI merges them by **normalized model name** and **provider**. The benchmark script fetches **LMSYS Chatbot Arena** (overall quality / ELO) and **Hugging Face Open LLM Leaderboard** (MMLU, reasoning, etc.), merges with pricing models, and writes `benchmarks.json`. Script: `npm run update-benchmarks`. Workflow: [`.github/workflows/update-benchmarks.yml`](.github/workflows/update-benchmarks.yml) (weekly, Sunday 03:00 UTC). **Empty-dataset protection:** the script does not overwrite `benchmarks.json` if the built benchmark list is empty (exits with code 1). See [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

| Source / Metric | Update frequency |
|------------------|------------------|
| Pricing          | Daily (06:00 UTC) |
| Arena leaderboard| Weekly (Sun 03:00 UTC) |
| HF leaderboard   | Weekly (Sun 03:00 UTC) |

---

### Architecture (data + frontend)

```
External sources
      ├── Pricing API (Vizra) → update-pricing.js → pricing.json
      └── Benchmark sources (Arena, HF) → update-benchmarks.js → benchmarks.json

Frontend (index.html + src/)
   fetchPricingData() (Vizra API → pricing.json fallback) + benchmarks.json
   → mergeModels() (pricing + benchmarks by model/provider)
   → computeCostPerRequest() (e.g. 1k prompt + 500 output tokens)
   → computeFrontier() (best performance at each cost level)
   → renderQuadrantChart() (scatter: all models grey, frontier colored)
```

The **Cost vs Performance** quadrant is in the **Value Analysis** section and uses this merged dataset so you see value (cost per request vs Arena/MMLU/Code) in one view.

---

## What's in the app

- **Dashboard layout** — Header (**AI Model Pricing Intelligence Dashboard**), **sidebar navigation** (Overview, Models, Value Analysis, Calculators, Benchmarks, Pricing History), and main content area. **One section at a time:** clicking a sidebar link shows only that module (others are hidden). At ≤ 900px the sidebar becomes a horizontal nav. See [Dashboard layout and sidebar navigation](docs/UI.md#dashboard-layout-and-sidebar-navigation).
- **KPI summary cards** — On Home: total models, cheapest (by blended cost), costliest, largest context. See [KPI summary cards](docs/UI.md#kpi-summary-cards).
- **Pricing grid** — Gemini, OpenAI, Anthropic, Mistral with **Context / tier** column. Where tiered pricing exists (e.g. ≤200K vs >200K), **all tiers** are shown (one row per tier). Data from `pricing.json` + `src/data/pricingTiersOverlay.js`. Retired/deprecated models are excluded from all views.
- **Dark mode / light mode** — Toggle in the header (☀️/🌙). Preference is saved and respects system `prefers-color-scheme` on first visit. See [docs/UI.md](docs/UI.md#dark-mode-and-light-mode).
- **Model comparison table** — In the **Models** section: single table **Model | Provider | Input | Output | Context** (all models in one view). **Provider filter**: All, Google, OpenAI, Anthropic, Mistral. **Default sort**: grouped by provider with cheapest first in each group. **Sort by**: Default, Input price, Output price, or Context (largest first). **Export**: CSV and PDF of the current table (respects filter and sort). **Cheapest highlight**: row with lowest blended cost has green tint and 🟢 Cheapest badge. See [Model comparison table](docs/UI.md#model-comparison-table).
- **Cost vs Performance quadrant** — In the **Value Analysis** section: scatter chart of **cost per request** (1k prompt + 500 output tokens) vs **performance** (Arena, MMLU, or Code). All models = grey dots; **frontier** models (best value at each cost) = colored by provider. **Performance metric** selector and **provider filter** for the chart. Chart colors are theme-aware (readable in both light and dark mode). **Frontier tooltips:** (?) in the section subtitle; a dedicated “Colored points = Frontier (best value) (?)” line above the chart with a custom CSS hover tooltip; and hover on frontier points for per-model details. Tooltips explain both what frontier is and how it is calculated (sort by cost low to high, then keep only models with strictly better performance than every cheaper model). See [Cost vs Performance quadrant chart](docs/UI.md#cost-vs-performance-quadrant-chart).
- **Calculators** — **Cost calculator** (input: Prompt tokens, Output tokens, Model → output: Estimated cost; see [docs/UI.md](docs/UI.md#cost-calculator)), prompt cost from text, context-window check, **production cost simulator** (per request, daily, monthly, per annum; see [Production cost simulator](docs/UI.md#production-cost-simulator)). A **simulator note** states: *Cost estimates assume flat token pricing; tiered discounts and prompt caching are not included.* **Export**: CSV and PDF of the **current** calculator result (Pricing, Prompt cost, Context window, or Production cost, depending on the active sub-tab). **Hover tooltips (?)**: labels in all calculator sections have a (?) with brief explanations (e.g. prompt tokens, output tokens, context window). See [Calculator tooltips](docs/UI.md#calculator-tooltips).
- **Benchmarks** — MMLU, code, reasoning, arena-style. Data from `benchmarks.json` (weekly pipeline); merged with pricing by model. **Export**: CSV and PDF of the full benchmark table. See [Model benchmark dashboard](docs/UI.md#model-benchmark-dashboard) and [Benchmark pipeline](docs/BENCHMARKS.md).
- **Recommend** — Find the right model by use case (e.g. cheap summarization, best quality for code). Considers **all four providers** (Gemini, OpenAI, Anthropic, Mistral). Results are **diversified**: at most 2 models per provider, then top 6 by score, so you see a mix of providers rather than one. Doc search fetches official docs for all four. See [Recommend module](docs/UI.md#recommend-module).
- **Pricing history** — Open via **📜 History** in the header. Modal shows daily snapshots (12:00 AM IST), **compare two dates** to see price changes, and **Export CSV/PDF**. After **Refresh from web**, a **Recent price changes** summary may appear in the footer. See [Pricing history](docs/UI.md#pricing-history).
- **Refresh from web** — Reload pricing (from `pricing.json` on GitHub Pages, or from Vizra when run locally).
- **Data status (footer)** — Footer shows **Pricing: [date]; Benchmarks: [date]** with timestamps formatted to include the **exact time zone** (e.g. UTC, IST); if the benchmark pipeline fails, the benchmarks date may be older or "—". See [Data status (footer)](docs/UI.md#data-status-footer).
- **Mobile-friendly layout** — Responsive CSS at `@media (max-width: 768px)`: KPI cards and nav stack, pricing grid and calculators single column, full-width controls; Cost vs Performance chart has a responsive container and reduced height on small screens. See [Mobile-friendly layout](docs/UI.md#mobile-friendly-layout).

## Code structure

Front-end logic is split into ES modules under `src/` for clearer code and easier debugging:

| File | Role |
|------|------|
| **`src/api/pricingService.js`** | **Pricing API service:** `fetchPricingData()` tries Vizra API (`https://vizra.ai/api/llm-model-pricing`), then falls back to `pricing.json`. Isolates API logic from UI for easier debugging and API changes. See [docs/API.md](docs/API.md). |
| **`src/utils/cacheManager.js`** | **Cache manager:** `getCachedPricing()` / `setCachedPricing(data)` with 12-hour TTL. Centralizes pricing cache in one place and reduces API calls. See [docs/CACHE.md](docs/CACHE.md). |
| **`src/data/providerByModel.js`** | **Canonical provider by name:** `getProviderByModelName(name)` returns `gemini` \| `openai` \| `anthropic` \| `mistral` \| null. Used by `app.js` in `reassignByCanonicalProvider()` so every model appears under the correct provider. |
| **`src/data/allowedModels.js`** | **Official-only allowlist:** `isAllowedModel(providerKey, modelName)`. Only models listed as available on each provider’s official page are shown. Used by `app.js` (`filterToAllowedModels`) and `calculator.js` (`getAllModels`, `getUnifiedCalcModels`). See [docs/ALLOWED_MODELS.md](docs/ALLOWED_MODELS.md). |
| **`src/utils/retiredModels.js`** | **Retired model detection:** `isRetiredGeminiModel`, `isRetiredOpenAIModel`, `isRetiredAnthropicModel`, `isRetiredMistralModel`, and `isRetired(providerKey, name)`. Used with the allowlist so only official-available, non-retired models appear in **Overview, Models, Value Analysis, Calculators, Benchmarks, and Recommend**. |
| **`src/data/pricingTiersOverlay.js`** | **Tiered pricing overlay:** `PRICING_TIERS_OVERLAY` (context-tier prices per model, e.g. ≤200K vs >200K). `mergeTiersIntoPayload(payload)` merges overlay into loaded pricing so the UI shows all tiers. |
| **`src/api.js`** | Other fetch layer: `getPricing()` (pricing.json with cache-busting, used for file-only fallbacks), `getBenchmarks()`, `getPricingJsonUrl()`, `isGitHubPages()`, `fetchWithCors()` for doc search. |
| **`src/pricingService.js`** | Load, cache, normalize: `loadPricingFromApi(fetchPricingData)` (primary), `loadPricing(getPricing)`, `getCachedPricingPayload()` (uses cache manager), `normalizeFetchedPricing()`, `DEFAULT_PRICING`, `parseVizraResponse()`, `comparePrices()`, history. |
| **`src/calculator.js`** | Pure logic: cost (`calcCost`, `calcCostOpenAI`, `calcCostForEntry`), context windows, benchmarks, model lists (`getUnifiedCalcModels`, `getAllModels` — both require allowed + non-retired via `data/allowedModels.js` and `utils/retiredModels.js`), recommendations (`getRecommendations`, `scoreModelForUseCase`), doc search helpers, `estimatePromptTokens`. |
| **`src/valueChart.js`** | Cost vs Performance quadrant: `mergeModels()` (pricing + benchmarks), `computeCostPerRequest()`, `computeFrontier()`, `renderQuadrantChart()` (Chart.js scatter), `updateValueChart()`. |
| **`src/render.js`** | UI: `renderTables()`, `updateKPIs()` (KPI cards), `renderModelComparisonTable()`, `renderBenchmarkDashboard()`, `appendRowsWithFragment()` (DocumentFragment for table rows — fewer reflows, faster rendering for large lists), `renderHistoryList()`, `renderRecommendations()`, toasts, `setLastUpdated`, CSV/PDF export helpers, `formatHistoryDate`. See [Table rendering (DocumentFragment)](docs/UI.md#current-pricing-section). |
| **`src/app.js`** | App entry: state (gemini/openai/anthropic/mistral), `loadPricing`, `refreshFromWeb`, daily capture, history compare, calculator handlers, event wiring; imports the modules above. |

`index.html` contains markup only: it links to **`css/styles.css`** for all styles and to **`src/app.js`** as the app entry (`<script type="module" src="src/app.js"></script>`). No inline CSS or app logic.

## Hosting

Static only (HTML/CSS/JS). No server or database. See [HOSTING.md](HOSTING.md) for GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.

## Docs

- [docs/UI.md](docs/UI.md) — UI overview: **Dashboard layout and sidebar navigation**; **retired models excluded** in Overview, Models, Value Analysis, Calculators, Benchmarks, and Recommend (see `src/utils/retiredModels.js` and Current pricing section). (header, sidebar, scrollable main; section order: Overview → Value Analysis → Recommend → Models → Calculators → Benchmarks; responsive sidebar at ≤ 900px), **Dark mode / light mode**, **KPI cards**, **Current pricing** (grid, search, export), **Calculator tooltips** (?), **Cost calculator** (Pricing), **Prompt cost estimator** (paste/import, token count, cost per model), **Context window calculator**, **Production cost simulator** (formula, per request/annum; **simulator note**: flat token pricing, no tiered discounts or prompt caching), **Calculators export** (CSV/PDF of current result), **Export toolbar alignment** (right-aligned), **Model comparison table** (provider filter, sort, cheapest highlight, export), **Cost vs Performance quadrant** (scatter, fixed baseline 1k/500 tokens, frontier, Arena/MMLU/Code, provider filter; theme-aware colors; mobile/responsive; lazy rendering and filtering for large datasets; frontier tooltips: subtitle (?), legend-hint (?) native title, point hover), **Model benchmark dashboard** (pipeline, export), **Recommend module** (all four providers, diversity, doc search), **Pricing history** (modal, compare two dates, export; recent price changes), **Data status (footer)** (Pricing and Benchmarks last-updated dates), **Favicon** (inline SVG).
- [docs/API.md](docs/API.md) — **Pricing API service:** `fetchPricingData()`, Vizra → pricing.json fallback, how the UI uses it, and how to change the API.
- [docs/CACHE.md](docs/CACHE.md) — **Cache manager:** `getCachedPricing()` / `setCachedPricing()`, 12-hour TTL, centralizes cache logic and reduces API calls.
- [docs/BENCHMARKS.md](docs/BENCHMARKS.md) — Benchmark pipeline: `benchmarks.json`, weekly workflow, merge with pricing by model.
- [docs/ALLOWED_MODELS.md](docs/ALLOWED_MODELS.md) — Only models listed as available on each provider’s official page are shown (Overview, Models, Value Analysis, Calculators, Benchmarks, Recommend). Implementation: `src/data/allowedModels.js`, `filterToAllowedModels`, `isAllowedModel`.
- [docs/RETIRED_MODELS.md](docs/RETIRED_MODELS.md) — Retired/deprecated models excluded; used together with allowlist. Implementation (`utils/retiredModels.js`, `filterRetiredModels`, `getAllModels`, `getUnifiedCalcModels`). Lists cross-checked with each provider’s official deprecation pages.
- [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md) — Pricing update architecture and flow.
- [docs/PRICING_SCENARIOS.md](docs/PRICING_SCENARIOS.md) — How pricing is loaded in each scenario (first load, refresh, GitHub vs local).
