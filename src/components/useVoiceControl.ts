import { useEffect, useMemo, useRef } from "react";
import { track } from "@plasius/nfr";
import type { GlobalVoiceStore } from "../stores/global.store.js";
import { globalVoiceStore as defaultGlobalVoiceStore } from "../stores/global.store.js";
import type { WebSpeechEngine } from "../engine/useWebSpeechEngine.js";
import { useWebSpeechEngine } from "../engine/useWebSpeechEngine.js";

/**
 * Options for the Voice Control hook.
 */
export type UseVoiceControlOptions = {
  /**
   * Keyboard keys that trigger PTT. Values are KeyboardEvent.code entries
   * (e.g. "Space", "KeyV"). Defaults to ["Space"].
   */
  pttKeyCodes?: string[]; // KeyboardEvent.code
  /**
   * Mouse button to use for PTT (0=Left,1=Middle,2=Right). If undefined, mouse is ignored.
   */
  pttMouseButton?: 0 | 1 | 2;
  /**
   * Whether to attach global keyboard listeners (window). Default: true.
   */
  enableGlobalKeyboard?: boolean;
  /**
   * Whether to attach global mouse listeners (window). Default: false (you can bind handlers to a button instead).
   */
  enableGlobalMouse?: boolean;
  /**
   * Whether to attach global touch listeners (window). Default: false (you can bind handlers to a button instead).
   */
  enableGlobalTouch?: boolean;

  /**
   * If true, PTT requires holding the key/button; if false, pressing toggles talk on/off.
   * This can also be changed dynamically through the store (pttHold).
   * Provided here only as initial convenience.
   */
  initialPttHold?: boolean;

  /**
   * Initial PTT enabled flag. Can be changed later through store.
   */
  initialPttEnabled?: boolean;

  /**
   * Initial volume (0..1). Will be clamped. Stored in global voice state.
   */
  initialVolume?: number;

  /**
   * Inject a custom global store (for testing or advanced wiring).
   */
  globalStore?: GlobalVoiceStore;

  /**
   * Inject a pre-created engine (for testing). If not provided, we create one.
   * When injecting, ensure it uses the same global store instance (opts.globalStore).
   */
  engine?: WebSpeechEngine;

  /**
   * Engine configuration passthrough (initial language/config).
   */
  engineConfig?: { lang?: string; interim?: boolean; continuous?: boolean };
};

export type VoiceControlAPI = {
  // Control functions
  setMuted(value: boolean): void;
  setVolume(value: number): void;
  setPTTButton(config: { enabled?: boolean; mode?: "hold" | "toggle" }): void;
  /**
   * Imperative PTT helper. If `action` is omitted, it toggles in toggle mode or
   * behaves like press in hold mode.
   */
  pttButton(
    action?: "press" | "release" | "toggle",
    source?: "keyboard" | "mouse" | "touch"
  ): void;

  // Props you can spread onto a PTT button
  pttButtonProps: {
    onMouseDown: () => void;
    onMouseUp: () => void;
    onTouchStart: () => void;
    onTouchEnd: () => void;
    "aria-pressed": boolean;
  };

  // Expose underlying engine controls
  start(): void;
  stop(): void;
  dispose(): void;
};

const clamp01 = (n: number) =>
  isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.0;

export function useVoiceControl(
  options: UseVoiceControlOptions = {}
): VoiceControlAPI {
  const {
    pttKeyCodes = ["ControlLeft", "Space", "ControlRight"],
    pttMouseButton,
    enableGlobalKeyboard = true,
    enableGlobalMouse = false,
    enableGlobalTouch = false,
    initialPttHold,
    initialPttEnabled,
    initialVolume,
    globalStore = defaultGlobalVoiceStore,
    engine,
    engineConfig = {},
  } = options;

  // Ensure initial config is pushed once
  useEffect(() => {
    const payload: any = {};
    if (typeof initialPttHold === "boolean") payload.pttHold = !!initialPttHold;
    if (typeof initialPttEnabled === "boolean")
      payload.pttEnabled = !!initialPttEnabled;
    if (Object.keys(payload).length) {
      globalStore.dispatch({ type: "INT/SET_PTT_CONFIG", payload });
    }
    if (typeof initialVolume === "number") {
      globalStore.dispatch({
        type: "INT/SET_VOLUME",
        payload: { volume: clamp01(initialVolume) },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create (or reuse injected) engine that uses the same global store
  const voiceEngine: WebSpeechEngine =
    engine ??
    useWebSpeechEngine({
      lang: engineConfig.lang ?? (globalStore.getState().lang || "en-GB"),
      interim: !!engineConfig.interim,
      continuous: !!engineConfig.continuous,
    });

  // --- Global input listeners (optional) --------------------------------------

  // Keyboard: hold or toggle based on store config at press time.
  useEffect(() => {
    if (!enableGlobalKeyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // ignore auto-repeat; we only want edge
      if (!pttKeyCodes.includes(e.code)) return;
      const { pttHold, pttEnabled } = globalStore.getState();
      if (!pttEnabled) return;

      if (pttHold) {
        globalStore.dispatch({
          type: "EVT/PTT_PRESSED",
          payload: { source: "keyboard" },
        });
        globalStore.dispatch({ type: "REQ/START" }); // desired start while held
      } else {
        // toggle on press
        globalStore.dispatch({
          type: "EVT/PTT_PRESSED",
          payload: { source: "keyboard" },
        });
        globalStore.dispatch({
          type: "EVT/PTT_RELEASED",
          payload: { source: "keyboard" },
        }); // normalize press edge
        globalStore.dispatch({
          type: "EVT/PTT_TOGGLE",
          payload: { source: "keyboard" },
        });
        const { pttActive } = globalStore.getState();
        globalStore.dispatch(
          pttActive ? { type: "REQ/START" } : { type: "REQ/STOP" }
        );
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!pttKeyCodes.includes(e.code)) return;
      const { pttHold, pttEnabled } = globalStore.getState();
      if (!pttEnabled) return;
      if (pttHold) {
        globalStore.dispatch({
          type: "EVT/PTT_RELEASED",
          payload: { source: "keyboard" },
        });
        globalStore.dispatch({ type: "REQ/STOP" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enableGlobalKeyboard, pttKeyCodes, globalStore]);

  // Mouse (button-based) — default off; many UIs will bind pttButtonProps instead
  useEffect(() => {
    if (!enableGlobalMouse || typeof pttMouseButton !== "number") return;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== pttMouseButton) return;
      const { pttHold, pttEnabled } = globalStore.getState();
      if (!pttEnabled) return;
      if (pttHold) {
        globalStore.dispatch({
          type: "EVT/PTT_PRESSED",
          payload: { source: "mouse" },
        });
        globalStore.dispatch({ type: "REQ/START" });
      } else {
        globalStore.dispatch({
          type: "EVT/PTT_PRESSED",
          payload: { source: "mouse" },
        });
        globalStore.dispatch({
          type: "EVT/PTT_RELEASED",
          payload: { source: "mouse" },
        });
        globalStore.dispatch({
          type: "EVT/PTT_TOGGLE",
          payload: { source: "mouse" },
        });
        const { pttActive } = globalStore.getState();
        globalStore.dispatch(
          pttActive ? { type: "REQ/START" } : { type: "REQ/STOP" }
        );
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== pttMouseButton) return;
      const { pttHold, pttEnabled } = globalStore.getState();
      if (!pttEnabled) return;
      if (pttHold) {
        globalStore.dispatch({
          type: "EVT/PTT_RELEASED",
          payload: { source: "mouse" },
        });
        globalStore.dispatch({ type: "REQ/STOP" });
      }
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [enableGlobalMouse, pttMouseButton, globalStore]);

  // Touch (global) — default off
  useEffect(() => {
    if (!enableGlobalTouch) return;
    const onTouchStart = () => {
      const { pttHold, pttEnabled } = globalStore.getState();
      if (!pttEnabled) return;
      if (pttHold) {
        globalStore.dispatch({
          type: "EVT/PTT_PRESSED",
          payload: { source: "touch" },
        });
        globalStore.dispatch({ type: "REQ/START" });
      } else {
        globalStore.dispatch({
          type: "EVT/PTT_PRESSED",
          payload: { source: "touch" },
        });
        globalStore.dispatch({
          type: "EVT/PTT_RELEASED",
          payload: { source: "touch" },
        });
        globalStore.dispatch({
          type: "EVT/PTT_TOGGLE",
          payload: { source: "touch" },
        });
        const { pttActive } = globalStore.getState();
        globalStore.dispatch(
          pttActive ? { type: "REQ/START" } : { type: "REQ/STOP" }
        );
      }
    };
    const onTouchEnd = () => {
      const { pttHold, pttEnabled } = globalStore.getState();
      if (!pttEnabled) return;
      if (pttHold) {
        globalStore.dispatch({
          type: "EVT/PTT_RELEASED",
          payload: { source: "touch" },
        });
        globalStore.dispatch({ type: "REQ/STOP" });
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enableGlobalTouch, globalStore]);

  const setPTTButton = (config: {
    enabled?: boolean;
    mode?: "hold" | "toggle";
  }) => {
    const payload: { pttEnabled?: boolean; pttHold?: boolean } = {};
    if (typeof config.enabled === "boolean")
      payload.pttEnabled = config.enabled;
    if (config.mode === "hold") payload.pttHold = true;
    if (config.mode === "toggle") payload.pttHold = false;
    if (Object.keys(payload).length) {
      globalStore.dispatch({ type: "INT/SET_PTT_CONFIG", payload });
    }
  };

  const pttButton = (
    action?: "press" | "release" | "toggle",
    source: "keyboard" | "mouse" | "touch" = "mouse"
  ) => {
    const s = globalStore.getState();
    if (!s.pttEnabled) return;

    const mode: "hold" | "toggle" = s.pttHold ? "hold" : "toggle";

    // If action omitted, choose sensible default per mode
    const act = action ?? (mode === "hold" ? "press" : "toggle");

    if (act === "press") {
      if (mode === "hold") {
        globalStore.dispatch({ type: "EVT/PTT_PRESSED", payload: { source } });
        globalStore.dispatch({ type: "REQ/START" });
      } else {
        // toggle mode press == toggle
        globalStore.dispatch({ type: "EVT/PTT_PRESSED", payload: { source } });
        globalStore.dispatch({ type: "EVT/PTT_RELEASED", payload: { source } });
        globalStore.dispatch({ type: "EVT/PTT_TOGGLE", payload: { source } });
        const { pttActive } = globalStore.getState();
        globalStore.dispatch(
          pttActive ? { type: "REQ/START" } : { type: "REQ/STOP" }
        );
      }
      return;
    }

    if (act === "release") {
      if (mode === "hold") {
        globalStore.dispatch({ type: "EVT/PTT_RELEASED", payload: { source } });
        globalStore.dispatch({ type: "REQ/STOP" });
      }
      return;
    }

    // act === "toggle"
    globalStore.dispatch({ type: "EVT/PTT_TOGGLE", payload: { source } });
    {
      const { pttActive } = globalStore.getState();
      globalStore.dispatch(
        pttActive ? { type: "REQ/START" } : { type: "REQ/STOP" }
      );
    }
  };

  const pttButtonProps = useMemo(
    () => ({
      onMouseDown: () => pttButton("press", "mouse"),
      onMouseUp: () => pttButton("release", "mouse"),
      onTouchStart: () => pttButton("press", "touch"),
      onTouchEnd: () => pttButton("release", "touch"),
      "aria-pressed": globalStore.getState().pttActive,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [globalStore.getState().pttActive]
  );

  const setMuted = (value: boolean) => {
    const old = globalStore.getState().muted;
    if (old === value) return;
    globalStore.dispatch({
      type: "EVT/MUTE_CHANGED",
      payload: { muted: value },
    });
    if (value) globalStore.dispatch({ type: "REQ/STOP" });
    else if (globalStore.getState().wantListening)
      globalStore.dispatch({ type: "REQ/START" });
    try {
      track("voice:set-mute", { muted: value });
    } catch {}
  };

  const setVolume = (value: number) => {
    const v = clamp01(value);
    globalStore.dispatch({ type: "INT/SET_VOLUME", payload: { volume: v } });
    try {
      track("voice:set-volume", { volume: v });
    } catch {}
  };

  // Snapshot for return; consumers should rely on subscribe/selectors to update UI
  const state = globalStore.getState();

  return {
    // controls
    setMuted,
    setVolume,
    setPTTButton,
    pttButton,
    pttButtonProps,

    // engine proxies
    start: voiceEngine.start,
    stop: voiceEngine.stop,
    dispose: voiceEngine.dispose,
  };
}
