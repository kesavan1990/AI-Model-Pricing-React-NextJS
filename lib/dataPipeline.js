/**
 * Shared data pipeline: official overlays + reassign provider + allowlist + retired filter.
 * Used by the React app (PricingContext). Keeps parity with src/app.js setData logic.
 */

import { mergeOpenAIOfficialIntoPayload } from '../src/data/openaiOfficialOverlay.js';
import { mergeGeminiOfficialIntoPayload } from '../src/data/geminiOfficialOverlay.js';
import { mergeAnthropicOfficialIntoPayload } from '../src/data/anthropicOfficialOverlay.js';
import { mergeMistralOfficialIntoPayload } from '../src/data/mistralOfficialOverlay.js';
import { getProviderByModelName } from '../src/data/providerByModel.js';
import { isAllowedModel } from '../src/data/allowedModels.js';
import {
  isRetiredGeminiModel,
  isRetiredOpenAIModel,
  isRetiredAnthropicModel,
  isRetiredMistralModel,
} from '../src/utils/retiredModels.js';

export function applyOfficialOverlays(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  let out = payload;
  out = mergeOpenAIOfficialIntoPayload(out);
  out = mergeGeminiOfficialIntoPayload(out);
  out = mergeAnthropicOfficialIntoPayload(out);
  out = mergeMistralOfficialIntoPayload(out);
  return out;
}

function reassignByCanonicalProvider(data) {
  if (!data || typeof data !== 'object') return data;
  const buckets = { gemini: [], openai: [], anthropic: [], mistral: [] };
  const seen = { gemini: new Set(), openai: new Set(), anthropic: new Set(), mistral: new Set() };
  const push = (provider, model) => {
    if (!model || !model.name || !buckets[provider]) return;
    const key = model.name.toLowerCase().trim();
    if (seen[provider].has(key)) return;
    seen[provider].add(key);
    buckets[provider].push(model);
  };
  for (const provider of ['gemini', 'openai', 'anthropic', 'mistral']) {
    const list = data[provider];
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (!m || !m.name) continue;
      const canonical = getProviderByModelName(m.name);
      if (canonical) push(canonical, m);
      else push(provider, m);
    }
  }
  return { ...data, ...buckets };
}

function filterToAllowedModels(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    gemini: Array.isArray(data.gemini) ? data.gemini.filter((m) => m && isAllowedModel('gemini', m.name)) : data.gemini,
    openai: Array.isArray(data.openai) ? data.openai.filter((m) => m && isAllowedModel('openai', m.name)) : data.openai,
    anthropic: Array.isArray(data.anthropic) ? data.anthropic.filter((m) => m && isAllowedModel('anthropic', m.name)) : data.anthropic,
    mistral: Array.isArray(data.mistral) ? data.mistral.filter((m) => m && isAllowedModel('mistral', m.name)) : data.mistral,
  };
}

function filterRetiredModels(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    gemini: Array.isArray(data.gemini) ? data.gemini.filter((m) => m && !isRetiredGeminiModel(m.name)) : data.gemini,
    openai: Array.isArray(data.openai) ? data.openai.filter((m) => m && !isRetiredOpenAIModel(m.name)) : data.openai,
    anthropic: Array.isArray(data.anthropic) ? data.anthropic.filter((m) => m && !isRetiredAnthropicModel(m.name)) : data.anthropic,
    mistral: Array.isArray(data.mistral) ? data.mistral.filter((m) => m && !isRetiredMistralModel(m.name)) : data.mistral,
  };
}

/** Run reassign → allowlist → retired. Returns cleaned payload. */
export function processPayload(data) {
  const reassigned = reassignByCanonicalProvider(data);
  const allowed = filterToAllowedModels(reassigned);
  return filterRetiredModels(allowed);
}
