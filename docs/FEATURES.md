# Application features (checklist)

This document lists all user-facing functionality for the **React/Next.js** app so nothing is missed when testing or documenting.

---

## Navigation and layout

| Feature | Description | Where |
|--------|-------------|--------|
| **Dashboard home** | Landing view with KPI cards and link to pricing. | `/` → redirects to `/dashboard`; sidebar **Dashboard**. |
| **Sidebar navigation** | One section at a time: Dashboard, Pricing, Calculator, Comparison, Value Analysis, Benchmarks, Recommend. | All main pages. |
| **Pricing History** | Opens history modal (daily snapshots, compare two dates, export). | Header **History** button. |
| **Theme toggle** | Dark / light mode; persisted in `localStorage`. | Header ☀️/🌙. |
| **Refresh from web** | Reload pricing (and benchmarks) from data source. | Header **Refresh**. |
| **Responsive layout** | Sidebar → horizontal nav at ≤900px; stacked cards and full-width controls on small screens. | Global; see [UI.md](UI.md#mobile-friendly-layout). |

---

## Dashboard

| Feature | Description | Where |
|--------|-------------|--------|
| **KPI cards** | Total models, Cheapest (blended), Costliest, Largest context. | Dashboard home. |
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
| **Pricing calculator** | Prompt + output tokens, model select → estimated cost; optional second model compare. | **Calculator** (`/calculator`) → Pricing. |
| **Prompt cost** | Paste/import text → token estimate; set output tokens → cost per model. | Calculator → Prompt cost. |
| **Context window** | Enter prompt + output tokens → list of models that fit (or not). | Calculator → Context window. |
| **Production cost** | Users/day, requests/user, tokens/request → per request, daily, monthly, per annum. | Calculator → Production cost. |
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
| **Use-case input** | Free text (e.g. "cheap summarization", "best for code"). | **Recommend** (`/recommend`). |
| **Get recommendation** | Returns up to 6 models, **diversified** (at most 2 per provider). | Recommend section. |
| **Doc search** | Fetches official docs (Gemini, OpenAI, Anthropic, Mistral) and shows matching snippets. | After recommendation. |

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
| **Pricing pipeline** | Daily (06:00 UTC) update from Vizra → `pricing.json`. | [README](README.md), [PRICING_UPDATES.md](PRICING_UPDATES.md). |
| **Benchmark pipeline** | Weekly (Sunday 03:00 UTC) Arena + HF → `benchmarks.json`. | [BENCHMARKS.md](BENCHMARKS.md). |
| **Footer dates** | "Pricing: [date]; Benchmarks: [date]" with time zone. | Footer. |

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
