/**
 * Static documentation index for the Recommend section.
 * Search uses Fuse.js over this index for broader coverage without live doc fetching.
 * Format: { model, provider, providerKey, keywords, source }
 * providerKey is used to map to getData() (gemini | openai | anthropic | mistral).
 */

export const RECOMMEND_DOC_INDEX = [
  // Anthropic
  { model: 'claude-opus-4-6', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'complex tasks', 'best quality', 'sophisticated'], source: 'anthropic documentation' },
  { model: 'claude-opus-4-5', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'complex tasks'], source: 'anthropic documentation' },
  { model: 'claude-sonnet-4-6', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'balance', 'general purpose'], source: 'anthropic documentation' },
  { model: 'claude-sonnet-4-5', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'balance'], source: 'anthropic documentation' },
  { model: 'claude-4-opus', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'best quality'], source: 'anthropic documentation' },
  { model: 'claude-4-sonnet', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'general'], source: 'anthropic documentation' },
  { model: 'claude-haiku-4-5', provider: 'Anthropic', providerKey: 'anthropic', keywords: ['fast', 'low cost', 'high volume', 'throughput', 'cheap', 'budget'], source: 'anthropic documentation' },
  // Gemini (names aligned with overlay / pricing data)
  { model: 'gemini-3.1-pro-preview', provider: 'Google Gemini', providerKey: 'gemini', keywords: ['reasoning', 'coding', 'long context', 'multimodal', 'vision', 'text', 'best-in-class', 'capabilities'], source: 'google gemini documentation' },
  { model: 'gemini-2.5-pro', provider: 'Google Gemini', providerKey: 'gemini', keywords: ['reasoning', 'coding', 'long context', 'multimodal', 'vision', 'text', 'best-in-class'], source: 'google gemini documentation' },
  { model: 'gemini-2.5-flash', provider: 'Google Gemini', providerKey: 'gemini', keywords: ['fast', 'vision', 'text', 'balance', 'cost effective', 'multimodal'], source: 'google gemini documentation' },
  { model: 'gemini-2.0-flash', provider: 'Google Gemini', providerKey: 'gemini', keywords: ['fast', 'vision', 'text', 'multimodal', 'low cost'], source: 'google gemini documentation' },
  { model: 'gemini-3.1-flash-lite-preview', provider: 'Google Gemini', providerKey: 'gemini', keywords: ['fast', 'vision', 'text', 'low cost', 'throughput'], source: 'google gemini documentation' },
  { model: 'gemini-3-flash-preview', provider: 'Google Gemini', providerKey: 'gemini', keywords: ['vision', 'text', 'multimodal', 'balance'], source: 'google gemini documentation' },
  // OpenAI
  { model: 'gpt-4o', provider: 'OpenAI', providerKey: 'openai', keywords: ['vision', 'text', 'multimodal', 'reasoning', 'coding', 'best-in-class', 'capabilities'], source: 'openai documentation' },
  { model: 'gpt-4.1', provider: 'OpenAI', providerKey: 'openai', keywords: ['vision', 'text', 'reasoning', 'coding', 'analysis'], source: 'openai documentation' },
  { model: 'gpt-4o-mini', provider: 'OpenAI', providerKey: 'openai', keywords: ['fast', 'vision', 'text', 'low cost', 'high volume'], source: 'openai documentation' },
  { model: 'o1', provider: 'OpenAI', providerKey: 'openai', keywords: ['reasoning', 'complex', 'best quality', 'sophisticated', 'analysis'], source: 'openai documentation' },
  { model: 'o3', provider: 'OpenAI', providerKey: 'openai', keywords: ['reasoning', 'complex', 'best quality', 'sophisticated'], source: 'openai documentation' },
  { model: 'o4-mini', provider: 'OpenAI', providerKey: 'openai', keywords: ['reasoning', 'balance', 'cost effective'], source: 'openai documentation' },
  // Mistral — broad keywords so "best-in-class text and vision" matches
  { model: 'mistral-large-3', provider: 'Mistral', providerKey: 'mistral', keywords: ['reasoning', 'coding', 'analysis', 'long context', 'text', 'vision', 'best-in-class', 'capabilities', 'multimodal'], source: 'mistral documentation' },
  { model: 'mistral-large-2512', provider: 'Mistral', providerKey: 'mistral', keywords: ['reasoning', 'text', 'vision', 'best-in-class', 'capabilities'], source: 'mistral documentation' },
  { model: 'mistral-medium-3-1-2508', provider: 'Mistral', providerKey: 'mistral', keywords: ['reasoning', 'coding', 'text', 'vision', 'balance', 'cost effective'], source: 'mistral documentation' },
  { model: 'mistral-small-3-2-2506', provider: 'Mistral', providerKey: 'mistral', keywords: ['fast', 'text', 'vision', 'low cost', 'high volume', 'throughput'], source: 'mistral documentation' },
  { model: 'pixtral-large-2411', provider: 'Mistral', providerKey: 'mistral', keywords: ['vision', 'multimodal', 'image', 'text', 'best-in-class', 'capabilities'], source: 'mistral documentation' },
  { model: 'magistral-medium-1-2-2509', provider: 'Mistral', providerKey: 'mistral', keywords: ['reasoning', 'coding', 'text', 'vision', 'analysis'], source: 'mistral documentation' },
  { model: 'codestral-2508', provider: 'Mistral', providerKey: 'mistral', keywords: ['coding', 'developer', 'code', 'software', 'programming'], source: 'mistral documentation' },
  { model: 'mistral-tiny', provider: 'Mistral', providerKey: 'mistral', keywords: ['fast', 'cheap', 'budget', 'high volume', 'throughput'], source: 'mistral documentation' },
  { model: 'mistral-small-creative-25-12', provider: 'Mistral', providerKey: 'mistral', keywords: ['meticulously curated data', 'creative writing', 'narrative generation', 'roleplay', 'character-driven dialog', 'instruction following', 'conversational agents', 'experimental', 'specialized small model', 'curated data'], source: 'mistral documentation' },
];
