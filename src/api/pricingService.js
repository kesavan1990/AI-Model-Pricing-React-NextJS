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
 * Fetch pricing data.
 * - On GitHub Pages (and other non-localhost origins): try pricing.json first so we never hit Vizra and avoid 404 in console.
 * - On localhost: try Vizra first, then fall back to pricing.json.
 * Uses getPricingJsonUrl() so pricing.json is requested from the app root (correct on GitHub Pages with basePath).
 * Timeouts prevent the app from staying stuck on the loading skeleton.
 * @returns {Promise<object>} Raw pricing data (Vizra format or pricing.json format).
 */
export async function fetchPricingData() {
  const { getPricingJsonUrl, isGitHubPages } = await import('../api.js');
  const url = getPricingJsonUrl();
  const tryLocalFirst = typeof window !== 'undefined' && isGitHubPages();

  async function fetchLocal() {
    const res = await fetchWithTimeout(url, FALLBACK_TIMEOUT_MS, { cache: 'no-store' });
    if (!res.ok) throw new Error('Fallback pricing.json failed');
    return res.json();
  }

  async function fetchVizra() {
    const res = await fetchWithTimeout(VIZRA_API, VIZRA_TIMEOUT_MS, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  if (tryLocalFirst) {
    try {
      return await fetchLocal();
    } catch (err) {
      console.warn('Local pricing.json failed, trying Vizra', err?.message || err);
      try {
        return await fetchVizra();
      } catch (_) {
        throw err;
      }
    }
  }

  try {
    return await fetchVizra();
  } catch (err) {
    console.warn('Using fallback pricing', err?.message || err);
    return await fetchLocal();
  }
}

export { VIZRA_API };
