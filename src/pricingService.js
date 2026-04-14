/**
 * Pricing service: load, cache, normalize, compare, history. Uses api for fetch.
 * Cache read/write is centralized in utils/cacheManager.js.
 */

import { getCachedPricing } from './utils/cacheManager.js';
import { getServerHistory } from './api.js';
import { getHistoryDateMergeKey } from './historyDateKey.js';

export const STORAGE_KEY = 'ai_pricing_cache'; // legacy; prefer cacheManager.CACHE_KEY
export const HISTORY_KEY = 'ai_pricing_history';
export const LAST_DAILY_KEY = 'ai_pricing_last_daily';
export const CACHE_HOURS = 12;

export const DEFAULT_PRICING = {
  gemini: [
    { name: 'Gemini 3.1 Pro', input: 2.0, output: 12.0, badge: 'Latest' },
    { name: 'Gemini 3.1 Flash-Lite', input: 0.25, output: 1.5, badge: 'Latest' },
    { name: 'Gemini 3 Flash', input: 0.5, output: 3.0 },
    { name: 'Gemini 2.5 Pro', input: 1.25, output: 5.0 },
    { name: 'Gemini 2.5 Flash', input: 0.075, output: 0.3 },
    { name: 'Gemini 2.0 Flash', input: 0, output: 0, badge: 'Free' },
    { name: 'Gemini 2.0 Flash-Lite', input: 0, output: 0, badge: 'Preview' },
    { name: 'Gemini 1.5 Pro', input: 1.25, output: 5.0 },
    { name: 'Gemini 1.5 Flash', input: 0.075, output: 0.3 },
    { name: 'Gemini 1.5 Flash-8B', input: 0.0375, output: 0.15 },
  ],
  openai: [
    { name: 'gpt-5.2', input: 1.75, cachedInput: 0.175, output: 14.0, badge: 'Latest' },
    { name: 'gpt-5.1', input: 1.25, cachedInput: 0.125, output: 10.0 },
    { name: 'gpt-5', input: 1.25, cachedInput: 0.125, output: 10.0 },
    { name: 'gpt-5.2-pro', input: 21.0, output: 168.0 },
    { name: 'gpt-5-pro', input: 15.0, output: 120.0 },
    { name: 'gpt-5-mini', input: 0.25, cachedInput: 0.025, output: 2.0 },
    { name: 'gpt-5-nano', input: 0.05, cachedInput: 0.005, output: 0.4 },
    { name: 'gpt-4.1', input: 2.0, cachedInput: 0.5, output: 8.0 },
    { name: 'gpt-4.1-mini', input: 0.4, cachedInput: 0.1, output: 1.6 },
    { name: 'gpt-4.1-nano', input: 0.1, cachedInput: 0.025, output: 0.4 },
    { name: 'gpt-4o', input: 2.5, cachedInput: 1.25, output: 10.0 },
    { name: 'gpt-4o-mini', input: 0.15, cachedInput: 0.075, output: 0.6 },
    { name: 'o1', input: 15.0, cachedInput: 7.5, output: 60.0 },
    { name: 'o1-mini', input: 1.1, cachedInput: 0.55, output: 4.4 },
    { name: 'o3-pro', input: 20.0, output: 80.0 },
    { name: 'o3', input: 2.0, cachedInput: 0.5, output: 8.0 },
    { name: 'o3-mini', input: 1.1, cachedInput: 0.55, output: 4.4 },
    { name: 'o4-mini', input: 1.1, cachedInput: 0.275, output: 4.4 },
    { name: 'text-embedding-3-small', input: 0.02, output: 0 },
    { name: 'text-embedding-3-large', input: 0.13, output: 0 },
    { name: 'text-embedding-ada-002', input: 0.1, output: 0 },
  ],
  anthropic: [],
  mistral: [],
};

export function dedupeModelsByName(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const seen = new Map();
  for (const m of arr) {
    const key = (m && m.name != null ? String(m.name) : '').toLowerCase().trim();
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, m);
  }
  return Array.from(seen.values());
}

export function normalizeProvider(p) {
  if (p == null || p === '') return '';
  const s = String(p).toLowerCase().trim();
  if (s === 'google' || s.startsWith('google')) return 'gemini';
  if (s === 'openai') return 'openai';
  if (s === 'anthropic') return 'anthropic';
  if (s === 'mistral') return 'mistral';
  return p;
}

export function normalizePrice(price, unit) {
  if (price == null || typeof price !== 'number' || isNaN(price)) return 0;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'per_1k_tokens' || u === '1k_tokens' || u === '1k') return price * 1000;
  if (u === 'per_100_tokens' || u === '100_tokens') return price * 10000;
  if (u === 'per_token' || u === 'token' || u === 'per_tokens') return price * 1000000;
  return price;
}

export function normalizePricing(models) {
  if (!Array.isArray(models)) return [];
  return models
    .map((m) => {
      const raw = m || {};
      const inputUnit = raw.input_unit || raw.unit || '1m_tokens';
      const outputUnit = raw.output_unit || raw.unit || '1m_tokens';
      const cachedUnit = raw.cached_unit || raw.unit || '1m_tokens';
      const inputRaw = Number(raw.input_price_per_1m ?? raw.input_price_per_million ?? 0) || 0;
      const outputRaw = Number(raw.output_price_per_1m ?? raw.output_price_per_million ?? 0) || 0;
      const cachedRaw =
        raw.cached_price_per_1m != null || raw.cached_price_per_million != null
          ? Number(raw.cached_price_per_1m ?? raw.cached_price_per_million ?? 0)
          : null;
      return {
        name: raw.model || raw.name || '',
        provider: normalizeProvider(raw.provider),
        input: normalizePrice(inputRaw, inputUnit),
        output: normalizePrice(outputRaw, outputUnit),
        cachedInput: cachedRaw != null ? normalizePrice(cachedRaw, cachedUnit) : null,
      };
    })
    .filter((n) => n.name && (n.input > 0 || n.output > 0));
}

export function parseVizraResponse(data) {
  const out = { gemini: [], openai: [], anthropic: [], mistral: [] };
  if (!data || typeof data !== 'object') return out;
  let rawList = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (Array.isArray(data.data)) {
    rawList = data.data;
  } else if (data.data && typeof data.data.models === 'object' && !Array.isArray(data.data.models)) {
    for (const [modelId, m] of Object.entries(data.data.models)) {
      rawList.push({ ...(m || {}), model: (m && m.model) || modelId });
    }
  } else if (Array.isArray(data.models)) {
    rawList = data.models;
  }
  const normalized = normalizePricing(rawList);
  for (const n of normalized) {
    const key = normalizeProvider(n.provider);
    if (!key || out[key] === undefined) continue;
    out[key].push({
      name: n.name.replace(/^gemini\//, '').replace(/^mistral\//, '').replace(/^deepseek\//, ''),
      input: n.input,
      output: n.output,
      cachedInput: n.cachedInput,
    });
  }
  out.gemini = dedupeModelsByName(out.gemini);
  out.openai = dedupeModelsByName(out.openai);
  out.anthropic = dedupeModelsByName(out.anthropic);
  out.mistral = dedupeModelsByName(out.mistral);
  return out;
}

export const PROVIDER_LABELS = { gemini: 'Google Gemini', openai: 'OpenAI', anthropic: 'Anthropic', mistral: 'Mistral' };

export function comparePrices(last, newPrices) {
  const drops = [];
  const increases = [];
  if (!last || !newPrices || typeof last !== 'object' || typeof newPrices !== 'object') return { drops, increases };
  const providerKeys = ['gemini', 'openai', 'anthropic', 'mistral'];
  for (const pk of providerKeys) {
    const oldList = last[pk] || [];
    const newList = newPrices[pk] || [];
    const byName = {};
    oldList.forEach((m) => { byName[m.name] = m; });
    newList.forEach((m) => {
      const old = byName[m.name];
      if (!old) return;
      const fields = [
        { key: 'input', old: old.input, new: m.input },
        { key: 'output', old: old.output, new: m.output },
      ];
      if (m.cachedInput != null || old.cachedInput != null) {
        fields.push({ key: 'cached', old: old.cachedInput, new: m.cachedInput });
      }
      const label = PROVIDER_LABELS[pk] || pk;
      for (const f of fields) {
        const o = Number(f.old);
        const n = f.new != null ? Number(f.new) : null;
        if (n === null) continue;
        if (n < o) drops.push({ provider: label, name: m.name, field: f.key, oldVal: o, newVal: n });
        if (n > o) increases.push({ provider: label, name: m.name, field: f.key, oldVal: o, newVal: n });
      }
    });
  }
  return { drops, increases };
}

export function isCacheFresh(cachedAt) {
  if (cachedAt == null) return false;
  const ageMs = Date.now() - Number(cachedAt);
  return ageMs >= 0 && ageMs < CACHE_HOURS * 60 * 60 * 1000;
}

/** Returns cached pricing payload if present and within TTL; otherwise null. Uses utils/cacheManager. */
export function getCachedPricingPayload() {
  return getCachedPricing();
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export { getHistoryDateMergeKey };

/** Prefer server snapshot per day, then local-only days (same rules as Pricing History modal). */
export function mergeServerAndLocalHistory(serverList, localList) {
  const byDate = new Map();
  for (const e of serverList || []) {
    const key = getHistoryDateMergeKey(e.date);
    if (key && !byDate.has(key)) byDate.set(key, { ...e });
  }
  for (const e of localList || []) {
    const key = getHistoryDateMergeKey(e.date);
    if (key && !byDate.has(key)) byDate.set(key, { ...e });
  }
  return Array.from(byDate.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/**
 * Pull GitHub Pages pricing-history.json into localStorage merged with existing rows.
 * Called after pricing loads so History reflects server snapshots even before opening the modal.
 * Empty server array still merges (normalizes sort) so a failed fetch does not skip the write path
 * when local rows already exist.
 */
export async function syncMergedHistoryToLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = await getServerHistory();
    const server = Array.isArray(raw) ? raw : [];
    const local = getHistory();
    const merged = mergeServerAndLocalHistory(server, local);
    const mergedStr = JSON.stringify(merged);
    if (mergedStr !== JSON.stringify(local)) {
      localStorage.setItem(HISTORY_KEY, mergedStr);
    }
  } catch (_) {}
}

/**
 * After pricing payload is loaded: merge server history into localStorage, then append a local
 * daily snapshot only if this calendar day (IST) is still missing. Aligns LAST_DAILY_KEY when
 * the day is already satisfied by the server merge so reopening the app does not depend on
 * order of operations.
 * @returns {{ appendedDaily: boolean }}
 */
export async function syncHistoryAfterPricingLoad(merged) {
  const out = { appendedDaily: false };
  if (typeof window === 'undefined' || !merged?.gemini?.length) return out;
  try {
    await syncMergedHistoryToLocalStorage();
    const today = getTodayIST();
    const todayKey = getHistoryDateMergeKey(getToday12AMIST());
    const listAfter = getHistory();
    const hasToday = listAfter.some((e) => getHistoryDateMergeKey(e.date) === todayKey);
    if (hasToday) {
      try {
        localStorage.setItem(LAST_DAILY_KEY, today);
      } catch (_) {}
      return out;
    }
    const last = localStorage.getItem(LAST_DAILY_KEY);
    if (last !== today) {
      saveToHistory(merged.gemini, merged.openai, {
        daily: true,
        date: getToday12AMIST(),
        anthropic: merged.anthropic || [],
        mistral: merged.mistral || [],
      });
      try {
        localStorage.setItem(LAST_DAILY_KEY, today);
      } catch (_) {}
      out.appendedDaily = true;
    }
  } catch (_) {}
  return out;
}

export function cleanupHistoryToDailyOnly() {
  const list = getHistory().filter((e) => e.daily === true || e.weekly === true);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function saveToHistory(gemini, openai, opts) {
  const list = getHistory();
  const entry = {
    date: (opts && opts.date) ? opts.date : new Date().toISOString(),
    gemini: dedupeModelsByName(JSON.parse(JSON.stringify(gemini || []))),
    openai: dedupeModelsByName(JSON.parse(JSON.stringify(openai || []))),
    anthropic: dedupeModelsByName(JSON.parse(JSON.stringify((opts && opts.anthropic) || []))),
    mistral: dedupeModelsByName(JSON.parse(JSON.stringify((opts && opts.mistral) || []))),
    weekly: !!(opts && opts.weekly),
    daily: !!(opts && opts.daily),
  };
  list.unshift(entry);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function getToday12AMIST() {
  const today = getTodayIST();
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1, 18, 30, 0, 0)).toISOString();
}

function applyDataFromPayload(data, existing) {
  const gemini = (data.gemini && data.gemini.length) ? dedupeModelsByName(data.gemini) : (existing.gemini || DEFAULT_PRICING.gemini).slice();
  const openai = (data.openai && data.openai.length) ? dedupeModelsByName(data.openai) : (existing.openai || DEFAULT_PRICING.openai).slice();
  const anthropic = (data.anthropic && Array.isArray(data.anthropic)) ? dedupeModelsByName(data.anthropic) : (existing.anthropic || DEFAULT_PRICING.anthropic || []).slice();
  const mistral = (data.mistral && Array.isArray(data.mistral)) ? dedupeModelsByName(data.mistral) : (existing.mistral || DEFAULT_PRICING.mistral || []).slice();
  return { gemini, openai, anthropic, mistral };
}

/**
 * Normalize raw data from fetchPricingData() (Vizra API or pricing.json) into app payload shape.
 * @param {object} raw - Response from API or pricing.json
 * @returns {{ payload: object, updated: string }} Payload for applyDataFromPayload and updated label.
 */
export function normalizeFetchedPricing(raw) {
  if (!raw || typeof raw !== 'object') return { payload: null, updated: '' };
  const isAppFormat = Array.isArray(raw.gemini) && Array.isArray(raw.openai);
  const payload = isAppFormat ? raw : parseVizraResponse(raw);
  const updated = raw.updated || (isAppFormat ? 'pricing.json' : 'Vizra API');
  return { payload, updated };
}

/**
 * Load pricing from API (Vizra first, then pricing.json fallback). On failure, try cache then default.
 * @param {() => Promise<object>} fetchPricingData - e.g. () => import('./api/pricingService.js').then(m => m.fetchPricingData())
 *   or pass the fetchPricingData function from api/pricingService.js
 * @returns {Promise<{ gemini, openai, anthropic, mistral, updated, usedFallback }>}
 */
const RETRY_DELAY_MS = 2000;

export async function loadPricingFromApi(fetchPricingData) {
  const existing = { gemini: [], openai: [], anthropic: [], mistral: [] };
  let updated = null;
  let usedFallback = null;
  const tryFetch = async () => {
    const raw = await fetchPricingData();
    const { payload, updated: u } = normalizeFetchedPricing(raw);
    if (!payload) throw new Error('Invalid data');
    const out = applyDataFromPayload(payload, existing);
    updated = u || 'from API';
    return { ...out, updated, usedFallback };
  };
  try {
    return await tryFetch();
  } catch (_) {
    try {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return await tryFetch();
    } catch (_) {}
    try {
      const cached = getCachedPricingPayload();
      if (cached) {
        const out = applyDataFromPayload(cached, existing);
        updated = (cached.updated || 'cached') + ' (from web)';
        usedFallback = 'cache';
        return { ...out, updated, usedFallback };
      }
    } catch (_) {}
    const gemini = DEFAULT_PRICING.gemini.slice();
    const openai = DEFAULT_PRICING.openai.slice();
    const anthropic = (DEFAULT_PRICING.anthropic || []).slice();
    const mistral = (DEFAULT_PRICING.mistral || []).slice();
    updated = 'embedded default';
    usedFallback = 'default';
    return { gemini, openai, anthropic, mistral, updated, usedFallback };
  }
}

/**
 * Load pricing: try getPricing() (pricing.json only), then cache, then default.
 * @param {() => Promise<object|null>} getPricing - e.g. api.getPricing
 * @returns {Promise<{ gemini, openai, anthropic, mistral, updated, usedFallback }>}
 */
export async function loadPricing(getPricing) {
  const existing = { gemini: [], openai: [], anthropic: [], mistral: [] };
  let updated = null;
  let usedFallback = null;
  try {
    const data = await getPricing();
    if (!data || typeof data !== 'object') throw new Error('Invalid data');
    const out = applyDataFromPayload(data, existing);
    updated = data.updated || 'from pricing.json';
    return { ...out, updated, usedFallback };
  } catch (_) {
    try {
      const cached = getCachedPricingPayload();
      if (cached) {
        const out = applyDataFromPayload(cached, existing);
        updated = (cached.updated || 'cached') + ' (from web)';
        usedFallback = 'cache';
        return { ...out, updated, usedFallback };
      }
    } catch (_) {}
    const gemini = DEFAULT_PRICING.gemini.slice();
    const openai = DEFAULT_PRICING.openai.slice();
    const anthropic = (DEFAULT_PRICING.anthropic || []).slice();
    const mistral = (DEFAULT_PRICING.mistral || []).slice();
    updated = 'embedded default';
    usedFallback = 'default';
    return { gemini, openai, anthropic, mistral, updated, usedFallback };
  }
}

/**
 * Apply fallback from pricing.json. Returns new payload or null.
 * @param {() => Promise<object|null>} getPricing
 * @param {{ gemini, openai, anthropic, mistral }} current
 */
export async function applyFallbackPricingFromFile(getPricing, current) {
  try {
    const data = await getPricing();
    if (!data || typeof data !== 'object') return null;
    return applyDataFromPayload(data, current);
  } catch (_) {
    return null;
  }
}
