# Model display rules (provider + retired)

The app shows **all models that pass the pricing pipeline** except (1) rows that **clearly belong to another provider** by name, and (2) models on each provider’s **retired / deprecation** lists. This applies to **Overview**, **Models**, **Value Analysis**, **Calculators**, **Benchmarks**, and **Recommend**. Models are **reassigned to the correct provider** by name when the source mis-tags them.

## How it works

1. **Provider by name** — `src/data/providerByModel.js` defines `getProviderByModelName(name)` with prefix patterns (Gemini/Google media first, then OpenAI, Anthropic, Mistral) so IDs like `text-embedding-004` map to **Gemini**, and `whisper-*`, `tts-*`, `sora-*`, `computer-use-*`, `gpt-image-*`, `gpt-realtime-*` map to **OpenAI**. Before filtering, **`reassignByCanonicalProvider()`** moves every row into the bucket that matches its name.

2. **Allow / reject (`isAllowedModel`)** — `src/data/allowedModels.js`:
   - If `getProviderByModelName(name)` returns a provider **different** from the current bucket → **reject** (stops cross-provider leakage).
   - If the name is **unknown** (no pattern match) → **allow** in the current bucket (trust Vizra / `pricing.json` so **new SKUs are not dropped** until patterns are updated).
   - **OpenAI:** additionally require **not** deprecated per `isRetiredOpenAIModel()` ([OpenAI deprecations](https://developers.openai.com/api/docs/deprecations)).

3. **Retired filter** — **`filterRetiredModels()`** removes deprecated models for **all** providers (e.g. Gemini 1.x/1.5, Claude 3.x, OpenAI shutdown list). Keep **`src/utils/retiredModels.js`** in sync with official deprecation pages.

4. **Filtering order** — **PricingContext** → `applyOfficialOverlays()` → `mergeTiersIntoPayload()` → `processPayload()`: `reassignByCanonicalProvider()` → `filterToAllowedModels()` → `filterRetiredModels()`.

5. **Lists** — In `src/calculator.js`, `getAllModels(data)` and `getUnifiedCalcModels(data)` require `isAllowedModel` and `!isRetired` (and skip embedding-only where applicable).

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

## Official sources (for provider map + retired updates)

| Provider   | Official “available” / models page |
|-----------|------------------------------------|
| **Gemini**   | [Models \| Gemini API](https://ai.google.dev/gemini-api/docs/models), [api/models](https://ai.google.dev/api/models) |
| **OpenAI**   | [All models \| OpenAI API](https://developers.openai.com/api/docs/models/all); allowed = not in [Deprecations](https://developers.openai.com/api/docs/deprecations) |
| **Anthropic**| [Models overview \| Claude](https://docs.anthropic.com/en/docs/about-claude/models/overview) |
| **Mistral**  | [Models \| Mistral Docs](https://docs.mistral.ai/models/) |

To tune **cross-provider detection**, edit prefix patterns in **`src/data/providerByModel.js`**. To hide **deprecated** OpenAI IDs, edit **`src/utils/retiredModels.js`**. For **new vendor naming schemes**, add patterns to `providerByModel.js` first so reassignment stays correct.

---

## Scope: which model types are included

The app is built around **text/multimodal chat and token-based pricing**. **Anything in the pricing feed** that passes provider + retired rules is shown; **missing** SKUs are usually absent from Vizra/`pricing.json` or the **overlays**, not blocked by a tight name allowlist.

### Included

- **Chat/completion models** — Text and multimodal (text + vision) models with **per-token** (input/output per 1M tokens) or comparable pricing. These appear in Overview, Models, Value Analysis, Calculators, Benchmarks, and Recommend.
- **Realtime/audio when token-priced** — e.g. OpenAI Realtime (gpt-realtime-1.5, gpt-realtime-mini) are in the overlay and appear if not deprecated.
- **Embeddings** — Allowed when present in data, but **excluded from** some flows (Calculator dropdown, Recommend, Comparison) via `isEmbeddingOnlyModel()` in `src/calculator.js`.

### Not included (or only partly)

Some catalog entries may still **not appear** if they are **missing from `pricing.json`/Vizra** and **not** in the **official overlay** for that provider, or if they use **non–token pricing** the UI does not yet surface:

| Type | Examples | Why they might be missing |
|------|----------|---------------------------|
| **Image / video / audio SKUs** | Some Imagen, Veo, Sora rows | Need overlay + optional `modelType` / per-unit pricing fields. |
| **Specialized APIs** | Moderation, some Labs models | Often absent from pricing feed or overlay. |

So models **from the API / JSON** appear if they are **not retired** and **not clearly another provider’s ID**. They still need **prices** from the API or an **overlay** row to be useful in the UI.

### Adding more models (including audio/video/specialized)

1. **Provider patterns** — If a new ID is **mis-bucketed or dropped** as “wrong provider”, add a prefix in **`src/data/providerByModel.js`** so `getProviderByModelName()` returns the correct vendor (or leave unknown names to **trust the source bucket**).
2. **Overlay** — In the provider’s overlay file (e.g. `src/data/geminiOfficialOverlay.js`), add an entry with `name`, `input`, `output` (per 1M tokens if the provider publishes it; otherwise you can use placeholder or a separate pricing path later).
3. **Pricing units** — The UI and calculators assume **input/output cost per 1M tokens**. For per-image or per-second pricing you’d need to extend the data shape and the relevant UI (e.g. Calculator, Overview) to support alternate units.
4. **Exclusions** — If the model is embedding-only, it will still be hidden from Calculator/Recommend/Comparison by `isEmbeddingOnlyModel()`. Audio/video/image-only models need overlay entries (and optional `modelType` / alternate pricing) to show meaningful costs.

---

## If you add all models from all providers

**Short answer:** You can **surface** more models with **overlays** (and provider-map tweaks if names are new). For **non–token-priced** SKUs, the app may still need **structural** support (see Option B below).

### Option A: List only (minimal change)

- **What you do:** Ensure models appear in **`pricing.json`/Vizra** or add them to the provider **`\*OfficialOverlay.js`** with `name`, `input`, `output` (use 0 or a placeholder if the provider doesn't publish token pricing). Add **`providerByModel.js`** prefixes if a name is assigned to the wrong vendor.
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
- **Provider map** — `src/data/providerByModel.js` includes prefixes for image/audio/video where applicable (e.g. `imagen-`, `veo-`, `lyria-`, `whisper-`, `tts-`, `sora-`).
- Retired models (e.g. DALL·E 2/3 in `src/utils/retiredModels.js`) are still filtered out; Whisper and TTS (and Gemini image/audio/video) appear when in overlay and not retired.

For a **runbook to add new models or new model types** (e.g. a future type) without changing app behavior, see [MODEL_TYPES_AND_INTEGRATION.md](MODEL_TYPES_AND_INTEGRATION.md).
