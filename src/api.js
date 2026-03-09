/**
 * API layer: fetch pricing.json and Vizra pricing. No app state.
 */

const VIZRA_PRICING_URL = 'https://vizra.ai/api/v1/pricing/ai-models';

const CORS_PROXIES = [
  (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
];

export function getPricingJsonUrl() {
  try {
    return new URL('pricing.json', window.location.href).href;
  } catch (_) {
    return 'pricing.json';
  }
}

export function isGitHubPages() {
  return typeof window !== 'undefined' && /github\.io$/i.test(window.location.hostname || '');
}

/**
 * Fetch pricing.json from the current origin (e.g. same host or GitHub Pages).
 * @returns {Promise<object|null>} Parsed JSON or null on failure
 */
export async function getPricing() {
  const url = getPricingJsonUrl();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

/**
 * Fetch pricing from Vizra API (direct then via CORS proxies).
 * @returns {Promise<object|null>} Parsed JSON or null
 */
export async function fetchVizraPricing() {
  const opts = { cache: 'no-store' };
  try {
    const direct = await fetch(VIZRA_PRICING_URL, opts);
    if (direct.ok) return await direct.json();
  } catch (_) {}
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(VIZRA_PRICING_URL), opts);
      if (res.ok) return await res.json();
    } catch (_) {}
  }
  return null;
}

/**
 * Fetch URL with CORS fallback (e.g. for doc pages). Returns response text or ''.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchWithCors(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return await res.text();
  } catch (_) {}
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(url), { cache: 'no-store' });
      if (res.ok) return await res.text();
    } catch (_) {}
  }
  return '';
}

/**
 * Fetch URL with CORS fallback (for doc search from browser).
 * @param {string} url
 * @returns {Promise<string>} Response text or ''
 */
export async function fetchWithCors(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return await res.text();
  } catch (_) {}
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(url), { cache: 'no-store' });
      if (res.ok) return await res.text();
    } catch (_) {}
  }
  return '';
}

export { VIZRA_PRICING_URL, CORS_PROXIES };
