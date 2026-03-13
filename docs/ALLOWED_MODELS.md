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

---

## Scope: which model types are included

The app is built around **text/multimodal chat and token-based pricing**. Only a **subset** of each provider’s catalog is shown.

### Included

- **Chat/completion models** — Text and multimodal (text + vision) models with **per-token** (input/output per 1M tokens) or comparable pricing. These appear in Overview, Models, Value Analysis, Calculators, Benchmarks, and Recommend.
- **Realtime/audio when token-priced** — e.g. OpenAI Realtime (gpt-realtime-1.5, gpt-realtime-mini) are in the overlay and appear if not deprecated.
- **Embeddings** — In the allowlist and overlay, but **excluded from** the main model lists (Calculator dropdown, Recommend, Comparison) via `isEmbeddingOnlyModel()` in `src/calculator.js`; they are not shown in those flows.

### Not included (or only partly)

Many **audio-, video-, or image-generation–specific** models are **not** in the overlays or allowlist, so they do not appear:

| Type | Examples | Why they’re missing |
|------|----------|----------------------|
| **Image generation** | DALL·E, Imagen, Flux | Pricing is per image (or per resolution), not per token; overlays use input/output per 1M tokens only. |
| **Video generation** | Veo, Sora, Runway | Pricing is per second or per clip, not token-based. |
| **Audio / music** | Lyria, Whisper, TTS | Per minute / per second or different units; not in the token-priced overlay. |
| **Specialized APIs** | Moderation, some Labs models | Different products; allowlist/overlay are tuned to main chat and token-priced models. |

So **only models that (1) are on the official docs, (2) match the allowlist, and (3) have token-style pricing in the overlay** (or from the API) will show. Audio/video/image-only models are not added by default.

### Adding more models (including audio/video/specialized)

1. **Allowlist** — In `src/data/allowedModels.js`, add a pattern (or logic) for the model name (e.g. `veo-`, `imagen-`, `whisper-`) so `isAllowedModel(providerKey, name)` returns true.
2. **Overlay** — In the provider’s overlay file (e.g. `src/data/geminiOfficialOverlay.js`), add an entry with `name`, `input`, `output` (per 1M tokens if the provider publishes it; otherwise you can use placeholder or a separate pricing path later).
3. **Pricing units** — The UI and calculators assume **input/output cost per 1M tokens**. For per-image or per-second pricing you’d need to extend the data shape and the relevant UI (e.g. Calculator, Overview) to support alternate units.
4. **Exclusions** — If the model is embedding-only, it will still be hidden from Calculator/Recommend/Comparison by `isEmbeddingOnlyModel()`. Audio/video/image-only models are not treated as “embedding-only”; they’re simply not in the overlay/allowlist unless you add them as above.

---

## If you add all models from all providers

**Short answer:** You can **list** all models with small changes (allowlist + overlay). For the app to **use** them properly (comparison, calculator, benchmarks, recommend), **yes — structure and use would need to change**.

### Option A: List only (minimal change)

- **What you do:** Add every model to the allowlist (patterns in `allowedModels.js`) and to the provider overlays (`*OfficialOverlay.js`) with `name`, `input`, `output` (use 0 or a placeholder if the provider doesn't publish token pricing).
- **What stays the same:** Data shape (still `input`/`output` per 1M tokens), all existing screens, Calculator (token-based), Value Analysis, Benchmarks, Recommend.
- **Trade-off:** Non–token-based models (image, video, audio) will appear in Overview/Models but won't be comparable in a meaningful way (cost "per 1M tokens" is wrong for them; benchmarks don't exist). So **structure and UI stay the same, but use is inconsistent** for those models.

### Option B: Full support (structure and use change)

To support **all** model types in a consistent way, the app would need to evolve:

| Area | Current | Change needed |
|------|--------|----------------|
| **Data model** | One shape: `input`, `output` (per 1M tokens), optional `cachedInput`. | Add e.g. `modelType` (`chat` / `embedding` / `image` / `audio` / `video`) and optional pricing fields (`perImage`, `perSecond`, `perMinute`) or a flexible pricing object. |
| **Overlays / pipeline** | Every entry has token `input`/`output`. | Support alternate pricing per type; overlays or API payload would need to supply the right fields per model type. |
| **Overview / Comparison** | Single list; cost = blended $/1M tokens. | Filter or segment by type (e.g. "Chat", "Image", "Audio"); show different units ($/image, $/min, etc.) and possibly separate tables or views. |
| **Calculator** | Token-based only (prompt + output tokens → cost). | Type-specific flows: e.g. "Chat" (tokens), "Image" (number of images), "Audio" (minutes). Either separate calculators or one flow that branches by selected model type. |
| **Value Analysis** | Cost per "request" (1k prompt + 500 output tokens) vs quality. | Only applies to chat; image/audio/video would need different metrics or be excluded/hidden for this view. |
| **Benchmarks** | MMLU, Code, Reasoning, Arena (chat/reasoning). | Only for chat/reasoning models; other types would show "N/A" or be filtered out. |
| **Recommend** | Scores by cost, reasoning, context, etc. | Add model type (or capability) so queries like "image generation" recommend image models; keep token-based scoring for chat. |
| **Core logic** | `getAllModels()`, `pushModel()` assume token pricing and context. | Either branch by `modelType` (e.g. no `contextWindow` for image models) or maintain separate lists per type and merge where needed. |

So: **adding "all models" in a way that is correct and usable for image/audio/video as well as chat would require structural changes (data model, pipelines, and UI) and would change how the application is used** (filtering by type, type-specific calculators, and different comparison metrics). Listing them with token placeholders avoids structural change but keeps the app's "use" focused on token-priced chat models.

---

## Option B implementation (current app behavior)

The app has been extended with **Option B** so that image, audio, and video models are fully supported **without changing** the existing design, architecture, or default behavior for chat.

### Data model and types

- **`lib/modelTypes.js`** — Defines `MODEL_TYPES` (chat, embedding, image, audio, video), `MODEL_TYPE_LABELS`, and `getModelType(providerKey, model)` (uses `model.modelType` if set, else infers from name). Helpers: `isTokenPricedType()`, `hasBenchmarksType()`.
- **`src/calculator.js`** — `pushModel()` adds to each model: `modelType` (default `chat`), optional `pricingPerImage`, `pricingPerSecond`, `pricingPerMinute`. For non-chat types, `contextWindow` is not set. **`getChatModels(data)`** returns only chat models and is used wherever behavior must stay chat-only.

### What stays chat-only (unchanged)

- **Value Analysis** — Uses `getChatModels(data)`; cost vs performance chart remains chat-only.
- **Benchmarks** — Uses `getChatModels(data)`; table shows only chat models (with benchmarks).
- **Overview KPIs** — Still computed from `getChatModels(data)`.
- **Default view** — Model type filter defaults to **Chat / Text**; Overview and Comparison behave as before when left on Chat.

### Filters and UI

- **Overview** — Model type dropdown: Chat / Text, Image, Audio, Video, All. Provider tables use `filteredData` by selected type; KPIs use chat models only.
- **Comparison (Models)** — Model type filter buttons: Chat/Text, Image, Audio, Video, All. Table shows per-image / per-minute / per-second for non-chat; token pricing for chat.
- **Calculators** — Tabs: **Pricing**, **Prompt cost**, **Context window**, **Production cost**, **Image cost**, **Audio cost**. Image cost uses `pricingPerImage`; Audio cost uses `pricingPerMinute`. CSV/PDF export support Image and Audio results.

### Where model type and alternate pricing are set

- **Overlays** — `src/data/openaiOfficialOverlay.js` and `src/data/geminiOfficialOverlay.js` add image/audio (and video) entries with `modelType`, `pricingPerImage`, or `pricingPerMinute`; merge passes these through.
- **Allowlist** — `src/data/allowedModels.js` includes patterns for image/audio/video (e.g. `imagen-`, `veo-`, `lyria-`, `whisper-`, `tts-`).
- Retired models (e.g. DALL·E 2/3 in `src/utils/retiredModels.js`) are still filtered out; Whisper and TTS (and Gemini image/audio/video) appear when in overlay and allowlist.

For a **runbook to add new models or new model types** (e.g. a future type) without changing app behavior, see [MODEL_TYPES_AND_INTEGRATION.md](MODEL_TYPES_AND_INTEGRATION.md).
