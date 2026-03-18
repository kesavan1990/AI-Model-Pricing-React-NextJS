# Recommend section

The **Recommend** section (`/recommend`) suggests up to six models based on a free-text use-case description (e.g. “cheap summarization”, “best-in-class text and vision capabilities”). It uses a **static documentation index** with **Fuse.js** for broad search coverage, then optionally enriches results with **live documentation snippets** when available.

---

## User flow

1. User enters a use-case description in the text area.
2. User clicks **Get recommendation**.
3. The app returns up to **6 models**, with provider tag, name, reason, optional doc snippet, and pricing.
4. When results are informed by the static index or live docs, the note appears: *“Results informed by official Gemini, OpenAI, Anthropic, and Mistral documentation.”*
5. **Reset** — Clicking **Reset** clears the description text area and the recommended model results (and the “informed by documentation” note), so the section returns to its initial state. The user can then enter a new use case and click **Get recommendation** again.

---

## How it works

### 1. Static documentation index (primary search)

Recommend uses a **static index** of models and keywords so search has **broader coverage** without depending on live doc fetches.

- **Data:** `data/recommendDocIndex.js` exports `RECOMMEND_DOC_INDEX`: an array of entries in this shape:

  ```json
  {
    "model": "claude-sonnet-4-6",
    "provider": "Anthropic",
    "providerKey": "anthropic",
    "keywords": ["reasoning", "coding", "analysis", "long context"],
    "source": "anthropic documentation"
  }
  ```

- **Search:** [Fuse.js](https://fusejs.io/) runs over this index with the user’s description. Search keys: `keywords`, `model`, `provider`, `source`. Threshold is `0.45` for fuzzy matching.
- **Resolution:** Each index hit is resolved to a **full model object** from the app’s pricing data via `getAllModels(data)`. Matching is by `providerKey` and model name (exact or normalized). Only models that exist in the current data are shown.
- **Result list:** Up to 6 models from the index (by Fuse score), with remaining slots filled by the **score-based recommendations** from `getRecommendations()` so the list is always full and diversified when possible.
- **Fallback:** If the static index returns **no matches** (e.g. empty or very short query), the list comes entirely from `getRecommendations()` (score + diversity), so behavior matches the previous “no index” case.

### 2. Score-based recommendations (fallback and fill)

- **Source:** `getRecommendations(data, useCaseType, description)` in `src/calculator.js`.
- **Logic:** All models from `getAllModels(data)` are scored by use-case type (cost, accuracy, long-doc, code, high-volume, general, balanced). The result list is **diversified**: at least one model per provider when possible, then filled by score up to 6.
- **Use-case inference:** `inferUseCaseType(description)` maps the description to a type (e.g. “cheap”, “best quality”, “long document”, “code”) so scoring weights align with the user’s intent.
- **No backend changes:** This logic is unchanged; the Recommend UI only adds the **static index + Fuse** step before/alongside it.

### 3. Live documentation search (optional enrichment)

- After the result list is built (from index + fill or from `getRecommendations` only), the app may **fetch official API/model documentation pages** (one per provider) and search them for the user’s keywords.
- **Implementation:** `fetchDocsAndSearch(description, data)` in `components/sections/Recommend.js` uses `fetchWithCors()` from `src/api.js` and `extractKeywords` / `searchDocContent` / `cleanDocSnippetForDisplay` from `src/calculator.js`.
- When a doc snippet is found for a recommended model, it is attached as `docSnippet`; otherwise the static index can supply a short line (e.g. “From mistral documentation.”). The “fromDocs” note is shown when any results used the static index or live doc search.

**Official documentation URLs** (one URL per provider; update in `Recommend.js` if the provider changes their docs):

| Provider | URL |
|----------|-----|
| **Google Gemini** | [Models \| Gemini API](https://ai.google.dev/gemini-api/docs/models) |
| **OpenAI** | [Models \| OpenAI API](https://developers.openai.com/api/docs/models) |
| **Anthropic** | [Models overview \| Claude API](https://docs.anthropic.com/en/docs/models-overview) |
| **Mistral** | [Models \| Mistral Docs](https://docs.mistral.ai/models/) |

---

## Index format and extending coverage

Each entry in `RECOMMEND_DOC_INDEX` has:

| Field         | Description |
|---------------|-------------|
| `model`       | Model ID as it appears in pricing/overlay data (e.g. `mistral-large-3`, `claude-sonnet-4-6`). Must match or normalize to a name in `getAllModels(data)` for the same `providerKey`. |
| `provider`    | Display name (e.g. `"Anthropic"`, `"Mistral"`). |
| `providerKey` | Internal key: `gemini` \| `openai` \| `anthropic` \| `mistral`. Used to resolve the entry to a model in `data[providerKey]`. |
| `keywords`    | Array of phrases that Fuse searches (e.g. `"reasoning"`, `"vision"`, `"best-in-class"`, `"long context"`). Add terms that users might type for this model. |
| `source`      | Short attribution (e.g. `"mistral documentation"`). Shown as “From &lt;source&gt;.” when the model is recommended via the index. |

To improve coverage:

1. **Add entries** in `data/recommendDocIndex.js` for more models (use model names from overlays / `getData()` so resolution succeeds).
2. **Add or adjust keywords** so Fuse matches common queries (e.g. “best-in-class text and vision” for Mistral/Gemini/OpenAI).
3. Keep **one entry per model** (or one per “logical” model if you map multiple API names to the same row); resolution deduplicates by `providerKey:name`.

---

## Testing (multiple rounds)

A **test script** runs the same recommendation logic (static index + score-based fallback) against real pricing data and multiple use-case descriptions, so you can verify behavior without opening the UI.

- **Run:** From project root: `npm run test:recommend` or `node scripts/test-recommend.js`.
- **Data:** Uses `public/pricing.json` plus the full pipeline (`applyOfficialOverlays` → `mergeTiersIntoPayload` → `processPayload`) so model counts and filters match the app.
- **Scenarios:** The script runs 10 fixed test cases and prints inferred use-case type and up to 6 recommendations per case.

| Scenario | Sample input | Expected use-case type |
|----------|--------------|-------------------------|
| Empty description | *(empty)* | `general` |
| Cost / cheap | "cheap model for high volume" | `cost` |
| Accuracy / quality | "best quality for complex reasoning" | `accuracy` |
| Long document | "long documents and PDF summarization" | `long-doc` |
| Code | "code generation and developer API" | `code` |
| High volume | "fast throughput and high volume batch" | `high-volume` |
| General / balance | "balanced general purpose" | `general` |
| Budget keywords | "low cost budget affordable" | `cost` |
| Vision (static index) | "best-in-class text and vision" | `balanced` |
| Summarize + context | "summarize PDFs with large context" | `long-doc` |

**What is checked:** For each scenario the script asserts that `inferUseCaseType(description)` returns the expected type, then builds the recommendation list (static index hits resolved to `getAllModels(data)` + fill from `getRecommendations`). Output shows model name, provider, and reason snippet. When the static index contributes results, the script prints “(includes static index matches)”.

**Interpretation:** All scenarios should return 6 recommendations (when the dataset has enough models) and use-case types should match the table. Cost-focused inputs should surface cheaper models first (e.g. mistral-tiny, haiku) when the index or scoring does so; accuracy/long-doc inputs should surface high-capability models. Re-run after changing `RECOMMEND_DOC_INDEX`, scoring in `scoreModelForUseCase`, or `inferUseCaseType` to confirm behavior.

---

## Implementation reference (React app)

| Piece | Location |
|-------|----------|
| UI and handler | `components/sections/Recommend.js` |
| Static index | `data/recommendDocIndex.js` |
| Fuse.js | Dependency: `fuse.js` (search over index). |
| Recommendations and scoring | `src/calculator.js`: `getRecommendations`, `getAllModels`, `inferUseCaseType`, `getFallbackReason`, `normalizeModelName`, `extractKeywords`, `searchDocContent`, `cleanDocSnippetForDisplay`, `getGeneratedDocNote`. |
| Live doc fetch | `src/api.js`: `fetchWithCors`. Doc URLs per provider: see table in §3 (Live documentation search). |
| Data | `context/PricingContext.js`: `getData()`. |

---

## Related docs

- [FEATURES.md](FEATURES.md) — Recommend row in the feature checklist.
- [UI.md – Recommend module](UI.md#recommend-module) — UI and behaviour summary.
- [ALLOWED_MODELS.md](ALLOWED_MODELS.md) — Which models appear in the app (Recommend uses the same pool via `getAllModels`).
