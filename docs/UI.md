# UI overview

## Dashboard layout and sidebar navigation

The app uses a **structured dashboard layout** (similar to Vercel, Datadog, and AI analytics dashboards): a header, a **sidebar navigation**, and a main content area. **Only one section is visible at a time**; clicking a sidebar link shows that module and hides the others, keeping the page focused and avoiding long scrolling. The header shows **AI Model Pricing Intelligence Dashboard** with theme toggle, Refresh, and Pricing History.

| Link | Destination |
|------|-------------|
| **Overview** | KPI cards and current pricing grid (all providers). |
| **Models** | Filterable/sortable comparison table of all models. |
| **Value Analysis** | Cost vs Performance scatter chart. |
| **Calculators** | Pricing, Prompt cost, Context window, Production cost (sub-nav). |
| **Benchmarks** | MMLU, code, reasoning, arena scores. |
| **Pricing History** | Opens the history modal. |

Clicking a sidebar link **displays only that section** (all others are hidden) and updates the URL hash (`#overview`, `#models`, `#value-analysis`, `#calculators`, `#benchmarks`). The active sidebar link is highlighted. **Pricing History** opens the modal. Sections available: Overview, Value Analysis, Recommended Models, Models, Calculators, Benchmarks. Markup: `.dashboard-sidebar`, `.sidebar-nav`, `.sidebar-link`; behavior: `showSection`, `setActiveSidebarLink`. The Production cost simulator is in the Calculators section via the Production cost sub-tab.

**Responsive** — At viewport ≤ 900px the sidebar moves to the top and becomes a horizontal nav; links wrap on small screens.

---

## Dark mode and light mode

The app supports **dark mode** (default) and **light mode**. You can switch between them at any time.

- **Toggle:** Use the **theme button** in the header (next to "Refresh from web"). The icon shows **☀️** in dark mode (click to switch to light) and **🌙** in light mode (click to switch to dark).
- **Persistence:** Your choice is saved in `localStorage` (`ai-pricing-theme`) so it is kept across sessions.
- **First visit:** If you have not chosen a theme yet, the app uses your system preference (`prefers-color-scheme: light`) when available; otherwise it defaults to dark.
- **Implementation:** The theme is applied via `data-theme="light"` on `<html>`. CSS variables and `[data-theme="light"]` overrides in `css/styles.css` define the light palette (e.g. light background, dark text). Theme logic lives in `src/app.js` (`getPreferredTheme`, `setTheme`, `toggleTheme`).

---

## KPI summary cards

In the **Overview** section, at the top of the main area (above the pricing grid), four **KPI cards** give quick insights across all service providers:

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

| Area | Mobile behavior |
|------|---------------------------|
| **Sidebar** | At ≤ 900px: moves to top, horizontal nav; links wrap. |
| **KPI cards** | At ≤ 768px: single column; cards stack vertically. |
| **Top navigation** | (Legacy; now sidebar) Sidebar becomes horizontal at ≤ 900px. |
| **Pricing grid** | One provider card per row. |
| **Calculators** | Calculator cards and calc sub-nav stack; full-width controls. |
| **Model comparison** | Provider filter and Sort by controls stack; table scrolls horizontally if needed. |
| **Header** | Header and actions stack; reduced padding. |
| **Page** | Reduced body and container padding for more usable width. |

All of this is implemented in a single `@media (max-width: 768px)` block in `css/styles.css`, which improves accessibility and usability on phones and small tablets.

---

## Current pricing section

In the **Overview** section, the **Current pricing** block shows API pricing per 1M tokens from Vizra for all four providers. The section header label lists **Gemini · OpenAI · Anthropic · Mistral** so users see that all providers are included. Below the label and Export (CSV/PDF) toolbar, the **pricing grid** displays four provider cards: Google Gemini, OpenAI, Anthropic, and Mistral, each with a searchable model table. Markup: `.pricing-section-header` with `.section-label` and `.pricing-grid` in `index.html`.

**Context/tier pricing** — When tiered pricing is available (e.g. ≤200K vs >200K tokens), the app shows **all tiers** in the pricing grid: each model has a **Context / tier** column and one row per tier (e.g. "≤200K tokens", ">200K tokens"). Tier data comes from `src/data/pricingTiersOverlay.js` (merged into the payload after load). The **Model comparison** table and **Cost vs Performance** chart also expand by tier (one row or point per tier). Exports (CSV/PDF) include the context tier column.

**Provider-specific pricing and retired models** — Each provider card shows a short note (`.provider-pricing-note`). **Retired/deprecated models are excluded** from the app: they are filtered out in `setData()` (see `filterRetiredModels()` in `src/app.js`) using `isRetiredGeminiModel()`, `isRetiredOpenAIModel()`, `isRetiredAnthropicModel()`, and `isRetiredMistralModel()` in `src/render.js`. Excluded examples: Gemini 1.0, `gemini-pro`; OpenAI `gpt-4-0314`, `gpt-3.5-turbo-instruct`, `babbage-002`; Anthropic Claude 3 Opus, 3.5 Haiku, 3.7 Sonnet; Mistral `mistral-large`, `mistral-small`, `open-mistral-nemo`. They do not appear in the pricing grid, model comparison, calculators, benchmarks, or value chart.

**Export toolbar alignment** — All export (CSV/PDF) toolbars in the app are **right-aligned** for consistency: **Current pricing** (Overview), **Model comparison** (Models section), **Calculators**, and **Benchmarks**. Implementation: Overview uses `justify-content: space-between` on `.pricing-section-header`; Model comparison uses `margin-left: auto` on `.comparison-export-toolbar`; Calculators and Benchmarks use `margin-left: auto` on `.calculators-export-toolbar` and `.benchmark-export-toolbar` with parent `#calculators` and `#section-benchmark` set to `display: flex; flex-direction: column` in `css/styles.css`.

**Table rendering (DocumentFragment)** — To keep rendering fast and avoid multiple DOM updates, table rows are appended via a **DocumentFragment**. Instead of appending each row to the `tbody` in a loop (which would trigger a reflow per row), the app builds an array of row HTML strings, parses them into a temporary container, moves all `<tr>` nodes into a fragment, and appends the fragment to the `tbody` in a single operation. Benefits: fewer reflows, faster rendering, and better performance for large model lists. Used in **Current pricing** (four provider tables), **Model comparison** table, and **Benchmarks** dashboard. Implementation: `appendRowsWithFragment(tbody, rowHtmlArray)` in `src/render.js`; used by `renderTables()`, `renderModelComparisonTable()`, and `renderBenchmarkDashboard()`.

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

## Prompt cost estimator

In **Calculators → 📝 Prompt cost**, you can paste text (or **Import file**: TXT, CSV, PDF, MD, JSON) to get an estimated **prompt token count** (using gpt-tokenizer / cl100k_base when available, else ≈4 chars per token). You set **Estimated output tokens**; then **Estimate cost** shows cost per model across Gemini, OpenAI, Anthropic, and Mistral (embedding-only models excluded). Use **Reset** to clear. The result can be exported via the Calculators export toolbar when this sub-tab is active.

---

## Context window calculator

In **Calculators → 📐 Context window**, you enter **Prompt tokens** and **Output tokens**; **Check context** shows which models can fit that input+output within their context limit (and which cannot). The result table lists each model with its context window and whether your prompt + output fits. Use **Reset** to restore defaults. The result can be exported via the Calculators export toolbar when this sub-tab is active.

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

**Simulator note** — A short note appears above the simulator form: *"Cost estimates assume flat token pricing. Tiered discounts and prompt caching are not included."* This avoids misinterpretation: the simulator does not apply volume discounts or cached-input pricing (e.g. OpenAI cached tokens) in the table; it uses the same per‑1M input/output rates as the rest of the app. Markup: `<p class="simulator-note">` in `index.html`; styles in `css/styles.css` (`.simulator-note`).

**Calculators export (CSV / PDF)** — In the **Calculators** tab, an **Export current result** toolbar (below the sub-nav) lets you download the result of the **currently active** calculator as CSV or PDF. Which result is exported depends on the active sub-tab: **Pricing** (model + est. cost), **Prompt cost** (model + cost per model), **Context window** (model + context window + result), or **Production cost** (model + per request, daily, monthly, per annum). Run the calculator first; if there is no result, a toast asks you to run it. Implementation: `lastPricingResult`, `lastPromptCostResult`, `lastContextResult`, `lastProductionResult` in `src/app.js` store the last result per tool; `getCurrentCalculatorExport()` reads the URL hash to pick the active sub; `exportCalculatorsCSV()` and `exportCalculatorsPDF()` build the file. Buttons live in `.calculators-export-toolbar` in `index.html`.

---

## Model comparison table

In the **Models** section (via sidebar → Models), a single **Model comparison** table lists all models for quick scanning and comparison.

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

In the **Value Analysis** section, a **Cost vs Performance** scatter chart helps you see value at a glance: cost per request (X) vs a chosen performance metric (Y). All models appear as grey dots; **frontier** models (best performance at each cost level) are colored by provider. Hover any point for model name, cost per request, and performance score.

**Data** — The chart uses the same merged dataset as the rest of the app: **pricing** (input/output per 1M tokens) and **benchmarks** (Arena, MMLU, Code). Cost per request is computed with a **fixed baseline**: **1,000 prompt tokens** and **500 output tokens**. This baseline is not affected by the calculator or production-cost simulator; the chart stays consistent regardless of token values entered elsewhere.

**Frontier** — The **price–performance frontier** is computed by sorting models by cost ascending, then keeping only models that have strictly better performance than all cheaper models. So you see the “best value” options; other models are shown as faint grey dots.

**Controls** — **Performance metric** dropdown: **Arena**, **MMLU**, or **Code** (Y axis). **Filter by provider**: All, Google, OpenAI, Anthropic, Mistral (same idea as the table filter but independent for the chart).

**Frontier tooltips** — Three places explain what “frontier” means and **how it is calculated**. (1) **Section subtitle:** A **(?)** with a `title` that states what frontier is and the calculation: sort models by cost (low to high), then keep only those with strictly better performance than every cheaper model. (2) **Legend hint above the chart:** The line “Colored points = **Frontier (best value)** (?)” uses the **native browser `title` tooltip** with What (models with best performance at their cost) and How (sort by cost low to high, then keep models with strictly better performance than every cheaper model). Markup: `<span class="value-chart-frontier-tooltip" title="...">(?)</span>`. (3) **Chart point tooltip:** Hovering a frontier point shows model name, provider, cost, performance, and “✓ Frontier — best value at this cost (no cheaper model has higher performance).” Implementation: tooltip callback in `renderQuadrantChart()` in `src/valueChart.js` adds the frontier explanation when `onFrontier` is true.

**Mobile and responsive behavior** — The chart section uses a responsive container: `max-width: 100%`, `overflow-x: auto`, and `min-width: 0` on the chart wrap so the scatter does not overflow on small screens. At viewport ≤ 768px the chart height is 320px and the wrap uses `max-width: 100%`; at ≤ 480px height is 280px. This keeps the chart usable on phones without horizontal page overflow.

**Performance (large datasets)** — When the number of models grows (e.g. 40 → 100), the chart uses **lazy rendering** (`requestAnimationFrame` in `updateValueChart()`) so heavy work runs in the next frame and does not block the main thread. **Provider filter** and **performance metric** selector reduce the number of points drawn. For more than 50 points, the "all models" layer uses a smaller point radius and no border to reduce draw cost; frontier points are unchanged. Implementation: `src/valueChart.js` (`updateValueChart`, `renderQuadrantChart`).

**Chart colors (light and dark theme)** — The chart uses theme-aware colors so it stays readable in both modes. **Dark theme:** axis and legend text `#e2e8f0`; grid `rgba(255,255,255,0.12)`; “All models” dots medium light grey (fill/border) so they remain visible on dark background; frontier points colored by provider (blue / emerald / orange / violet) at 0.95 opacity. **Light theme:** axis and legend text `#334155`; grid `rgba(0,0,0,0.1)`; “All models” dots medium grey; same provider colors. When you toggle the app theme, the chart is redrawn with the matching palette (see `setTheme()` → `updateValueChartIfVisible()` in `src/app.js`).

**Implementation** — `src/valueChart.js`: `mergeModels()` builds cost + performance per model from `getAllModels(data)` and `getBenchmarkForModelMerged()`; `computeCostPerRequest()` uses (prompt/1e6)×input + (output/1e6)×output with the fixed baseline (1k prompt, 500 output); `computeFrontier()` sorts by cost then performance (same-cost edge case); `renderQuadrantChart()` uses **Chart.js** (scatter: all models + frontier points). The chart is rendered or updated when data or filters change (chart is in the Value Analysis section); theme (dark/light) is respected. Markup: `#section-value-chart`, `#value-chart-canvas`, `.value-chart-controls`, `.value-chart-legend-hint`, `.value-chart-frontier-tooltip` in `index.html`; styles in `css/styles.css` (`.value-chart-section` with overflow-x and max-width, `.value-chart-wrap` with fixed height and responsive overrides at 768px and 480px).

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

## Pricing history

The **📜 History** button in the header opens a **Pricing history** modal. Daily snapshots (12:00 AM IST) are saved when you first open the app each day; one snapshot per day is kept. History is stored in this browser only (separate for local file vs GitHub Pages). In the modal you can **compare two dates**: select two snapshots and see which models had price changes (drops and increases) between those dates. **Export CSV** and **Export PDF** download the full history list. After you click **Refresh from web**, a **Recent price changes** summary may appear in the footer showing which provider/model/field dropped or increased compared with the previous snapshot.

---

## Data status (footer)

The **footer** shows when each dataset was last updated: **Pricing: [date]; Benchmarks: [date]**. Timestamps are formatted with an **exact time zone** (e.g. **UTC**, **GMT**, **IST**) so you can see the precise time; raw ISO strings like `2026-03-10T15:41:13.242Z` are converted to a readable form such as *"Mar 10, 2026, 3:41:13 PM UTC (from site)"*. If the benchmark pipeline fails or runs less often than pricing, the benchmarks date may be older than the pricing date; seeing both helps you interpret partial or stale data. When benchmarks fail to load, the benchmarks date shows "—". **Implementation:** `render.setLastUpdated(result.updated)` and `render.setBenchmarksLastUpdated(benchPayload?.updated ?? '—')` in `src/app.js`; both use `formatLastUpdatedLabel()` in `src/render.js` to format ISO date strings with `toLocaleString(..., { dateStyle: 'medium', timeStyle: 'medium', timeZoneName: 'short' })`. Markup: `<span id="lastUpdated">` and `<span id="benchmarksLastUpdated">` in `index.html`.

---

## Favicon

The app provides a **favicon** so the browser does not request `/favicon.ico` (which would 404 on static hosts like GitHub Pages). The favicon is an inline SVG (🤖) in the document head via a `data:` URL: `<link rel="icon" href="data:image/svg+xml,..." type="image/svg+xml">` in `index.html`. No separate favicon file is required.
