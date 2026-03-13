# Model types and integration guide

This doc describes the **model types** the app supports (text/chat, image, audio, video, embedding) and **where they are defined**. Use it when adding a **new model** or a **new model type** so integration stays consistent.

**Canonical source of “which models exist”:** The app does **not** read this file. The real list of models and their pricing lives in:

- **Overlay files** — `src/data/openaiOfficialOverlay.js`, `src/data/geminiOfficialOverlay.js`, `src/data/anthropicOfficialOverlay.js`, `src/data/mistralOfficialOverlay.js` (name, pricing, `modelType`, `pricingPerImage`, etc.).
- **Allowlist** — `src/data/allowedModels.js` (patterns so only official models are shown).
- **Retired filter** — `src/utils/retiredModels.js` (deprecated models are excluded).

Do **not** maintain a duplicate list of every model in this .md; that would drift. When in doubt, check the overlay and allowlist.

---

## Supported model types

| Type     | Value   | Pricing style        | Where type is set / inferred |
|----------|--------|----------------------|------------------------------|
| Chat/Text| `chat` | Per token (input/output) | Default; or overlay `modelType: 'chat'` |
| Embedding| `embedding` | Per token | Inferred from name (e.g. `gemini-embedding-*`, `text-embedding-*`) or overlay |
| Image    | `image` | Per image            | Overlay `modelType: 'image'`, `pricingPerImage`; or inferred (e.g. `imagen-`, `dall-e`) |
| Audio    | `audio` | Per minute / per second | Overlay `modelType: 'audio'`, `pricingPerMinute` / `pricingPerSecond`; or inferred (e.g. `whisper`, `tts`, `lyria`) |
| Video    | `video` | Per second            | Overlay `modelType: 'video'`, `pricingPerSecond`; or inferred (e.g. `veo-`) |

**Code:** `lib/modelTypes.js` defines `MODEL_TYPES`, `MODEL_TYPE_LABELS`, and `getModelType(providerKey, model)`. Inference rules (by provider and model name) live there when the overlay does not set `modelType`.

---

## How to add a new model (existing type)

1. **Allowlist** — In `src/data/allowedModels.js`, add a pattern (or logic) so `isAllowedModel(providerKey, modelName)` returns true for the new model.
2. **Overlay** — In the provider’s overlay file (e.g. `src/data/openaiOfficialOverlay.js`), add an entry with at least `name` and:
   - **Chat:** `input`, `output` (per 1M tokens), optional `cachedInput`.
   - **Image:** `modelType: 'image'`, `pricingPerImage`, and `input: 0`, `output: 0` if no token pricing.
   - **Audio:** `modelType: 'audio'`, `pricingPerMinute` or `pricingPerSecond`, and token fields 0 if N/A.
   - **Video:** `modelType: 'video'`, `pricingPerSecond`, and token fields 0 if N/A.
3. **Retired list** — If the model is deprecated, add it to `src/utils/retiredModels.js` instead so it is filtered out.
4. **Type inference (optional)** — If you don’t set `modelType` in the overlay, ensure `getModelType()` in `lib/modelTypes.js` can infer the type from the model name (e.g. new name pattern for that provider).

No change to this .md is required when adding a single model; the canonical list stays in the overlay.

---

## How to add a new model type (e.g. a future “code” or “reasoning” type)

When a provider introduces a **new kind** of product (new pricing unit or new UI bucket), follow these steps so the app can support it without breaking existing behavior:

1. **`lib/modelTypes.js`**
   - Add the new type to `MODEL_TYPES` (e.g. `NEW_TYPE: 'new_type'`).
   - Add a label in `MODEL_TYPE_LABELS`.
   - In `getModelType()`, either:
     - Prefer overlay `modelType` (already supported if overlay sends the new value), or
     - Add inference by provider and model name (e.g. regex on `name`).
   - Update `isTokenPricedType()` and/or `hasBenchmarksType()` if the new type has different pricing or benchmark behavior.

2. **Overlays**
   - In the provider’s overlay file, add entries with `modelType: 'new_type'` and the appropriate pricing fields (e.g. a new `pricingPerX` if needed).

3. **Calculator**
   - In `src/calculator.js`, `pushModel()` already passes through `modelType` and optional pricing fields. If the new type needs a **new pricing field** (e.g. per-request), add it to the overlay merge and to `pushModel()` so it’s on each model object.
   - If the new type needs a **dedicated calculator tab** (like Image cost / Audio cost), add a new tab and handler in `components/sections/Calculators.js` (and CSV/PDF export for that result type).

4. **Context and filters**
   - In `context/PricingContext.js`, `modelTypeFilter` already supports any value; the Overview and Comparison filters are built from the list of types. To show the new type in the filter:
     - Ensure `MODEL_TYPE_LABELS` in `lib/modelTypes.js` includes it (step 1).
     - Overview and Comparison use that plus `getModelType()`, so they will show the new type once models have `modelType: 'new_type'`.
   - In `components/sections/Overview.js`, `filteredData` filters by `getModelType(providerKey, m) === modelTypeFilter`; no change needed if the new type is in `MODEL_TYPES`.
   - In `components/sections/Models.js`, `getComparisonList()` filters by `modelType` when not `'chat'` or `'all'`; and `formatPriceDisplay()` may need a branch for the new type’s pricing unit (e.g. “$X/request”).

5. **Value Analysis and Benchmarks**
   - These stay **chat-only** by design (`getChatModels(data)`). If the new type should be excluded from them, ensure `hasBenchmarksType()` and any cost logic treat it like audio/video (excluded). If the new type should be included, update `getChatModels()` or the chart/table logic as needed.

6. **Allowlist**
   - In `src/data/allowedModels.js`, add a pattern (or logic) for the new model names so they are allowed.

7. **Docs**
   - Update this file: add the new type to the “Supported model types” table and, if needed, to the “How to add a new model” section (e.g. which overlay fields to set).
   - Optionally update `docs/ALLOWED_MODELS.md` (e.g. “Option B implementation”) if the new type changes behavior or UI in a notable way.

---

## Quick reference: where to edit

| Goal                         | File(s) |
|-----------------------------|---------|
| Add / change model type enum and labels | `lib/modelTypes.js` |
| Infer type from model name   | `lib/modelTypes.js` → `getModelType()` |
| Add a new model (name + pricing) | Provider overlay in `src/data/*OfficialOverlay.js` |
| Allow a model to be shown    | `src/data/allowedModels.js` |
| Exclude deprecated model     | `src/utils/retiredModels.js` |
| New calculator tab / unit    | `src/calculator.js` (pricing fields), `components/sections/Calculators.js` (tab + export) |
| Filter / comparison display  | `components/sections/Overview.js`, `components/sections/Models.js` (formatPriceDisplay) |
| Keep Value Analysis / Benchmarks chat-only | `src/valueChart.js`, `components/sections/Benchmarks.js` use `getChatModels(data)` |

This keeps one source of truth (overlay + allowlist + modelTypes.js) and makes future model-type integration a matter of following this runbook.
