# Official-only model display (allowlist)

The app **displays only models that are listed as available** on each provider’s official documentation. This applies to **Overview**, **Models**, **Value Analysis**, **Calculators**, **Benchmarks**, and **Recommend**. Models are also **reassigned to the correct provider** by name so they always appear under the right provider.

## How it works

1. **Provider by name** — `src/data/providerByModel.js` defines `getProviderByModelName(name)`. Before allowlist/retired filtering, every model is moved into the provider array that matches its name (e.g. `deep-research-*` → OpenAI, `gemini-*` → Gemini, `claude-*` → Anthropic, `mistral-*` / `mixtral-*` / `codestral-*` / etc. → Mistral). So models are always under the correct provider even if the data source misclassifies them.

2. **Allowlist** — `src/data/allowedModels.js` defines `isAllowedModel(providerKey, modelName)`:
   - **Gemini:** Official patterns: `gemini-2.5-*`, `gemini-3.*`, `gemini-embedding-2*`, `gemini-embedding-001`, `gemini-live-2.5*`, `gemini-2.0-*`, `gemini-gemma-2-*`, `gemini-exp-*`, `gemini-robotics-*`. 1.0, 1.5, and `gemini-pro` are not in the allowlist (retired).
   - **OpenAI:** Any model **not** in the [deprecations list](https://developers.openai.com/api/docs/deprecations) is considered allowed.
   - **Anthropic:** Only Claude 4.x (e.g. `claude-opus-4-*`, `claude-sonnet-4-*`, `claude-haiku-4-*`, `claude-4-opus*`, `claude-4-sonnet*`).
   - **Mistral:** Official patterns: `mistral-large-3`, `mistral-large-2512`, `mistral-medium-3*`, `mistral-small-3*`, `mistral-3.*`, `mistral-medium-2505`, `mistral-large-24*`, `ministral-3*`, `magistral-*`, `codestral-*`, `pixtral-*`, `devstral-*`, `labs-devstral-*`, `open-mistral-*`, `open-mixtral-*`, `open-codestral-*`, `mistral-tiny`, `mistral-7b`, `mixtral-8x22b`, and generic `mistral-small` / `mistral-medium` / `mistral-large` when still listed.

3. **Filtering** — In the React app, **PricingContext** loads pricing and passes the payload to **`lib/dataPipeline.js`** `processPayload()`, which runs `reassignByCanonicalProvider()` → `filterToAllowedModels()` → `filterRetiredModels()`. Only allowed, non-retired models are stored in context, and each model is in the correct provider array.

4. **Lists** — In `src/calculator.js`, `getAllModels(data)` and `getUnifiedCalcModels(data)` only include models for which `isAllowedModel(providerKey, m.name)` is true and the model is not retired.

## Official models overlays (all providers)

So that all models on each provider’s official pricing/models page appear even when the API or `pricing.json` omits them, the app merges in **official overlays** whenever pricing data is set. A single helper `applyOfficialOverlays(payload)` is used on every code path that feeds `setData()` (initial load, fallback, refresh from web, daily capture, fill-missing-providers from API or cache), so **Overview**, **Models**, **Value Analysis**, **Calculators**, **Benchmarks**, and **Recommend** all see the same merged data. Each overlay adds any listed model not already in the loaded payload (by name). Deprecated models are excluded via [RETIRED_MODELS.md](RETIRED_MODELS.md) (which is also aligned with official deprecation pages).

| Provider   | Overlay file | Source (pricing / models page) |
|-----------|--------------|---------------------------------|
| **OpenAI**   | `src/data/openaiOfficialOverlay.js` | [Pricing \| OpenAI API](https://developers.openai.com/api/docs/pricing) |
| **Gemini**   | `src/data/geminiOfficialOverlay.js` | [Pricing \| Gemini API](https://ai.google.dev/gemini-api/docs/pricing), [Models](https://ai.google.dev/gemini-api/docs/models) |
| **Anthropic**| `src/data/anthropicOfficialOverlay.js` | [Pricing \| Claude API](https://docs.anthropic.com/en/docs/about-claude/pricing) |
| **Mistral**  | `src/data/mistralOfficialOverlay.js` | [Pricing \| Mistral](https://docs.mistral.ai/deployment/laplateforme/pricing), [mistral.ai/pricing](https://mistral.ai/pricing) |

- **OpenAI:** GPT-5 series, o3-deep-research, o4-mini-deep-research, gpt-4.1, gpt-4o, o1/o3/o4, etc.
- **Gemini:** 3.1 Pro/Flash-Lite/Flash, 2.5 Pro/Flash/Flash-Lite, 2.0 Flash, embedding-2, Gemma 2.
- **Anthropic:** Claude Opus 4.6/4.5/4.1/4, Sonnet 4.6/4.5/4, Haiku 4.5 (current only; deprecated 3.x excluded via retired list).
- **Mistral:** Mistral Large 3, Medium 3.1, Small 3.2, Ministral 3, Codestral, Magistral, Pixtral, Devstral, open-mistral/open-mixtral.

Update each overlay when that provider’s official pricing or models page changes.

## Official sources (for allowlist updates)

| Provider   | Official “available” / models page |
|-----------|------------------------------------|
| **Gemini**   | [Models \| Gemini API](https://ai.google.dev/gemini-api/docs/models), [api/models](https://ai.google.dev/api/models) |
| **OpenAI**   | [All models \| OpenAI API](https://developers.openai.com/api/docs/models/all); allowed = not in [Deprecations](https://developers.openai.com/api/docs/deprecations) |
| **Anthropic**| [Models overview \| Claude](https://docs.anthropic.com/en/docs/about-claude/models/overview) |
| **Mistral**  | [Models \| Mistral Docs](https://docs.mistral.ai/models/) |

To change which models are shown, edit the patterns or logic in **`src/data/allowedModels.js`** and re-check the provider’s official page.
