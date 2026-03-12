# Official-only model display (allowlist)

The app **displays only models that are listed as available** on each provider’s official documentation. This applies to **Overview**, **Models**, **Value Analysis**, **Calculators**, **Benchmarks**, and **Recommend**. Models are also **reassigned to the correct provider** by name so they always appear under the right provider.

## How it works

1. **Provider by name** — `src/data/providerByModel.js` defines `getProviderByModelName(name)`. Before allowlist/retired filtering, every model is moved into the provider array that matches its name (e.g. `deep-research-*` → OpenAI, `gemini-*` → Gemini, `claude-*` → Anthropic, `mistral-*` / `mixtral-*` / `codestral-*` / etc. → Mistral). So models are always under the correct provider even if the data source misclassifies them.

2. **Allowlist** — `src/data/allowedModels.js` defines `isAllowedModel(providerKey, modelName)`:
   - **Gemini:** Official patterns: `gemini-2.5-*`, `gemini-3.*`, `gemini-embedding-2*`, `gemini-embedding-001`, `gemini-live-2.5*`, `gemini-2.0-*`, `gemini-gemma-2-*`, `gemini-exp-*`, `gemini-robotics-*`. 1.0, 1.5, and `gemini-pro` are not in the allowlist (retired).
   - **OpenAI:** Any model **not** in the [deprecations list](https://developers.openai.com/api/docs/deprecations) is considered allowed.
   - **Anthropic:** Only Claude 4.x (e.g. `claude-opus-4-*`, `claude-sonnet-4-*`, `claude-haiku-4-*`, `claude-4-opus*`, `claude-4-sonnet*`).
   - **Mistral:** Official patterns: `mistral-large-3`, `mistral-large-2512`, `mistral-medium-3*`, `mistral-small-3*`, `mistral-3.*`, `mistral-medium-2505`, `mistral-large-24*`, `ministral-3*`, `magistral-*`, `codestral-*`, `pixtral-*`, `devstral-*`, `labs-devstral-*`, `open-mistral-*`, `open-mixtral-*`, `open-codestral-*`, `mistral-tiny`, `mistral-7b`, `mixtral-8x22b`, and generic `mistral-small` / `mistral-medium` / `mistral-large` when still listed.

3. **Filtering** — In `src/app.js`, `setData(data)` runs: `reassignByCanonicalProvider(data)` → `filterToAllowedModels(...)` → `filterRetiredModels(...)`. Only allowed, non-retired models are stored, and each model is in the correct provider array.

4. **Lists** — In `src/calculator.js`, `getAllModels(data)` and `getUnifiedCalcModels(data)` only include models for which `isAllowedModel(providerKey, m.name)` is true and the model is not retired.

## Official sources (for allowlist updates)

| Provider   | Official “available” / models page |
|-----------|------------------------------------|
| **Gemini**   | [Models \| Gemini API](https://ai.google.dev/gemini-api/docs/models), [api/models](https://ai.google.dev/api/models) |
| **OpenAI**   | [All models \| OpenAI API](https://developers.openai.com/api/docs/models/all); allowed = not in [Deprecations](https://developers.openai.com/api/docs/deprecations) |
| **Anthropic**| [Models overview \| Claude](https://docs.anthropic.com/en/docs/about-claude/models/overview) |
| **Mistral**  | [Models \| Mistral Docs](https://docs.mistral.ai/models/) |

To change which models are shown, edit the patterns or logic in **`src/data/allowedModels.js`** and re-check the provider’s official page.
