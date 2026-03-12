/**
 * Canonical provider for a model based on its name only.
 * Used to reassign models that appear under the wrong provider in the data.
 * Order matters: check more specific patterns first where needed.
 *
 * Official sources: same as allowedModels.js (Gemini, OpenAI, Anthropic, Mistral docs).
 */

const PROVIDER_PATTERNS = {
  gemini: [/^gemini-/],
  openai: [
    /^deep-research-/i,
    /^gpt-/, /^o1-/, /^o3-/, /^o4-/, /^chatgpt-/i,
    /^dall-e-/i, /^text-embedding-/i, /^text-moderation-/i,
    /^babbage-/, /^davinci-/, /^ada$/, /^curie$/i,
    /^code-davinci-/, /^text-davinci-/, /^text-ada-/, /^text-curie-/, /^text-babbage-/,
  ],
  anthropic: [/^claude-/],
  mistral: [
    /^mistral-/, /^mixtral-/, /^codestral-/, /^pixtral-/,
    /^ministral-/, /^magistral-/, /^devstral-/, /^labs-devstral-/i,
    /^open-mistral-/, /^open-mixtral-/, /^open-codestral-/,
  ],
};

/**
 * Returns the canonical provider key for a model name, or null if unknown.
 * @param {string} name - Model name or ID
 * @returns {'gemini'|'openai'|'anthropic'|'mistral'|null}
 */
export function getProviderByModelName(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.trim();
  if (!n) return null;
  // OpenAI has many specific prefixes; check before anthropic (claude) and generic gemini
  for (const pattern of PROVIDER_PATTERNS.openai) {
    if (pattern.test(n)) return 'openai';
  }
  if (PROVIDER_PATTERNS.anthropic.some((re) => re.test(n))) return 'anthropic';
  if (PROVIDER_PATTERNS.mistral.some((re) => re.test(n))) return 'mistral';
  if (PROVIDER_PATTERNS.gemini.some((re) => re.test(n))) return 'gemini';
  return null;
}
