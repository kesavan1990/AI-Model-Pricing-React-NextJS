/**
 * Model type classification for chat vs image/audio/video/embedding.
 * Used to support multiple model types (Option B) without changing existing chat-centric behavior.
 * Default is 'chat'; existing code that does not check modelType continues to work.
 */

/** Model types supported in the app. */
export const MODEL_TYPES = Object.freeze({
  CHAT: 'chat',
  EMBEDDING: 'embedding',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
});

/** Display labels for filters and UI. */
export const MODEL_TYPE_LABELS = {
  [MODEL_TYPES.CHAT]: 'Chat / Text',
  [MODEL_TYPES.EMBEDDING]: 'Embedding',
  [MODEL_TYPES.IMAGE]: 'Image',
  [MODEL_TYPES.AUDIO]: 'Audio',
  [MODEL_TYPES.VIDEO]: 'Video',
};

/**
 * Infer model type from provider and model name when not explicitly set.
 * Returns MODEL_TYPES.CHAT for unknown so existing behavior is unchanged.
 * @param {string} providerKey - gemini | openai | anthropic | mistral
 * @param {{ name: string, modelType?: string }} model - Raw model (name, optional modelType from overlay)
 * @returns {string} One of MODEL_TYPES
 */
export function getModelType(providerKey, model) {
  if (model && model.modelType && Object.values(MODEL_TYPES).includes(String(model.modelType).toLowerCase())) {
    return String(model.modelType).toLowerCase();
  }
  const n = (model && model.name ? model.name : '').toString().toLowerCase();
  if (!n) return MODEL_TYPES.CHAT;

  if (providerKey === 'gemini') {
    if (/^gemini-embedding/.test(n)) return MODEL_TYPES.EMBEDDING;
    if (/imagen|^imagen-|nano-banana/.test(n)) return MODEL_TYPES.IMAGE;
    if (/gemini-.*-flash-image|gemini-.*-pro-image-preview/.test(n)) return MODEL_TYPES.IMAGE;
    if (/^veo-|veo\s/.test(n)) return MODEL_TYPES.VIDEO;
    if (/lyria|tts|speech|audio|native-audio/.test(n)) return MODEL_TYPES.AUDIO;
  }
  if (providerKey === 'openai') {
    if (/^text-embedding/.test(n)) return MODEL_TYPES.EMBEDDING;
    if (/gpt-image|dall-e|dalle|image.*generat/.test(n)) return MODEL_TYPES.IMAGE;
    if (/whisper|transcribe|speech-to-text|stt/.test(n)) return MODEL_TYPES.AUDIO;
    if (/tts|text-to-speech|realtime|audio/.test(n)) return MODEL_TYPES.AUDIO;
    if (/video|sora/.test(n)) return MODEL_TYPES.VIDEO;
  }
  if (providerKey === 'anthropic') {
    // Claude is chat/multimodal; no separate image/audio product names in overlay yet
  }
  if (providerKey === 'mistral') {
    if (/pixtral.*image|vision.*only/.test(n)) return MODEL_TYPES.IMAGE;
    if (/voxtral|transcribe/.test(n)) return MODEL_TYPES.AUDIO;
  }

  return MODEL_TYPES.CHAT;
}

/** True if the model type uses token pricing (chat, embedding). */
export function isTokenPricedType(modelType) {
  return modelType === MODEL_TYPES.CHAT || modelType === MODEL_TYPES.EMBEDDING;
}

/** True if the model type has benchmarks (chat/reasoning only). */
export function hasBenchmarksType(modelType) {
  return modelType === MODEL_TYPES.CHAT;
}
