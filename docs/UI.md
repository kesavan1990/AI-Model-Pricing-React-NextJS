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

**Client navigation and route prefetching** — All in-app links use the Next.js **`Link`** component (from `next/link`) so navigation is client-side and does not trigger full page reloads. **Prefetching** is enabled via the `prefetch` prop on every `Link`. Next.js preloads the target route in the background (e.g. when the link enters the viewport or on hover, depending on the Next.js version). When the user clicks, navigation feels instant because the page JS and data may already be loaded. This pattern is used by many production apps.

- **Where it applies:** Sidebar links (Dashboard, Pricing, Calculator, Comparison, Value Analysis, Benchmarks, Recommend), header logo link to Dashboard, and Calculator sub-nav links (Pricing, Prompt cost, Context window, Production cost).
- **Behavior:** User hovers or link becomes visible → route is prefetched in the background; user clicks → instant navigation.
- **Implementation:** `components/Sidebar.js`, `components/Header.js`, and `components/sections/Calculators.js` use `<Link href="..." prefetch>`.

**Navigation loading indicator** — When the user clicks an internal link and the app is loading the next page, a **top progress bar** (NProgress) is shown at the top of the viewport. The bar appears as soon as the user clicks an in-app link and disappears when the new page has loaded. This gives immediate feedback that navigation is in progress and is common in dashboards and SPAs.

- **Library:** `nprogress` (see [nprogress](https://github.com/rstacruz/nprogress)).
- **Behavior:** User clicks link → thin bar appears at top → page loads → bar disappears.
- **Implementation:** `components/NavigationProgress.js` uses `usePathname()` from `next/navigation` to call `NProgress.done()` when the route changes; a document-level click listener calls `NProgress.start()` when the user clicks any internal `<a href="/...">` (including Next.js `Link` components). The component is rendered in the root layout (`app/layout.js`). The spinner is disabled so only the top bar is shown.

---

## Dashboard home (Cost per 1M tokens and Model Intelligence)

The **Dashboard** route (`/dashboard`) shows a **Cost per 1M tokens (blended)** chart and a **Model Intelligence** sidebar. Both respect the same filters. The dashboard uses a **compact layout** (reduced padding and spacing) consistent with other pages.

**Model type filter** — A dropdown above the chart: **Chat / Text** (default), **All**, **Image**, **Audio**, **Video**. It filters the cost chart and the Model Intelligence panel together.

**Provider cards** — Four cards (Google Gemini, OpenAI, Anthropic, Mistral) show average cost per provider. They are **clickable**: click a card to show **only that provider’s models** in the chart and in Model Intelligence; click the same card again to **clear** the provider filter. All four cards remain visible in an equal-width grid; the selected card is highlighted (e.g. purple tint). Implementation: `CostBarChart` in `components/CostBarChart.js` receives `modelsForProviderSummary` (for card averages) and `models` (for the table); `DashboardHome` in `components/DashboardHome.js` manages `modelTypeFilter` and `providerFilter`.

**Cost per 1M tokens table** — The table shows **all** matching models (not limited to top 10). The list is inside a **scrollable area** (fixed max-height, vertical scroll) so the page length stays bounded. The **header row (Rank, Model, Cost)** is **sticky**: it stays visible at the top of the scroll area while you scroll. **Sort by cost:** click the **Cost** column header to toggle **ascending** (↑, lowest first) or **descending** (↓, highest first). **Ranking** is always by cost: rank 1 = cheapest, rank 2 = second cheapest, etc., regardless of sort direction. A **cost legend** (🟢 Cheapest, ● Low cost, ● Mid, ● High cost) appears **below** the table.

**Cost display** — All costs on the dashboard use **5 decimal places** (e.g. `$0.12345`): provider card averages, cost scale min/max, ranked table, and Model Intelligence values.

**Empty state** — When the selected model type + provider has **no models** (e.g. Image + a provider with no image models), the chart does not hide the controls. The cost type toggles (Blended / Input / Output) and all four provider cards stay visible; only the table is replaced by a message: *"No model data yet. Try a different Model type above, or click a provider card to change filter. Click the selected card again to show all providers."* This avoids getting stuck when a filter combination returns no data.

---

## Skeleton loaders (loading state)

While pricing (and benchmark) data is loading—on first visit or after **Refresh from web**—the app shows **skeleton placeholders** instead of a blank screen. This makes loading feel faster and gives clear feedback that content is coming.

- **When they appear:** Whenever the global pricing context is loading (`loading === true`), the main content area shows a **data loading skeleton** that mirrors the Dashboard layout: a title bar, filter row, chart card (bar-shaped lines), and Model Intelligence–style panel with rows.
- **Where:** The skeleton is rendered in the **dashboard layout** in place of the current page content. So on initial load or refresh, users see the skeleton until data is ready; then the real Dashboard (or other page) is shown.
- **Theme-aware:** Skeleton blocks use the CSS variable `--theme-skeleton` (and a pulse animation) so they look correct in both **dark** and **light** mode.
- **Implementation:**
  - **`components/Skeleton.js`** — Reusable building block: a `div` with the `.skeleton` class. Use with Tailwind size/radius classes (e.g. `h-6 w-40 rounded`). Example: `<Skeleton className="h-6 w-40 rounded" />`.
  - **`components/DataLoadingSkeleton.js`** — Full-page skeleton composed of `Skeleton` pieces, matching the Dashboard structure (title, filters, chart area, right panel).
  - **`components/layout/DashboardLayout.js`** — Uses `usePricing().loading`; when `loading` is true, it renders `<DataLoadingSkeleton />` instead of `children` in the main area. Toast and Footer remain visible.
- **CSS:** In `css/styles.css`, `:root` and `[data-theme="light"]` define `--theme-skeleton`. The `.skeleton` class sets `background: var(--theme-skeleton)`, `border-radius`, and a `skeleton-pulse` keyframe animation for a subtle pulse effect.

No extra libraries are required; the implementation uses Tailwind for layout and a small amount of custom CSS for the skeleton style and animation.

---

## Dark mode and light mode

The app supports **dark mode** (default) and **light mode**. You can switch between them at any time.

- **Toggle:** Use the **theme button** in the header (next to "Refresh from web"). The icon shows **☀️** in dark mode (click to switch to light) and **🌙** in light mode (click to switch to dark).
- **Persistence:** Your choice is saved in `localStorage` (`ai-pricing-theme`) so it is kept across sessions.
- **First visit:** If you have not chosen a theme yet, the app uses your system preference (`prefers-color-scheme: light`) when available; otherwise it defaults to dark.
- **Implementation:** The theme is applied via `data-theme="light"` on `<html>`. CSS variables and `[data-theme="light"]` overrides in `css/styles.css` define the light palette (e.g. light background, dark text). Theme logic lives in **ThemeContext** (`context/ThemeContext.js`) and the header theme toggle; the root layout applies `data-theme` to `<html>`.

---

## KPI summary cards

In the **Overview** section, at the top of the main area (above the pricing grid), four **KPI cards** give quick insights across all service providers:

| Card | Content |
|------|---------|
| **Total Models** | Total number of models across all providers (Gemini, OpenAI, Anthropic, Mistral). |
| **Cheapest** | Model with the lowest blended cost (70% input + 30% output per 1M tokens). Subtitle: **$X.XX / 1M blended** or **Free**. |
| **Costliest** | Model with the highest blended cost per 1M tokens. Subtitle: **$X.XX / 1M blended**. |
| **Largest context** | Model with the largest context window. Subtitle: context size (e.g. **1M**, **128k**). |

The cards use the same data as the pricing tables and update whenever pricing is loaded or refreshed (e.g. after **Refresh from web** or when applying a history snapshot). Implementation: **Dashboard** section (`components/sections/Overview.js` or dashboard page) and **StatCard** components render the KPI cards; data from `usePricing().getData()`; styles in `css/styles.css` (including `[data-theme="light"]` overrides).

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

In the **Overview** section, the **Current pricing** block shows API pricing per 1M tokens from Vizra for all four providers. The section header label lists **Gemini · OpenAI · Anthropic · Mistral** so users see that all providers are included. Below the label and Export (CSV/PDF) toolbar, the **pricing grid** displays four provider cards: Google Gemini, OpenAI, Anthropic, and Mistral, each with a searchable model table. Rendered by the **Overview** (or Pricing) section component; classes `.pricing-section-header`, `.section-label`, `.pricing-grid` in `css/styles.css`.

**Context/tier pricing** — When tiered pricing is available (e.g. ≤200K vs >200K tokens), the app shows **all tiers** in the pricing grid: each model has a **Context / tier** column and one row per tier (e.g. "≤200K tokens", ">200K tokens"). Tier data comes from `src/data/pricingTiersOverlay.js` (merged into the payload after load). The **Model comparison** table and **Cost vs Performance** chart also expand by tier (one row or point per tier). Exports (CSV/PDF) include the context tier column.

**Official-only models and retired exclusion** — The app **shows only models listed as available** on each provider’s official page (see [ALLOWED_MODELS.md](ALLOWED_MODELS.md)). In addition, **retired/deprecated models are excluded** from all sections. (1) **State:** `filterToAllowedModels()` and `filterRetiredModels()` in `src/app.js` run on every `setData()`, so in-memory data (Overview and any list from `getData()`) contains only official-available, non-retired models. (2) **Lists:** `getAllModels()` and `getUnifiedCalcModels()` in `src/calculator.js` require `isAllowedModel(providerKey, name)` and `!isRetired(providerKey, name)` from `src/data/allowedModels.js` and `src/utils/retiredModels.js`. **Sections affected:** Overview, **Models**, **Value Analysis**, **Calculators**, **Benchmarks**, **Recommend**. Excluded examples: Gemini 1.0/1.5, `gemini-pro`; OpenAI deprecated list (e.g. `gpt-4-0314`, `babbage-002`); Anthropic Claude 3.x; Mistral legacy names (e.g. `mistral-large`, `mistral-small` without version).

**Export toolbar alignment** — All export (CSV/PDF) toolbars in the app are **right-aligned** for consistency: **Current pricing** (Overview), **Model comparison** (Models section), **Calculators**, and **Benchmarks**. Implementation: Overview uses `justify-content: space-between` on `.pricing-section-header`; Model comparison uses `margin-left: auto` on `.comparison-export-toolbar`; Calculators and Benchmarks use `margin-left: auto` on `.calculators-export-toolbar` and `.benchmark-export-toolbar` with parent `#calculators` and `#section-benchmark` set to `display: flex; flex-direction: column` in `css/styles.css`.

**Official-only and retired (excluded in all sections)** — Only **official-available** models are shown (allowlist in **`src/data/allowedModels.js`**); **retired** models are also excluded (**`src/utils/retiredModels.js`**). **App state:** **PricingContext** calls `processPayload()` (in `lib/dataPipeline.js`) on every `setData()`, which runs `filterToAllowedModels()` then `filterRetiredModels()`, so `getData()` only sees allowed, non-retired models. **Model lists:** `src/calculator.js` uses `isAllowedModel()` and `isRetired()` in `getAllModels()` and `getUnifiedCalcModels()`, so **Models**, **Value Analysis**, **Calculators**, **Benchmarks**, and **Recommend** show only official-available, non-retired models. See [ALLOWED_MODELS.md](ALLOWED_MODELS.md) and [RETIRED_MODELS.md](RETIRED_MODELS.md).

**Table rendering (DocumentFragment)** — To keep rendering fast and avoid multiple DOM updates, table rows are appended via a **DocumentFragment**. Instead of appending each row to the `tbody` in a loop (which would trigger a reflow per row), the app builds an array of row HTML strings, parses them into a temporary container, moves all `<tr>` nodes into a fragment, and appends the fragment to the `tbody` in a single operation. Benefits: fewer reflows, faster rendering, and better performance for large model lists. Used in **Current pricing** (four provider tables), **Model comparison** table, and **Benchmarks** dashboard. Implementation: `appendRowsWithFragment(tbody, rowHtmlArray)` in `src/render.js`; used by `renderTables()`, `renderModelComparisonTable()`, and `renderBenchmarkDashboard()`.

---

## Sticky headers on scrollable result tables

Scrollable result tables use **sticky headers** so the column headers stay visible while you scroll. This applies to:

| Location | Table | Behavior |
|----------|--------|----------|
| **Dashboard** | Cost per 1M tokens (Rank, Model, Cost) | Header sticks at top of scroll area; opaque background so body rows do not show through. |
| **Calculator → Pricing** | Compare all models (Model, Est. cost) | Same: sticky header, no gap above table, opaque header row. |
| **Calculator → Prompt cost** | Model, Est. cost | Sticky header; scroll container has no top padding so no gap. |
| **Calculator → Context window** | Model, Provider, Context limit, etc. | Sticky header; opaque thead row (dark/light theme). |
| **Calculator → Production cost** | Model, Provider, Cost/request, Daily, etc. | Sticky header; opaque thead row. |

**No-gap behavior** — Scroll containers for these tables use **zero top padding** so the header sits flush at the top with no gap. This prevents the first data row from appearing to overlap the header when scrolling. Header cells use a **solid opaque background** (dark: `#1a1a2e`, light: `#ffffff`) and a bottom border/box-shadow so scrolling content does not show through. Implementation: `css/styles.css` (e.g. `.cost-leaderboard-table-wrap`, `.calc-result.wrap-scroll`, `.prompt-cost-result`, `.context-window-result`, `.production-cost-result`) with `padding-top: 0` on the scroll wrapper and sticky `thead th` (and `thead tr`) styles.

---

## Calculator tooltips

Across **Calculators** (Pricing, Prompt cost, Context window, Production cost), labels show a **(?)** icon. Hover over the label or the **(?)** to see a short tooltip explaining the term. This helps users who are unfamiliar with:

- **Prompt tokens** — Tokens in the request sent to the model (your input/prompt).
- **Output tokens** — Tokens in the model's response (completion).
- **Context window** — Maximum tokens the model can process in one request (input + output combined).
- **Cached input tokens** — Tokens served from cache at a lower rate (OpenAI); use 0 for others.
- **Users per day** / **Requests per user** — Used in the production cost simulator to scale cost.

Tooltips are implemented with a `title` attribute on a `<span class="calc-tooltip-icon">(?)</span>` next to each label in the **Calculators** section component; `.calc-tooltip-icon` is styled in `css/styles.css` (cursor: help, subtle opacity).

---

## Cost calculator

In **Calculators → 💰 Pricing**, the cost calculator estimates API cost for a chosen model (and optionally compares two models). **Model** and **Compare with** dropdowns list **only chat/text models** (same as Context window and Production cost). **Compare all models** also runs over chat models only; image/audio/video models do not appear in the result.

| | Description |
|---|-------------|
| **Input** | **Prompt tokens** — number of input/prompt tokens. |
| **Input** | **Output tokens** — number of output/completion tokens. |
| **Input** | **Model** — select one model (chat/text only). Optional: **Compare with** a second model. |
| **Output** | **Estimated cost** — cost in $ for the given prompt + output tokens for the selected model(s). |

OpenAI models can also use **Cached input tokens** (tokens served from cache at a lower rate); use 0 for non-OpenAI. The result shows the estimated cost per request; with "Compare with" you see both models side by side.

---

## Prompt cost estimator

In **Calculators → 📝 Prompt cost**, you can paste text (or **Import file**: TXT, CSV, PDF, MD, JSON) to get an estimated **prompt token count** (using gpt-tokenizer / cl100k_base when available, else ≈4 chars per token). You set **Estimated output tokens**; then **Estimate cost** shows cost per **chat/text model** across Gemini, OpenAI, Anthropic, and Mistral (image/audio/video and embedding-only models excluded). Use **Reset** to clear. The result can be exported via the Calculators export toolbar when this sub-tab is active.

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

**Simulator note** — A short note appears above the simulator form: *"Cost estimates assume flat token pricing. Tiered discounts and prompt caching are not included."* This avoids misinterpretation: the simulator does not apply volume discounts or cached-input pricing (e.g. OpenAI cached tokens) in the table; it uses the same per‑1M input/output rates as the rest of the app. Rendered in the **Calculators** section (Production cost sub-tab); styles in `css/styles.css` (`.simulator-note`).

**Calculators export (CSV / PDF)** — In the **Calculators** tab, an **Export current result** toolbar (below the sub-nav) lets you download the result of the **currently active** calculator as CSV or PDF. Which result is exported depends on the active sub-tab: **Pricing** (model + est. cost), **Prompt cost** (model + cost per model), **Context window** (model + context window + result), or **Production cost** (model + per request, daily, monthly, per annum). Run the calculator first; if there is no result, a toast asks you to run it. Implementation: **PricingContext** (or Calculators section state) holds the last result per calculator sub-tab; the active sub-tab is tracked in component state; export handlers build CSV/PDF. Buttons live in the Calculators section (`.calculators-export-toolbar`).

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

**Provider filter** — Above the table, **Filter by provider** lets you narrow the list to one provider: **All**, **Google** (Gemini), **OpenAI**, **Anthropic**, or **Mistral**. Click a button to filter; the table updates to show only that provider’s models. This makes it easier to compare within a provider and improves UX as model count grows. Logic: **Models** section (`components/sections/Models.js`) holds comparison filter and sort state; table is rendered from `getData()` and filter/sort; export uses the same filtered/sorted list.

**Grouping and sort order** — With **Sort by: Default**, results are **grouped by provider** (Google → OpenAI → Anthropic → Mistral), and within each provider group models are sorted by **blended cost ascending** (cheapest first). When **All** is selected you see all providers in that order; when a single provider is selected, that provider’s models are listed with cheapest first.

**Sort by** — A **Sort by** dropdown lets you reorder the (filtered) table: **Default** (group by provider, cheapest first), **Input price (low → high)**, **Output price (low → high)**, or **Context (largest first)**. The chosen sort applies to whatever provider filter is active (All or a single provider). State is kept in `comparisonSortBy` in `src/render.js`; `setComparisonSortBy(sortBy)` and the select’s change handler in `src/app.js` update and re-render the table.

**Cheapest model highlight** — Among the models currently shown (after any provider filter), the row with the **lowest blended cost** (70% input + 30% output per 1M tokens) is highlighted: the row has a green-tinted background and the model name shows a **🟢 Cheapest** badge. In light theme the highlight uses a light green background (`#dcfce7`). This makes the best-value option obvious at a glance.

**Export (CSV / PDF)** — In the Model comparison section, **Export: CSV** and **Export: PDF** let you download the current table (respecting the active provider filter and sort order). CSV columns: Model, Provider, Input per 1M, Output per 1M, Context. PDF uses the same data in a landscape table. Implementation: **Models** section calls export helpers (e.g. from `src/render.js`) with the current filtered and sorted list; buttons live in `.comparison-export-toolbar`.

---

## Cost vs Performance quadrant chart

In the **Value Analysis** section, a **Cost vs Performance** scatter chart helps you see value at a glance: cost per request (X) vs a chosen performance metric (Y). All models appear as grey dots; **frontier** models (best performance at each cost level) are colored by provider. Hover any point for model name, cost per request, and performance score.

**Data** — The chart uses the same merged dataset as the rest of the app: **pricing** (input/output per 1M tokens) and **benchmarks** (Arena, MMLU, Code). Cost per request is computed with a **fixed baseline**: **1,000 prompt tokens** and **500 output tokens**. This baseline is not affected by the calculator or production-cost simulator; the chart stays consistent regardless of token values entered elsewhere.

**Frontier** — The **price–performance frontier** is computed by sorting models by cost ascending, then keeping only models that have strictly better performance than all cheaper models. So you see the “best value” options; other models are shown as faint grey dots.

**Controls** — **Performance metric** dropdown: **Arena**, **MMLU**, or **Code** (Y axis). **Filter by provider**: All, Google, OpenAI, Anthropic, Mistral (same idea as the table filter but independent for the chart).

**Point tooltip (model name, cost, performance)** — Hovering any scatter point shows **model name**, **provider**, **Cost/request** (fixed baseline: 1k prompt + 500 output tokens), and the selected **performance metric** (Arena, MMLU, or Code). For this to display correctly, each chart data point must carry the full model object (not just `x`/`y`): the Value Analysis component passes full point objects (with `name`, `cost`, `performance`, `provider`, etc.) into the Chart.js dataset `data` array so the tooltip callback can read them from `context.raw`. Frontier points additionally show "✓ Frontier — best value at this cost (no cheaper model has higher performance)." React: `components/sections/ValueAnalysis.js` (tooltip uses `ctx.raw`); non-React: `renderQuadrantChart()` in `src/valueChart.js`.

**Frontier tooltips** — Three places explain what “frontier” means and **how it is calculated**. (1) **Section subtitle:** A **(?)** with a `title` that states what frontier is and the calculation: sort models by cost (low to high), then keep only those with strictly better performance than every cheaper model. (2) **Legend hint above the chart:** The line “Colored points = **Frontier (best value)** (?)” uses the **native browser `title` tooltip** with What (models with best performance at their cost) and How (sort by cost low to high, then keep models with strictly better performance than every cheaper model). Markup: `<span class="value-chart-frontier-tooltip" title="...">(?)</span>`. (3) **Chart point tooltip:** Hovering a frontier point shows model name, provider, cost, performance, and “✓ Frontier — best value at this cost (no cheaper model has higher performance).” Implementation: tooltip callback in `renderQuadrantChart()` in `src/valueChart.js` adds the frontier explanation when `onFrontier` is true.

**Mobile and responsive behavior** — The chart section uses a responsive container: `max-width: 100%`, `overflow-x: auto`, and `min-width: 0` on the chart wrap so the scatter does not overflow on small screens. At viewport ≤ 768px the chart height is 320px and the wrap uses `max-width: 100%`; at ≤ 480px height is 280px. This keeps the chart usable on phones without horizontal page overflow.

**Performance (large datasets)** — When the number of models grows (e.g. 40 → 100), the chart uses **lazy rendering** (`requestAnimationFrame` in `updateValueChart()`) so heavy work runs in the next frame and does not block the main thread. **Provider filter** and **performance metric** selector reduce the number of points drawn. For more than 50 points, the "all models" layer uses a smaller point radius and no border to reduce draw cost; frontier points are unchanged. Implementation: `src/valueChart.js` (`updateValueChart`, `renderQuadrantChart`).

**Chart colors (light and dark theme)** — The chart uses theme-aware colors so it stays readable in both modes. **Dark theme:** axis and legend text `#e2e8f0`; grid `rgba(255,255,255,0.12)`; “All models” dots medium light grey (fill/border) so they remain visible on dark background; frontier points colored by provider (blue / emerald / orange / violet) at 0.95 opacity. **Light theme:** axis and legend text `#334155`; grid `rgba(0,0,0,0.1)`; “All models” dots medium grey; same provider colors. When you toggle the app theme (**ThemeContext**), the chart is redrawn with the matching palette (Value Analysis section reacts to theme).

**Implementation** — **Value Analysis** section (`components/sections/ValueAnalysis.js`) uses `src/valueChart.js`: `mergeModels()` builds cost + performance from `getAllModels(data)` and `getBenchmarkForModelMerged()`; `computeCostPerRequest()` uses the fixed baseline (1k prompt, 500 output); `computeFrontier()` sorts by cost then performance; **Chart.js** renders the scatter (all models + frontier). Chart dataset `data` uses **full point objects** (with `x`, `y`, `name`, `cost`, `performance`, `provider`) so the tooltip can show correct model name, cost/request, and performance from `context.raw`. The chart updates when data or filters change; theme is respected. Styles in `css/styles.css` (`.value-chart-section`, `.value-chart-wrap`, responsive overrides).

---

## Model benchmark dashboard

On the **Benchmarks** tab (React: `/benchmarks`), the **Model benchmark dashboard** shows leaderboard cards, one main table, and a radar comparison. All content uses merged pricing + benchmarks; **one row per model name** (duplicates removed so the same model does not appear twice).

**Layout and alignment** — The **Benchmarks Leaderboard** title and subtitle are **left-aligned**. The heatmap legend is **right-aligned** above the table. The **Benchmark Radar Comparison** section title and instructions are left-aligned.

### Leaderboard cards

Four cards show **top 5** models each: **Best Reasoning Models**, **Best Coding Models**, **Best General Intelligence** (MMLU), **Best Arena Score**. Each lists model name and score.

### Benchmark table

One table with columns: **Model**, **MMLU**, **Code**, **Reasoning**, **Arena**, **Cost** (tier from current pricing). Scores are indicative from published results.

**Deduplication** — The table shows **at most one row per model name** (first occurrence when merging pricing and tiers). This avoids duplicate model names from multiple context tiers or providers.

**Heatmap** — Each score cell (MMLU, Code, Reasoning, Arena) shows a **color indicator plus the numeric score** for quick scanning:

| Level   | Range   | Color  |
|---------|---------|--------|
| Strong  | 70–100  | Green  |
| Average | 40–69   | Yellow |
| Weak    | 0–39    | Red    |

Missing or invalid scores show a neutral indicator and "—". A **legend** above the table (right-aligned) explains **Strong (70–100)**, **Average (40–69)**, **Weak (0–39)** with colored dots. The exact number remains visible in each cell and in tooltips.

**Sort by column** — The columns **MMLU**, **Code**, **Reasoning**, **Arena**, and **Cost** are **sortable**. Click a column header to sort by that column; click again to toggle **ascending** / **descending**. A **sort icon** is always visible in each sortable header: **↕** when that column is not active, **↑** when sorted ascending, **↓** when sorted descending. Score columns default to descending (best first) when first selected; Cost defaults to ascending (cheapest first). Ties are broken by model name.

**Search** — A **Search models** field filters the table by model name. The sorted order applies to the filtered list.

**Export (CSV / PDF)** — **Export: CSV** and **Export: PDF** download the full benchmark table (same data as the on-screen table, including heatmap values). CSV columns: Model, MMLU, Code, Reasoning, Arena, Cost tier. PDF uses the same data in a landscape table. Buttons are in the benchmark export toolbar (right-aligned with the header).

### Benchmark Radar Comparison

Below the table, **Benchmark Radar Comparison** lets you compare **2 or more models** on a radar chart (Reasoning, Code, Arena, MMLU). Select models from a **scrollable list** (all models are listed; search narrows the list). Each model is drawn as an **outline-only** polygon (no fill) in a **distinct color** so overlapping models stay distinguishable.

**Hover tooltip** — Hovering over the chart shows a **tooltip** with the **actual scores** for each selected model on the benchmark axis under the cursor (e.g. Reasoning: model A 92, model B 96). Model names in the tooltip are colored to match the chart.

**Legend** — Below the chart, a legend lists each selected model with its color. A short **How to read this chart** block explains axes and scale (0–100).

**Export** — CSV/PDF export for the benchmarks section includes the same table data as above; the radar is for on-screen comparison only.

### Benchmark pipeline and data

**Benchmark pipeline** — The UI loads both `pricing.json` and `benchmarks.json` and merges by **model name** and **provider**. The benchmark script fetches **LMSYS Chatbot Arena** (arena.lmsys.org; overall quality / ELO) and **Hugging Face Open LLM Leaderboard** (MMLU, reasoning via datasets-server API), merges with pricing models, and writes `benchmarks.json`. When external data is missing, embedded scores from `getBenchmarkForModel()` in `src/calculator.js` are used. See [Benchmark pipeline](BENCHMARKS.md).

**Update frequency** — **Pricing** updates **daily** (06:00 UTC); **benchmarks** update **weekly** (Sunday 03:00 UTC via `.github/workflows/update-benchmarks.yml`). The benchmark workflow reads `pricing.json`, assigns scores per model, and writes `benchmarks.json`; the frontend fetches both and merges by model.

---

## Recommend module

The **Recommend** tab helps users find a suitable model by describing their use case (e.g. “cheap summarization”, “best-in-class text and vision capabilities”, “long documents”). It considers **all four service providers**: **Google Gemini**, **OpenAI**, **Anthropic**, and **Mistral**. Full behaviour and implementation are documented in **[RECOMMEND.md](RECOMMEND.md)**. A **Reset** button next to **Get recommendation** clears the description text area and the recommended model results, returning the section to its initial state so the user can enter a new use case.

**Static documentation index (Fuse.js)** — A static index (`data/recommendDocIndex.js`) lists models with `keywords` and `source`. When the user clicks **Get recommendation**, **Fuse.js** searches this index with the user’s description (keys: `keywords`, `model`, `provider`, `source`; fuzzy threshold 0.45). Index hits are resolved to full model objects from `getAllModels(data)` by `providerKey` and model name. This gives **broader search coverage** (e.g. “best-in-class text and vision” matches Mistral and others) without depending on live doc fetches.

**Score-based recommendations and diversity** — If the index returns matches, up to 6 are shown (by Fuse score), and any remaining slots are filled from `getRecommendations(data, useCaseType, description)` in `src/calculator.js`. If the index returns none, the list comes entirely from `getRecommendations()`. That function scores all models by use-case type (cost, accuracy, long-doc, code, etc.) and **diversifies**: at least one model per provider when possible, then top 6 by score. So results are never dominated by a single provider.

**Live documentation search (optional)** — After building the list, the React app may fetch **official API/model documentation** (one URL per provider) and search them for the user’s keywords. URLs used: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [OpenAI API models](https://developers.openai.com/api/docs/models), [Anthropic models overview](https://docs.anthropic.com/en/docs/models-overview), [Mistral models](https://docs.mistral.ai/models/). Matching snippets are attached to recommended models when available. Implementation: `fetchDocsAndSearch()` in `components/sections/Recommend.js` uses `fetchWithCors()` from `src/api.js` and `searchDocContent()` / `cleanDocSnippetForDisplay()` from `src/calculator.js`; results are merged by `providerKey:modelName`. The note “Results informed by official Gemini, OpenAI, Anthropic, and Mistral documentation.” is shown when results used the static index or live doc search.

---

## Pricing history

The **📜 History** button in the header opens a **Pricing history** modal. Daily snapshots (12:00 AM IST) are saved when you first open the app each day; one snapshot per day is kept. History is stored in this browser only (separate for local file vs GitHub Pages). In the modal you can **compare two dates**: select two snapshots and see which models had price changes (drops and increases) between those dates. **Export CSV** and **Export PDF** download the full history list. After you click **Refresh from web**, a **Recent price changes** summary may appear in the footer showing which provider/model/field dropped or increased compared with the previous snapshot.

---

## Data status (footer)

The **footer** shows **Pricing: [date]; Benchmarks: [date]** — these dates indicate **when the app last loaded the data**, not the “updated” field from the data source. So both **initial load** (including a manual page refresh, e.g. F5) and **Refresh from web** show the same behavior: the footer reflects the current date/time when the data was loaded. Timestamps are formatted with an **exact time zone** (e.g. **UTC**, **GMT**, **IST**); raw ISO strings like `2026-03-10T15:41:13.242Z` are converted to a readable form such as *"Mar 10, 2026, 3:41:13 PM UTC (from site)"*. When benchmarks fail to load, the benchmarks date shows "—". **Implementation:** **PricingContext** sets `lastUpdated` (and `benchmarksLastUpdated` when benchmarks are present) to the load time on both initial load and refresh; **Footer** reads them and formats with `formatLastUpdatedLabel()` (or equivalent) for display.

---

## Favicon

The app provides a **favicon** so the browser does not request `/favicon.ico` (which would 404 on static hosts like GitHub Pages). The favicon is an inline SVG (🤖) in the document head via a `data:` URL in **`app/layout.js`**. No separate favicon file is required.
