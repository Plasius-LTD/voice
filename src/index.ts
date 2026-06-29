export * from "./components/voiceProvider.js";
export * from "./components/useVoiceIntents.js";
export * from "./components/useVoiceControl.js";
export {
  VoiceProvider,
  useVoiceContext,
  WithVoice,
} from "./components/voiceProvider.js";
export { useVoice, type UseVoiceOptions, type UseVoiceResult } from "./components/useVoice.js";
export { useVoiceIntents } from "./components/useVoiceIntents.js";
export { useVoiceControl } from "./components/useVoiceControl.js";
export {
  VoiceIntents,
  useAutoVoiceIntents,
} from "./components/voiceIntents.js";
export type {
  IntentSpec,
  VoiceIntentsProps,
} from "./components/voiceIntents.js";
export {
  createGlobalVoiceStore,
  globalVoiceStore,
  type GlobalVoiceStore,
} from "./stores/global.store.js";
export {
  useWebSpeechEngine,
  type WebSpeechEngine,
  type WebSpeechEngineOptions,
} from "./engine/useWebSpeechEngine.js";
export {
  useSpeechRecognitionEngine,
  isWebSpeechUnavailableError,
  type SpeechRecognitionEngineMode,
  type SpeechRecognitionEngineOptions,
} from "./engine/useSpeechRecognitionEngine.js";
export {
  useLocalSpeechEngine,
  useRemoteSpeechEngine,
  createFetchRemoteRecognitionClient,
  isLocalSpeechRecognitionConfigured,
  isRemoteSpeechRecognitionConfigured,
  normalizeRemoteSpeechRecognitionResult,
  type LocalSpeechEngineOptions,
  type LocalSpeechRecognitionConfig,
  type LocalSpeechRecognitionClient,
  type LocalSpeechRecognitionExecutionTarget,
  type LocalSpeechRecognitionGpuPolicy,
  type LocalSpeechRecognitionRequest,
  type LocalSpeechRecognitionResult,
  type RemoteSpeechEngineOptions,
  type RemoteSpeechRecognitionClient,
  type RemoteSpeechRecognitionConfig,
  type RemoteSpeechRecognitionRequest,
  type RemoteSpeechRecognitionResult,
  type FetchRemoteRecognitionClientOptions,
} from "./engine/remoteSpeechRecognition.js";
export {
  createSpellCastingIntent,
  parseSpellCastingUtterance,
  SPELL_CASTING_FEATURE_FLAG_ID,
  SPELL_CASTING_PATTERNS,
  type SpellCastingIntent,
  type SpellCastingIntentHandler,
  type SpellCastingIntentMeta,
  type SpellCastingTargetMode,
} from "./spellCasting.js";
