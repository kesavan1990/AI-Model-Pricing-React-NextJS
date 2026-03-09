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

- **Workflow:** [`.github/workflows/update-pricing.yml`](.github/workflows/update-pricing.yml)  
- **Script:** [`scripts/update-pricing.js`](scripts/update-pricing.js) — fetches [Vizra API](https://vizra.ai/api/v1/pricing/ai-models), normalizes provider names and units, deduplicates by model name, writes `pricing.json`.

### Run the update locally

From the repo root:

```bash
node scripts/update-pricing.js
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

## Hosting

Static only (HTML/CSS/JS). No server or database. See [HOSTING.md](HOSTING.md) for GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.

## Docs

- [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md) — Pricing update architecture and flow.
- [docs/PRICING_SCENARIOS.md](docs/PRICING_SCENARIOS.md) — How pricing is loaded in each scenario (first load, refresh, GitHub vs local).
