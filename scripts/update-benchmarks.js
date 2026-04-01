#!/usr/bin/env node
/**
 * Builds benchmarks.json by merging:
 * 1. LMSYS Chatbot Arena — text, code, and document leaderboards (ELO each) — lmarena.ai/leaderboard/{text,code,document}
 * 2. Hugging Face Open LLM Leaderboard (MMLU, reasoning, etc.) — from datasets-server API
 * 3. Embedded fallback — when external data is missing or no match
 *
 * Scope: one benchmark entry per model in pricing.json for all providers (gemini, openai,
 * anthropic, mistral) and all model types (text/chat, image, audio, video). Chat models
 * get Arena/HF data when available; image/audio/video and unknowns get embedded fallback.
 * Only models with no fallback (e.g. text-embedding) are skipped.
 *
 * Architecture: Arena + HF → update-benchmarks.js → benchmarks.json. UI loads pricing + benchmarks and merges by model.
 *
 * Run: node scripts/update-benchmarks.js
 * GitHub Action: .github/workflows/update-benchmarks.yml (weekly).
 */

const OUT_FILE = 'public/benchmarks.json';
const SCHEMA_PATH = 'schemas/benchmarks.schema.json';
const PRICING_FILE = 'public/pricing.json';
const ARENA_URL_TEXT = 'https://lmarena.ai/leaderboard/text';
const ARENA_URL_CODE = 'https://lmarena.ai/leaderboard/code';
const ARENA_URL_DOCUMENT = 'https://lmarena.ai/leaderboard/document';
const HF_ROWS_URL = 'https://datasets-server.huggingface.co/rows';
const FETCH_TIMEOUT_MS = 25_000;

/** Normalize model name for matching (must match app normalizeModelName): lowercase, alphanumeric only. */
function normalizeName(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** First numeric token (handles "1504±6", "1,504", "1491±7Preliminary"). */
function parseLeaderboardNumber(s) {
  const m = String(s || '').match(/[\d,]+(?:\.\d+)?/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(/,/g, ''), 10);
}

async function fetchArenaScoresFromUrl(url, logLabel) {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BenchmarkBot/1.0)' } });
    clearTimeout(to);
    if (!res.ok) return [];
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    const scores = [];
    $('table tbody tr').each((_, row) => {
      const tds = $(row).find('td');
      if (tds.length < 2) return;
      let model;
      let scoreText;
      if (tds.length >= 7) {
        model = $(tds[2]).text().trim();
        scoreText = $(tds[3]).text().trim();
      } else if (tds.length >= 4) {
        model = $(tds[1]).text().trim();
        scoreText = $(tds[2]).text().trim();
      } else {
        model = $(tds[0]).text().trim();
        scoreText = $(tds[1]).text().trim();
      }
      const num = parseLeaderboardNumber(scoreText);
      if (model && !Number.isNaN(num)) scores.push({ model, arena: num });
    });
    if (scores.length > 0) console.log(`Arena ${logLabel}:`, scores.length, 'rows');
    return scores;
  } catch (e) {
    console.warn(`Arena ${logLabel} fetch failed:`, e.message || e);
    return [];
  }
}

async function fetchAllArenaLeaderboards() {
  const [text, code, document_] = await Promise.all([
    fetchArenaScoresFromUrl(ARENA_URL_TEXT, 'text'),
    fetchArenaScoresFromUrl(ARENA_URL_CODE, 'code'),
    fetchArenaScoresFromUrl(ARENA_URL_DOCUMENT, 'document'),
  ]);
  return { text, code, document: document_ };
}

/** Fetch Hugging Face Open LLM Leaderboard slice (MMLU-PRO, BBH, MATH, etc.). Returns [{ model, mmlu, reasoning }]. */
async function fetchHFBenchmarks() {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    const url = `${HF_ROWS_URL}?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=0&length=500`;
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(to);
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data.rows || [];
    const out = [];
    for (const row of rows) {
      const rowData = row.row || row;
      const model = rowData.Model ?? rowData.model ?? rowData.fullname ?? '';
      if (!model || typeof model !== 'string') continue;
      const mmluVal = rowData['MMLU-PRO'] ?? rowData['MMLU-PRO Raw'] ?? rowData.mmlu;
      const reasoningVal = rowData['MATH Lvl 5'] ?? rowData['MATH Lvl 5 Raw'] ?? rowData.BBH ?? rowData['BBH Raw'] ?? rowData.reasoning;
      const mmlu = typeof mmluVal === 'number' && !Number.isNaN(mmluVal) ? mmluVal : 0;
      const reasoning = typeof reasoningVal === 'number' && !Number.isNaN(reasoningVal) ? reasoningVal : 0;
      out.push({ model: model.trim(), mmlu, reasoning });
    }
    if (out.length > 0) console.log('HF leaderboard: fetched', out.length, 'rows');
    return out;
  } catch (e) {
    console.warn('HF leaderboard fetch failed:', e.message || e);
    return [];
  }
}

/** Embedded benchmark lookup (same logic as app fallback). */
function getScoresForModel(name, providerKey) {
  const n = (name || '').toLowerCase();
  if (providerKey === 'gemini') {
    if (/3\.1\s*pro/i.test(n)) return { mmlu: 87, code: 90, reasoning: 91, arena: 92 };
    if (/3\.1\s*flash-lite|3\s*flash/i.test(n)) return { mmlu: 84, code: 86, reasoning: 87, arena: 88 };
    if (/2\.5\s*pro/i.test(n)) return { mmlu: 86, code: 89, reasoning: 90, arena: 91 };
    if (/2\.5\s*flash/i.test(n)) return { mmlu: 82, code: 85, reasoning: 86, arena: 87 };
    if (/2\.0\s*flash/i.test(n)) return { mmlu: 80, code: 83, reasoning: 84, arena: 85 };
    if (/1\.5\s*pro/i.test(n)) return { mmlu: 86, code: 88, reasoning: 89, arena: 90 };
    if (/1\.5\s*flash/i.test(n)) return { mmlu: 80, code: 82, reasoning: 83, arena: 84 };
    return { mmlu: 80, code: 82, reasoning: 83, arena: 84 };
  }
  if (providerKey === 'openai') {
    if (/^text-embedding/i.test(n)) return null;
    if (/gpt-5\.2-pro|gpt-5-pro/i.test(n)) return { mmlu: 90, code: 93, reasoning: 96, arena: 97 };
    if (/gpt-5\.2|gpt-5\.1|^gpt-5$/i.test(n)) return { mmlu: 89, code: 92, reasoning: 95, arena: 96 };
    if (/gpt-5-mini/i.test(n)) return { mmlu: 85, code: 88, reasoning: 90, arena: 91 };
    if (/gpt-5-nano/i.test(n)) return { mmlu: 82, code: 85, reasoning: 87, arena: 88 };
    if (/o1|o3|o4/i.test(n)) return { mmlu: 89, code: 91, reasoning: 96, arena: 97 };
    if (/gpt-4\.1|gpt-4o/i.test(n)) return { mmlu: 88, code: 90, reasoning: 92, arena: 93 };
    if (/gpt-4\.1-mini|gpt-4o-mini/i.test(n)) return { mmlu: 84, code: 86, reasoning: 88, arena: 89 };
    return { mmlu: 85, code: 87, reasoning: 88, arena: 89 };
  }
  if (providerKey === 'anthropic') {
    if (/opus|claude-4-opus|claude-opus-4/i.test(n)) return { mmlu: 89, code: 91, reasoning: 93, arena: 95 };
    if (/sonnet|claude-4-sonnet|claude-sonnet-4/i.test(n)) return { mmlu: 87, code: 89, reasoning: 90, arena: 92 };
    if (/haiku|claude-3\.5-haiku|claude-haiku/i.test(n)) return { mmlu: 84, code: 86, reasoning: 87, arena: 88 };
    return { mmlu: 85, code: 87, reasoning: 88, arena: 89 };
  }
  if (providerKey === 'mistral') {
    if (/mistral-large|magistral|pixtral-large/i.test(n)) return { mmlu: 86, code: 88, reasoning: 89, arena: 90 };
    if (/mistral-medium|devstral|codestral/i.test(n)) return { mmlu: 83, code: 86, reasoning: 85, arena: 87 };
    return { mmlu: 80, code: 82, reasoning: 83, arena: 84 };
  }
  return { mmlu: 75, code: 78, reasoning: 80, arena: 82 };
}

/** Find best Arena match for a pricing model name (prefer exact, then longest arena slug containing pricing key). */
function findArenaScore(pricingModelName, arenaList) {
  const key = normalizeName(pricingModelName);
  if (!key) return null;
  for (const { model, arena } of arenaList) {
    const k = normalizeName(model);
    if (k === key) return arena;
  }
  let bestArena = null;
  let bestLen = -1;
  for (const { model, arena } of arenaList) {
    const k = normalizeName(model);
    if (k.includes(key) && k.length > bestLen) {
      bestArena = arena;
      bestLen = k.length;
    }
  }
  if (bestArena != null) return bestArena;
  bestLen = -1;
  const minK = Math.min(12, Math.max(6, Math.floor(key.length * 0.5)));
  for (const { model, arena } of arenaList) {
    const k = normalizeName(model);
    if (key.includes(k) && k.length >= minK && k.length > bestLen) {
      bestArena = arena;
      bestLen = k.length;
    }
  }
  return bestArena;
}

/** Find best HF match for a pricing model name. */
function findHFScores(pricingModelName, hfList) {
  const key = normalizeName(pricingModelName);
  if (!key) return null;
  for (const hf of hfList) {
    const k = normalizeName(hf.model);
    if (k === key || k.includes(key) || key.includes(k)) return { mmlu: hf.mmlu, reasoning: hf.reasoning };
  }
  return null;
}

/** Build benchmark entries for every model in pricing (all providers, all types: text/chat, image, audio, video). */
function buildBenchmarksFromPricing(pricing, arenaByCategory, hfList) {
  const entries = [];
  const providers = [
    { key: 'gemini', list: pricing.gemini },
    { key: 'openai', list: pricing.openai },
    { key: 'anthropic', list: pricing.anthropic || [] },
    { key: 'mistral', list: pricing.mistral || [] },
  ];
  const textList = arenaByCategory.text || [];
  const codeList = arenaByCategory.code || [];
  const docList = arenaByCategory.document || [];
  for (const { key, list } of providers) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const name = m && m.name ? String(m.name).trim() : '';
      if (!name) continue;
      const embedded = getScoresForModel(name, key);
      if (!embedded) continue; // e.g. text-embedding: no benchmark scores
      const arenaText = findArenaScore(name, textList);
      const arenaCode = findArenaScore(name, codeList);
      const arenaDocument = findArenaScore(name, docList);
      const hfScores = findHFScores(name, hfList);
      const row = {
        model: name,
        provider: key,
        mmlu: hfScores?.mmlu ?? embedded.mmlu,
        code: embedded.code,
        reasoning: hfScores?.reasoning ?? embedded.reasoning,
        arena: arenaText ?? embedded.arena,
      };
      if (arenaCode != null) row.arenaCode = arenaCode;
      if (arenaDocument != null) row.arenaDocument = arenaDocument;
      entries.push(row);
    }
  }
  return entries;
}

async function main() {
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(process.cwd(), OUT_FILE);
  const pricingPath = path.join(process.cwd(), PRICING_FILE);

  let pricing;
  try {
    const raw = fs.readFileSync(pricingPath, 'utf8');
    pricing = JSON.parse(raw);
  } catch (e) {
    console.error('Benchmarks update failed: Could not read or parse', PRICING_FILE, e.message);
    process.exit(1);
  }

  if (!pricing || typeof pricing !== 'object') {
    console.error('Benchmarks update failed: Invalid pricing payload');
    process.exit(1);
  }

  const [arenas, hfList] = await Promise.all([fetchAllArenaLeaderboards(), fetchHFBenchmarks()]);
  const benchmarks = buildBenchmarksFromPricing(pricing, arenas, hfList);
  const updated = new Date().toISOString().slice(0, 10);
  const payload = { updated, benchmarks };

  const schemaPath = path.join(process.cwd(), SCHEMA_PATH);
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (e) {
    console.error('Benchmarks update failed: Could not load schema', SCHEMA_PATH, e.message);
    process.exit(1);
  }
  const { default: Ajv } = await import('ajv');
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  if (!validate(payload)) {
    const errs = (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
    console.error('Benchmarks update failed: Schema validation failed:', errs);
    process.exit(1);
  }

  if (!benchmarks || benchmarks.length === 0) {
    console.error('Benchmarks update failed: Invalid dataset (no benchmark entries). Refusing to overwrite.');
    process.exit(1);
  }

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    'Wrote',
    OUT_FILE,
    `(${benchmarks.length} models, Arena text/code/doc=${arenas.text.length}/${arenas.code.length}/${arenas.document.length}, HF=${hfList.length})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
