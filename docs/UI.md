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

**Layout and alignment:** The KPI block uses a CSS Grid so the four cards align from the top-left and use the full content width (no floating in the middle). On large screens they appear in one row (4 equal columns). On viewports ≤ 900px the grid switches to 2 columns; on ≤ 480px the cards stack in a single column. Styles: `.kpi-container` with `grid-template-columns: repeat(4, 1fr)` and responsive `@media` overrides in `css/styles.css`.

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
