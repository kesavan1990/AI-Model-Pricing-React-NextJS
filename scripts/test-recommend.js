/**
 * Test script for the Recommend section: runs multiple scenarios and prints results.
 * Run from project root: node scripts/test-recommend.js
 * Uses real pricing data from public/pricing.json and the same logic as the app.
 */

import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const toUrl = (p) => pathToFileURL(join(rootDir, p)).href;

async function loadData() {
  const { applyOfficialOverlays, processPayload } = await import(toUrl('lib/dataPipeline.js'));
  const { mergeTiersIntoPayload } = await import(toUrl('src/data/pricingTiersOverlay.js'));
  const path = join(rootDir, 'public/pricing.json');
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error('Could not load public/pricing.json:', e.message);
    process.exit(1);
  }
  let merged = applyOfficialOverlays(raw);
  mergeTiersIntoPayload(merged);
  const data = processPayload(merged);
  return data;
}

function toSearchableRecord(item) {
  const parts = [...(item.keywords || []), item.model, item.provider, item.source].filter(Boolean);
  return { ...item, _searchable: parts.join(' ').toLowerCase() };
}

function searchStaticIndex(query, index, Fuse) {
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  const withSearchable = index.map(toSearchableRecord);
  const fuse = new Fuse(withSearchable, {
    keys: ['_searchable'],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
  });
  const results = fuse.search(query.trim().toLowerCase());
  return results.map((r) => ({ ...r.item, _score: r.score }));
}

function indexHitMatchesDataModel(hitModel, dataModelName, normalizeModelNameFn) {
  if (!hitModel || !dataModelName) return false;
  const nHit = normalizeModelNameFn(hitModel);
  const nData = normalizeModelNameFn(dataModelName);
  if (nHit === nData) return true;
  if (nData.startsWith(nHit)) return true;
  if (nHit.startsWith(nData)) return true;
  return false;
}

function resolveIndexHitsToModels(indexHits, allModels, normalizeModelName) {
  const seen = new Set();
  const out = [];
  for (const hit of indexHits) {
    const hitKey = hit.providerKey + ':' + (hit.model || '').toLowerCase();
    if (seen.has(hitKey)) continue;
    const candidates = allModels.filter(
      (m) =>
        m.providerKey === hit.providerKey &&
        indexHitMatchesDataModel(hit.model, m.name, normalizeModelName)
    );
    if (candidates.length === 0) continue;
    seen.add(hitKey);
    const exact = candidates.find((m) => normalizeModelName(m.name) === normalizeModelName(hit.model));
    const model = exact || candidates.find((m) => m.name === hit.model) || candidates[0];
    out.push({ ...model, docSnippet: 'From ' + (hit.source || 'provider documentation') + '.', _fromIndex: true });
  }
  return out;
}

const TEST_CASES = [
  { description: '', expectedType: 'general', label: 'Empty description' },
  { description: 'cheap model for high volume', expectedType: 'cost', label: 'Cost / cheap' },
  { description: 'best quality for complex reasoning', expectedType: 'accuracy', label: 'Accuracy / quality' },
  { description: 'long documents and PDF summarization', expectedType: 'long-doc', label: 'Long document' },
  { description: 'code generation and developer API', expectedType: 'code', label: 'Code' },
  { description: 'fast throughput and high volume batch', expectedType: 'high-volume', label: 'High volume' },
  { description: 'balanced general purpose', expectedType: 'general', label: 'General / balance' },
  { description: 'low cost budget affordable', expectedType: 'cost', label: 'Budget keywords' },
  { description: 'best-in-class text and vision', expectedType: 'balanced', label: 'Vision (static index)' },
  { description: 'summarize PDFs with large context', expectedType: 'long-doc', label: 'Summarize + context' },
];

async function run() {
  const calc = await import(toUrl('src/calculator.js'));
  const { RECOMMEND_DOC_INDEX } = await import(toUrl('data/recommendDocIndex.js'));

  const Fuse = (await import('fuse.js')).default;
  console.log('Loading pricing data...');
  const data = await loadData();
  const allModels = calc.getAllModels(data);
  console.log('Models loaded:', allModels.length);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    console.log('---', test.label, '---');
    console.log('Input:', test.description || '(empty)');

    const useCaseType = calc.inferUseCaseType(test.description);
    console.log('Inferred use case type:', useCaseType);
    if (test.expectedType && useCaseType !== test.expectedType) {
      console.log('  ⚠ Expected type:', test.expectedType);
      failed++;
    } else if (test.expectedType) {
      passed++;
    }

    const fallbackRecs = calc.getRecommendations(data, useCaseType, test.description);

    let indexHits = [];
    try {
      indexHits = searchStaticIndex(test.description, RECOMMEND_DOC_INDEX, Fuse);
    } catch (e) {
      console.log('  (Fuse.js search skipped:', e.message, ')');
    }
    const fromIndex = resolveIndexHitsToModels(indexHits, allModels, calc.normalizeModelName).slice(0, 6);
    const usedIndex = fromIndex.length > 0;

    let recs;
    if (usedIndex) {
      const seen = new Set(fromIndex.map((m) => m.providerKey + ':' + m.name));
      recs = fromIndex.map((m) => ({ ...m, reason: m.reason || calc.getFallbackReason(m) }));
      for (const r of fallbackRecs) {
        if (recs.length >= 6) break;
        const id = r.providerKey + ':' + r.name;
        if (!seen.has(id)) {
          seen.add(id);
          recs.push(r);
        }
      }
    } else {
      recs = fallbackRecs || [];
    }

    console.log('Recommendations:', recs.length);
    recs.slice(0, 6).forEach((m, i) => {
      console.log(`  ${i + 1}. [${m.providerKey}] ${m.name} — ${(m.reason || '').slice(0, 60)}...`);
    });
    if (usedIndex) console.log('  (includes static index matches)');
    console.log('');
  }

  console.log('=== Summary ===');
  console.log('Use-case type checks:', passed, 'passed', failed ? `, ${failed} unexpected` : '');
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
