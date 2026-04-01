# Benchmark pipeline

The app uses a **second dataset** alongside pricing. The benchmark script fetches **LMSYS Chatbot Arena** (overall model quality) and **Hugging Face Open LLM Leaderboard** (technical benchmarks), merges them with pricing models, and writes `benchmarks.json`. The UI loads both files and merges by model name and provider.

## Defined timeline

| Item | Schedule | Details |
|------|----------|---------|
| **Automated run** | **Weekly, Sunday 03:00 UTC** | `.github/workflows/update-benchmarks.yml` uses `cron: '0 3 * * 0'`. |
| **Manual run** | On demand | GitHub Actions → **Update benchmarks** → **Run workflow**. |
| **Output** | After each run | `benchmarks.json` is updated and committed only if content changed. |
| **Input** | From repo | Script reads `pricing.json` (from the pricing workflow or repo); ensure pricing has run at least once. |

Benchmarks don’t change daily, so weekly is sufficient. Pricing runs daily (see [PRICING_UPDATES.md](PRICING_UPDATES.md)).

## Flow

```
Pricing API (Vizra)          Benchmark sources
        ↓                            ↓
update-pricing.js            Arena + HF → update-benchmarks.js
        ↓                            ↓
  pricing.json                 benchmarks.json
        ↓                            ↓
        └──────────┬─────────────────┘
                   ↓
            Frontend loads both
                   ↓
        Merge by model name + provider
```

## Benchmark sources

### 1. LMSYS Chatbot Arena (best for overall model quality)

- **URL:** https://arena.lmsys.org/
- **What it measures:** Human preference ranking, conversation quality, reasoning ability, real-world usefulness. One of the most trusted LLM benchmarks.
- **Data:** Leaderboard table (model name + ELO/Arena score). Example: GPT-4o 1320, Claude 3 Opus 1290, Gemini 1.5 Pro 1275.
- **How we fetch it:** The script scrapes the Arena HTML table (using `cheerio`). If the fetch or parse fails (e.g. timeout, page structure change), the script falls back to embedded scores and still writes `benchmarks.json`.
- **Update frequency:** Weekly (with the benchmark workflow).

### 2. Hugging Face Open LLM Leaderboard (technical benchmarks)

- **Data source:** Hugging Face Datasets Server API — `open-llm-leaderboard/contents` (MMLU-PRO, BBH, MATH Lvl 5, GPQA, etc.).
- **What it provides:** MMLU-PRO (knowledge), BBH / MATH (reasoning), and other technical scores per model.
- **How we fetch it:** `GET https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard/contents&config=default&split=train&offset=0&length=500`. We map `MMLU-PRO` → mmlu, `MATH Lvl 5` / `BBH` → reasoning. If the fetch fails, we use embedded fallback for those fields.
- **Update frequency:** Weekly.

### 3. Embedded fallback

When Arena or HF is unavailable or a model has no match, the script uses embedded scores from the same logic as the app’s `getBenchmarkForModel()` in `src/calculator.js` (so the dashboard always has values).

## Merge logic

The script:

1. Fetches Arena scores (model → arena number).
2. Fetches HF leaderboard rows (model → mmlu, reasoning).
3. For each model in `pricing.json`, builds one benchmark entry:
   - **arena:** from Arena if we found a matching model name, else embedded.
   - **mmlu, reasoning:** from HF if we found a match, else embedded.
   - **code:** from embedded (HF Open LLM Leaderboard doesn’t expose HumanEval in the same slice; can be extended later).
4. Writes `benchmarks.json` with `updated` (YYYY-MM-DD) and `benchmarks` array. Names in `benchmarks` match pricing model names so the frontend merge works.

Model name matching uses **normalized names** (lowercase, alphanumeric only: `name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')`) so variants like `gpt-4o`, `gpt4o`, and `GPT-4o` all match. The script’s `normalizeName()` and the app’s `normalizeModelName()` in `src/calculator.js` use the same rule so merge is consistent.

## benchmarks.json shape

```json
{
  "updated": "2026-03-10",
  "benchmarks": [
    {
      "model": "gpt-4o",
      "provider": "openai",
      "mmlu": 88.7,
      "code": 90,
      "reasoning": 87,
      "arena": 1320
    },
    {
      "model": "Gemini 1.5 Pro",
      "provider": "gemini",
      "mmlu": 86,
      "code": 88,
      "reasoning": 85,
      "arena": 1275
    }
  ]
}
```

- **model** — Same as in pricing (so UI merge by model + provider works).
- **provider** — One of `gemini`, `openai`, `anthropic`, `mistral`.
- **mmlu, code, reasoning, arena** — Numbers (0 if missing). Validated by `schemas/benchmarks.schema.json` before write.

## Update frequency (aligned with timeline)

| Source                  | Frequency | When (UTC)        | Implemented in                          |
|-------------------------|-----------|-------------------|-----------------------------------------|
| Pricing                 | Daily     | 06:00             | `.github/workflows/update-pricing.yml`   |
| Arena leaderboard       | Weekly    | Sun 03:00         | Fetched inside update-benchmarks run    |
| HF Open LLM Leaderboard | Weekly    | Sun 03:00         | Fetched inside update-benchmarks run    |
| benchmarks.json         | Weekly    | Sun 03:00         | `.github/workflows/update-benchmarks.yml` |

Benchmarks don’t change daily, so weekly is sufficient. Research benchmarks (if added later) could use a separate monthly job.

## Final data architecture

```
ai-model-pricing/
├── public/
│   ├── pricing.json   (written by update-pricing workflow)
│   └── benchmarks.json (written by update-benchmarks workflow)
├── scripts/
│   ├── update-pricing.js
│   └── update-benchmarks.js
├── schemas/
│   ├── pricing.schema.json
│   └── benchmarks.schema.json
└── Next.js app (serves public/* at /; PricingContext loads both and merges)
```

## Script: update-benchmarks.js

- **Location:** `scripts/update-benchmarks.js`
- **Run:** `npm run update-benchmarks` or `node scripts/update-benchmarks.js`
- **Dependencies:** `cheerio` (for Arena HTML parsing), `ajv` (schema validation). Node 18+ (native `fetch`).
- **Input:** Reads `public/pricing.json` (from the pricing workflow or repo). Fetches Arena (HTML) and HF (rows API).
- **Output:** Writes `public/benchmarks.json`. Validates against `schemas/benchmarks.schema.json`; on validation failure, exits with code 1 and does not write.
- **Scope:** One benchmark entry per model in pricing for **all providers** (Gemini, OpenAI, Anthropic, Mistral) and **all model types** (text/chat, image, audio, video). Chat models get Arena/HF data when available; image/audio/video get embedded fallback scores. Only models with no fallback (e.g. text-embedding) are skipped.
- **Empty-dataset protection:** If the built `benchmarks` array is empty (`!benchmarks || benchmarks.length === 0`), the script logs an error and exits with code 1 **without writing**, so a failed or partial run does not overwrite the file with empty data.
- **Resilience:** If Arena or HF fetch fails, the script still runs and uses embedded scores for missing data.

## GitHub Action

- **Workflow:** `.github/workflows/update-benchmarks.yml`
- **Schedule:** `cron: '0 3 * * 0'` (Sunday 03:00 UTC)
- **Manual:** `workflow_dispatch`
- **Steps:** Checkout → npm ci → `npm run update-benchmarks` → commit and push `public/benchmarks.json` only if the file content changed.

The workflow depends on `public/pricing.json` being present (from the last run of the pricing workflow or from the repo).

## Frontend

- **API:** `api.getBenchmarks()` fetches `benchmarks.json?t=<timestamp>` (cache-busting). Returns `{ updated, benchmarks }` or `null`.
- **State:** App stores `benchmarksData` (the `benchmarks` array or `null`) and passes it to `render.renderTables(data, benchmarks)`.
- **Merge:** `getBenchmarkForModelMerged(name, providerKey, fileBenchmarks)` in `src/calculator.js` finds an entry in `fileBenchmarks` where `provider` and normalized `model` match; otherwise falls back to `getBenchmarkForModel(name, providerKey)`.
- **Transparency (Next.js `/benchmarks`):** Collapsible **Where these scores come from** explains Arena vs HF vs in-app fallbacks, shows the file **`updated`** date, and aligns column tooltips with this pipeline. See [UI.md](UI.md) § Model benchmark dashboard → *Where scores come from (UI)*; changelog [RECENT_CHANGES.md](RECENT_CHANGES.md) §12.
