/**
 * Pricing API service: fetches pricing data from Vizra API with fallback to pricing.json.
 * Isolates API logic from UI for easier debugging and future API changes.
 */

const VIZRA_API = 'https://vizra.ai/api/llm-model-pricing';

/**
 * Fetch pricing data: try Vizra API first, fall back to pricing.json on error.
 * Uses getPricingJsonUrl() so pricing.json is requested from the app root (correct on GitHub Pages with basePath).
 * @returns {Promise<object>} Raw pricing data (Vizra format or pricing.json format).
 */
export async function fetchPricingData() {
  try {
    const res = await fetch(VIZRA_API);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Using fallback pricing', err?.message || err);
    const { getPricingJsonUrl } = await import('../api.js');
    const url = getPricingJsonUrl();
    const local = await fetch(url);
    if (!local.ok) throw new Error('Fallback pricing.json failed');
    return await local.json();
  }
}

export { VIZRA_API };
