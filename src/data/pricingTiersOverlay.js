/**
 * Tiered pricing overlay: context-size–based prices (e.g. ≤200K vs >200K) per model.
 * Keys are normalized model names (lowercase). Merged into pricing payload so the UI
 * can show all tiers. Update from official provider pricing docs when rates change.
 *
 * Sources: Google Gemini API pricing, OpenAI platform pricing, Anthropic Claude pricing, Mistral pricing.
 */

export const PRICING_TIERS_OVERLAY = {
  gemini: {
    'gemini-2.5-pro': [
      { contextLabel: '≤200K tokens', input: 1.25, output: 10 },
      { contextLabel: '>200K tokens', input: 2.5, output: 20 },
    ],
    'gemini-2.5-flash': [
      { contextLabel: '≤200K tokens', input: 0.15, output: 0.6 },
      { contextLabel: '>200K tokens', input: 0.3, output: 1.2 },
    ],
    'gemini-2.5-flash-(thinking)': [
      { contextLabel: '≤200K tokens', input: 0.15, output: 3.5 },
      { contextLabel: '>200K tokens', input: 0.3, output: 7 },
    ],
    'gemini-1.5-pro': [
      { contextLabel: '≤128K tokens', input: 1.25, output: 5 },
      { contextLabel: '>128K tokens', input: 3.5, output: 10.5 },
    ],
    'gemini-1.5-pro-002': [
      { contextLabel: '≤128K tokens', input: 1.25, output: 5 },
      { contextLabel: '>128K tokens', input: 2.5, output: 10 },
    ],
    'gemini-1.5-flash': [
      { contextLabel: '≤128K tokens', input: 0.075, output: 0.3 },
      { contextLabel: '>128K tokens', input: 0.15, output: 0.6 },
    ],
    'gemini-3.1-pro-preview': [
      { contextLabel: '≤200K tokens', input: 2, output: 12 },
      { contextLabel: '>200K tokens', input: 4, output: 18 },
    ],
    'gemini-2.0-flash': [
      { contextLabel: 'Standard', input: 0.1, output: 0.4 },
    ],
  },
  openai: {
    'gpt-4o': [
      { contextLabel: '≤128K (standard)', input: 2.5, output: 10, cachedInput: 1.25 },
      { contextLabel: '>128K extended', input: 5, output: 20, cachedInput: 2.5 },
    ],
    'gpt-4o-mini': [
      { contextLabel: '≤128K (standard)', input: 0.15, output: 0.6, cachedInput: 0.075 },
      { contextLabel: '>128K extended', input: 0.3, output: 1.2, cachedInput: 0.15 },
    ],
    'gpt-4.1': [
      { contextLabel: '≤272K (standard)', input: 2, output: 8, cachedInput: 0.5 },
      { contextLabel: '>272K extended', input: 4, output: 16, cachedInput: 1 },
    ],
    'gpt-4.1-mini': [
      { contextLabel: '≤272K (standard)', input: 0.4, output: 1.6, cachedInput: 0.1 },
      { contextLabel: '>272K extended', input: 0.8, output: 3.2, cachedInput: 0.2 },
    ],
    'o1': [
      { contextLabel: '≤200K (standard)', input: 15, output: 60, cachedInput: 7.5 },
      { contextLabel: '>200K extended', input: 30, output: 120, cachedInput: 15 },
    ],
    'o1-mini': [
      { contextLabel: '≤128K (standard)', input: 1.1, output: 4.4, cachedInput: 0.55 },
      { contextLabel: '>128K extended', input: 2.2, output: 8.8, cachedInput: 1.1 },
    ],
  },
  anthropic: {
    'claude-4-sonnet': [
      { contextLabel: '≤200K input', input: 3, output: 15 },
      { contextLabel: '>200K extended', input: 6, output: 22.5 },
    ],
    'claude-4-opus': [
      { contextLabel: '≤200K input', input: 15, output: 75 },
      { contextLabel: '>200K extended', input: 30, output: 112.5 },
    ],
    'claude-sonnet-4-6': [
      { contextLabel: '≤200K input', input: 3, output: 15 },
      { contextLabel: '>200K extended', input: 6, output: 22.5 },
    ],
    'claude-opus-4-6': [
      { contextLabel: '≤200K input', input: 5, output: 25 },
      { contextLabel: '>200K extended', input: 10, output: 37.5 },
    ],
    'claude-haiku-4-5': [
      { contextLabel: '≤200K input', input: 1, output: 5 },
      { contextLabel: '>200K extended', input: 2, output: 7.5 },
    ],
  },
  mistral: {
    'mistral-large-2411': [
      { contextLabel: 'Standard', input: 2, output: 6 },
    ],
    'mistral-medium-2505': [
      { contextLabel: 'Standard', input: 0.4, output: 2 },
    ],
    'mistral-3.1-small': [
      { contextLabel: 'Standard', input: 0.1, output: 0.3 },
    ],
  },
};

/**
 * Normalize model name for overlay lookup (lowercase, trim).
 */
export function normalizeKey(name) {
  return (name || '').toLowerCase().trim();
}

/**
 * Get tiers for a model from the overlay, or null if none.
 * @param {string} provider - 'gemini' | 'openai' | 'anthropic' | 'mistral'
 * @param {string} modelName
 * @returns {Array<{ contextLabel: string, input: number, output: number, cachedInput?: number }>|null}
 */
export function getTiersForModel(provider, modelName) {
  const overlay = PRICING_TIERS_OVERLAY[provider];
  if (!overlay) return null;
  const key = normalizeKey(modelName);
  return overlay[key] || null;
}

/**
 * Merge overlay tiers into each model in the payload. Mutates and returns the same payload.
 * Models that have an overlay entry get a .tiers array; others are unchanged.
 */
export function mergeTiersIntoPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  for (const provider of ['gemini', 'openai', 'anthropic', 'mistral']) {
    const list = payload[provider];
    if (!Array.isArray(list)) continue;
    const overlay = PRICING_TIERS_OVERLAY[provider];
    if (!overlay) continue;
    for (const m of list) {
      if (!m || !m.name) continue;
      const tiers = overlay[normalizeKey(m.name)];
      if (tiers && tiers.length > 0) m.tiers = tiers.slice();
    }
  }
  return payload;
}
