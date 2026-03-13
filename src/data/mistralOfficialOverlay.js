/**
 * Mistral AI models and prices from the official pricing page so they always appear
 * even when the API or pricing.json omits them.
 * Source: https://docs.mistral.ai/deployment/laplateforme/pricing , https://mistral.ai/pricing (per 1M tokens).
 * Changelog/deprecations: https://docs.mistral.ai/getting-started/changelog
 * Update when the official page changes.
 */

/** Official Mistral models (name, input, output per 1M tokens). Missing models are merged into loaded payload. */
export const MISTRAL_OFFICIAL_MODELS = [
  { name: 'mistral-large-3', input: 0.5, output: 1.5 },
  { name: 'mistral-large-2512', input: 0.5, output: 1.5 },
  { name: 'mistral-medium-3-1-2508', input: 0.4, output: 2 },
  { name: 'mistral-small-3-2-2506', input: 0.06, output: 0.18 },
  { name: 'mistral-3.1-small', input: 0.1, output: 0.3 },
  { name: 'ministral-3-3b-2512', input: 0.1, output: 0.1 },
  { name: 'ministral-3-8b-2512', input: 0.15, output: 0.15 },
  { name: 'ministral-3-14b-2512', input: 0.2, output: 0.2 },
  { name: 'codestral-2508', input: 0.3, output: 0.9 },
  { name: 'codestral-2405', input: 1, output: 3 },
  { name: 'magistral-medium-1-2-2509', input: 2, output: 5 },
  { name: 'magistral-small-1-2-2509', input: 0.5, output: 1.5 },
  { name: 'pixtral-large-2411', input: 2, output: 6 },
  { name: 'pixtral-12b-2409', input: 0.15, output: 0.15 },
  { name: 'devstral-2512', input: 0.4, output: 2 },
  { name: 'devstral-small-2505', input: 0.1, output: 0.3 },
  { name: 'open-mistral-7b', input: 0.25, output: 0.25 },
  { name: 'open-mixtral-8x22b', input: 2, output: 6 },
  { name: 'open-mixtral-8x7b', input: 0.7, output: 0.7 },
  { name: 'mistral-tiny', input: 0.25, output: 0.25 },
  { name: 'mistral-small-creative-25-12', input: 0.1, output: 0.3 },
  // Audio (Voxtral transcription). Per-minute pricing.
  { name: 'voxtral-mini-2602', input: 0, output: 0, modelType: 'audio', pricingPerMinute: 0.003 },
  { name: 'voxtral-mini-latest', input: 0, output: 0, modelType: 'audio', pricingPerMinute: 0.003 },
];

/**
 * Merge official Mistral models into payload: add any overlay model not already in mistral array (by name, case-insensitive).
 * @param {{ gemini?: array, openai?: array, anthropic?: array, mistral?: array }} payload
 * @returns {object} New payload with merged mistral array.
 */
export function mergeMistralOfficialIntoPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const mistral = Array.isArray(payload.mistral) ? payload.mistral.slice() : [];
  const names = new Set(mistral.map((m) => (m && m.name ? String(m.name).toLowerCase().trim() : '')));
  for (const entry of MISTRAL_OFFICIAL_MODELS) {
    const key = (entry.name || '').toLowerCase().trim();
    if (!key || names.has(key)) continue;
    names.add(key);
    mistral.push({
      name: entry.name,
      input: entry.input ?? 0,
      output: entry.output ?? 0,
      cachedInput: null,
      modelType: entry.modelType ?? null,
      pricingPerImage: entry.pricingPerImage != null ? entry.pricingPerImage : null,
      pricingPerSecond: entry.pricingPerSecond != null ? entry.pricingPerSecond : null,
      pricingPerMinute: entry.pricingPerMinute != null ? entry.pricingPerMinute : null,
    });
  }
  return { ...payload, mistral };
}
