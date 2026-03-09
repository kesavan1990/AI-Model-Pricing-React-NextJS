#!/usr/bin/env node
/**
 * Fetches pricing from Vizra API and writes pricing.json.
 * Used by GitHub Actions to avoid frontend rate limits.
 * Mirrors frontend normalization: provider (google→gemini), units (1k→per 1M), schema.
 *
 * Failure handling: on API timeout, rate limit (429), non-OK status, empty response,
 * or malformed JSON, logs an error and exits with code 1 so the workflow does not commit.
 */

const VIZRA_URL = 'https://vizra.ai/api/v1/pricing/ai-models';
const OUT_FILE = 'pricing.json';

function normalizeProvider(p) {
  if (p == null || p === '') return '';
  const s = String(p).toLowerCase().trim();
  if (s === 'google' || s.startsWith('google')) return 'gemini';
  if (s === 'openai') return 'openai';
  if (s === 'anthropic') return 'anthropic';
  if (s === 'mistral') return 'mistral';
  return p;
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

function parseVizraResponse(data) {
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

const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url, opts = {}) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    clearTimeout(to);
    return res;
  } catch (e) {
    clearTimeout(to);
    if (e.name === 'AbortError') throw new Error('API timeout');
    throw e;
  }
}

async function main() {
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(process.cwd(), OUT_FILE);

  let data;
  try {
    const res = await fetchWithTimeout(VIZRA_URL, { cache: 'no-store' });

    if (!res.ok) {
      const msg = res.status === 429 ? 'Rate limit (429)' : `API error: ${res.status}`;
      throw new Error(`${msg} ${res.statusText || ''}`.trim());
    }

    const raw = await res.text();
    if (raw == null || String(raw).trim() === '') {
      throw new Error('Empty response from API');
    }

    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new Error('Malformed JSON from API');
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Empty or invalid response body');
    }
  } catch (err) {
    console.error('Pricing fetch failed:', err.message || err);
    process.exit(1);
  }

  const parsed = parseVizraResponse(data);
  if (!parsed.gemini.length && !parsed.openai.length) {
    console.error('Pricing fetch failed: No pricing data in response');
    process.exit(1);
  }

  const updated = new Date().toISOString().slice(0, 10);
  const payload = {
    updated,
    gemini: parsed.gemini,
    openai: parsed.openai,
    anthropic: parsed.anthropic || [],
    mistral: parsed.mistral || [],
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT_FILE, `(${parsed.gemini.length} Gemini, ${parsed.openai.length} OpenAI, ${(parsed.anthropic || []).length} Anthropic, ${(parsed.mistral || []).length} Mistral)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
