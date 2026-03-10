# UI overview

## Top navigation bar

Below the header (**AI Model Pricing Dashboard**), a single **top navigation bar** lets users jump between main sections without scrolling. This makes the tool easier to understand and use.

| Link | Destination |
|------|-------------|
| **Overview** | KPI cards and current pricing grid (all providers). |
| **Model Comparison** | Compare tab: filterable/sortable table of all models. |
| **Calculators** | Calculators tab (Pricing, Prompt cost, Context window, **Production cost**). Use the sub-nav inside the tab to open the Production cost simulator or other tools. |
| **Benchmarks** | Benchmarks tab: MMLU, code, reasoning, arena scores. |
| **Recommend** | Find the right model by use case. |

Clicking a link updates the URL hash (e.g. `#pricing`, `#comparison`, `#calc-pricing`, `#benchmarks`, `#recommend`) and shows the corresponding panel. The active link is highlighted. The **Production cost simulator** is not a separate top-level link; it is available inside **Calculators** via the “Production cost” sub-tab. Markup: `<nav class="tab-nav top-nav">` in `index.html`; behavior in `src/app.js` (`switchTab`, `switchCalcSub`, hashchange listener).

**Tab panel visibility** — Only one tab panel is shown at a time. Panels use `.tab-panel { display: none }` and `.tab-panel.active { display: block }` in `css/styles.css`. The **Calculators** panel needs a flex layout for its export toolbar alignment; to avoid that layout overriding visibility, the rule is scoped to the active state: `#tab-calculators.tab-panel.active { display: flex; flex-direction: column }`. Otherwise the Calculators panel would stay visible (due to ID specificity) and **Benchmarks** / **Recommend** would not show correctly.

---

## Dark mode and light mode

The app supports **dark mode** (default) and **light mode**. You can switch between them at any time.

- **Toggle:** Use the **theme button** in the header (next to "Refresh from web"). The icon shows **☀️** in dark mode (click to switch to light) and **🌙** in light mode (click to switch to dark).
- **Persistence:** Your choice is saved in `localStorage` (`ai-pricing-theme`) so it is kept across sessions.
- **First visit:** If you have not chosen a theme yet, the app uses your system preference (`prefers-color-scheme: light`) when available; otherwise it defaults to dark.
- **Implementation:** The theme is applied via `data-theme="light"` on `<html>`. CSS variables and `[data-theme="light"]` overrides in `css/styles.css` define the light palette (e.g. light background, dark text). Theme logic lives in `src/app.js` (`getPreferredTheme`, `setTheme`, `toggleTheme`).

---

## KPI summary cards

On the **Home** tab, at the top of the page (above the pricing grid), four **KPI cards** give quick insights across all service providers:

| Card | Content |
|------|---------|
| **Total Models** | Total number of models across all providers (Gemini, OpenAI, Anthropic, Mistral). |
| **Cheapest** | Model with the lowest blended cost (70% input + 30% output per 1M tokens). Subtitle: **$X.XX / 1M blended** or **Free**. |
| **Costliest** | Model with the highest blended cost per 1M tokens. Subtitle: **$X.XX / 1M blended**. |
| **Largest context** | Model with the largest context window. Subtitle: context size (e.g. **1M**, **128k**). |

The cards use the same data as the pricing tables and update whenever pricing is loaded or refreshed (e.g. after **Refresh from web** or when applying a history snapshot). Implementation: `updateKPIs(data)` in `src/render.js` is called from `renderTables(data)`; markup is in `index.html` (`.kpi-container`, `.kpi-card`); styles in `css/styles.css` (including `[data-theme="light"]` overrides).

**Layout and alignment:** The KPI block uses a CSS Grid so the four cards align from the top-left and use the full content width (no floating in the middle). On large screens they appear in one row (4 equal columns). On viewports ≤ 900px the grid switches to 2 columns; on ≤ 768px the cards stack in a single column for mobile. Styles: `.kpi-container` with `grid-template-columns: repeat(4, 1fr)` and responsive `@media` overrides in `css/styles.css`.

---

## Mobile-friendly layout

Many users open the dashboard on phones. The app uses **responsive CSS** so all main sections work on small screens (e.g. ≤ 768px).

| Area | Mobile behavior (≤ 768px) |
|------|---------------------------|
| **KPI cards** | Single column (`grid-template-columns: 1fr`); cards stack vertically. |
| **Top navigation** | Vertical stack (`flex-direction: column`); full-width links for easier tap targets. |
| **Pricing grid** | One provider card per row. |
| **Calculators** | Calculator cards and calc sub-nav stack; full-width controls. |
| **Model comparison** | Provider filter and Sort by controls stack; table scrolls horizontally if needed. |
| **Header** | Header and actions stack; reduced padding. |
| **Page** | Reduced body and container padding for more usable width. |

All of this is implemented in a single `@media (max-width: 768px)` block in `css/styles.css`, which improves accessibility and usability on phones and small tablets.

---

## Current pricing section

On the **Home** tab, the **Current pricing** section shows API pricing per 1M tokens from Vizra for all four providers. The section header label lists **Gemini · OpenAI · Anthropic · Mistral** so users see that all providers are included. Below the label and Export (CSV/PDF) toolbar, the **pricing grid** displays four provider cards: Google Gemini, OpenAI, Anthropic, and Mistral, each with a searchable model table. Markup: `.pricing-section-header` with `.section-label` and `.pricing-grid` in `index.html`.

**Export toolbar alignment** — All export (CSV/PDF) toolbars in the app are **right-aligned** for consistency: **Current pricing** (Home), **Model comparison**, **Calculators**, and **Benchmarks**. Implementation: Home uses `justify-content: space-between` on `.pricing-section-header`; Model comparison uses `margin-left: auto` on `.comparison-export-toolbar` inside the sort row; Calculators and Benchmarks use `margin-left: auto` on `.calculators-export-toolbar` and `.benchmark-export-toolbar` with their parent containers (`#tab-calculators`, `#section-benchmark`) set to `display: flex; flex-direction: column` in `css/styles.css`.

---

## Calculator tooltips

Across **Calculators** (Pricing, Prompt cost, Context window, Production cost), labels show a **(?)** icon. Hover over the label or the **(?)** to see a short tooltip explaining the term. This helps users who are unfamiliar with:

- **Prompt tokens** — Tokens in the request sent to the model (your input/prompt).
- **Output tokens** — Tokens in the model's response (completion).
- **Context window** — Maximum tokens the model can process in one request (input + output combined).
- **Cached input tokens** — Tokens served from cache at a lower rate (OpenAI); use 0 for others.
- **Users per day** / **Requests per user** — Used in the production cost simulator to scale cost.

Tooltips are implemented with a `title` attribute on a `<span class="calc-tooltip-icon">(?)</span>` next to each label in `index.html`; `.calc-tooltip-icon` is styled in `css/styles.css` (cursor: help, subtle opacity).

---

## Cost calculator

In **Calculators → 💰 Pricing**, the cost calculator estimates API cost for a chosen model (and optionally compares two models).

| | Description |
|---|-------------|
| **Input** | **Prompt tokens** — number of input/prompt tokens. |
| **Input** | **Output tokens** — number of output/completion tokens. |
| **Input** | **Model** — select one model (Gemini, OpenAI, Anthropic, Mistral). Optional: **Compare with** a second model. |
| **Output** | **Estimated cost** — cost in $ for the given prompt + output tokens for the selected model(s). |

OpenAI models can also use **Cached input tokens** (tokens served from cache at a lower rate); use 0 for non-OpenAI. The result shows the estimated cost per request; with "Compare with" you see both models side by side.

---

## Production cost simulator

In **Calculators → 🏭 Production cost**, the production cost simulator estimates API cost across all models for a given usage scenario.

| | Description |
|---|-------------|
| **Input** | **Users per day** — number of daily active users. |
| **Input** | **Requests per user** — number of API requests per user per day. |
| **Input** | **Prompt tokens (per request)** — input tokens per request. |
| **Input** | **Output tokens (per request)** — output tokens per request. |
| **Output** | **Estimated costs** — a table with one row per model and columns: **Per request** (cost for one request), **Daily cost**, **Monthly cost**, **Per annum** (yearly cost). |

**Per-request cost formula:**  
`costPerRequest = (promptTokens / 1_000_000) × inputPrice + (completionTokens / 1_000_000) × outputPrice`  

Here *inputPrice* and *outputPrice* are the model’s per‑1M‑token prices; *promptTokens* and *completionTokens* are the tokens per request. For OpenAI models, cached input tokens use the cached rate where applicable.

Monthly cost is daily cost × 30; per annum is monthly × 12. Use **Simulate** to run the calculation and **Reset** to restore default inputs.

**Calculators export (CSV / PDF)** — In the **Calculators** tab, an **Export current result** toolbar (below the sub-nav) lets you download the result of the **currently active** calculator as CSV or PDF. Which result is exported depends on the active sub-tab: **Pricing** (model + est. cost), **Prompt cost** (model + cost per model), **Context window** (model + context window + result), or **Production cost** (model + per request, daily, monthly, per annum). Run the calculator first; if there is no result, a toast asks you to run it. Implementation: `lastPricingResult`, `lastPromptCostResult`, `lastContextResult`, `lastProductionResult` in `src/app.js` store the last result per tool; `getCurrentCalculatorExport()` reads the URL hash to pick the active sub; `exportCalculatorsCSV()` and `exportCalculatorsPDF()` build the file. Buttons live in `.calculators-export-toolbar` in `index.html`.

---

## Model comparison table

On the **Compare** tab (📋 Compare in the main nav, next to Home, Calculators, Benchmarks, Recommend), a single **Model comparison** table lists all models for quick scanning and comparison.

| Column    | Description |
|-----------|-------------|
| **Model** | Model name (e.g. Gemini 2.5 Flash, GPT-4o). |
| **Provider** | Provider name: Google Gemini, OpenAI, Anthropic, Mistral. |
| **Input** | Input price per 1M tokens (e.g. $0.10 or Free). |
| **Output** | Output price per 1M tokens (e.g. $0.40 or Free). |
| **Context** | Context window size (e.g. 1M, 128k, 200k). From provider/model metadata; "—" if not set. |

Example table shape:

| Model   | Provider      | Input | Output | Context |
|---------|---------------|-------|--------|---------|
| …       | Google Gemini | $0.10 | $0.40  | 1M      |
| …       | OpenAI        | $2.50 | $10.00 | 128k    |
| …       | Anthropic     | …     | …      | 200k    |
| …       | Mistral       | …     | …      | 32k     |

The table is filled by `renderModelComparisonTable(data)` in `src/render.js`, using `getAllModels(data)` from `src/calculator.js` (which includes context from `getContextWindow(providerKey, modelName)`).

**Provider filter** — Above the table, **Filter by provider** lets you narrow the list to one provider: **All**, **Google** (Gemini), **OpenAI**, **Anthropic**, or **Mistral**. Click a button to filter; the table updates to show only that provider’s models. This makes it easier to compare within a provider and improves UX as model count grows. Logic: `setComparisonProviderFilter(provider)` and `renderModelComparisonTable(data, provider)` in `src/render.js`; click handlers in `src/app.js` init.

**Grouping and sort order** — With **Sort by: Default**, results are **grouped by provider** (Google → OpenAI → Anthropic → Mistral), and within each provider group models are sorted by **blended cost ascending** (cheapest first). When **All** is selected you see all providers in that order; when a single provider is selected, that provider’s models are listed with cheapest first.

**Sort by** — A **Sort by** dropdown lets you reorder the (filtered) table: **Default** (group by provider, cheapest first), **Input price (low → high)**, **Output price (low → high)**, or **Context (largest first)**. The chosen sort applies to whatever provider filter is active (All or a single provider). State is kept in `comparisonSortBy` in `src/render.js`; `setComparisonSortBy(sortBy)` and the select’s change handler in `src/app.js` update and re-render the table.

**Cheapest model highlight** — Among the models currently shown (after any provider filter), the row with the **lowest blended cost** (70% input + 30% output per 1M tokens) is highlighted: the row has a green-tinted background and the model name shows a **🟢 Cheapest** badge. In light theme the highlight uses a light green background (`#dcfce7`). This makes the best-value option obvious at a glance.

**Export (CSV / PDF)** — In the Model comparison section, **Export: CSV** and **Export: PDF** let you download the current table (respecting the active provider filter and sort order). CSV columns: Model, Provider, Input per 1M, Output per 1M, Context. PDF uses the same data in a landscape table. Implementation: `exportComparisonCSV()` and `exportComparisonPDF()` in `src/app.js` use `render.getComparisonList(data)` to get the filtered and sorted list; buttons live in `.comparison-export-toolbar` in `index.html`.

---

## Cost vs Performance quadrant chart

On the **Compare** tab, below the Model comparison table, a **Cost vs Performance** scatter chart helps you see value at a glance: cost per request (X) vs a chosen performance metric (Y). All models appear as grey dots; **frontier** models (best performance at each cost level) are colored by provider and connected by a red frontier line. Hover any point for model name, cost per request, and performance score.

**Data** — The chart uses the same merged dataset as the rest of the app: **pricing** (input/output per 1M tokens) and **benchmarks** (Arena, MMLU, Code). Cost per request is computed with fixed token counts: **1,000 prompt tokens** and **500 output tokens** by default, so models are comparable on a “typical” request.

**Frontier** — The **price–performance frontier** is computed by sorting models by cost ascending, then keeping only models that have strictly better performance than all cheaper models. So you see the “best value” options; other models are shown as faint grey dots.

**Controls** — **Performance metric** dropdown: **Arena**, **MMLU**, or **Code** (Y axis). **Filter by provider**: All, Google, OpenAI, Anthropic, Mistral (same idea as the table filter but independent for the chart).

**Implementation** — `src/valueChart.js`: `mergeModels()` builds cost + performance per model from `getAllModels(data)` and `getBenchmarkForModelMerged()`; `computeCostPerRequest()` uses (prompt/1e6)×input + (output/1e6)×output; `computeFrontier()` implements the frontier algorithm; `renderQuadrantChart()` uses **Chart.js** (scatter + line). The chart is rendered or updated when the Compare tab is active and when data or filters change; theme (dark/light) is respected. Markup: `#section-value-chart`, `#value-chart-canvas`, `.value-chart-controls` in `index.html`; styles in `css/styles.css` (`.value-chart-section`, `.value-chart-wrap` with fixed height for responsive chart).

---

## Model benchmark dashboard

On the **Benchmarks** tab, the **Model benchmark dashboard** shows one table with columns: **Model**, **MMLU**, **Code**, **Reasoning**, **Arena**, **Cost** (tier from current pricing). Scores are indicative from published results.

**Benchmark pipeline** — The UI loads both `pricing.json` and `benchmarks.json` and merges by **model name** and **provider**. The benchmark script fetches **LMSYS Chatbot Arena** (arena.lmsys.org; overall quality / ELO) and **Hugging Face Open LLM Leaderboard** (MMLU, reasoning via datasets-server API), merges with pricing models, and writes `benchmarks.json`. When external data is missing, embedded scores from `getBenchmarkForModel()` in `src/calculator.js` are used. See [Benchmark pipeline](docs/BENCHMARKS.md).

**Update frequency** — In line with typical dashboards: **pricing** updates **daily** (06:00 UTC); **benchmarks** update **weekly** (Sunday 03:00 UTC via `.github/workflows/update-benchmarks.yml`). Arena rankings and benchmark scores don’t change as often as prices. The benchmark workflow reads `pricing.json`, assigns scores per model (embedded lookup; replaceable by a real API later), and writes `benchmarks.json`; the frontend fetches both and merges by model.

**Export (CSV / PDF)** — Above the table, **Export: CSV** and **Export: PDF** let you download the full benchmark table. CSV columns: Model, MMLU, Code, Reasoning, Arena, Cost tier. PDF uses the same data in a landscape table. Implementation: `render.getBenchmarkList(data)` in `src/render.js` returns the same rows as the dashboard; `exportBenchmarksCSV()` and `exportBenchmarksPDF()` in `src/app.js` build the files. Buttons live in `.benchmark-export-toolbar` in `index.html`.

---

## Recommend module

The **Recommend** tab helps users find a suitable model by describing their use case (e.g. “cheap summarization”, “best quality for code”, “long documents”). It considers **all four service providers**: **Google Gemini**, **OpenAI**, **Anthropic**, and **Mistral**.

**Model pool** — Recommendations are built from every model in the current pricing data. `getAllModels(data)` in `src/calculator.js` aggregates models from `data.gemini`, `data.openai`, `data.anthropic`, and `data.mistral`, so no provider is excluded. Each model is scored (cost, reasoning, context, performance).

**Provider diversity** — So that results are not dominated by a single provider (e.g. only Gemini), the top list is **diversified**: at most **2 models per provider** are considered, then the combined list is sorted by score and the **top 6** are returned. So you typically see models from two or more providers (Gemini, OpenAI, Anthropic, Mistral). The doc-snippet pass does not re-sort by “has snippet,” so this diversity is preserved.

**Documentation search** — When the user clicks **Get recommendation**, the app also fetches official documentation pages and searches them for the user’s keywords. Doc search runs for **all four providers**:

| Provider   | Documentation URL(s) used |
|------------|----------------------------|
| Google Gemini | `ai.google.dev` (pricing + models) |
| OpenAI    | `developers.openai.com` + `platform.openai.com` (pricing + models) |
| Anthropic  | `docs.anthropic.com` (model cards) |
| Mistral    | `docs.mistral.ai` (models) |

Matching snippets from any of these sources are attached to the recommended models when available. The note under the results says: “Results informed by official Gemini, OpenAI, Anthropic, and Mistral documentation.” Implementation: `fetchDocsAndSearch()` in `src/app.js` fetches all four in parallel, runs `calc.searchDocContent()` per provider with that provider’s model names, and merges matches into a single doc map keyed by `providerKey:modelName`. `runRecommendation()` then enriches each recommendation with doc snippets and passes the “fromDocs” flag to `render.renderRecommendations()` so the note is shown when any provider’s docs were searched.

---

## Favicon

The app provides a **favicon** so the browser does not request `/favicon.ico` (which would 404 on static hosts like GitHub Pages). The favicon is an inline SVG (🤖) in the document head via a `data:` URL: `<link rel="icon" href="data:image/svg+xml,..." type="image/svg+xml">` in `index.html`. No separate favicon file is required.
