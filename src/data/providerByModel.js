/**
 * Canonical provider for a model based on its name only.
 * Used to reassign models that appear under the wrong provider in the data, and to
 * decide whether a row belongs in a provider bucket (see allowedModels.js).
 *
 * Order matters: Gemini (Google) is checked before OpenAI so IDs like `text-embedding-004`
 * map to Google, not OpenAI’s `text-embedding-*` family.
 *
 * Official sources: same as allowedModels.js (Gemini, OpenAI, Anthropic, Mistral docs).
 */

const PROVIDER_PATTERNS = {
  /** Google AI / Gemini API family (chat, embeddings, Imagen, Veo, Lyria, etc.) */
  gemini: [
    /^text-embedding-004$/i,
    /^gemini-/i,
    /^gemini-embedding/i,
    /^imagen-/i,
    /^veo-/i,
    /^lyria-/i,
    /^nano-banana/i,
  ],
  openai: [
    /^deep-research-/i,
    /^gpt-/i,
    /^o(1|3|4)(-|$)/i, // o1, o3, o4 and dated variants (e.g. o1-2024-12-17, o4-mini)
    /^chatgpt-/i,
    /^dall-e-/i,
    /^text-embedding-/i,
    /^text-moderation-/i,
    /^babbage-/i,
    /^davinci-/i,
    /^ada$/i,
    /^curie$/i,
    /^code-davinci-/i,
    /^text-davinci-/i,
    /^text-ada-/i,
    /^text-curie-/i,
    /^text-babbage-/i,
    /^whisper-/i,
    /^tts-/i,
    /^sora-/i,
    /^computer-use-/i,
    /^gpt-image-/i,
    /^gpt-realtime-/i,
  ],
  anthropic: [/^claude-/i],
  mistral: [
    /^mistral-/i,
    /^mixtral-/i,
    /^codestral-/i,
    /^pixtral-/i,
    /^ministral-/i,
    /^magistral-/i,
    /^devstral-/i,
    /^labs-devstral-/i,
    /^labs-mistral-/i,
    /^open-mistral-/i,
    /^open-mixtral-/i,
    /^open-codestral-/i,
    /^voxtral-/i,
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

  for (const pattern of PROVIDER_PATTERNS.gemini) {
    if (pattern.test(n)) return 'gemini';
  }
  for (const pattern of PROVIDER_PATTERNS.openai) {
    if (pattern.test(n)) return 'openai';
  }
  if (PROVIDER_PATTERNS.anthropic.some((re) => re.test(n))) return 'anthropic';
  if (PROVIDER_PATTERNS.mistral.some((re) => re.test(n))) return 'mistral';
  return null;
}
