/**
 * Model visibility rules for Overview, Models, Value Analysis, Calculators, Benchmarks, Recommend.
 *
 * Strategy (avoid missing new official IDs):
 * - **Wrong bucket:** If the model name clearly belongs to another provider (see
 *   `getProviderByModelName()`), it is dropped from this bucket (after reassignment, rare).
 * - **Unknown name:** If the provider cannot be inferred from the name, we **trust the
 *   source bucket** (Vizra / pricing.json) so new SKUs are not hidden until we add a pattern.
 * - **OpenAI:** Still gated by the official deprecations list (`isRetiredOpenAIModel`).
 * - **Retired / deprecated:** Removed in `filterRetiredModels()` after this step (all providers).
 *
 * When providers add new **naming schemes**, extend `src/data/providerByModel.js` patterns
 * so reassignment and cross-bucket filtering stay accurate.
 *
 * Official sources (cross-check when updating patterns / retired lists):
 * - Gemini: https://ai.google.dev/gemini-api/docs/models
 * - OpenAI: https://developers.openai.com/api/docs/models/all + deprecations
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/overview
 * - Mistral: https://docs.mistral.ai/models/
 */

import { getProviderByModelName } from './providerByModel.js';
import { isRetiredOpenAIModel } from '../utils/retiredModels.js';

/**
 * True if this row may appear under `providerKey`.
 * Rejects only: (1) names that clearly belong to another provider, (2) OpenAI deprecated IDs.
 */
export function isAllowedModel(providerKey, modelName) {
  if (!providerKey || !modelName || typeof modelName !== 'string') return false;
  const canonical = getProviderByModelName(modelName);
  if (canonical != null && canonical !== providerKey) return false;
  if (providerKey === 'openai') return !isRetiredOpenAIModel(modelName);
  return true;
}
