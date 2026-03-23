#!/usr/bin/env node
/**
 * Regression checks: pricing pipeline + calculator behavior must stay consistent
 * after allowlist / provider-map changes (retired filter, embeddings, chat-only paths).
 *
 * Run: npm run test:pipeline
 *   or: node scripts/test-pipeline-invariants.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyOfficialOverlays, processPayload } from '../lib/dataPipeline.js';
import { mergeTiersIntoPayload } from '../src/data/pricingTiersOverlay.js';
import { isRetired } from '../src/utils/retiredModels.js';
import {
  getUnifiedCalcModels,
  getUnifiedCalcModelsChat,
  getChatModels,
} from '../src/calculator.js';
import { MODEL_TYPES } from '../lib/modelTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

const pricingPath = path.join(root, 'public', 'pricing.json');
if (!fs.existsSync(pricingPath)) {
  console.warn('SKIP: public/pricing.json missing');
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(pricingPath, 'utf8'));
let merged = applyOfficialOverlays({ ...raw });
mergeTiersIntoPayload(merged);
const p = processPayload(merged);

const providers = ['gemini', 'openai', 'anthropic', 'mistral'];

// 1) No retired model in any bucket (same rule as UI)
for (const pk of providers) {
  for (const m of p[pk] || []) {
    if (m && m.name && isRetired(pk, m.name)) {
      fail(`Retired model leaked into ${pk}: ${m.name}`);
    }
  }
}

// 2) Known deprecated IDs must not surface (Anthropic dot-id, OpenAI snapshot)
const forbiddenAnywhere = ['claude-3.5-haiku', 'gpt-4-0314', 'babbage-002'];
for (const name of forbiddenAnywhere) {
  for (const pk of providers) {
    if ((p[pk] || []).some((m) => m && m.name === name)) {
      fail(`Forbidden deprecated ID still present: ${name} in ${pk}`);
    }
  }
}

// 3) Gemini 1.x / 1.5 family must stay out (retired)
for (const m of p.gemini || []) {
  const n = (m.name || '').toLowerCase();
  if (/^gemini-1\.(0|5)-/.test(n) || /^gemini-1\.5/.test(n)) {
    fail(`Retired Gemini 1.x/1.5 leaked: ${m.name}`);
  }
}

// 4) Cross-bucket: flagship OpenAI chat model must not live under Gemini
if ((p.gemini || []).some((m) => /^(gpt-5|gpt-4o)(-|$)/i.test(m.name || ''))) {
  fail('OpenAI-prefixed model wrongly classified under gemini after pipeline');
}

// 5) Calculator dropdown: embeddings excluded (unchanged behavior)
const unified = getUnifiedCalcModels(p);
for (const e of unified) {
  const n = (e.model?.name || '').toLowerCase();
  if (e.provider === 'openai' && /^text-embedding/.test(n)) {
    fail('OpenAI text-embedding in getUnifiedCalcModels');
  }
  if (e.provider === 'gemini' && /embedding/.test(n)) {
    fail('Gemini embedding in getUnifiedCalcModels');
  }
}

// 6) Chat-centric views still have data
const chatRows = getChatModels(p);
if (chatRows.length === 0) fail('getChatModels returned no rows');
if (!chatRows.every((row) => row.modelType === MODEL_TYPES.CHAT)) {
  fail('getChatModels included non-chat modelType');
}

const calcChat = getUnifiedCalcModelsChat(p);
if (calcChat.length === 0) fail('getUnifiedCalcModelsChat returned no rows');

console.log('OK: pipeline invariants', {
  byProvider: Object.fromEntries(providers.map((k) => [k, (p[k] || []).length])),
  unifiedCalcModels: unified.length,
  chatModels: chatRows.length,
  calcChatModels: calcChat.length,
});
