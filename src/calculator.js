/**
 * Calculator and model-selection logic: cost, context, benchmarks, recommendations.
 * Pure functions; all take data (gemini, openai, anthropic, mistral) as arguments.
 * Retired models are excluded in getAllModels and getUnifiedCalcModels (Models, Value Analysis, Calculators, Benchmarks, Recommend).
 */

import { encode as cl100kEncode } from 'gpt-tokenizer';
import { isRetired } from './utils/retiredModels.js';
import { isAllowedModel } from './data/allowedModels.js';
import { getModelType, MODEL_TYPES } from '../lib/modelTypes.js';

export const PROVIDER_DISPLAY_ORDER = { gemini: 0, openai: 1, anthropic: 2, mistral: 3 };

/**
 * Normalize model name for matching across pricing and benchmarks (e.g. gpt-4o, gpt4o, GPT-4o → same key).
 * @param {string} name
 * @returns {string}
 */
export function normalizeModelName(name) {
  if (name == null || typeof name !== 'string') return '';
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export function formatContextLabel(tokens) {
  if (tokens >= 1e6) return tokens / 1e6 + 'M';
  if (tokens >= 1e3) return tokens / 1e3 + 'k';
  return String(tokens);
}

export function getContextWindow(providerKey, modelName) {
  const n = (modelName || '').toLowerCase();
  if (providerKey === 'gemini') {
    if (/3\.1\s*pro|2\.5\s*pro|1\.5\s*pro/i.test(n)) return { tokens: 2097152, label: '2M' };
    if (/3\.|2\.5|2\.0|1\.5/i.test(n)) return { tokens: 1048576, label: '1M' };
    return { tokens: 1048576, label: '1M' };
  }
  if (providerKey === 'openai') {
    if (/^text-embedding/i.test(n)) return null;
    if (/o1|o3|o4/i.test(n)) return { tokens: 200000, label: '200k' };
    if (/gpt-5|gpt-5\./i.test(n)) return { tokens: 256000, label: '256k' };
    return { tokens: 128000, label: '128k' };
  }
  if (providerKey === 'anthropic') {
    return { tokens: 200000, label: '200k' };
  }
  if (providerKey === 'mistral') {
    if (/mistral-large|magistral|mixtral-8x22b/i.test(n)) return { tokens: 128000, label: '128k' };
    return { tokens: 32768, label: '32k' };
  }
  return null;
}

export function getBenchmarkForModel(name, providerKey) {
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

/**
 * Get benchmark scores for a model: from file (benchmarks.json) if provided and entry exists, else fallback.
 * @param {string} name - Model name
 * @param {string} providerKey - gemini | openai | anthropic | mistral
 * @param {Array<{ model: string, provider: string, mmlu?: number, code?: number, reasoning?: number, arena?: number, arenaCode?: number, arenaDocument?: number }>|null} fileBenchmarks - From benchmarks.json
 * @returns {{ mmlu: number, code: number, reasoning: number, arena: number, arenaCode?: number, arenaDocument?: number }}
 */
export function getBenchmarkForModelMerged(name, providerKey, fileBenchmarks) {
  if (Array.isArray(fileBenchmarks) && fileBenchmarks.length > 0) {
    const norm = normalizeModelName(name);
    const entry = fileBenchmarks.find(
      (e) => e && e.provider === providerKey && normalizeModelName(e.model) === norm
    );
    if (entry) {
      const out = {
        mmlu: typeof entry.mmlu === 'number' ? entry.mmlu : 0,
        code: typeof entry.code === 'number' ? entry.code : 0,
        reasoning: typeof entry.reasoning === 'number' ? entry.reasoning : 0,
        arena: typeof entry.arena === 'number' ? entry.arena : 0,
      };
      if (typeof entry.arenaCode === 'number') out.arenaCode = entry.arenaCode;
      if (typeof entry.arenaDocument === 'number') out.arenaDocument = entry.arenaDocument;
      return out;
    }
  }
  return getBenchmarkForModel(name, providerKey);
}

export function getCostTier(blended) {
  if (blended <= 0) return '$';
  if (blended < 2) return '$$';
  return '$$$';
}

export function getCostTierLabel(blended) {
  if (blended <= 0) return { tier: '$', desc: 'Free / very low' };
  if (blended < 2) return { tier: '$$', desc: 'Budget (<$2/1M blended)' };
  return { tier: '$$$', desc: 'Premium (≥$2/1M blended)' };
}

export function calcCost(inputTokens, outputTokens, inputPerM, outputPerM) {
  return (inputTokens / 1e6) * inputPerM + (outputTokens / 1e6) * outputPerM;
}

export function calcCostOpenAI(inputTokens, cachedTokens, outputTokens, inputPerM, cachedPerM, outputPerM) {
  const cache = Number(cachedTokens) || 0;
  const nonCached = Math.max(0, (Number(inputTokens) || 0) - cache);
  const out = Number(outputTokens) || 0;
  const inputCost = (nonCached / 1e6) * inputPerM;
  const cachedCost = cachedPerM != null ? (cache / 1e6) * cachedPerM : (cache / 1e6) * inputPerM;
  const outputCost = (out / 1e6) * outputPerM;
  return inputCost + cachedCost + outputCost;
}

export function calcCostForEntry(entry, inputTokens, cachedTokens, outputTokens) {
  if (!entry) return 0;
  const inT = inputTokens || 0;
  const outT = outputTokens || 0;
  const rate = entry.model.tiers?.length ? entry.model.tiers[0] : entry.model;
  const inp = Number(rate.input) || 0;
  const out = Number(rate.output) || 0;
  const cached = rate.cachedInput != null ? Number(rate.cachedInput) : null;
  if (entry.provider === 'gemini' || entry.provider === 'anthropic' || entry.provider === 'mistral') {
    return calcCost(inT, outT, inp, out);
  }
  return calcCostOpenAI(inT, cachedTokens || 0, outT, inp, cached, out);
}

function isEmbeddingOnlyModel(provider, modelName) {
  const n = (modelName || '').toLowerCase();
  if (provider === 'gemini' && /embedding/.test(n)) return true;
  if (provider === 'openai' && /^text-embedding/.test(n)) return true;
  return false;
}

export function getUnifiedCalcModels(data) {
  if (!data || typeof data !== 'object') return [];
  const { gemini = [], openai = [], anthropic = [], mistral = [] } = data;
  const list = [];
  gemini.forEach((m, i) => {
    if (isEmbeddingOnlyModel('gemini', m.name)) return;
    if (isAllowedModel('gemini', m.name) && !isRetired('gemini', m.name)) list.push({ key: 'gemini:' + i, provider: 'gemini', label: 'Google Gemini — ' + m.name, model: m });
  });
  openai.forEach((m, i) => {
    if (isEmbeddingOnlyModel('openai', m.name)) return;
    if (isAllowedModel('openai', m.name) && !isRetired('openai', m.name)) list.push({ key: 'openai:' + i, provider: 'openai', label: 'OpenAI — ' + m.name, model: m });
  });
  anthropic.forEach((m, i) => { if (isAllowedModel('anthropic', m.name) && !isRetired('anthropic', m.name)) list.push({ key: 'anthropic:' + i, provider: 'anthropic', label: 'Anthropic — ' + m.name, model: m }); });
  mistral.forEach((m, i) => { if (isAllowedModel('mistral', m.name) && !isRetired('mistral', m.name)) list.push({ key: 'mistral:' + i, provider: 'mistral', label: 'Mistral — ' + m.name, model: m }); });
  return list;
}

/** Same shape as getUnifiedCalcModels but only chat/text models (for Pricing and Prompt cost calculators). */
export function getUnifiedCalcModelsChat(data) {
  return getUnifiedCalcModels(data).filter((u) => getModelType(u.provider, u.model) === MODEL_TYPES.CHAT);
}

export function getCalcModelByKey(key, data) {
  if (!key || key === '__all__') return null;
  if (!data || typeof data !== 'object') return null;
  const [provider, idxStr] = key.split(':');
  const i = parseInt(idxStr, 10);
  const { gemini = [], openai = [], anthropic = [], mistral = [] } = data;
  if (provider === 'gemini' && i >= 0 && i < gemini.length) return { provider: 'gemini', name: gemini[i].name, model: gemini[i] };
  if (provider === 'openai' && i >= 0 && i < openai.length) return { provider: 'openai', name: openai[i].name, model: openai[i] };
  if (provider === 'anthropic' && i >= 0 && i < anthropic.length) return { provider: 'anthropic', name: anthropic[i].name, model: anthropic[i] };
  if (provider === 'mistral' && i >= 0 && i < mistral.length) return { provider: 'mistral', name: mistral[i].name, model: mistral[i] };
  return null;
}

const INPUT_WEIGHT = 0.7;
const OUTPUT_WEIGHT = 0.3;

function pushModel(list, provider, providerKey, m, input, output, cachedInput, contextTier) {
  const modelType = getModelType(providerKey, m);
  const ctx = modelType === MODEL_TYPES.CHAT ? getContextWindow(providerKey, m.name) : null;
  const blended = input * INPUT_WEIGHT + output * OUTPUT_WEIGHT;
  const tier = input === 0 && output === 0 ? 'budget' : blended >= 8 ? 'pro' : blended < 1 ? 'budget' : 'mid';
  list.push({
    provider,
    providerKey,
    name: m.name,
    input,
    output,
    cachedInput: cachedInput ?? null,
    blended,
    tier,
    hasCached: cachedInput != null,
    contextWindow: ctx ? ctx.label : null,
    contextTokens: ctx ? ctx.tokens : 0,
    contextTier: contextTier ?? null,
    modelType,
    pricingPerImage: m.pricingPerImage != null ? Number(m.pricingPerImage) : null,
    pricingPerSecond: m.pricingPerSecond != null ? Number(m.pricingPerSecond) : null,
    pricingPerMinute: m.pricingPerMinute != null ? Number(m.pricingPerMinute) : null,
  });
}

export function getAllModels(data) {
  if (!data || typeof data !== 'object') return [];
  const { gemini = [], openai = [], anthropic = [], mistral = [] } = data;
  const list = [];
  gemini.forEach((m) => {
    if (!isAllowedModel('gemini', m.name) || isRetired('gemini', m.name)) return;
    if (m.tiers && m.tiers.length > 0) {
      m.tiers.forEach((t) => pushModel(list, 'Google Gemini', 'gemini', m, Number(t.input) || 0, Number(t.output) || 0, null, t.contextLabel));
    } else {
      pushModel(list, 'Google Gemini', 'gemini', m, Number(m.input) || 0, Number(m.output) || 0, null, null);
    }
  });
  openai.forEach((m) => {
    if (/^text-embedding/i.test(m.name)) return;
    if (!isAllowedModel('openai', m.name) || isRetired('openai', m.name)) return;
    if (m.tiers && m.tiers.length > 0) {
      m.tiers.forEach((t) => pushModel(list, 'OpenAI', 'openai', m, Number(t.input) || 0, Number(t.output) || 0, t.cachedInput != null ? Number(t.cachedInput) : null, t.contextLabel));
    } else {
      const input = Number(m.input) || 0, output = Number(m.output) || 0, cached = Number(m.cachedInput) || 0;
      pushModel(list, 'OpenAI', 'openai', m, input, output, m.cachedInput != null ? cached : null, null);
    }
  });
  anthropic.forEach((m) => {
    if (!isAllowedModel('anthropic', m.name) || isRetired('anthropic', m.name)) return;
    if (m.tiers && m.tiers.length > 0) {
      m.tiers.forEach((t) => pushModel(list, 'Anthropic', 'anthropic', m, Number(t.input) || 0, Number(t.output) || 0, null, t.contextLabel));
    } else {
      pushModel(list, 'Anthropic', 'anthropic', m, Number(m.input) || 0, Number(m.output) || 0, null, null);
    }
  });
  mistral.forEach((m) => {
    if (!isAllowedModel('mistral', m.name) || isRetired('mistral', m.name)) return;
    if (m.tiers && m.tiers.length > 0) {
      m.tiers.forEach((t) => pushModel(list, 'Mistral', 'mistral', m, Number(t.input) || 0, Number(t.output) || 0, null, t.contextLabel));
    } else {
      pushModel(list, 'Mistral', 'mistral', m, Number(m.input) || 0, Number(m.output) || 0, null, null);
    }
  });
  return list;
}

export function scoreModelForUseCase(m, useCaseType, description) {
  const d = (description || '').toLowerCase();
  const costScore = m.blended <= 0 ? 1 : Math.max(0, 1 - m.blended / 20);
  const reasoningScore = (m.tier === 'pro' || /Pro|o1|o3|o4|gpt-5-pro|gpt-5\.2-pro/i.test(m.name)) ? 1 : m.tier === 'mid' ? 0.5 : 0.2;
  const contextScore = m.contextTokens >= 1e6 ? 1 : m.contextTokens >= 200000 ? 0.7 : m.contextTokens >= 128000 ? 0.5 : 0.3;
  const performanceScore = m.tier === 'pro' ? 1 : m.tier === 'mid' ? 0.6 : 0.4;
  let wCost = 0.25,
    wReasoning = 0.25,
    wContext = 0.25,
    wPerf = 0.25;
  if (/cheap|low cost|budget|affordable|save money|minimize cost/i.test(d)) {
    wCost = 0.5;
    wReasoning = 0.1;
    wContext = 0.2;
    wPerf = 0.2;
  }
  if (/accurate|reasoning|complex|quality|precise|sophisticated/i.test(d)) {
    wReasoning = 0.5;
    wCost = 0.15;
    wContext = 0.2;
    wPerf = 0.15;
  }
  if (/long document|pdf|context|large file|many pages|summariz|cached|high context/i.test(d)) {
    wContext = 0.45;
    wCost = 0.25;
    wReasoning = 0.1;
    wPerf = 0.2;
  }
  if (/performance|fast|speed|throughput|scale|high volume/i.test(d)) {
    wPerf = 0.4;
    wCost = 0.3;
    wContext = 0.15;
    wReasoning = 0.15;
  }
  const score = wCost * costScore + wReasoning * reasoningScore + wContext * contextScore + wPerf * performanceScore;
  const dimensions = [];
  if (costScore >= 0.6) dimensions.push('Cost');
  if (reasoningScore >= 0.5) dimensions.push('Reasoning');
  if (contextScore >= 0.5) dimensions.push('Context');
  if (performanceScore >= 0.5) dimensions.push('Performance');
  return { score, dimensions, costScore, reasoningScore, contextScore, performanceScore };
}

export function inferUseCaseType(description) {
  const d = (description || '').toLowerCase();
  if (/cheap|low cost|budget|minimize cost|cost effective|save money|affordable|lowest cost/i.test(d)) return 'cost';
  if (/accurate|best quality|complex|reasoning|precise|correct|quality|sophisticated/i.test(d)) return 'accuracy';
  if (/long document|pdf|context|cached|large file|many pages|high context|summariz/i.test(d)) return 'long-doc';
  if (/code|programming|developer|software|script|api/i.test(d)) return 'code';
  if (/high volume|throughput|real-time|realtime|batch|millions|scale|performance|fast|speed/i.test(d)) return 'high-volume';
  if (/balance|general|default|all purpose|multi|various/i.test(d)) return 'general';
  if (d.trim().length > 0) return 'balanced';
  return 'general';
}

export function extractKeywords(description) {
  if (!description || !description.trim()) return [];
  const stop = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'and', 'or', 'but', 'if', 'then', 'so', 'i', 'we', 'my', 'our',
    'need', 'want', 'get', 'use', 'using',
  ]);
  const words = description
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  return [...new Set(words)];
}

export function searchDocContent(html, modelNames, keywords) {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const results = [];
  const lower = text.toLowerCase();
  for (const name of modelNames) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 180);
    const end = Math.min(text.length, idx + name.length + 220);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    snippet = snippet.replace(/\s+/g, ' ').slice(0, 280);
    const windowStart = Math.max(0, idx - 350);
    const windowEnd = Math.min(text.length, idx + 350);
    const windowText = lower.slice(windowStart, windowEnd);
    const keywordCount = keywords.filter((kw) => windowText.includes(kw)).length;
    results.push({ modelName: name, snippet, keywordCount });
  }
  return results.sort((a, b) => b.keywordCount - a.keywordCount);
}

export function cleanDocSnippetForDisplay(snippet) {
  if (!snippet || typeof snippet !== 'string') return null;
  const s = snippet.trim().replace(/\s+/g, ' ');
  if (s.length < 20) return null;
  const lower = s.toLowerCase();
  const dollarCount = (s.match(/\$\d/g) || []).length;
  const looksLikeTable =
    dollarCount >= 4 ||
    (/\b(input|cached input|output)\s*(input|cached|output)/i.test(s) && dollarCount >= 2) ||
    /\b(model|flex|standard|priority|batch)\s+input\s+cached/i.test(lower) ||
    /gpt-\d[\d.]*\s*\$\d|gemini\s*\d[\d.]*\s*\$\d/i.test(s);
  if (looksLikeTable) return null;
  const firstSentence = s.match(/[^.]{10,160}\.?/);
  const excerpt = firstSentence ? firstSentence[0].trim() : s.slice(0, 120).trim();
  const stillTableLike = (/\$\d\.\d+\s+\$\d\.\d+|\b(input|output|cached)\s*\/\s*1\s*m/i.test(excerpt) && dollarCount >= 2);
  if (stillTableLike || excerpt.length < 15) return null;
  return excerpt.length > 140 ? excerpt.slice(0, 137) + '…' : excerpt;
}

export function getGeneratedDocNote(modelResult, useCaseType) {
  const provider = modelResult.provider || 'documentation';
  const name = modelResult.name || '';
  const templates = [
    provider + ' documentation lists this model as suitable for ' + (useCaseType === 'cost' ? 'cost-sensitive' : useCaseType === 'accuracy' ? 'high-accuracy' : useCaseType === 'long-doc' ? 'long-context' : 'general') + ' workloads.',
    'This model is referenced in ' + provider + ' docs for use cases like yours.',
    'Official ' + provider + ' documentation recommends this model for similar scenarios.',
    'Documented by ' + provider + ' as a fit for ' + (useCaseType === 'cost' ? 'budget-conscious' : useCaseType === 'accuracy' ? 'demanding' : useCaseType === 'long-doc' ? 'extended-context' : 'diverse') + ' applications.',
    'Listed in ' + provider + ' documentation for this type of use case.',
    'Docs suggest this model for ' + (useCaseType === 'cost' ? 'low-cost' : useCaseType === 'accuracy' ? 'accuracy-focused' : useCaseType === 'long-doc' ? 'large-context' : 'general') + ' needs.',
  ];
  const idx = Math.abs((name.length + provider.length * 3) % templates.length);
  return templates[idx];
}

export function getFallbackReason(m) {
  const provider = m.provider || 'This model';
  const tier = m.tier || 'mid';
  if (m.blended <= 0) return 'Free tier — ideal for experimentation.';
  if (m.hasCached) return 'Cached input support — cheaper for repeated long context.';
  if (tier === 'budget') return `${provider} — low cost at $${(m.blended || 0).toFixed(2)}/1M blended. Good for high volume or tight budgets.`;
  if (tier === 'pro') return `${provider} — high capability tier. Best for complex tasks and accuracy.`;
  return `${provider} — $${(m.blended || 0).toFixed(2)}/1M blended. Solid choice for most tasks.`;
}

/** Ensure at least one model per provider when possible, then fill up to 6 by score. */
const MAX_RECOMMENDATIONS = 6;

export function getRecommendations(data, useCaseType, description) {
  const all = getAllModels(data);
  const scored = all.map((m) => {
    const { score, dimensions } = scoreModelForUseCase(m, useCaseType, description);
    return { ...m, _score: score, _dimensions: dimensions };
  });
  scored.sort((a, b) => (b._score || 0) - (a._score || 0));
  // Guarantee at least one per provider (so e.g. Mistral always appears if they have models), then fill by score
  const seen = new Set();
  const byProviderBest = new Map();
  for (const m of scored) {
    const key = m.providerKey || m.provider || 'other';
    if (!byProviderBest.has(key)) {
      byProviderBest.set(key, m);
      seen.add(m.name + '|' + key);
    }
  }
  const result = [...byProviderBest.values()];
  result.sort((a, b) => (b._score || 0) - (a._score || 0));
  for (const m of scored) {
    if (result.length >= MAX_RECOMMENDATIONS) break;
    const id = m.name + '|' + (m.providerKey || m.provider || 'other');
    if (!seen.has(id)) {
      result.push(m);
      seen.add(id);
    }
  }
  result.sort((a, b) => (b._score || 0) - (a._score || 0));
  const top = result.slice(0, MAX_RECOMMENDATIONS);
  return top.map((m) => {
    const dims = m._dimensions && m._dimensions.length ? m._dimensions.join(' · ') : '';
    let reason = dims ? dims + ' — ' : '';
    if (m.blended <= 0) reason += 'Free tier. ';
    else reason += `$${m.blended.toFixed(2)}/1M blended. `;
    if (m.contextWindow) reason += `${m.contextWindow} context. `;
    if (m.hasCached) reason += 'Cached input for long context. ';
    if (m.tier === 'pro' || /Pro|o1|o3|o4|gpt-5-pro/i.test(m.name)) reason += 'Strong reasoning.';
    else if (m.tier === 'budget') reason += 'Cost-optimized.';
    else reason += 'Good balance.';
    return { ...m, reason: reason.trim() || getFallbackReason(m) };
  });
}

export function estimatePromptTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const t = text.trim();
  if (t.length === 0) return 0;
  try {
    const tokens = cl100kEncode(t);
    return Array.isArray(tokens) ? tokens.length : Math.ceil(t.length / 4);
  } catch (_) {}
  return Math.ceil(t.length / 4);
}

/**
 * Token count for OpenAI-style chat API: user message + assistant turn start.
 * Matches what tools like Tiktokenizer show (content + <|im_start|>user<|im_sep|>...<|im_end|><|im_start|>assistant<|im_sep|>).
 */
export function estimatePromptTokensWithOpenAIChatFormat(text) {
  if (!text || typeof text !== 'string') return 0;
  const content = text.trim();
  const fullMessage = '<|im_start|>user<|im_sep|>' + content + '<|im_end|><|im_start|>assistant<|im_sep|>';
  return estimatePromptTokens(fullMessage);
}

/** Returns only chat models (for Value Analysis, Benchmarks, and default views). Keeps existing behavior unchanged. */
export function getChatModels(data) {
  const all = getAllModels(data);
  return all.filter((m) => m.modelType === MODEL_TYPES.CHAT);
}
