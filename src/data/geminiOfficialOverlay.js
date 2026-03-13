/**
 * Google Gemini models and prices from the official pricing page so they always appear
 * even when the API or pricing.json omits them.
 * Source: https://ai.google.dev/gemini-api/docs/pricing (per 1M tokens; standard tier).
 * Deprecations: https://ai.google.dev/gemini-api/docs/changelog
 * Update when the official page changes.
 */

/** Official Gemini models (name, input, output per 1M tokens). Missing models are merged into loaded payload. */
export const GEMINI_OFFICIAL_MODELS = [
  { name: 'gemini-3.1-pro-preview', input: 2, output: 12 },
  { name: 'gemini-3.1-flash-lite-preview', input: 0.25, output: 1.5 },
  { name: 'gemini-3.1-flash-image-preview', input: 0.5, output: 3, modelType: 'image', pricingPerImage: 0.067 },
  { name: 'gemini-3-flash-preview', input: 0.5, output: 3 },
  { name: 'gemini-3-pro-image-preview', input: 1, output: 6, modelType: 'image', pricingPerImage: 0.134 },
  { name: 'gemini-2.5-pro', input: 1.25, output: 5 },
  { name: 'gemini-2.5-flash', input: 0.3, output: 2.5 },
  { name: 'gemini-2.5-flash-lite', input: 0.075, output: 0.3 },
  { name: 'gemini-2.5-flash-(thinking)', input: 0.15, output: 3.5 },
  { name: 'gemini-2.0-flash', input: 0.1, output: 0.4 },
  { name: 'gemini-2.0-flash-lite', input: 0.075, output: 0.3 },
  { name: 'gemini-embedding-2-preview', input: 0.2, output: 0 },
  { name: 'gemini-embedding-001', input: 0.025, output: 0 },
  { name: 'gemini-gemma-2-27b-it', input: 0.075, output: 0.3 },
  { name: 'gemini-gemma-2-9b-it', input: 0.0375, output: 0.15 },
  { name: 'gemini-2.5-flash-image', input: 0.3, output: 0, modelType: 'image', pricingPerImage: 0.039 },
  // TTS / native audio (modelType audio; token pricing for output)
  { name: 'gemini-2.5-flash-preview-tts', input: 0.5, output: 10, modelType: 'audio' },
  { name: 'gemini-2.5-pro-preview-tts', input: 1, output: 20, modelType: 'audio' },
  { name: 'gemini-2.5-flash-native-audio-preview-12-2025', input: 3, output: 12, modelType: 'audio' },
  // Image / video / audio (modelType + alternate pricing; token fields 0 for non-token)
  { name: 'imagen-4', input: 0, output: 0, modelType: 'image', pricingPerImage: 0.02 },
  { name: 'nano-banana-2', input: 0, output: 0, modelType: 'image', pricingPerImage: 0.067 },
  { name: 'imagen-4.0-fast-generate-001', input: 0, output: 0, modelType: 'image', pricingPerImage: 0.02 },
  { name: 'imagen-4.0-generate-001', input: 0, output: 0, modelType: 'image', pricingPerImage: 0.04 },
  { name: 'imagen-4.0-ultra-generate-001', input: 0, output: 0, modelType: 'image', pricingPerImage: 0.06 },
  { name: 'veo-3.1-generate-preview', input: 0, output: 0, modelType: 'video', pricingPerSecond: 0.4 },
  { name: 'veo-3.1-fast-generate-preview', input: 0, output: 0, modelType: 'video', pricingPerSecond: 0.15 },
  { name: 'veo-3.0-generate-001', input: 0, output: 0, modelType: 'video', pricingPerSecond: 0.4 },
  { name: 'veo-3.0-fast-generate-001', input: 0, output: 0, modelType: 'video', pricingPerSecond: 0.15 },
  { name: 'veo-2.0-generate-001', input: 0, output: 0, modelType: 'video', pricingPerSecond: 0.35 },
  { name: 'lyria-realtime-exp', input: 0, output: 0, modelType: 'audio', pricingPerMinute: 0.1 },
];

/**
 * Merge official Gemini models into payload: add any overlay model not already in gemini array (by name, case-insensitive).
 * @param {{ gemini?: array, openai?: array, anthropic?: array, mistral?: array }} payload
 * @returns {object} New payload with merged gemini array.
 */
export function mergeGeminiOfficialIntoPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const gemini = Array.isArray(payload.gemini) ? payload.gemini.slice() : [];
  const names = new Set(gemini.map((m) => (m && m.name ? String(m.name).toLowerCase().trim() : '')));
  for (const entry of GEMINI_OFFICIAL_MODELS) {
    const key = (entry.name || '').toLowerCase().trim();
    if (!key || names.has(key)) continue;
    names.add(key);
    gemini.push({
      name: entry.name,
      input: entry.input ?? 0,
      output: entry.output ?? 0,
      cachedInput: entry.cachedInput ?? null,
      modelType: entry.modelType ?? null,
      pricingPerImage: entry.pricingPerImage != null ? entry.pricingPerImage : null,
      pricingPerSecond: entry.pricingPerSecond != null ? entry.pricingPerSecond : null,
      pricingPerMinute: entry.pricingPerMinute != null ? entry.pricingPerMinute : null,
    });
  }
  return { ...payload, gemini };
}
