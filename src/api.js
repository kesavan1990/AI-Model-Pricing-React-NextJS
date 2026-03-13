/**
 * API layer: fetch pricing.json and Vizra pricing. No app state.
 */

const VIZRA_PRICING_URL = 'https://vizra.ai/api/v1/pricing/ai-models';

const CORS_PROXIES = [
  (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
];

/**
 * Base path for static assets on GitHub Pages. Uses NEXT_PUBLIC_BASE_PATH when set (build-time),
 * or derives from pathname (e.g. /AI-Model-Pricing-React-NextJS) when on github.io so pricing.json works.
 */
function getBasePath() {
  if (typeof window === 'undefined') return '';
  const fromEnv = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH ? process.env.NEXT_PUBLIC_BASE_PATH : '';
  if (fromEnv) return fromEnv;
  if (/github\.io$/i.test(window.location.hostname || '')) {
    const seg = (window.location.pathname || '').split('/').filter(Boolean)[0];
    return seg ? `/${seg}` : '';
  }
  return '';
}

/**
 * URL for pricing.json with cache-busting query (?t=timestamp) so the browser
 * does not serve stale cached pricing. On GitHub Pages (basePath), resolves to
 * /repoName/pricing.json so the first load does not 404.
 */
export function getPricingJsonUrl() {
  try {
    if (typeof window === 'undefined') return `pricing.json?t=${Date.now()}`;
    const base = getBasePath();
    return `${window.location.origin}${base}/pricing.json?t=${Date.now()}`;
  } catch (_) {
    return `pricing.json?t=${Date.now()}`;
  }
}

export function isGitHubPages() {
  return typeof window !== 'undefined' && /github\.io$/i.test(window.location.hostname || '');
}

/**
 * URL for benchmarks.json with cache-busting (same pattern as pricing).
 * Uses same base-path logic as getPricingJsonUrl for GitHub Pages.
 */
export function getBenchmarksJsonUrl() {
  try {
    if (typeof window === 'undefined') return `benchmarks.json?t=${Date.now()}`;
    const base = getBasePath();
    return `${window.location.origin}${base}/benchmarks.json?t=${Date.now()}`;
  } catch (_) {
    return `benchmarks.json?t=${Date.now()}`;
  }
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

const BENCHMARKS_TIMEOUT_MS = 10000;

/**
 * Fetch benchmarks.json from the current origin. Merged with pricing in the UI by model + provider.
 * Uses a timeout so the app never stays stuck loading if the request hangs (e.g. on deploy).
 * @returns {Promise<{ updated: string, benchmarks: Array }|null>} Parsed JSON or null on failure
 */
export async function getBenchmarks() {
  const url = getBenchmarksJsonUrl();
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), BENCHMARKS_TIMEOUT_MS);
    const res = await fetch(url, { cache: 'no-store', signal: ac.signal }).finally(() => clearTimeout(t));
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

export { VIZRA_PRICING_URL, CORS_PROXIES };
