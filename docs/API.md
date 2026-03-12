# Pricing API service

The app isolates **pricing API logic** from UI logic so that:

- **Debugging** is easier: all fetch and fallback behavior lives in one place.
- **API changes** (URL, error handling, or adding another source) can be done in the service without touching UI code.

## Service: `src/api/pricingService.js`

### `fetchPricingData()`

**Purpose:** Fetch pricing data with a single call. Tries the Vizra API first; on any error (network, non-OK response, invalid JSON), falls back to `pricing.json` in the app origin.

```js
import * as pricingApi from './api/pricingService.js';

const pricing = await pricingApi.fetchPricingData();
```

**Returns:** Raw pricing data in one of two shapes:

- **Vizra API** — Response from `https://vizra.ai/api/llm-model-pricing` (format may be array, `{ data: [...] }`, or `{ data: { models: {...} } }`).
- **Fallback** — Contents of `pricing.json` (app format: `{ gemini, openai, anthropic, mistral, updated? }`).

**Behavior:**

1. `fetch(VIZRA_API)`; if `res.ok` and valid JSON, return that data.
2. On error (e.g. `!res.ok`, network failure, parse error), log a warning and `fetch('pricing.json')`.
3. If the fallback also fails, the promise rejects (caller can then use cache or embedded defaults).

The UI does **not** call the API or `pricing.json` directly. It calls `fetchPricingData()` and then uses the pricing module to normalize the result (see below).

### Configuration

- **API URL:** `VIZRA_API` in `src/api/pricingService.js` (default: `https://vizra.ai/api/llm-model-pricing`). Change this constant to point at a different endpoint or environment.

## How the UI uses it

The **React/Next.js** app uses the pricing service in **PricingContext** (`context/PricingContext.js`):

1. **Load:** `pricing.loadPricingFromApi(pricingApi.fetchPricingData)` — loads via the service, then normalizes and applies cache/default fallbacks; context then runs `applyOfficialOverlays()`, `mergeTiersIntoPayload()`, and `processPayload()` before setting state.
2. **Refresh from web:** Same flow: `fetchPricingData()` then normalize and pipeline; components read updated data via `usePricing()` / `getData()`.

Normalization (Vizra vs app format) is done in `pricingService.js` via `normalizeFetchedPricing(raw)` and `parseVizraResponse()`; the API service only fetches and returns raw data.

## Relation to other code

| Layer | Role |
|-------|------|
| **`src/api/pricingService.js`** | Fetch only: Vizra API → on error → `pricing.json`. No parsing or app state. |
| **`src/pricingService.js`** | Normalize raw data (`normalizeFetchedPricing`, `parseVizraResponse`), apply to app payload (`applyDataFromPayload`), cache, history, defaults. |
| **`src/api.js`** | Other fetches: `getPricing()` (pricing.json only, with cache-busting), `getBenchmarks()`, `fetchWithCors()` for doc search. `getPricing()` is still used for file-only fallbacks (e.g. when refresh fails). |
| **`src/app.js`** | Calls `fetchPricingData()` (or `loadPricingFromApi(fetchPricingData)`) and passes the result into the pricing module; no direct API URLs or fetch logic. |

## Changing the API

To switch endpoint or add another source:

1. Edit `VIZRA_API` in `src/api/pricingService.js`, or add another fetch path (e.g. try a second URL before fallback).
2. Ensure the response is still handled by `parseVizraResponse()` in `src/pricingService.js` if the shape is Vizra-like; otherwise extend `normalizeFetchedPricing()` to recognize the new format and return the same payload shape.

No UI or app-state code needs to change for a different pricing API URL or a new primary source.
