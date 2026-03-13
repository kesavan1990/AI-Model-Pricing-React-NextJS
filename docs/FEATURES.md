# Application features (checklist)

This document lists all user-facing functionality for the **React/Next.js** app so nothing is missed when testing or documenting.

---

## Navigation and layout

| Feature | Description | Where |
|--------|-------------|--------|
| **Dashboard home** | Landing view with KPI cards and link to pricing. | `/` → redirects to `/dashboard`; sidebar **Dashboard**. |
| **Sidebar navigation** | One section at a time: Dashboard, Pricing, Calculator, Comparison, Value Analysis, Benchmarks, Recommend. Uses Next.js **Link** with **prefetch**. | All main pages. |
| **Route prefetching** | All internal links use `<Link prefetch>` so target routes are preloaded in the background; clicks feel instant. | Sidebar, header logo, Calculator sub-nav. See [UI.md](UI.md). |
| **Navigation loading indicator** | **NProgress** top progress bar shown while a new page loads after clicking an internal link. Bar appears on click and disappears when the route is ready. | Global; `components/NavigationProgress.js`, root layout. |
| **Pricing History** | Opens history modal (daily snapshots, compare two dates, export). | Header **History** button. |
| **Theme toggle** | Dark / light mode; persisted in `localStorage`. | Header ☀️/🌙. |
| **Refresh from web** | Reload pricing (and benchmarks) from data source. | Header **Refresh**. |
| **Responsive layout** | Sidebar → horizontal nav at ≤900px; stacked cards and full-width controls on small screens. | Global; see [UI.md](UI.md#mobile-friendly-layout). |

---

## Dashboard

| Feature | Description | Where |
|--------|-------------|--------|
| **Model type filter** | Chat/Text (default), All, Image, Audio, Video. Filters both Cost per 1M tokens chart and Model Intelligence panel. | Dashboard home, above the cost chart. |
| **Provider cards (clickable)** | Four cards: Google Gemini, OpenAI, Anthropic, Mistral. Click one to show only that provider’s models; click again to clear. All four cards stay visible. | Dashboard home, Cost per 1M tokens section. |
| **Cost per 1M tokens** | All matching models in scrollable table; sticky header (Rank, Model, Cost); sort by clicking Cost header (asc/desc); legend below table; provider cards; cost scale. **5 decimals**. Compact layout. | Dashboard home. |
| **Model Intelligence** | Cheapest, Best Quality, Fastest, Largest Context (driven by same model type + provider filter). Costs with 5 decimals. | Dashboard home, right sidebar. |
| **Empty state** | When no models match the filter: message + hint; cost type toggles and all four provider cards remain so user can change filters. | Dashboard home. |
| **Skeleton loaders** | While pricing data is loading (first visit or Refresh), the main content shows skeleton placeholders that mirror the Dashboard layout (title, filters, chart, Model Intelligence). Theme-aware; no blank screen. | Main content when `loading` is true; see [UI.md](UI.md#skeleton-loaders-loading-state). |
| **KPI cards** | Total models, Cheapest (blended), Costliest, Largest context. | Overview / Pricing. |
| **Current pricing** | Grid of all providers (Gemini, OpenAI, Anthropic, Mistral) with search and export CSV/PDF. | Dashboard or **Pricing** (`/pricing`). |
| **Tiered pricing** | Rows per context tier (e.g. ≤200K vs >200K) where applicable. | Pricing grid, comparison, value chart. |

---

## Pricing (Overview)

| Feature | Description | Where |
|--------|-------------|--------|
| **Provider cards** | One card per provider with model table (Context/tier, Input, Output). | Pricing section. |
| **Search** | Filter models by name within each provider. | Per provider card. |
| **Export CSV/PDF** | Download current pricing table. | Export toolbar (right-aligned). |

---

## Models (Comparison)

| Feature | Description | Where |
|--------|-------------|--------|
| **Comparison table** | Model, Provider, Input, Output, Context. | **Comparison** (`/comparison`). |
| **Provider filter** | All, Google, OpenAI, Anthropic, Mistral. | Above table. |
| **Sort** | Default (group by provider, cheapest first), Input price, Output price, Context (largest first). | Dropdown. |
| **Cheapest highlight** | Row with lowest blended cost has green tint and 🟢 Cheapest badge. | Table. |
| **Export CSV/PDF** | Download filtered/sorted table. | Export toolbar. |

---

## Value Analysis

| Feature | Description | Where |
|--------|-------------|--------|
| **Cost vs Performance chart** | Scatter: cost per request (1k prompt + 500 output) vs Arena/MMLU/Code. | **Value Analysis** (`/value-analysis`). |
| **Frontier** | Colored points = best performance at each cost level; grey = all models. | Chart. |
| **Performance metric** | Arena, MMLU, or Code (Y axis). | Dropdown. |
| **Provider filter** | All, Google, OpenAI, Anthropic, Mistral. | Chart controls. |
| **Frontier tooltips** | (?) in subtitle and legend; hover on frontier points for explanation. | Chart. |

---

## Calculators

| Feature | Description | Where |
|--------|-------------|--------|
| **Pricing calculator** | Prompt + output tokens, model select → estimated cost; optional second model compare. Chat/text models only. Result table: **sticky header**, no gap above. | **Calculator** (`/calculator`) → Pricing. |
| **Prompt cost** | Paste/import text → token estimate; set output tokens → cost per model. Chat/text models only. Result table: **sticky header**, no gap. | Calculator → Prompt cost. |
| **Context window** | Enter prompt + output tokens → list of models that fit (or not). Chat models only. Result table: **sticky header**, no gap, opaque header. | Calculator → Context window. |
| **Production cost** | Users/day, requests/user, tokens/request → per request, daily, monthly, per annum. Chat models only. Result table: **sticky header**, no gap, opaque header. | Calculator → Production cost. |
| **Calculator tooltips** | (?) on labels (prompt tokens, output tokens, context, etc.). | All calculator sub-tabs. |
| **Export CSV/PDF** | Export result of the **active** calculator sub-tab. | Calculators export toolbar. |

---

## Benchmarks

| Feature | Description | Where |
|--------|-------------|--------|
| **Leaderboard header** | "Benchmarks Leaderboard" and subtitle; **left-aligned**. | Top of Benchmarks screen. |
| **Best-model cards** | Top 5 each: Best Reasoning, Best Coding, Best General (MMLU), Best Arena. | Benchmarks section. |
| **Benchmark table** | Model, MMLU, Code, Reasoning, Arena, Cost. **One row per model** (duplicates by name removed). | Benchmarks section. |
| **Search models** | Filter table by model name. | Above table. |
| **Heatmap** | Score cells show **color + number**: 🟢 Strong (70–100), 🟡 Average (40–69), 🔴 Weak (0–39). Legend at **top of table**, **right-aligned**, with ranges. | Table cells. |
| **Sort by column** | Click MMLU, Code, Reasoning, Arena, or Cost header to sort **ascending/descending**. Sort icon **always visible**: ↕ unsorted, ↑ asc, ↓ desc. | Table header buttons. |
| **Benchmark Radar Comparison** | Select 2+ models from a **scrollable full list** (no "first 40"); compare as **outline-only** polygons (no fill) in **distinct colors**. | Below table. |
| **Radar tooltip** | Hover on chart: shows **actual scores** for each selected model on the hovered benchmark (Reasoning/Code/Arena/MMLU). | Radar chart. |
| **Radar legend** | Model names with colored dots below chart. | Below radar. |
| **Export CSV/PDF** | Download full benchmark table (with heatmap data). | Benchmarks export toolbar. |

See [UI.md – Model benchmark dashboard](UI.md#model-benchmark-dashboard) and [BENCHMARKS.md](BENCHMARKS.md) for pipeline and data.

---

## Recommend

| Feature | Description | Where |
|--------|-------------|--------|
| **Use-case input** | Free text (e.g. "cheap summarization", "best-in-class text and vision"). | **Recommend** (`/recommend`). |
| **Get recommendation** | Returns up to **6 models**: index matches first, then filled by score-based recommendations (diversified, at least one per provider when possible). | Recommend section. |
| **Reset** | Clears the use-case description and the recommended model results (returns section to initial state). | Recommend section; next to Get recommendation. |
| **Static doc index + Fuse** | Search over a static index of models and keywords (Fuse.js) for **broader coverage**; results resolved to current pricing data. | Recommend section; see [RECOMMEND.md](RECOMMEND.md). |
| **Live doc search** | Optionally fetches official docs (Gemini, OpenAI, Anthropic, Mistral) and attaches matching snippets to results. | After recommendation. |

---

## Pricing History

| Feature | Description | Where |
|--------|-------------|--------|
| **Daily snapshots** | One snapshot per day (e.g. 12:00 AM IST) when app is opened. | Stored in browser. |
| **Compare two dates** | Select two snapshots → see price changes (drops/increases). | History modal. |
| **Export CSV/PDF** | Download history list. | History modal. |
| **Recent price changes** | After Refresh, footer may show summary of changes vs previous snapshot. | Footer. |

---

## Data and behaviour

| Feature | Description | Where |
|--------|-------------|--------|
| **Allowed models only** | Only models listed on each provider’s official page are shown. | All sections; see [ALLOWED_MODELS.md](ALLOWED_MODELS.md). |
| **Retired models excluded** | Deprecated/retired models are hidden everywhere. | All sections; see [RETIRED_MODELS.md](RETIRED_MODELS.md). |
| **Pricing pipeline** | Daily (06:00 UTC) update from Vizra → `public/pricing.json`; all providers and model types. | [README](README.md), [PRICING_UPDATES.md](PRICING_UPDATES.md). |
| **Benchmark pipeline** | Weekly (Sunday 03:00 UTC) Arena + HF → `public/benchmarks.json`; one entry per model (all types). | [BENCHMARKS.md](BENCHMARKS.md). |
| **Footer dates** | "Pricing: [date]; Benchmarks: [date]" with time zone. | Footer. |
| **Recent changes** | Dashboard filters, 5-decimal costs, calculator chat-only, pipeline scope, empty state. | [RECENT_CHANGES.md](RECENT_CHANGES.md). |

---

## Next.js routes (React app)

| Route | Content |
|-------|--------|
| `/` | Redirects to `/dashboard`. |
| `/dashboard` | Dashboard home (KPI cards, link to pricing). |
| `/pricing` | Current pricing grid (all providers, export). |
| `/calculator` | Calculators (Pricing, Prompt cost, Context window, Production cost). |
| `/comparison` | Model comparison table (filter, sort, export). |
| `/value-analysis` | Cost vs Performance quadrant chart. |
| `/benchmarks` | Benchmarks leaderboard, table (heatmap, sort), radar comparison. |
| `/recommend` | Recommend by use case. |

History is a modal opened from the header (no dedicated route).

---

## Deployment

| Feature | Description | Where |
|--------|-------------|--------|
| **GitHub Pages** | Static export with basePath for project site. | [DEPLOY.md](DEPLOY.md). |
| **GitHub Actions** | Build and deploy on push to `main`. | `.github/workflows/deploy-pages.yml`. |
