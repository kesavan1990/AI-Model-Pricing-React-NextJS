/**
 * OpenAI models and prices from the official pricing page so they always appear
 * even when the API or pricing.json omits them.
 * Source: https://developers.openai.com/api/docs/pricing (Standard tier, text tokens).
 * Update when the official page changes.
 */

/** Official OpenAI models (name, input, output, cachedInput per 1M tokens). Missing models are merged into loaded payload. */
export const OPENAI_OFFICIAL_MODELS = [
  { name: 'gpt-5.4', input: 2.5, cachedInput: 0.25, output: 15 },
  { name: 'gpt-5.4-pro', input: 30, cachedInput: null, output: 180 },
  { name: 'gpt-5.2', input: 1.75, cachedInput: 0.175, output: 14 },
  { name: 'gpt-5.1', input: 1.25, cachedInput: 0.125, output: 10 },
  { name: 'gpt-5', input: 1.25, cachedInput: 0.125, output: 10 },
  { name: 'gpt-5-mini', input: 0.25, cachedInput: 0.025, output: 2 },
  { name: 'gpt-5-nano', input: 0.05, cachedInput: 0.005, output: 0.4 },
  { name: 'gpt-5.2-pro', input: 21, cachedInput: null, output: 168 },
  { name: 'gpt-5-pro', input: 15, cachedInput: null, output: 120 },
  { name: 'gpt-5.3-chat-latest', input: 1.75, cachedInput: 0.175, output: 14 },
  { name: 'gpt-5.2-chat-latest', input: 1.75, cachedInput: 0.175, output: 14 },
  { name: 'gpt-5.1-chat-latest', input: 1.25, cachedInput: 0.125, output: 10 },
  { name: 'gpt-5-chat-latest', input: 1.25, cachedInput: 0.125, output: 10 },
  { name: 'gpt-5.1-codex-mini', input: 0.25, cachedInput: 0.025, output: 2 },
  { name: 'gpt-4.1', input: 2, cachedInput: 0.5, output: 8 },
  { name: 'gpt-4.1-mini', input: 0.4, cachedInput: 0.1, output: 1.6 },
  { name: 'gpt-4.1-nano', input: 0.1, cachedInput: 0.025, output: 0.4 },
  { name: 'gpt-4o', input: 2.5, cachedInput: 1.25, output: 10 },
  { name: 'gpt-4o-2024-05-13', input: 5, cachedInput: null, output: 15 },
  { name: 'gpt-4o-mini', input: 0.15, cachedInput: 0.075, output: 0.6 },
  { name: 'o1', input: 15, cachedInput: 7.5, output: 60 },
  { name: 'o1-pro', input: 150, cachedInput: null, output: 600 },
  { name: 'o3-pro', input: 20, cachedInput: null, output: 80 },
  { name: 'o3', input: 2, cachedInput: 0.5, output: 8 },
  { name: 'o3-deep-research', input: 10, cachedInput: 2.5, output: 40 },
  { name: 'o4-mini', input: 1.1, cachedInput: 0.275, output: 4.4 },
  { name: 'o4-mini-deep-research', input: 2, cachedInput: 0.5, output: 8 },
  { name: 'o3-mini', input: 1.1, cachedInput: 0.55, output: 4.4 },
  { name: 'o1-mini', input: 1.1, cachedInput: 0.55, output: 4.4 },
  { name: 'computer-use-preview', input: 3, cachedInput: null, output: 12 },
  { name: 'gpt-realtime-1.5', input: 4, cachedInput: 0.4, output: 16 },
  { name: 'gpt-realtime-mini', input: 0.6, cachedInput: 0.06, output: 2.4 },
  // Image (modelType + per-image pricing). GPT Image family; DALL·E 2/3 in retired list.
  { name: 'gpt-image-1.5', input: 0, output: 0, cachedInput: null, modelType: 'image', pricingPerImage: 0.034 },
  { name: 'gpt-image-1', input: 0, output: 0, cachedInput: null, modelType: 'image', pricingPerImage: 0.042 },
  { name: 'gpt-image-1-mini', input: 0, output: 0, cachedInput: null, modelType: 'image', pricingPerImage: 0.011 },
  { name: 'dall-e-3', input: 0, output: 0, cachedInput: null, modelType: 'image', pricingPerImage: 0.04 },
  { name: 'dall-e-2', input: 0, output: 0, cachedInput: null, modelType: 'image', pricingPerImage: 0.02 },
  // Audio (transcription and speech). Per-minute or per-1M chars where applicable.
  { name: 'whisper-1', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.006 },
  { name: 'gpt-4o-transcribe', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.006 },
  { name: 'gpt-4o-transcribe-diarize', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.006 },
  { name: 'gpt-4o-mini-transcribe', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.003 },
  { name: 'gpt-4o-mini-tts', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.015 },
  { name: 'tts-1', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.015 },
  { name: 'tts-1-hd', input: 0, output: 0, cachedInput: null, modelType: 'audio', pricingPerMinute: 0.03 },
  // Video (Sora). Per-second pricing.
  { name: 'sora-2', input: 0, output: 0, cachedInput: null, modelType: 'video', pricingPerSecond: 0.1 },
  { name: 'sora-2-pro', input: 0, output: 0, cachedInput: null, modelType: 'video', pricingPerSecond: 0.5 },
];

/**
 * Merge official OpenAI models into payload: add any overlay model not already in openai array (by name, case-insensitive).
 * @param {{ gemini?: array, openai?: array, anthropic?: array, mistral?: array }} payload
 * @returns {object} New payload with merged openai array.
 */
export function mergeOpenAIOfficialIntoPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const openai = Array.isArray(payload.openai) ? payload.openai.slice() : [];
  const names = new Set(openai.map((m) => (m && m.name ? String(m.name).toLowerCase().trim() : '')));
  for (const entry of OPENAI_OFFICIAL_MODELS) {
    const key = (entry.name || '').toLowerCase().trim();
    if (!key || names.has(key)) continue;
    names.add(key);
    openai.push({
      name: entry.name,
      input: entry.input ?? 0,
      output: entry.output ?? 0,
      cachedInput: entry.cachedInput != null ? entry.cachedInput : null,
      modelType: entry.modelType ?? null,
      pricingPerImage: entry.pricingPerImage != null ? entry.pricingPerImage : null,
      pricingPerSecond: entry.pricingPerSecond != null ? entry.pricingPerSecond : null,
      pricingPerMinute: entry.pricingPerMinute != null ? entry.pricingPerMinute : null,
    });
  }
  return { ...payload, openai };
}
