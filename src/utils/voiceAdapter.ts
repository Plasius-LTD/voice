// src/utils/voiceAdapter.ts
import { useVoiceContext } from "../components/voiceProvider.js";

/** Adapts the VoiceProvider API into a stable interface for the hook. */
export interface VoiceAdapter {
  getMuted(): boolean;
  setMuted(muted: boolean): void;
  getVolume(): number; // 0..1
  setVolume(v: number): void; // 0..1
  startListening(): void;
  stopListening(): void;
  isListening(): boolean;
}

/**
 * Default adapter builder. It attempts common method names first, then
 * property fallbacks. Kept free of React hooks to aid testability.
 */
export function buildDefaultAdapter(
  voice: ReturnType<typeof useVoiceContext>
): VoiceAdapter {
  const anyVoice = voice as unknown as Record<string, unknown>;

  const getMuted = () => {
    if (typeof (anyVoice as any).getMuted === "function")
      return (anyVoice as any).getMuted();
    if (typeof (anyVoice as any).isMuted === "function")
      return (anyVoice as any).isMuted();
    if (typeof (anyVoice as any).muted === "boolean")
      return (anyVoice as any).muted as boolean;
    return false;
  };

  const setMuted = (val: boolean) => {
    if (typeof (anyVoice as any).setMuted === "function")
      return (anyVoice as any).setMuted(val);
    if (val && typeof (anyVoice as any).mute === "function")
      return (anyVoice as any).mute();
    if (!val && typeof (anyVoice as any).unmute === "function")
      return (anyVoice as any).unmute();
  };

  const getVolume = () => {
    if (typeof (anyVoice as any).getVolume === "function")
      return (anyVoice as any).getVolume();
    if (typeof (anyVoice as any).volume === "number")
      return (anyVoice as any).volume as number;
    return 1;
  };

  const setVolume = (v: number) => {
    if (typeof (anyVoice as any).setVolume === "function")
      return (anyVoice as any).setVolume(v);
    if (typeof (anyVoice as any).volume === "number")
      (anyVoice as any).volume = v;
  };

  const startListening = () => {
    if (typeof (anyVoice as any).startListening === "function")
      return (anyVoice as any).startListening();
    if (typeof (anyVoice as any).start === "function")
      return (anyVoice as any).start();
    if (typeof (anyVoice as any).listen === "function")
      return (anyVoice as any).listen();
  };

  const stopListening = () => {
    if (typeof (anyVoice as any).stopListening === "function")
      return (anyVoice as any).stopListening();
    if (typeof (anyVoice as any).stop === "function")
      return (anyVoice as any).stop();
    if (typeof (anyVoice as any).pause === "function")
      return (anyVoice as any).pause();
  };

  const isListening = () => {
    if (typeof (anyVoice as any).isListening === "function")
      return (anyVoice as any).isListening();
    if (typeof (anyVoice as any).listening === "boolean")
      return (anyVoice as any).listening as boolean;
    return false;
  };

  return {
    getMuted,
    setMuted,
    getVolume,
    setVolume,
    startListening,
    stopListening,
    isListening,
  };
}
