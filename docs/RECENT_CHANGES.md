# Recent changes

This document summarizes recent updates to the AI Model Pricing app (dashboard, calculator, pipelines, and data scope).

---

## 1. Pricing and benchmark pipelines

### Output location and deploy

- **Scripts write to `public/`** so the deployed site serves the latest data:
  - `scripts/update-pricing.js` → **`public/pricing.json`**
  - `scripts/update-benchmarks.js` reads **`public/pricing.json`**, writes **`public/benchmarks.json`**
- **Workflows** commit and push these paths:
  - `.github/workflows/update-pricing.yml` → `public/pricing.json`
  - `.github/workflows/update-benchmarks.yml` → `public/benchmarks.json`
- After a workflow run, the next deploy uses the updated files from `public/`, so the live site always reflects the latest pricing and benchmarks.

### Scope: all model types and all providers

- **Pricing update** includes **all providers** (Gemini, OpenAI, Anthropic, Mistral) and **all model types** (text/chat, image, audio, video). The script does not filter by model type.
- **Validation:** Models with **0/0 token pricing** are allowed when they have `modelType` or alternate pricing (`pricingPerImage`, `pricingPerMinute`, `pricingPerSecond`). The script preserves these fields from the API when present.
- **Benchmarks update** builds one benchmark entry per model in `public/pricing.json` for all providers and all model types. Chat models use Arena/HF data when available; image/audio/video use embedded fallback. Only models with no fallback (e.g. text-embedding) are skipped.

See [PRICING_UPDATES.md](PRICING_UPDATES.md) and [BENCHMARKS.md](BENCHMARKS.md) for timelines and details.

---

## 2. Dashboard

### Model type filter

- **Model type** dropdown above the cost chart: **Chat / Text** (default), **All**, **Image**, **Audio**, **Video**.
- Applies to both **Cost per 1M tokens (blended)** and **Model Intelligence** (cheapest, best quality, fastest, largest context). Changing the filter updates the chart and the right-hand panel together.

### Provider filter (clickable cards)

- The **four provider cards** (Google Gemini, OpenAI, Anthropic, Mistral) are **clickable**.
- **Click a card** → results (chart list + Model Intelligence) show **only that provider’s models**.
- **Click the same card again** → clears the provider filter and shows all providers again.
- The selected card is **visually highlighted** (e.g. purple tint and border).
- **All four cards remain visible** at all times (equal-width grid). When a provider is selected, the table shows only that provider’s models, but the cards do not collapse or expand.

### Cost display: 5 decimals

- All cost values on the dashboard use **5 decimal places** (e.g. `$0.12345`):
  - Provider card averages  
  - Cost scale (min/max)  
  - Ranked model table  
  - Model Intelligence panel (cheapest, best quality, fastest)

### Empty state (no data)

- When the current **model type + provider** combination has **no models** (e.g. Image + a provider with no image models), the app no longer hides the controls.
- **Always shown:** Cost type toggles (Blended / Input / Output) and **all four provider cards**, so you can change provider or model type.
- In place of the table, a short message appears: *"No model data yet. Try a different Model type above, or click a provider card to change filter. Click the selected card again to show all providers."*

### Cost per 1M tokens table (compact, scroll, sticky header, sort)

- **Compact layout** — Dashboard home uses reduced padding and spacing so it matches other pages.
- **All results** — The cost table shows **all** matching models (not just top 10); the list lives in a **scrollable area** (fixed max-height, vertical scroll).
- **Sticky header** — The table header (Rank, Model, Cost) stays visible at the top of the scroll area; header uses an opaque background so body rows do not show through.
- **Sort by cost** — Click the **Cost** column header to toggle ascending (lowest first) or descending (highest first). Ranking is always by cost (rank 1 = cheapest) regardless of sort direction.
- **Legend** — The cost legend (🟢 Cheapest, ● Low cost, ● Mid, ● High cost) is displayed **below** the table.

---

## 3. Calculator

### Pricing and Prompt cost: chat/text models only

- **Pricing** and **Prompt cost** tabs now use **only text/chat models** (same scope as Context window and Production cost).
- **Model** and **Compare with** dropdowns list only chat models.
- **Compare all models** (Pricing) also runs over **chat models only**; image/audio/video models do not appear in the result table.
- Implementation: `getUnifiedCalcModelsChat(data)` in `src/calculator.js`; used by `components/sections/Calculators.js` for Pricing and Prompt cost.

### Sticky headers and no-gap scroll (Pricing, Prompt cost, Context window, Production cost)

- **Sticky headers** — Result tables in **Calculator → Pricing** (Compare all models), **Prompt cost**, **Context window**, and **Production cost** use a sticky table header so column names stay visible while scrolling.
- **No gap** — Scroll containers for these tables have **zero top padding** so the header sits flush at the top with no gap; this prevents the first data row from appearing to overlap the header when scrolling.
- **Opaque header row** — Header cells use a solid background (dark and light theme) so scrolling body rows do not show through. Implementation: `css/styles.css` (e.g. `.calc-result.wrap-scroll`, `.prompt-cost-result`, `.context-window-result`, `.production-cost-result`).

---

## 4. Summary table

| Area | Change |
|------|--------|
| **Pricing pipeline** | Writes `public/pricing.json`; includes all model types and providers; preserves `modelType` and alternate pricing; allows 0/0 when type or alternate pricing present. |
| **Benchmarks pipeline** | Reads/writes `public/pricing.json` and `public/benchmarks.json`; one entry per model (all types, all providers); chat uses Arena/HF, others use fallback. |
| **Dashboard** | Model type filter (Chat/Text default); provider filter via clickable cards; 5 decimals; empty state; compact layout; Cost per 1M: all results, scrollable, sticky header, sort by Cost header, legend below. |
| **Calculator** | Chat-only models for Pricing and Prompt cost; sticky headers and no-gap scroll on result tables (Pricing, Prompt cost, Context window, Production cost). |

---

For full pipeline and validation details, see [PRICING_UPDATES.md](PRICING_UPDATES.md), [BENCHMARKS.md](BENCHMARKS.md), and [PRICING_SCENARIOS.md](PRICING_SCENARIOS.md).
