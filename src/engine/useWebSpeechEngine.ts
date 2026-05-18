import { useEffect, useMemo, useRef } from "react";
import { track } from "@plasius/nfr";
import { createStore } from "@plasius/react-state";
import { stopAndWait } from "../utils/stopAndWait.js";
import {
  globalVoiceStore as defaultGlobalVoiceStore,
  GlobalVoiceState,
  type GlobalVoiceStore,
} from "../stores/global.store.js";

// ──────────────────────────────────────────────────────────────────────────────
// Action creators (thin helpers for readability & testability)
// ──────────────────────────────────────────────────────────────────────────────
const createActions = (store: GlobalVoiceStore) => ({
  reqStart: (
    payload?: Partial<{ lang: string; interim: boolean; continuous: boolean }>
  ) => store.dispatch({ type: "REQ/START", payload }),
  reqStop: () => store.dispatch({ type: "REQ/STOP" }),
  setConfig: (lang: string, interim: boolean, continuous: boolean) =>
    store.dispatch({
      type: "INT/SET_CONFIG",
      payload: { lang, interim, continuous },
    }),
  setPermission: (permission: any) =>
    store.dispatch({ type: "INT/SET_PERMISSIONS", payload: { permission } }),
  deviceList: (deviceList: MediaDeviceInfo[]) =>
    store.dispatch({
      type: "EVT/DEVICE_LIST_CHANGED",
      payload: { deviceList },
    }),
  deviceChanged: (deviceId: string | null) =>
    store.dispatch({ type: "EVT/DEVICE_CHANGED", payload: { deviceId } }),
  startEvt: (sessionId: string, startedAt: number) =>
    engineStore.dispatch({
      type: "EVT/START",
      payload: { sessionId, startedAt },
    }),
  endEvt: (endedAt: number) =>
    engineStore.dispatch({ type: "EVT/END", payload: { endedAt } }),
  errorEvt: (error: string) =>
    engineStore.dispatch({ type: "EVT/ERROR", payload: { error } }),
  resetLocal: () => engineStore.dispatch({ type: "INT/RESET" }),
  partial: (text: string) =>
    store.dispatch({ type: "EVT/PARTIAL", payload: { text } }),
  final: (text: string) =>
    store.dispatch({ type: "EVT/FINAL", payload: { text } }),
  startFlag: () => store.dispatch({ type: "EVT/START" }),
  endFlag: () => store.dispatch({ type: "EVT/END" }),
});

type EngineActions = ReturnType<typeof createActions>;

const emit = (name: string, props?: Record<string, unknown>) => {
  try {
    track(name, props as any);
  } catch {}
};

// ──────────────────────────────────────────────────────────────────────────────
// Engine-local state (for telemetry/session lifecycle)
// ──────────────────────────────────────────────────────────────────────────────
export type EngineState = {
  sessionId: string | null;
  startedAt?: number;
  endedAt?: number;
  lastError?: string;
};

export type EngineAction =
  | { type: "EVT/START"; payload: { sessionId: string; startedAt: number } }
  | { type: "EVT/END"; payload: { endedAt: number } }
  | { type: "EVT/ERROR"; payload: { error: string } }
  | { type: "INT/RESET" };

export type WebSpeechEngine = {
  start(): void;
  stop(): void;
  dispose(): void;
  reset(): void;
  getLocalState(): EngineState;
  // convenience proxies reading from the global store
  getState(): GlobalVoiceState;
  subscribe(cb: () => void): () => void;
  subscribeToKey<K extends keyof GlobalVoiceState>(
    key: K,
    listener: (value: GlobalVoiceState[K]) => void
  ): () => void;
};

// ──────────────────────────────────────────────────────────────────────────────
// Local engine store
// ──────────────────────────────────────────────────────────────────────────────
const reducer = (s: EngineState, a: EngineAction): EngineState => {
  switch (a.type) {
    case "EVT/START":
      return {
        ...s,
        sessionId: a.payload.sessionId,
        startedAt: a.payload.startedAt,
        lastError: undefined,
      };
    case "EVT/END":
      return { ...s, endedAt: a.payload.endedAt };
    case "EVT/ERROR":
      return { ...s, lastError: a.payload.error };
    case "INT/RESET":
      return {
        sessionId: null,
        startedAt: undefined,
        endedAt: undefined,
        lastError: undefined,
      };
    default:
      return s;
  }
};

const engineStore = createStore<EngineState, EngineAction>(reducer, {
  sessionId: null,
  startedAt: undefined,
  endedAt: undefined,
  lastError: undefined,
});

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────
type SRCtor = new () => SpeechRecognition;
const getSRCtor = (): SRCtor | undefined =>
  ((globalThis as any).SpeechRecognition ||
    (globalThis as any).webkitSpeechRecognition) as SRCtor | undefined;

function applyConfigTo(rec: SpeechRecognition, store: GlobalVoiceStore) {
  const s = store.getState();
  rec.lang = s.lang;
  rec.interimResults = !!s.interim;
  (rec as any).continuous = !!s.continuous;
}

// ──────────────────────────────────────────────────────────────────────────────
// SR handler helpers
// ──────────────────────────────────────────────────────────────────────────────
function newSessionId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );
}

function onSRStart(rec: SpeechRecognition, actions: EngineActions) {
  const sessionId = newSessionId();
  (rec as any).__sessionId = sessionId;
  (rec as any).__cursor = 0;
  actions.startEvt(sessionId, (performance as any)?.now?.() ?? Date.now());
  actions.startFlag();
  emit("webspeech:session-start", { lang: (rec as any).lang, sessionId });
}

function onSRError(
  rec: SpeechRecognition,
  err: any,
  actions: EngineActions,
  store: GlobalVoiceStore
) {
  const error = String(err?.error ?? err?.name ?? err ?? "unknown");
  const permissionDenied =
    error === "not-allowed" ||
    error === "NotAllowedError";
  const fatal = permissionDenied || error === "service-not-allowed";

  actions.errorEvt(error);
  store.dispatch({ type: "EVT/ERROR", payload: { error } });

  if (permissionDenied) {
    actions.setPermission("denied"); // force global store to denied
  }

  emit("webspeech:session-error", {
    lang: (rec as any).lang,
    sessionId: (rec as any).__sessionId,
    error,
    fatal,
  });
}

function onSREnd(rec: SpeechRecognition, actions: EngineActions) {
  actions.endEvt((performance as any)?.now?.() ?? Date.now());
  actions.endFlag();
  emit("webspeech:session-end", {
    lang: (rec as any).lang,
    sessionId: (rec as any).__sessionId,
  });
}

function extractTexts(ev: any, rec: SpeechRecognition) {
  const list = ev?.results as any;
  const len = list?.length ?? 0;
  if (len < (rec as any).__cursor) (rec as any).__cursor = 0;
  const start =
    typeof ev?.resultIndex === "number"
      ? ev.resultIndex
      : ((rec as any).__cursor ?? 0);
  let finalText = "";
  let interimText = "";
  for (let i = start; i < len; i++) {
    const res = list[i];
    if (!res || res.length === 0) continue;
    const chunk = res[0]?.transcript ?? "";
    if (res.isFinal) finalText += chunk;
    else interimText += chunk;
  }
  (rec as any).__cursor = len;
  return {
    interim: (interimText || "").replace(/\s+/g, " ").trim(),
    final: (finalText || "").replace(/\s+/g, " ").trim(),
  };
}

function onSRResult(rec: SpeechRecognition, ev: any, actions: EngineActions) {
  const { interim, final } = extractTexts(ev, rec);
  if (interim && interim !== (rec as any).__lastInterim) {
    (rec as any).__lastInterim = interim;
    actions.partial(interim);
    emit("webspeech:session-partial", {
      lang: (rec as any).lang,
      sessionId: (rec as any).__sessionId,
    });
  }
  if (final && final !== (rec as any).__lastFinal) {
    (rec as any).__lastFinal = final;
    actions.final(final);
    emit("webspeech:session-final", {
      lang: (rec as any).lang,
      sessionId: (rec as any).__sessionId,
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────
export type WebSpeechEngineOptions = {
  lang: string;
  interim: boolean;
  continuous: boolean;
  enabled?: boolean;
  globalStore?: GlobalVoiceStore;
};

export function useWebSpeechEngine(opts: WebSpeechEngineOptions): WebSpeechEngine {
  const store = opts.globalStore ?? defaultGlobalVoiceStore;
  const actions = useMemo(() => createActions(store), [store]);
  const recRef = useRef<SpeechRecognition | null>(null);
  const disposedRef = useRef(false);
  const cleanupsRef = useRef<(() => void)[]>([]);
  const enabled = opts.enabled ?? true;

  // 1) Push option changes into the global store (no implicit start/stop)
  useEffect(() => {
    if (!enabled) return;
    actions.setConfig(opts.lang, !!opts.interim, !!opts.continuous);
  }, [actions, enabled, opts.lang, opts.interim, opts.continuous]);

  // 2) One-time environment wiring: device watcher + permissions probe
  useEffect(() => {
    if (!enabled) return;
    if (disposedRef.current) return;

    const localCleanups: (() => void)[] = [];
    cleanupsRef.current = localCleanups;

    // Device watcher
    const md: any = (globalThis as any)?.navigator?.mediaDevices;
    const onDeviceChange = async () => {
      if (disposedRef.current) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const list = devices.filter((d) => d.kind === "audioinput");
        actions.deviceList(list);

        const current = store.getState().deviceId;
        const stillExists = !!list.find((d) => d.deviceId === current);
        if (!list.length || !stillExists) {
          actions.deviceChanged(null);
        }
      } catch {
        track("webspeech:devicechange-fail");
      }
    };

    if (md?.addEventListener) {
      md.addEventListener("devicechange", onDeviceChange);
      localCleanups.push(() =>
        md.removeEventListener("devicechange", onDeviceChange)
      );
      void onDeviceChange(); // prime once
    } else if (md && "ondevicechange" in md) {
      (md as any).ondevicechange = onDeviceChange;
      localCleanups.push(() => {
        if ((md as any).ondevicechange === onDeviceChange)
          (md as any).ondevicechange = null;
      });
      void onDeviceChange();
    }

    // Permissions probe (only if SR exists and Permissions API available)
    const SR = getSRCtor();
    if (!SR) {
      actions.setPermission("prompt");
    } else if ((globalThis as any)?.navigator?.permissions?.query) {
      (navigator as any).permissions
        .query({ name: "microphone" as any })
        .then((p: any) => {
          actions.setPermission(p.state as any);
        })
        .catch(() => {});
    }

    return () => {
      disposedRef.current = true;
      for (const fn of localCleanups)
        try {
          fn();
        } catch {}
      localCleanups.length = 0;
    };
  }, [actions, enabled, store]);

  // 3) Manage SR lifecycle in response to global store changes
  useEffect(() => {
    if (!enabled) return;
    const SR = getSRCtor();
    if (!SR) return;

    const localCleanups: (() => void)[] = cleanupsRef.current;

    const attachHandlers = (r: SpeechRecognition) => {
      (r as any).__cursor = 0;
      (r as any).__lastInterim = "";
      (r as any).__lastFinal = "";

      r.onstart = () => onSRStart(r, actions);
      r.onerror = (e: any) => {
        onSRError(r, e, actions, store);
        if (
          String(e?.error ?? e).includes("not-allowed") &&
          recRef.current === r
        ) {
          recRef.current = null;
        }
      };
      r.onend = () => {
        onSREnd(r, actions);
        if (disposedRef.current) return;
        const { continuous, wantListening } = store.getState();
        if (continuous && wantListening && recRef.current === r) {
          try {
            r.start();
          } catch (e) {
            emit("webspeech:restart-error", { msg: String(e) });
          }
        }
      };
      r.onresult = (ev: any) => onSRResult(r, ev, actions);
    };

    // Helper to encapsulate start + recovery logic
    async function startWithRecovery(r: SpeechRecognition) {
      try {
        r.start();
      } catch (e) {
        emit("webspeech:start-error", { msg: String(e) });
        store.dispatch({ type: "EVT/ERROR", payload: { error: String(e) } });
        // Deny if the browser reports a permission error shape
        const errStr = String((e as any)?.error ?? (e as any)?.name ?? e);
        const serviceUnavailable =
          errStr === "service-not-allowed" ||
          errStr === "network" ||
          errStr === "language-unavailable" ||
          errStr === "language-not-supported" ||
          errStr === "not-supported";
        if (
          errStr === "not-allowed" ||
          errStr === "NotAllowedError"
        ) {
          actions.setPermission("denied");
        }

        const stuck = recRef.current;
        recRef.current = null;
        if (stuck) {
          try {
            await stopAndWait(stuck as any);
          } catch (err) {
            try {
              track("webspeech:stopAndWait-error", { msg: String(err) });
            } catch {}
          }
        }

        if (serviceUnavailable) return;

        // Attempt a fresh recognizer if we are still alive
        if (!disposedRef.current && SR) {
          try {
            const fresh = new SR();
            applyConfigTo(fresh, store);
            attachHandlers(fresh);
            recRef.current = fresh;
            fresh.start();
          } catch (err2) {
            try {
              track("webspeech:freshstart-error", { msg: String(err2) });
            } catch {}
            store.dispatch({
              type: "EVT/ERROR",
              payload: { error: String(err2) },
            });
          }
        }
      }
    }

    const onWantListeningChange = async () => {
      const { wantListening, permission, muted } = store.getState();
      if (disposedRef.current || !SR || muted || permission === "denied")
        return;

      if (wantListening) {
        if (recRef.current) return;
        const r = new SR();
        applyConfigTo(r, store);
        attachHandlers(r);
        recRef.current = r;
        void startWithRecovery(r);
      } else if (recRef.current) {
        const current = recRef.current;
        recRef.current = null;
        stopAndWait(current).catch((e) => {
          try {
            track("webspeech:stopAndWait-error", {
              code: String((e as any)?.name || ""),
              msg: String(e),
              sessionId: (current as any).__sessionId || null,
            });
          } catch {}
        });
      }
    };

    const unsubWant = store.subscribeToKey(
      "wantListening",
      onWantListeningChange
    );
    onWantListeningChange();
    localCleanups.push(unsubWant);

    // Also react to config changes while listening
    let cfgScheduled = false;
    const onCfgChange = () => {
      if (disposedRef.current || cfgScheduled) return;
      cfgScheduled = true;

      // schedule into microtask to coalesce multiple key-changes in the same tick
      Promise.resolve().then(() => {
        cfgScheduled = false;
        if (disposedRef.current) return;

        const s = store.getState();
        const cfg = {
          lang: s.lang,
          interim: s.interim,
          continuous: s.continuous,
        };

        if (s.listening) {
          actions.reqStop();
          actions.reqStart(cfg);
        } else if (s.wantListening) {
          actions.reqStart(cfg);
        }
      });
    };
    const uLang = store.subscribeToKey("lang", onCfgChange);
    localCleanups.push(uLang);
    const uInterim = store.subscribeToKey("interim", onCfgChange);
    localCleanups.push(uInterim);
    const uCont = store.subscribeToKey("continuous", onCfgChange);
    localCleanups.push(uCont);

    // Device/mute enforcement
    const uDevice = store.subscribeToKey("deviceId", () => {
      const { wantListening, deviceId, interim, lang, continuous } =
        store.getState();
      if (deviceId === null) actions.reqStop();
      else if (wantListening) actions.reqStart({ lang, continuous, interim });
    });
    localCleanups.push(uDevice);

    const uMuted = store.subscribeToKey("muted", () => {
      if (disposedRef.current) return;
      actions.reqStop();
    });
    localCleanups.push(uMuted);

    return () => {
      for (const fn of localCleanups.splice(0)) {
        try {
          fn();
        } catch {}
      }
    };
  }, [actions, enabled, store]);

  // 4) Public API
  const api = useMemo<WebSpeechEngine>(
    () => ({
      start() {
        actions.reqStart();
      },
      stop() {
        actions.reqStop();
      },
      dispose() {
        actions.reqStop();
        disposedRef.current = true;
        const current = recRef.current;
        try {
          track("webspeech:dispose", {
            sessionId: (current as any).__sessionId,
          });
        } catch {}
        recRef.current = null;
        actions.resetLocal();
        for (const fn of cleanupsRef.current.splice(0)) {
          try {
            fn();
          } catch {}
        }
        if (current) {
          stopAndWait(current).catch((e) => {
            try {
              track("webspeech:stopAndWait-error", {
                code: String((e as any)?.name || ""),
                msg: String(e),
                sessionId: (current as any).__sessionId || null,
              });
            } catch {}
          });
        }
      },
      reset() {
        disposedRef.current = false;
        track("webspeech:reset");
      },
      getLocalState: engineStore.getState,
      getState: store.getState,
      subscribe: store.subscribe,
      subscribeToKey: store.subscribeToKey,
    }),
    [actions, store]
  );

  return api;
}
