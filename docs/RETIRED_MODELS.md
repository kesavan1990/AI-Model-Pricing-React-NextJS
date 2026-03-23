# Retired and deprecated models (excluded)

Retired/deprecated models are **excluded from the app**: they do not appear in any section. **Deprecated model lists are taken from each provider’s official deprecation page** (see table below). The logic in `src/utils/retiredModels.js` is aligned with those official sources. **Provider/bucket rules** (which rows appear under each vendor) are described in [ALLOWED_MODELS.md](ALLOWED_MODELS.md).

## Where they are excluded

| Section | How |
|--------|-----|
| **Overview** | Uses `getData()`, filtered by **`filterToAllowedModels`** (provider/bucket rules) then **`filterRetiredModels`**. |
| **Models** | Comparison table uses `getAllModels(data)`; only **allowed** and **non-retired** models are included. |
| **Value Analysis** | Cost vs performance chart uses `getAllModels(data)`; only allowed and non-retired models appear. |
| **Calculators** | Model dropdown uses `getUnifiedCalcModels(data)` (allowed + non-retired only). |
| **Benchmarks** | Benchmark table and export use `getAllModels(data)`; only allowed and non-retired models. |
| **Recommend** | Recommendations use `getAllModels(data)`; only allowed and non-retired models. |

## Implementation

1. **`src/utils/retiredModels.js`**  
   Defines:
   - `isRetiredGeminiModel(name)`
   - `isRetiredOpenAIModel(name)`
   - `isRetiredAnthropicModel(name)`
   - `isRetiredMistralModel(name)`
   - `isRetired(providerKey, name)` (single entry point)

2. **`lib/dataPipeline.js`** (used by **PricingContext**)  
   - `filterToAllowedModels(data)` keeps only models that pass `isAllowedModel(provider, name)` (see [ALLOWED_MODELS.md](ALLOWED_MODELS.md)).  
   - `filterRetiredModels(data)` filters out retired models using the helpers above.  
   - `processPayload(data)` runs `reassignByCanonicalProvider()` → `filterToAllowedModels()` → `filterRetiredModels()` before the result is stored in context, so `getData()` returns only provider-valid, non-retired models.

3. **`src/calculator.js`**  
   - `getAllModels(data)` and `getUnifiedCalcModels(data)` include a model only when `isAllowedModel(providerKey, m.name)` is true and `!isRetired(providerKey, m.name)`.

4. **`lib/dataPipeline.js`**  
   Calls `filterRetiredModels()` as part of `processPayload()`. Section components and `src/calculator.js` consume data that has already been filtered.

## Official sources (deprecated lists taken from here)

| Provider     | Official deprecation / lifecycle page |
|-------------|---------------------------------------|
| **OpenAI**  | [Deprecations \| OpenAI API](https://developers.openai.com/api/docs/deprecations) |
| **Gemini**  | [Changelog \| Gemini API](https://ai.google.dev/gemini-api/docs/changelog), [Deprecations](https://ai.google.dev/gemini-api/docs/deprecations) |
| **Anthropic** | [Model deprecations \| Claude API](https://docs.anthropic.com/en/docs/resources/model-deprecations) |
| **Mistral** | [Changelog \| Mistral Docs](https://docs.mistral.ai/getting-started/changelog) |

When updating retired logic, re-check the official page for that provider and edit **`src/utils/retiredModels.js`** accordingly.

## Examples of excluded models

- **Gemini:** Per [changelog](https://ai.google.dev/gemini-api/docs/changelog): 1.0 and 1.5 series, `gemini-pro`, legacy vision; shut-down previews: `gemini-2.5-flash-image-preview`, `gemini-3-pro-preview`, `gemini-2.5-flash-preview-09-25`, `text-embedding-004`.  
- **OpenAI:** Per [deprecations](https://developers.openai.com/api/docs/deprecations): e.g. `babbage-002`, `davinci-002`, `gpt-4-0314`, `gpt-4-turbo-preview`, `gpt-3.5-turbo-instruct`, `o1-preview`, `o1-mini`, DALL·E 2/3, deprecated realtime/audio previews.  
- **Anthropic:** Per [model deprecations](https://docs.anthropic.com/en/docs/resources/model-deprecations): Claude 3 Opus, Claude 3 Haiku, Claude 3.5 Haiku, Claude 3.7 Sonnet (and dated variants).  
- **Mistral:** Per [changelog](https://docs.mistral.ai/getting-started/changelog): conservative set: `mistral-large`, `mistral-small`, `mistral-medium-2312`, `open-mistral-nemo` (and variants).
