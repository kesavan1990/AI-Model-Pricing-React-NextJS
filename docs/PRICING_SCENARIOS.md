# How pricing is displayed in each scenario

This doc describes **when** the UI uses pricing.json, cache, or the Vizra API. For **when** those files are updated by the backend, see the defined timelines below.

## Update schedule (backend)

| Dataset | When it updates | Where it’s defined |
|---------|------------------|---------------------|
| **Pricing** (`pricing.json`) | **Daily at 06:00 UTC** | [PRICING_UPDATES.md](PRICING_UPDATES.md); workflow `.github/workflows/update-pricing.yml` (`cron: '0 6 * * *'`). |
| **Benchmarks** (`benchmarks.json`) | **Weekly, Sunday 03:00 UTC** | [BENCHMARKS.md](BENCHMARKS.md); workflow `.github/workflows/update-benchmarks.yml` (`cron: '0 3 * * 0'`). |

Both workflows can also be run manually (Actions → workflow → Run workflow). The footer shows **Pricing: [date]** and **Benchmarks: [date]** — these reflect **when the app last loaded the data** (on initial load, F5, or Refresh from web), not the file’s “updated” field.

---

## 1. First time page load

**When:** User opens the app for the first time (no `pricing.json` in `public/` or no localStorage cache).

**Flow:**

1. **PricingContext** mounts and **loadPricing()** runs (e.g. in `useEffect`).
2. **Try Vizra API then `pricing.json`** (via `fetchPricingData()`):
   - If the API or file returns valid data: normalize, apply overlays, `processPayload()` → set state → **Footer (Last updated):** set to the time the data was loaded (same for F5 and Refresh).
   - If both fail: go to step 3.
3. **Try localStorage cache** (via cache manager, e.g. key `ai_pricing_cache`):
   - If present and valid: load from cache → **Last updated:** e.g. `"cached (from web)"` → toast: *"Loaded pricing from local cache (file unavailable)."*
   - If missing or invalid: go to step 4.
4. **Use embedded default:** `DEFAULT_PRICING` from `src/pricingService.js` → **Last updated:** `"embedded default"` → toast: *"Using embedded default pricing (no file or cache)."*
5. **PricingContext** sets state → React components (Overview, Pricing, etc.) re-render with the chosen source.
6. Cache and fallback (Vizra → pricing.json → cache → default) are handled inside **loadPricingFromApi** and **PricingContext**; no separate fill step.
7. Daily history snapshot (if implemented) may run later and can use cache when fresh.

**What the user sees:**  
Pricing from **pricing.json** (if present), or **cache**, or **embedded default**. Footer shows the corresponding “Last updated” and any toast. Tables show Gemini, OpenAI, and if available Anthropic/Mistral (from file, cache, or after a one-time Vizra or fallback fill).

---

## 2. Page refresh (reload)

**When:** User refreshes the page (F5 or reload). localStorage may already have a cache from a previous visit.

**Flow:**

1. **loadPricing()** runs again.
2. **Try `pricing.json` first** (same as above):
   - If the app is deployed with an updated `pricing.json` (e.g. from GitHub Action), that file is loaded → **Last updated:** from file. No API call.
   - If the file is missing (e.g. opened as `file://` or file not deployed): request fails → go to cache/default.
3. **If file failed:** try **localStorage** → if valid cache exists, use it → **Last updated:** e.g. `"cached (from web)"` and toast *"Loaded pricing from local cache (file unavailable)."*
4. **If no cache:** use **embedded default** and toast *"Using embedded default pricing (no file or cache)."*
5. **renderTables()** → tables show the data from step 2–4.
6. **fillMissingProvidersFromVizra():**
   - If all four providers already have data (from file or cache), it exits without any API call.
   - If Anthropic/Mistral are missing:
     - If cache is **fresh** (< 12 hours): fill from cache, re-render, **no API call**.
     - If cache is stale or empty: **call Vizra**; on success save to cache with `cachedAt`, on failure try **pricing.json** again and save if it works.

**What the user sees:**  
On refresh, pricing comes from **pricing.json** (if present and valid) or from **localStorage cache** (same as before) or **embedded default**. Vizra is only called when cache is missing or stale and Anthropic/Mistral still need to be filled. “Last updated” and toasts reflect the source used.

---

## 3. User clicks “Refresh from web”

**When:** User explicitly clicks the “Refresh from web” button.

**Flow:**

1. Current pricing is stored as **previous** (for rollback if the API fails).
2. **Fetch Vizra API** directly.
3. **On success:**
   - Replace all four provider arrays (Gemini, OpenAI, Anthropic, Mistral) with the API response (normalized).
   - Save to **localStorage** with `cachedAt` (so the 12‑hour cache is updated).
   - **Last updated:** e.g. `"2026-03-09 (Vizra)"`.
   - **renderTables()** → tables show new data.
   - **Toast:** *"Pricing updated from Vizra API."* (and if there were changes: *"⬇ N price drop(s), ⬆ M increase(s)."*).
   - If there were price changes, the **“Recent price changes”** block in the footer is shown (drops/increases).
4. **On failure** (network error, rate limit, 5xx, invalid JSON):
   - Restore **previous** state (revert to what was on screen before the click).
   - Try **applyFallbackPricingFromFile()**: fetch `pricing.json` and apply it.
   - **If fallback works:** update “Last updated” to e.g. `"(fallback)"`, re-render, toast: *"API unavailable. Using fallback pricing from pricing.json."*
   - **If fallback fails:** keep restored state, toast: *"Refresh failed: … Kept current pricing."*
   - **renderTables()** in both cases so the UI matches the chosen state.

**What the user sees:**  
Either **fresh Vizra data** and “Last updated (Vizra)” plus optional change summary, or **unchanged pricing** with “Kept current pricing”, or **pricing.json** applied with “Using fallback pricing from pricing.json.” The dashboard does not break even when the API fails.

---

## Summary table

| Scenario              | Primary source        | When Vizra is called              | When pricing.json is used                    |
|-----------------------|------------------------|-----------------------------------|----------------------------------------------|
| First load            | pricing.json → cache → default | Only if Anthropic/Mistral missing and cache stale/missing | Initial load if present; fallback if Vizra fails in fillMissingProvidersFromVizra |
| Page refresh          | pricing.json → cache → default | Only if providers missing and cache stale/missing | Same as first load                            |
| “Refresh from web”    | Vizra API              | Always (one request per click)    | Only as fallback when the Vizra request fails |

So: **normal page loads and refreshes** use **pricing.json** (or cache/default) and avoid hitting Vizra unless needed to fill missing providers and cache isn’t fresh. **“Refresh from web”** always tries Vizra first, then falls back to pricing.json or current data on failure.
