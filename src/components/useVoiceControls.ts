import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVoiceContext } from "./voiceProvider.js";

/**
 * A minimal adapter to decouple the controls hook from the exact shape of the
 * voice API. We try sensible method/property names and fall back to no-ops if
 * missing so the hook is resilient while your voice API evolves.
 */
export interface VoiceAdapter {
  getMuted(): boolean;
  setMuted(muted: boolean): void;
  getVolume(): number; // normalized 0..1
  setVolume(v: number): void; // expects 0..1
  startListening(): void;
  stopListening(): void;
  isListening(): boolean;
}

function buildDefaultAdapter(voice: ReturnType<typeof useVoiceContext>): VoiceAdapter {
  const anyVoice = voice as unknown as Record<string, unknown>;

  const getMuted = () => {
    if (typeof (anyVoice as any).getMuted === "function") return (anyVoice as any).getMuted();
    if (typeof (anyVoice as any).isMuted === "function") return (anyVoice as any).isMuted();
    if (typeof (anyVoice as any).muted === "boolean") return (anyVoice as any).muted as boolean;
    return false;
  };

  const setMuted = (val: boolean) => {
    if (typeof (anyVoice as any).setMuted === "function") return (anyVoice as any).setMuted(val);
    if (val && typeof (anyVoice as any).mute === "function") return (anyVoice as any).mute();
    if (!val && typeof (anyVoice as any).unmute === "function") return (anyVoice as any).unmute();
  };

  const getVolume = () => {
    if (typeof (anyVoice as any).getVolume === "function") return (anyVoice as any).getVolume();
    if (typeof (anyVoice as any).volume === "number") return (anyVoice as any).volume as number;
    return 1;
  };

  const setVolume = (v: number) => {
    if (typeof (anyVoice as any).setVolume === "function") return (anyVoice as any).setVolume(v);
    if (typeof (anyVoice as any).volume === "number") (anyVoice as any).volume = v;
  };

  const startListening = () => {
    if (typeof (anyVoice as any).startListening === "function") return (anyVoice as any).startListening();
    if (typeof (anyVoice as any).start === "function") return (anyVoice as any).start();
    if (typeof (anyVoice as any).listen === "function") return (anyVoice as any).listen();
  };

  const stopListening = () => {
    if (typeof (anyVoice as any).stopListening === "function") return (anyVoice as any).stopListening();
    if (typeof (anyVoice as any).stop === "function") return (anyVoice as any).stop();
    if (typeof (anyVoice as any).pause === "function") return (anyVoice as any).pause();
  };

  const isListening = () => {
    if (typeof (anyVoice as any).isListening === "function") return (anyVoice as any).isListening();
    if (typeof (anyVoice as any).listening === "boolean") return (anyVoice as any).listening as boolean;
    return false;
  };

  return { getMuted, setMuted, getVolume, setVolume, startListening, stopListening, isListening };
}

export interface UseVoiceControlsOptions {
  /** Target for push-to-talk (PTT). Can be an HTMLElement or a CSS selector. */
  readonly target?: HTMLElement | string | null;
  /** Keyboard key for PTT (e.g., " ", "Space", "Shift"). Default: Space bar. */
  readonly pttKey?: string;
  /** Initial volume (0..1). If omitted, reads from voice adapter. */
  readonly initialVolume?: number;
  /** Start muted. If omitted, reads from voice adapter. */
  readonly initiallyMuted?: boolean;
  /**
   * Optional custom adapter if your voice API differs. If not provided, a
   * best-effort adapter is built from `useVoiceContext()`.
   */
  readonly adapter?: VoiceAdapter;
}

export interface UseVoiceControlsReturn {
  readonly muted: boolean;
  readonly volume: number; // 0..1
  readonly listening: boolean;
  readonly toggleMute: () => void;
  readonly setVolume: (v: number) => void;
  /** Bind these handlers to any element for mouse/touch PTT. */
  readonly bindPTT: {
    readonly onMouseDown: () => void;
    readonly onMouseUp: () => void;
    readonly onMouseLeave: () => void;
    readonly onTouchStart: () => void;
    readonly onTouchEnd: () => void;
  };
  /** Programmatically attach/detach PTT to a DOM element or selector. */
  readonly registerPTTTarget: (elOrSelector: HTMLElement | string | null) => void;
  readonly unregisterPTTTarget: () => void;
}

/**
 * useVoiceControls
 *
 * Provides mute/unmute, volume control, and push-to-talk (PTT) with both
 * keyboard and pointer bindings.
 */
export const useVoiceControls = (options?: UseVoiceControlsOptions): UseVoiceControlsReturn => {
  const voice = useVoiceContext();
  const adapter = useMemo<VoiceAdapter>(
    () => options?.adapter ?? buildDefaultAdapter(voice),
    [voice, options?.adapter]
  );

  const [muted, setMutedState] = useState<boolean>(
    typeof options?.initiallyMuted === "boolean" ? options.initiallyMuted : adapter.getMuted()
  );
  const [volume, setVolumeState] = useState<number>(
    typeof options?.initialVolume === "number" ? options.initialVolume : adapter.getVolume()
  );
  const [listening, setListening] = useState<boolean>(adapter.isListening());

  const pttKey = options?.pttKey ?? " "; // Space bar
  const pttTargetRef = useRef<HTMLElement | null>(null);
  const heldDownRef = useRef<boolean>(false);

  // Sync outward to adapter when local state changes
  useEffect(() => {
    adapter.setMuted(muted);
  }, [adapter, muted]);

  useEffect(() => {
    const v = Math.min(1, Math.max(0, volume));
    adapter.setVolume(v);
  }, [adapter, volume]);

  // Helper start/stop that also flips UI state
  const startPTT = useCallback(() => {
    if (heldDownRef.current) return;
    heldDownRef.current = true;
    adapter.startListening();
    setListening(true);
  }, [adapter]);

  const stopPTT = useCallback(() => {
    if (!heldDownRef.current) return;
    heldDownRef.current = false;
    adapter.stopListening();
    setListening(false);
  }, [adapter]);

  // Keyboard bindings for PTT
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support "Space" and " " variations
      const key = e.key === "Spacebar" ? " " : e.key; // legacy IE alias fallback
      if (key === pttKey && !e.repeat) {
        e.preventDefault();
        startPTT();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key === "Spacebar" ? " " : e.key;
      if (key === pttKey) {
        e.preventDefault();
        stopPTT();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pttKey, startPTT, stopPTT]);

  // Pointer bindings for a provided target element or selector
  const detachTarget = useCallback(() => {
    const el = pttTargetRef.current;
    if (!el) return;
    el.removeEventListener("mousedown", startPTT);
    el.removeEventListener("mouseup", stopPTT);
    el.removeEventListener("mouseleave", stopPTT);
    el.removeEventListener("touchstart", startPTT);
    el.removeEventListener("touchend", stopPTT);
    pttTargetRef.current = null;
  }, [startPTT, stopPTT]);

  const attachTarget = useCallback(
    (elOrSelector: HTMLElement | string | null) => {
      detachTarget();
      let el: HTMLElement | null = null;
      if (typeof elOrSelector === "string") {
        el = document.querySelector(elOrSelector) as HTMLElement | null;
      } else {
        el = elOrSelector ?? null;
      }
      if (!el) return;
      pttTargetRef.current = el;
      el.addEventListener("mousedown", startPTT);
      el.addEventListener("mouseup", stopPTT);
      el.addEventListener("mouseleave", stopPTT);
      el.addEventListener("touchstart", startPTT, { passive: true });
      el.addEventListener("touchend", stopPTT);
    },
    [detachTarget, startPTT, stopPTT]
  );

  useEffect(() => {
    if (options?.target) attachTarget(options.target);
    return () => detachTarget();
  }, [options?.target, attachTarget, detachTarget]);

  // Public API
  const toggleMute = useCallback(() => setMutedState((m) => !m), []);
  const setVolume = useCallback((v: number) => setVolumeState(() => v), []);

  const bindPTT = useMemo(
    () => ({
      onMouseDown: startPTT,
      onMouseUp: stopPTT,
      onMouseLeave: stopPTT,
      onTouchStart: startPTT,
      onTouchEnd: stopPTT,
    }),
    [startPTT, stopPTT]
  );

  return {
    muted,
    volume,
    listening,
    toggleMute,
    setVolume,
    bindPTT,
    registerPTTTarget: attachTarget,
    unregisterPTTTarget: detachTarget,
  };
};

export default useVoiceControls;
