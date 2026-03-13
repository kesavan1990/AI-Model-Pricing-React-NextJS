/**
 * Pricing API service: fetches pricing data from Vizra API with fallback to pricing.json.
 * Isolates API logic from UI for easier debugging and future API changes.
 */

const VIZRA_API = 'https://vizra.ai/api/llm-model-pricing';

const VIZRA_TIMEOUT_MS = 8000;
const FALLBACK_TIMEOUT_MS = 10000;

/**
 * fetch with timeout so we never hang (important on deploy where Vizra may 404 or network can hang).
 */
function fetchWithTimeout(url, ms, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
}

/**
 * Fetch pricing data: try Vizra API first (with timeout), fall back to pricing.json on error.
 * Uses getPricingJsonUrl() so pricing.json is requested from the app root (correct on GitHub Pages with basePath).
 * Timeouts prevent the app from staying stuck on the loading skeleton if the API or fallback hangs.
 * @returns {Promise<object>} Raw pricing data (Vizra format or pricing.json format).
 */
export async function fetchPricingData() {
  try {
    const res = await fetchWithTimeout(VIZRA_API, VIZRA_TIMEOUT_MS, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Using fallback pricing', err?.message || err);
    const { getPricingJsonUrl } = await import('../api.js');
    const url = getPricingJsonUrl();
    const local = await fetchWithTimeout(url, FALLBACK_TIMEOUT_MS, { cache: 'no-store' });
    if (!local.ok) throw new Error('Fallback pricing.json failed');
    return await local.json();
  }
}

export { VIZRA_API };
