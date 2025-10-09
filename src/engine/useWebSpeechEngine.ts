import { useEffect, useMemo, useRef } from "react";
import { track } from "@plasius/nfr";
import { createStore, Store } from "@plasius/react-state";
import { stopAndWait } from "../utils/stopAndWait.js";
import {
  globalVoiceStore as gStore,
  GlobalVoiceState
} from "../stores/global.store.js";

// Engine-internal state (not for general UI consumption)
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

  getLocalState(): EngineState;
  // convenience proxies reading from the global store
  getState(): GlobalVoiceState;
  subscribe(cb: () => void): () => void;
  subscribeToKey<K extends keyof GlobalVoiceState>(
    key: K,
    listener: (value: GlobalVoiceState[K]) => void
  ): () => void;
};

type SRCtor = new () => SpeechRecognition;


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

const engineStore =  createStore<EngineState, EngineAction>(reducer, {
  sessionId: null,
  startedAt: undefined,
  endedAt: undefined,
  lastError: undefined,
});

export function useWebSpeechEngine(opts: {
  lang: string;
  interim: boolean;
  continuous: boolean;
}): WebSpeechEngine {
  // Push option changes into the global store (no implicit start/stop)
  useEffect(() => {
    gStore.dispatch({
      type: "INT/SET_CONFIG",
      payload: {
        lang: opts.lang,
        interim: !!opts.interim,
        continuous: !!opts.continuous,
      },
    });
  }, [gStore, opts.lang, opts.interim, opts.continuous]);

  // Recognizer management
  const getSRCtor = (): SRCtor | undefined =>
    ((globalThis as any).SpeechRecognition ||
      (globalThis as any).webkitSpeechRecognition) as SRCtor | undefined;

  const recRef = useRef<SpeechRecognition | null>(null);
  const disposedRef = useRef(false);

  // Device list watcher
  useEffect(() => {
    if (
      !globalThis?.navigator ||
      !navigator.mediaDevices ||
      disposedRef.current
    )
      return;

    const onDeviceChange = async () => {
      if (disposedRef.current) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const list = devices.filter((d) => d.kind === "audioinput");
        gStore.dispatch({
          type: "EVT/DEVICE_LIST_CHANGED",
          payload: { deviceList: list },
        });

        const current = gStore.getState().deviceId;
        const stillExists = !!list?.find((d) => d.deviceId === current);
        if (!list.length || !stillExists) {
          gStore.dispatch({
            type: "EVT/DEVICE_CHANGED",
            payload: { deviceId: null },
          });
        }
      } catch {
        track("webspeech:devicechange-fail");
      }
    };

    if ((navigator.mediaDevices as any).addEventListener) {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        onDeviceChange,
        false
      );
    } else {
      (navigator.mediaDevices as any).ondevicechange = onDeviceChange;
    }
    void onDeviceChange();

    return () => {
      if ((navigator.mediaDevices as any).removeEventListener) {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          onDeviceChange
        );
      } else if (
        (navigator.mediaDevices as any).ondevicechange === onDeviceChange
      ) {
        (navigator.mediaDevices as any).ondevicechange = null;
      }
    };
  }, [gStore]);

  // Initial permissions
  useEffect(() => {
    const SR = getSRCtor();
    if (!SR) {
      gStore.dispatch({
        type: "INT/SET_PERMISSIONS",
        payload: { permission: "prompt" },
      });
      return;
    }
    if (
      globalThis?.navigator &&
      navigator.permissions &&
      "query" in navigator.permissions
    ) {
      navigator.permissions
        .query({ name: "microphone" as any })
        .then((p) => {
          gStore.dispatch({
            type: "INT/SET_PERMISSIONS",
            payload: { permission: p.state as any },
          });
        })
        .catch(() => {});
    }
  }, [gStore]);

  // Track deviceId change: enforce stop/resume
  useEffect(() => {
    const onCurrentDeviceChange = () => {
      if (disposedRef.current) return;
      const { wantListening, deviceId, interim, lang, continuous } =
        gStore.getState();
      if (deviceId === null) {
        gStore.dispatch({ type: "REQ/STOP" });
      } else if (wantListening) {
        gStore.dispatch({
          type: "REQ/START",
          payload: { lang, continuous, interim },
        });
      }
    };
    return gStore.subscribeToKey("deviceId", onCurrentDeviceChange);
  }, [gStore]);

  // Track mute change: enforce stop/resume
  useEffect(() => {
    const onMuteChange = () => {
      if (disposedRef.current) return;
      const { muted, wantListening, lang, interim, continuous } =
        gStore.getState();
      if (muted) gStore.dispatch({ type: "REQ/STOP" });
      else if (wantListening)
        gStore.dispatch({
          type: "REQ/START",
          payload: { lang, continuous, interim },
        });
    };
    return gStore.subscribeToKey("muted", onMuteChange);
  }, [gStore]);

  // Config changes while listening
  useEffect(() => {
    const onCfgChange = () => {
      if (disposedRef.current) return;
      const s = gStore.getState();
      const cfg = {
        lang: s.lang,
        interim: s.interim,
        continuous: s.continuous,
      };
      if (s.listening) {
        gStore.dispatch({ type: "REQ/STOP" });
        gStore.dispatch({ type: "REQ/START", payload: cfg });
      } else if (s.wantListening) {
        gStore.dispatch({ type: "REQ/START", payload: cfg });
      }
    };
    const u1 = gStore.subscribeToKey("lang", onCfgChange);
    const u2 = gStore.subscribeToKey("interim", onCfgChange);
    const u3 = gStore.subscribeToKey("continuous", onCfgChange);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [gStore]);

  // React to wantListening: own the SpeechRecognition lifecycle
  useEffect(() => {
    const SR = getSRCtor();
    const attach = (r: SpeechRecognition) => {
      const s = gStore.getState();
      r.lang = s.lang;
      r.interimResults = !!s.interim;
      (r as any).continuous = !!s.continuous;
      (r as any).__cursor = 0;
      (r as any).__lastInterim = "";
      (r as any).__lastFinal = "";

      r.onstart = () => {
        (r as any).__cursor = 0;
        const sessionId = crypto.randomUUID();
        (r as any).__sessionId = sessionId;
        engineStore.dispatch({
          type: "EVT/START",
          payload: { sessionId, startedAt: performance.now() },
        });
        gStore.dispatch({ type: "EVT/START" });
        try {
          track("webspeech:session-start", { lang: r.lang, sessionId });
        } catch {}
      };

      r.onerror = (e: any) => {
        const error = String(e?.error ?? e ?? "unknown");
        const fatal =
          error === "not-allowed" || error === "service-not-allowed";
        engineStore.dispatch({ type: "EVT/ERROR", payload: { error } });
        gStore.dispatch({ type: "EVT/ERROR", payload: { error } });
        if (fatal && recRef.current === r) {
          gStore.dispatch({
            type: "INT/SET_PERMISSIONS",
            payload: { permission: "denied" },
          });
          recRef.current = null;
        }
        try {
          track("webspeech:session-error", {
            lang: r.lang,
            sessionId: (r as any).__sessionId,
            error,
            fatal,
          });
        } catch {}
      };

      r.onend = () => {
        engineStore.dispatch({
          type: "EVT/END",
          payload: { endedAt: performance.now() },
        });
        gStore.dispatch({ type: "EVT/END" });
        try {
          track("webspeech:session-end", {
            lang: r.lang,
            sessionId: (r as any).__sessionId,
          });
        } catch {}
        if (disposedRef.current) return;
        const { continuous, wantListening } = gStore.getState();
        if (continuous && wantListening && recRef.current === r) {
          try {
            r.start();
          } catch (e) {
            track("webspeech:restart-error", {
              lang: r.lang,
              sessionId: (r as any).__sessionId,
              msg: String(e),
            });
          }
        }
      };

      r.onresult = (ev: any) => {
        const list = ev?.results as any;
        const len = list?.length ?? 0;
        if (len < (r as any).__cursor) (r as any).__cursor = 0;
        const start =
          typeof ev?.resultIndex === "number"
            ? ev.resultIndex
            : ((r as any).__cursor ?? 0);

        let finalText = "";
        let interimText = "";
        for (let i = start; i < len; i++) {
          const res = list[i];
          if (!res || res.length === 0) continue;
          const chunk = res[0]?.transcript ?? "";
          if (res.isFinal) finalText += chunk;
          else interimText += chunk;
        }
        (r as any).__cursor = len;

        const it = (interimText || "").replace(/\s+/g, " ").trim();
        if (it && it !== (r as any).__lastInterim) {
          (r as any).__lastInterim = it;
          gStore.dispatch({ type: "EVT/PARTIAL", payload: { text: it } });
          try {
            track("webspeech:session-partial", {
              lang: r.lang,
              sessionId: (r as any).__sessionId,
            });
          } catch {}
        }

        const ft = (finalText || "").replace(/\s+/g, " ").trim();
        if (ft && ft !== (r as any).__lastFinal) {
          (r as any).__lastFinal = ft;
          gStore.dispatch({ type: "EVT/FINAL", payload: { text: ft } });
          try {
            track("webspeech:session-final", {
              lang: r.lang,
              sessionId: (r as any).__sessionId,
            });
          } catch {}
        }
      };
    };

    const onWantListeningChange = () => {
      const { wantListening, permission, muted } = gStore.getState();
      const SR = getSRCtor();
      if (!SR || disposedRef.current || muted || permission === "denied")
        return;

      if (wantListening) {
        if (recRef.current) return;
        const r = new SR();
        attach(r);
        recRef.current = r;
        try {
          r.start();
        } catch (e) {
          track("webspeech:start-error", { msg: String(e) });
          gStore.dispatch({ type: "EVT/ERROR", payload: { error: String(e) } });
          if (String(e).includes("not-allowed")) {
            gStore.dispatch({
              type: "INT/SET_PERMISSIONS",
              payload: { permission: "denied" },
            });
          }
          const stuck = recRef.current;
          recRef.current = null;
          if (stuck) {
            stopAndWait(stuck)
              .catch((err) => {
                try {
                  track("webspeech:stopAndWait-error", {
                    code: String((err as any)?.name || ""),
                    msg: String(err),
                    sessionId: (stuck as any).__sessionId || null,
                  });
                } catch {}
              })
              .finally(() => {
                const fresh = new SR();
                attach(fresh);
                recRef.current = fresh;
                try {
                  fresh.start();
                } catch (err) {
                  try {
                    track("webspeech:freshstart-error", { msg: String(err) });
                    gStore.dispatch({
                      type: "EVT/ERROR",
                      payload: { error: String(err) },
                    });
                  } catch {}
                }
              });
          }
        }
      } else {
        if (recRef.current) {
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
      }
    };

    return gStore.subscribeToKey("wantListening", onWantListeningChange);
  }, [gStore, engineStore]);

  const api = useMemo<WebSpeechEngine>(
    () => ({
      start() {
        gStore.dispatch({ type: "REQ/START" });
      },
      stop() {
        gStore.dispatch({ type: "REQ/STOP" });
      },
      dispose() {
        gStore.dispatch({ type: "REQ/STOP" });
        disposedRef.current = true;
        const current = recRef.current;
        recRef.current = null;
        engineStore.dispatch({ type: "INT/RESET" });
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
      getLocalState: engineStore.getState,
      getState: gStore.getState,
      subscribe: gStore.subscribe,
      subscribeToKey: gStore.subscribeToKey,
    }),
    [gStore]
  );

  return api;
}
