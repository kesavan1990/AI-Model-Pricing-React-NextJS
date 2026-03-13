/**
 * Allowlist: only models listed as "available" on each provider's official page are shown.
 * Used so the app displays only models from the official docs (Models, Value Analysis, Calculators, Benchmarks, Recommend, Overview).
 *
 * Official sources (cross-check when updating):
 * - Gemini: https://ai.google.dev/gemini-api/docs/models , https://ai.google.dev/api/models
 * - OpenAI: https://developers.openai.com/api/docs/models/all (allowed = not in deprecations list)
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/overview
 * - Mistral: https://docs.mistral.ai/models/
 */

import { isRetiredOpenAIModel } from '../utils/retiredModels.js';

// --- Gemini: official list is 2.5 series, 3.x series, embedding-2, live, robotics, and some 2.0 (until deprecated) ---
const GEMINI_ALLOWED_PATTERNS = [
  /^gemini-2\.5-/,           // 2.5 Pro, 2.5 Flash, 2.5 Flash-Lite, Live, TTS, etc.
  /^gemini-3\./,              // 3.1 Pro, 3 Flash, 3.1 Flash-Lite, 3.1 Flash Image, etc.
  /^gemini-embedding-2/,      // gemini-embedding-2-preview
  /^gemini-embedding-001/,   // legacy embedding (if still listed)
  /^gemini-live-2\.5/,       // Live 2.5
  /^gemini-2\.0-/,            // 2.0 Flash/Lite (until official removal)
  /^gemini-gemma-2-/,         // Gemma 2 (if still on official page)
  /^gemini-exp-/,             // Experimental (if listed)
  /^gemini-robotics-/,        // Robotics ER and related (official)
  /^imagen-/,                 // Imagen (image generation)
  /^nano-banana/,             // Nano Banana (Gemini image generation, e.g. nano-banana-2)
  /^veo-/,                    // Veo (video generation)
  /^lyria-/,                  // Lyria (audio/music)
];

function isAllowedGeminiModel(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.toLowerCase().trim();
  return GEMINI_ALLOWED_PATTERNS.some((re) => re.test(n));
}

// --- OpenAI: allow = not deprecated (deprecations page is source of "not available") ---
function isAllowedOpenAIModel(name) {
  if (!name || typeof name !== 'string') return false;
  return !isRetiredOpenAIModel(name);
}

// --- Anthropic: official list is Claude 4.x (Opus 4, Sonnet 4, Haiku 4) ---
const ANTHROPIC_ALLOWED_PATTERNS = [
  /^claude-opus-4-/,   // Opus 4.6, 4.5, 4.1, etc.
  /^claude-sonnet-4-/, // Sonnet 4.6, 4.5, etc.
  /^claude-haiku-4-/,  // Haiku 4.5, etc.
  /^claude-4-opus/,    // claude-4-opus, claude-4-opus-20250514
  /^claude-4-sonnet/,  // claude-4-sonnet, etc.
  /^claude-4-haiku/,   // if present
];

function isAllowedAnthropicModel(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  return ANTHROPIC_ALLOWED_PATTERNS.some((re) => re.test(n));
}

// --- Mistral: official list uses current naming (Large 3, Medium 3.x, Small 3.x, Ministral, Magistral, etc.) ---
const MISTRAL_ALLOWED_PATTERNS = [
  /^mistral-large-3/,       // Mistral Large 3
  /^mistral-large-2512/,    // v25.12
  /^mistral-medium-3/,      // Mistral Medium 3.1 (e.g. mistral-medium-3-1-2508)
  /^mistral-small-3/,       // Mistral Small 3.2 (e.g. mistral-small-3-2-2506)
  /^mistral-3\./,           // mistral-3.1-small, etc.
  /^mistral-medium-2505/,   // dated variants (if on page)
  /^mistral-large-24/,      // mistral-large-2402, 2407, 2411 (if still listed)
  /^ministral-3/,           // Ministral 3 (3b, 8b, 14b)
  /^magistral-/,            // Magistral Medium/Small (2506, 2509, 1-2-2509, etc.)
  /^codestral-/,            // Codestral (2405, 2508)
  /^pixtral-/,              // Pixtral (large-2411, 12b-2409)
  /^devstral-/,             // Devstral (small-2505, 2507, 2512)
  /^labs-devstral-/i,       // labs-devstral-small-2512
  /^open-mistral-7b/,       // Open Mistral 7B
  /^open-mistral-/,         // open-mistral-nemo, etc. (if still listed)
  /^open-mixtral-/,         // open-mixtral-8x7b, open-mixtral-8x22b
  /^open-codestral-/,       // open-codestral-mamba
  /^mistral-7b/,            // Mistral 7B
  /^mistral-tiny/,          // Mistral Tiny (if on official page)
  /^mistral-small$/,        // generic small (if on page)
  /^mistral-small-creative/, // Mistral Small Creative (Labs, e.g. mistral-small-creative-25-12)
  /^labs-mistral-small-creative/i, // Labs Small Creative
  /^mistral-medium$/,       // generic medium (if on page)
  /^mistral-large$/,        // generic large (if on page)
  /^mixtral-8x22b/,         // Mixtral 8x22B
  /^voxtral-/,              // Voxtral (audio transcription, e.g. voxtral-mini-2602)
];

function isAllowedMistralModel(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.toLowerCase().trim();
  return MISTRAL_ALLOWED_PATTERNS.some((re) => re.test(n));
}

/**
 * True if the model is listed as available on the provider's official page.
 * Used to filter displayed models to official-only in Overview, Models, Value Analysis, Calculators, Benchmarks, Recommend.
 */
export function isAllowedModel(providerKey, modelName) {
  if (!providerKey || !modelName) return false;
  switch (providerKey) {
    case 'gemini': return isAllowedGeminiModel(modelName);
    case 'openai': return isAllowedOpenAIModel(modelName);
    case 'anthropic': return isAllowedAnthropicModel(modelName);
    case 'mistral': return isAllowedMistralModel(modelName);
    default: return false;
  }
}
