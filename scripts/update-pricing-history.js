#!/usr/bin/env node
/**
 * Appends a daily pricing snapshot to public/pricing-history.json.
 * Used by GitHub Actions so history is recorded even when no one opens the app.
 * Reads from public/pricing.json (from update-pricing workflow); if missing, fetches from Vizra.
 * Entry format matches app: { date, gemini, openai, anthropic, mistral, daily: true }.
 */

const fs = await import('fs');
const path = await import('path');

const PRICING_FILE = 'public/pricing.json';
const HISTORY_FILE = 'public/pricing-history.json';
const VIZRA_URL = 'https://vizra.ai/api/v1/pricing/ai-models';
const MAX_HISTORY_DAYS = 90;

function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getToday12AMIST() {
  const today = getTodayIST();
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1, 18, 30, 0, 0)).toISOString();
}

function dedupeModelsByName(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const seen = new Map();
  for (const m of arr) {
    const key = (m && m.name != null ? String(m.name) : '').toLowerCase().trim();
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, m);
  }
  return Array.from(seen.values());
}

function normalizeProvider(p) {
  if (p == null || p === '') return '';
  const s = String(p).toLowerCase().trim();
  if (s === 'google' || s.startsWith('google')) return 'gemini';
  if (s === 'openai') return 'openai';
  if (s === 'anthropic') return 'anthropic';
  if (s === 'mistral') return 'mistral';
  return s;
}

function normalizePrice(price, unit) {
  if (price == null || typeof price !== 'number' || isNaN(price)) return 0;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'per_1k_tokens' || u === '1k_tokens' || u === '1k') return price * 1000;
  if (u === 'per_100_tokens' || u === '100_tokens') return price * 10000;
  if (u === 'per_token' || u === 'token' || u === 'per_tokens') return price * 1000000;
  return price;
}

function normalizePricing(models) {
  if (!Array.isArray(models)) return [];
  return models
    .map((m) => {
      const raw = m || {};
      const inputUnit = raw.input_unit || raw.unit || '1m_tokens';
      const outputUnit = raw.output_unit || raw.unit || '1m_tokens';
      const inputRaw = Number(raw.input_price_per_1m ?? raw.input_price_per_million ?? raw.input ?? 0) || 0;
      const outputRaw = Number(raw.output_price_per_1m ?? raw.output_price_per_million ?? raw.output ?? 0) || 0;
      const cachedRaw = raw.cached_price_per_1m != null || raw.cached_price_per_million != null ? Number(raw.cached_price_per_1m ?? raw.cached_price_per_million ?? 0) : null;
      return {
        name: (raw.model || raw.name || '').replace(/^gemini\//, '').replace(/^mistral\//, '').replace(/^deepseek\//, ''),
        provider: normalizeProvider(raw.provider),
        input: normalizePrice(inputRaw, inputUnit),
        output: normalizePrice(outputRaw, outputUnit),
        cachedInput: cachedRaw != null ? normalizePrice(cachedRaw, raw.cached_unit || '1m_tokens') : null,
      };
    })
    .filter((n) => n.name && (n.input > 0 || n.output > 0));
}

function parseVizraResponse(data) {
  const out = { gemini: [], openai: [], anthropic: [], mistral: [] };
  if (!data || typeof data !== 'object') return out;
  let rawList = [];
  if (Array.isArray(data)) rawList = data;
  else if (Array.isArray(data.data)) rawList = data.data;
  else if (data.data && typeof data.data.models === 'object' && !Array.isArray(data.data.models)) {
    for (const [modelId, m] of Object.entries(data.data.models)) {
      rawList.push({ ...(m || {}), model: (m && m.model) || modelId });
    }
  } else if (Array.isArray(data.models)) rawList = data.models;
  const normalized = normalizePricing(rawList);
  for (const n of normalized) {
    const key = n.provider ? normalizeProvider(n.provider) : '';
    if (!key || out[key] === undefined) continue;
    out[key].push({ name: n.name, input: n.input, output: n.output, cachedInput: n.cachedInput });
  }
  out.gemini = dedupeModelsByName(out.gemini);
  out.openai = dedupeModelsByName(out.openai);
  out.anthropic = dedupeModelsByName(out.anthropic);
  out.mistral = dedupeModelsByName(out.mistral);
  return out;
}

async function loadPricing() {
  const pricingPath = path.join(process.cwd(), PRICING_FILE);
  try {
    const raw = fs.readFileSync(pricingPath, 'utf8');
    const data = JSON.parse(raw);
    if (data && (data.gemini?.length || data.openai?.length)) {
      return {
        gemini: dedupeModelsByName(data.gemini || []),
        openai: dedupeModelsByName(data.openai || []),
        anthropic: dedupeModelsByName(data.anthropic || []),
        mistral: dedupeModelsByName(data.mistral || []),
      };
    }
  } catch (_) {}
  const res = await fetch(VIZRA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Vizra API ${res.status}`);
  const data = await res.json();
  return parseVizraResponse(data);
}

async function main() {
  const todayDate = getToday12AMIST();
  const todayIST = getTodayIST();

  const pricing = await loadPricing();
  if (!pricing.gemini?.length && !pricing.openai?.length) {
    console.error('No pricing data available');
    process.exit(1);
  }

  const historyPath = path.join(process.cwd(), HISTORY_FILE);
  let list = [];
  try {
    const raw = fs.readFileSync(historyPath, 'utf8');
    list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch (_) {}

  const todayDateStr = todayDate.slice(0, 10);
  const existingDate = list.some((e) => e.date && String(e.date).slice(0, 10) === todayDateStr);
  if (existingDate) {
    console.log('History already has an entry for today', todayIST);
    process.exit(0);
  }

  const entry = {
    date: todayDate,
    gemini: JSON.parse(JSON.stringify(pricing.gemini || [])),
    openai: JSON.parse(JSON.stringify(pricing.openai || [])),
    anthropic: JSON.parse(JSON.stringify(pricing.anthropic || [])),
    mistral: JSON.parse(JSON.stringify(pricing.mistral || [])),
    daily: true,
    weekly: false,
  };
  list.unshift(entry);
  if (list.length > MAX_HISTORY_DAYS) list = list.slice(0, MAX_HISTORY_DAYS);

  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(historyPath, JSON.stringify(list, null, 2) + '\n', 'utf8');
  console.log('Appended daily snapshot to', HISTORY_FILE, 'for', todayIST);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
