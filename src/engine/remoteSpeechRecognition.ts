import { useEffect, useMemo, useRef } from "react";
import { track } from "@plasius/nfr";
import {
  globalVoiceStore as defaultGlobalVoiceStore,
  type GlobalVoiceState,
  type GlobalVoiceStore,
} from "../stores/global.store.js";
import type { EngineState, WebSpeechEngine } from "./useWebSpeechEngine.js";

export type RemoteSpeechRecognitionRequest = {
  audio: Blob;
  lang: string;
  interim: boolean;
  continuous: boolean;
  sessionId: string;
  mimeType?: string;
  deviceId?: string | null;
  signal: AbortSignal;
};

export type RemoteSpeechRecognitionResult =
  | string
  | {
      transcript?: string;
      text?: string;
      partial?: string;
      confidence?: number;
      language?: string;
      isFinal?: boolean;
    };

export type RemoteSpeechRecognitionClient = (
  request: RemoteSpeechRecognitionRequest
) => Promise<RemoteSpeechRecognitionResult>;

export type LocalSpeechRecognitionRequest = RemoteSpeechRecognitionRequest;
export type LocalSpeechRecognitionResult = RemoteSpeechRecognitionResult;
export type LocalSpeechRecognitionClient = (
  request: LocalSpeechRecognitionRequest
) => Promise<LocalSpeechRecognitionResult>;

type RemoteRequestContext = Omit<RemoteSpeechRecognitionRequest, "audio" | "signal">;

export type FetchRemoteRecognitionHeaders =
  | HeadersInit
  | ((
      request: RemoteRequestContext
    ) => HeadersInit | Promise<HeadersInit>);

export type FetchRemoteRecognitionClientOptions = {
  endpoint: string | URL;
  fetch?: typeof fetch;
  method?: string;
  fieldName?: string;
  filename?: string;
  credentials?: RequestCredentials;
  headers?: FetchRemoteRecognitionHeaders;
  metadata?: Record<string, string | number | boolean>;
  parseResponse?: (
    response: Response
  ) => Promise<RemoteSpeechRecognitionResult>;
};

export type RemoteSpeechRecognitionConfig = {
  /**
   * Runtime rollout switch. Wire this to the host application's remote feature
   * flag or capability decision. Defaults to true when a client or endpoint is provided.
   */
  enabled?: boolean;
  client?: RemoteSpeechRecognitionClient;
  endpoint?: string | URL;
  fetch?: typeof fetch;
  method?: string;
  fieldName?: string;
  filename?: string;
  credentials?: RequestCredentials;
  headers?: FetchRemoteRecognitionHeaders;
  metadata?: Record<string, string | number | boolean>;
  parseResponse?: (
    response: Response
  ) => Promise<RemoteSpeechRecognitionResult>;
  chunkMs?: number;
  maxRecordingMs?: number;
  mimeTypes?: readonly string[];
  mediaStreamConstraints?:
    | MediaStreamConstraints
    | ((state: GlobalVoiceState) => MediaStreamConstraints);
  recorderOptions?: MediaRecorderOptions;
};

export type LocalSpeechRecognitionExecutionTarget =
  | "native"
  | "webgpu"
  | "webnn"
  | "wasm"
  | "cpu"
  | "custom";

export type LocalSpeechRecognitionGpuPolicy = {
  /**
   * Defaults to false for WebGPU recognizers. Keep false when the host app is
   * actively rendering with WebGPU/WebGL and recognition can wait for a lighter path.
   */
  allowDuringRendering?: boolean;
  /**
   * Host-provided load signal. Return true while local rendering is using the GPU.
   */
  isRenderingActive?: () => boolean;
  /**
   * Upper bound for a single recording submitted to a local WebGPU recognizer.
   * Defaults to 4000ms for WebGPU recognizers to keep command recognition short.
   */
  maxRecordingMs?: number;
};

export type LocalSpeechRecognitionConfig = Omit<
  RemoteSpeechRecognitionConfig,
  "endpoint" | "fetch" | "method" | "fieldName" | "filename" | "credentials" | "headers" | "metadata" | "parseResponse"
> & {
  client?: LocalSpeechRecognitionClient;
  /**
   * Describes where the recognizer runs. Native is for Apple Speech, Android
   * SpeechRecognizer, Windows SpeechRecognizer, or app-shell bridges.
   */
  executionTarget?: LocalSpeechRecognitionExecutionTarget;
  adapterName?: string;
  isAvailable?: () => boolean;
  gpuPolicy?: LocalSpeechRecognitionGpuPolicy;
};

export type RemoteSpeechEngineOptions = {
  lang: string;
  interim: boolean;
  continuous: boolean;
  enabled?: boolean;
  remoteRecognition?: RemoteSpeechRecognitionConfig;
  globalStore?: GlobalVoiceStore;
};

export type LocalSpeechEngineOptions = {
  lang: string;
  interim: boolean;
  continuous: boolean;
  enabled?: boolean;
  localRecognition?: LocalSpeechRecognitionConfig;
  globalStore?: GlobalVoiceStore;
};

type RecorderCtor = typeof MediaRecorder;
type StopRemoteOptions = {
  submit?: boolean;
  restart?: boolean;
  emitEndWhenIdle?: boolean;
};

const DEFAULT_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

const now = () => (globalThis.performance as any)?.now?.() ?? Date.now();

const generateSecureRandomBytes = (length = 16) => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random generator is unavailable.");
  }
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
};

const newSessionId = () =>
  globalThis.crypto?.randomUUID?.() ??
  Array.from(generateSecureRandomBytes())
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const stableConfigValue = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof URL) return `url:${value.href}`;
  if (typeof Headers !== "undefined" && value instanceof Headers) {
    return stableConfigValue(Object.fromEntries([...value.entries()].sort()));
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableConfigValue(item)).join(",")}]`;
  }
  if (typeof value === "function") return "[function]";
  if (typeof value !== "object") return JSON.stringify(value);

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}:${stableConfigValue(item)}`)
    .join(",")}}`;
};

const sharedRecognitionConfigKey = (
  config?: RemoteSpeechRecognitionConfig | LocalSpeechRecognitionConfig
) =>
  stableConfigValue({
    enabled: config?.enabled !== false,
    chunkMs: config?.chunkMs,
    maxRecordingMs: config?.maxRecordingMs,
    mediaStreamConstraints: config?.mediaStreamConstraints,
    mimeTypes: config?.mimeTypes,
    recorderOptions: config?.recorderOptions,
  });

export const getRemoteSpeechRecognitionConfigKey = (
  config?: RemoteSpeechRecognitionConfig
) =>
  stableConfigValue({
    shared: sharedRecognitionConfigKey(config),
    configured: isRemoteSpeechRecognitionConfigured(config),
    endpoint: config?.endpoint ? String(config.endpoint) : undefined,
    method: config?.method,
    fieldName: config?.fieldName,
    filename: config?.filename,
    credentials: config?.credentials,
    headers: config?.headers,
    metadata: config?.metadata,
    parseResponse: config?.parseResponse,
    hasClient: !!config?.client,
    hasFetch: !!config?.fetch,
  });

export const getLocalSpeechRecognitionConfigKey = (
  config?: LocalSpeechRecognitionConfig
) =>
  stableConfigValue({
    shared: sharedRecognitionConfigKey(config),
    configured: isLocalSpeechRecognitionConfigured(config),
    hasClient: !!config?.client,
    executionTarget: config?.executionTarget,
    adapterName: config?.adapterName,
    available: (() => {
      try {
        return config?.isAvailable?.();
      } catch {
        return false;
      }
    })(),
    gpuPolicy: {
      allowDuringRendering: config?.gpuPolicy?.allowDuringRendering,
      renderingActive: (() => {
        try {
          return config?.gpuPolicy?.isRenderingActive?.();
        } catch {
          return true;
        }
      })(),
      maxRecordingMs: config?.gpuPolicy?.maxRecordingMs,
    },
  });

const isAbortError = (error: unknown) => {
  const name = String(
    (error as { name?: string } | null | undefined)?.name ?? ""
  ).toLowerCase();
  const code = String(
    (error as { code?: string | number } | null | undefined)?.code ?? ""
  ).toLowerCase();
  const message = String(
    (error as { message?: string } | null | undefined)?.message ?? ""
  ).toLowerCase();
  return (
    name === "aborterror" ||
    (name === "domexception" && code === "20") ||
    message.includes("aborted")
  );
};

const emit = (name: string, props?: Record<string, unknown>) => {
  try {
    track(name, props as any);
  } catch {}
};

export function isRemoteSpeechRecognitionConfigured(
  config?: RemoteSpeechRecognitionConfig
): boolean {
  return !!config && config.enabled !== false && !!(config.client || config.endpoint);
}

export function isLocalSpeechRecognitionConfigured(
  config?: LocalSpeechRecognitionConfig
): boolean {
  if (!config || config.enabled === false || !config.client) return false;
  try {
    if (config.isAvailable && !config.isAvailable()) return false;
  } catch {
    return false;
  }
  if (
    config.executionTarget === "webgpu" &&
    !(globalThis as any).navigator?.gpu
  ) {
    return false;
  }
  if (
    config.executionTarget === "webgpu" &&
    config.gpuPolicy?.allowDuringRendering !== true &&
    (() => {
      try {
        return config.gpuPolicy?.isRenderingActive?.();
      } catch {
        return true;
      }
    })()
  ) {
    return false;
  }
  return true;
}

export function normalizeRemoteSpeechRecognitionResult(
  result: RemoteSpeechRecognitionResult
): { final?: string; partial?: string } {
  if (typeof result === "string") {
    const final = result.replace(/\s+/g, " ").trim();
    return final ? { final } : {};
  }

  const final = (result.transcript ?? result.text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const partial = (result.partial ?? "").replace(/\s+/g, " ").trim();

  return {
    ...(final ? { final } : {}),
    ...(partial ? { partial } : {}),
  };
}

async function defaultParseResponse(
  response: Response
): Promise<RemoteSpeechRecognitionResult> {
  if (!response.ok) {
    throw new Error(`Remote speech recognition failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as RemoteSpeechRecognitionResult;
  }

  return { transcript: await response.text() };
}

export function createFetchRemoteRecognitionClient(
  options: FetchRemoteRecognitionClientOptions
): RemoteSpeechRecognitionClient {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Remote speech recognition requires a fetch implementation.");
  }

  return async (request) => {
    const form = new FormData();
    const fieldName = options.fieldName ?? "audio";
    const filename = options.filename ?? "speech.webm";
    form.append(fieldName, request.audio, filename);
    form.append("lang", request.lang);
    form.append("interim", String(request.interim));
    form.append("continuous", String(request.continuous));
    form.append("sessionId", request.sessionId);
    if (request.mimeType) form.append("mimeType", request.mimeType);
    if (request.deviceId) form.append("deviceId", request.deviceId);

    for (const [key, value] of Object.entries(options.metadata ?? {})) {
      form.append(key, String(value));
    }

    const context: RemoteRequestContext = {
      lang: request.lang,
      interim: request.interim,
      continuous: request.continuous,
      sessionId: request.sessionId,
      mimeType: request.mimeType,
      deviceId: request.deviceId,
    };
    const headers =
      typeof options.headers === "function"
        ? await options.headers(context)
        : options.headers;

    const response = await fetchImpl(options.endpoint, {
      method: options.method ?? "POST",
      body: form,
      credentials: options.credentials,
      headers,
      signal: request.signal,
    });

    return (options.parseResponse ?? defaultParseResponse)(response);
  };
}

function resolveRemoteClient(
  config?: RemoteSpeechRecognitionConfig
): RemoteSpeechRecognitionClient | null {
  if (!isRemoteSpeechRecognitionConfigured(config)) return null;
  if (config?.client) return config.client;
  if (!config?.endpoint) return null;
  return createFetchRemoteRecognitionClient({
    endpoint: config.endpoint,
    fetch: config.fetch,
    method: config.method,
    fieldName: config.fieldName,
    filename: config.filename,
    credentials: config.credentials,
    headers: config.headers,
    metadata: config.metadata,
    parseResponse: config.parseResponse,
  });
}

function selectMimeType(config?: RemoteSpeechRecognitionConfig): string | undefined {
  const MR = (globalThis as any).MediaRecorder as RecorderCtor | undefined;
  if (typeof MR !== "function") return undefined;

  for (const candidate of config?.mimeTypes ?? DEFAULT_MIME_TYPES) {
    if (typeof MR.isTypeSupported !== "function" || MR.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveConstraints(
  state: GlobalVoiceState,
  config?: RemoteSpeechRecognitionConfig
): MediaStreamConstraints {
  if (typeof config?.mediaStreamConstraints === "function") {
    return config.mediaStreamConstraints(state);
  }

  if (config?.mediaStreamConstraints) {
    return config.mediaStreamConstraints;
  }

  return {
    audio: state.deviceId ? { deviceId: { exact: state.deviceId } } : true,
  };
}

function getMaxRecordingMs(config?: RemoteSpeechRecognitionConfig): number | undefined {
  return config?.maxRecordingMs;
}

function getLocalMaxRecordingMs(
  config?: LocalSpeechRecognitionConfig
): number | undefined {
  if (typeof config?.maxRecordingMs === "number") return config.maxRecordingMs;
  if (typeof config?.gpuPolicy?.maxRecordingMs === "number") {
    return config.gpuPolicy.maxRecordingMs;
  }
  return config?.executionTarget === "webgpu" ? 4000 : undefined;
}

function useRecordedSpeechEngine(
  opts: RemoteSpeechEngineOptions & {
    recognition?: RemoteSpeechRecognitionConfig;
    client: RemoteSpeechRecognitionClient | null;
    telemetryPrefix: string;
    notConfiguredMessage: string;
    unsupportedMessage: string;
    defaultMaxRecordingMs?: number;
  }
): WebSpeechEngine {
  const store = opts.globalStore ?? defaultGlobalVoiceStore;
  const enabled = opts.enabled ?? !!opts.client;
  const client = opts.client;
  const recognition = opts.recognition;
  const disposedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const clientRef = useRef(client);
  const recognitionRef = useRef(recognition);
  const defaultMaxRecordingMsRef = useRef(opts.defaultMaxRecordingMs);
  const stopRemoteRef = useRef<((options?: StopRemoteOptions) => void) | null>(
    null
  );
  const cleanupsRef = useRef<(() => void)[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const startRequestRef = useRef(0);
  const suppressedSubmitSessionsRef = useRef(new Set<string>());
  const restartAfterStopRef = useRef(false);
  const localStateRef = useRef<EngineState>({
    sessionId: null,
    startedAt: undefined,
    endedAt: undefined,
    lastError: undefined,
  });

  const updateLocal = (patch: Partial<EngineState>) => {
    localStateRef.current = { ...localStateRef.current, ...patch };
  };

  enabledRef.current = enabled;
  clientRef.current = client;
  recognitionRef.current = recognition;
  defaultMaxRecordingMsRef.current = opts.defaultMaxRecordingMs;

  useEffect(() => {
    if (!enabled) return;
    store.dispatch({
      type: "INT/SET_CONFIG",
      payload: {
        lang: opts.lang,
        interim: !!opts.interim,
        continuous: !!opts.continuous,
      },
    });
  }, [enabled, opts.continuous, opts.interim, opts.lang, store]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;

    const mediaDevices = (globalThis as any)?.navigator?.mediaDevices;
    const MR = (globalThis as any).MediaRecorder as RecorderCtor | undefined;
    if (!mediaDevices?.getUserMedia || typeof MR !== "function") {
      store.dispatch({
        type: "INT/SET_PERMISSIONS",
        payload: { permission: "unsupported" },
      });
      return;
    }

    if ((globalThis as any)?.navigator?.permissions?.query) {
      (navigator as any).permissions
        .query({ name: "microphone" as any })
        .then((p: any) => {
          store.dispatch({
            type: "INT/SET_PERMISSIONS",
            payload: { permission: p.state as any },
          });
        })
        .catch(() => {});
    } else {
      store.dispatch({
        type: "INT/SET_PERMISSIONS",
        payload: { permission: "prompt" },
      });
    }
  }, [enabled, store]);

  useEffect(() => {
    if (!enabled) return;
    const localCleanups: (() => void)[] = [];
    cleanupsRef.current = localCleanups;

    const clearChunkTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const stopTracks = () => {
      for (const track of streamRef.current?.getTracks() ?? []) {
        try {
          track.stop();
        } catch {}
      }
      streamRef.current = null;
    };

    const fail = (error: unknown) => {
      if (disposedRef.current || !enabledRef.current) return;
      const message = String((error as any)?.message ?? error);
      updateLocal({ lastError: message, endedAt: now() });
      store.dispatch({ type: "EVT/ERROR", payload: { error: message } });
      emit(`${opts.telemetryPrefix}:session-error`, {
        sessionId: activeSessionRef.current,
        error: message,
      });
      stopTracks();
    };

    const submit = async (
      sessionId: string,
      chunks: Blob[],
      mimeType?: string,
      deviceId?: string | null
    ) => {
      const activeClient = clientRef.current;
      if (!activeClient) {
        throw new Error(opts.notConfiguredMessage);
      }
      if (!chunks.length) return;

      const audio = new Blob(chunks, { type: mimeType || chunks[0]?.type });
      const abort = new AbortController();
      abortRef.current = abort;
      const result = await activeClient({
        audio,
        lang: store.getState().lang,
        interim: store.getState().interim,
        continuous: store.getState().continuous,
        sessionId,
        mimeType: audio.type || mimeType,
        deviceId,
        signal: abort.signal,
      }).finally(() => {
        if (abortRef.current === abort) abortRef.current = null;
      });
      if (abort.signal.aborted || disposedRef.current || !enabledRef.current) {
        return;
      }

      const normalized = normalizeRemoteSpeechRecognitionResult(result);
      if (normalized.partial) {
        store.dispatch({
          type: "EVT/PARTIAL",
          payload: { text: normalized.partial },
        });
        emit(`${opts.telemetryPrefix}:session-partial`, { sessionId });
      }
      if (normalized.final) {
        store.dispatch({ type: "EVT/FINAL", payload: { text: normalized.final } });
        emit(`${opts.telemetryPrefix}:session-final`, { sessionId });
      }
    };

    const isPermissionDeniedError = (error: unknown) => {
      const name = String(
        (error as { name?: string } | null | undefined)?.name ?? ""
      ).toLowerCase();
      const message = String(
        (error as { message?: string } | null | undefined)?.message ?? error
      ).toLowerCase();
      return (
        name === "notallowederror" ||
        name === "permissiondeniederror" ||
        message.includes("notallowed") ||
        message.includes("permission denied")
      );
    };

    const startRemote = async () => {
      const state = store.getState();
      const startRequest = ++startRequestRef.current;
      if (
        disposedRef.current ||
        !enabledRef.current ||
        recorderRef.current ||
        state.muted ||
        state.permission === "denied"
      ) {
        return;
      }
      if (!clientRef.current) {
        fail(opts.notConfiguredMessage);
        return;
      }

      const MR = (globalThis as any).MediaRecorder as RecorderCtor | undefined;
      const mediaDevices = (globalThis as any)?.navigator?.mediaDevices;
      if (!mediaDevices?.getUserMedia || typeof MR !== "function") {
        fail(opts.unsupportedMessage);
        store.dispatch({
          type: "INT/SET_PERMISSIONS",
          payload: { permission: "unsupported" },
        });
        return;
      }

      const sessionId = newSessionId();
      const requestedDeviceId = state.deviceId ?? null;
      chunksRef.current = [];
      const currentRecognition = recognitionRef.current;

      try {
        const stream = await mediaDevices.getUserMedia(
          resolveConstraints(state, currentRecognition)
        );
        const currentState = store.getState();
        if (
          startRequestRef.current !== startRequest ||
          disposedRef.current ||
          !enabledRef.current ||
          !currentState.wantListening ||
          currentState.deviceId !== requestedDeviceId
        ) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        activeSessionRef.current = sessionId;
        streamRef.current = stream;
        const mimeType = selectMimeType(currentRecognition);
        const recorderOptions = {
          ...currentRecognition?.recorderOptions,
          ...(mimeType ? { mimeType } : {}),
        };
        const recorder = new MR(stream, recorderOptions);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event: any) => {
          if (event?.data?.size) chunksRef.current.push(event.data);
        };
        recorder.onerror = (event: any) => fail(event?.error ?? event);
        recorder.onstart = () => {
          updateLocal({
            sessionId,
            startedAt: now(),
            endedAt: undefined,
            lastError: undefined,
          });
          store.dispatch({ type: "EVT/START" });
          emit(`${opts.telemetryPrefix}:session-start`, {
            sessionId,
            lang: store.getState().lang,
          });
        };
        recorder.onstop = () => {
          if (activeSessionRef.current !== sessionId) {
            return;
          }

          clearChunkTimer();
          const chunks = chunksRef.current.splice(0);
          const currentMimeType = recorder.mimeType || mimeType;
          const currentDeviceId = requestedDeviceId;
          recorderRef.current = null;
          activeSessionRef.current = null;
          stopTracks();
          updateLocal({ endedAt: now() });
          store.dispatch({ type: "EVT/END" });
          emit(`${opts.telemetryPrefix}:session-end`, { sessionId });

          const shouldSubmit = !suppressedSubmitSessionsRef.current.delete(
            sessionId
          );
          const restartAfterStop = restartAfterStopRef.current;
          restartAfterStopRef.current = false;

          if (
            restartAfterStop &&
            !disposedRef.current &&
            enabledRef.current &&
            store.getState().wantListening &&
            !store.getState().muted
          ) {
            void startRemote();
          }

          const submitPromise = shouldSubmit
            ? submit(sessionId, chunks, currentMimeType, currentDeviceId).catch(
                (error) => {
                  if (isAbortError(error)) return;
                  fail(error);
                }
              )
            : Promise.resolve();

          void submitPromise
            .finally(() => {
              if (
                !recorderRef.current &&
                !disposedRef.current &&
                enabledRef.current &&
                store.getState().continuous &&
                store.getState().wantListening
              ) {
                void startRemote();
              }
            });
        };

        recorder.start();
        const currentMaxRecordingMs =
          defaultMaxRecordingMsRef.current ??
          getMaxRecordingMs(currentRecognition);
        if (store.getState().continuous || currentMaxRecordingMs) {
          const chunkMs = Math.max(
            1000,
            currentMaxRecordingMs ?? currentRecognition?.chunkMs ?? 10_000
          );
          timerRef.current = setTimeout(() => {
            if (recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
            }
          }, chunkMs);
        }
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          store.dispatch({
            type: "INT/SET_PERMISSIONS",
            payload: { permission: "denied" },
          });
        }
        fail(error);
      }
    };

    const stopRemote = (options: StopRemoteOptions = {}) => {
      const activeSessionId = activeSessionRef.current;
      if (activeSessionId && options.submit === false) {
        suppressedSubmitSessionsRef.current.add(activeSessionId);
      }
      if (options.restart) restartAfterStopRef.current = true;
      startRequestRef.current += 1;
      clearChunkTimer();
      abortRef.current?.abort();
      abortRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
        return;
      }
      recorderRef.current = null;
      activeSessionRef.current = null;
      stopTracks();
      if (store.getState().listening || options.emitEndWhenIdle) {
        store.dispatch({ type: "EVT/END" });
      }
      if (
        options.restart &&
        !disposedRef.current &&
        enabledRef.current &&
        store.getState().wantListening &&
        !store.getState().muted
      ) {
        void startRemote();
      }
    };
    stopRemoteRef.current = stopRemote;

    const syncWantedState = () => {
      const state = store.getState();
      if (disposedRef.current || !enabledRef.current) return;
      if (state.wantListening && !state.muted) {
        void startRemote();
      } else {
        stopRemote();
      }
    };

    const unsubWant = store.subscribeToKey("wantListening", syncWantedState);
    localCleanups.push(unsubWant);
    const unsubMuted = store.subscribeToKey("muted", syncWantedState);
    localCleanups.push(unsubMuted);
    const unsubDevice = store.subscribeToKey("deviceId", () => {
      if (store.getState().wantListening) {
        stopRemote({ restart: true });
      }
    });
    localCleanups.push(unsubDevice);

    syncWantedState();

    return () => {
      for (const cleanup of localCleanups.splice(0)) {
        try {
          cleanup();
        } catch {}
      }
      stopRemote({ submit: false });
    };
  }, [
    enabled,
    opts.notConfiguredMessage,
    opts.telemetryPrefix,
    opts.unsupportedMessage,
    store,
  ]);

  return useMemo<WebSpeechEngine>(
    () => ({
      start() {
        store.dispatch({ type: "REQ/START" });
      },
      stop() {
        store.dispatch({ type: "REQ/STOP" });
      },
      dispose() {
        stopRemoteRef.current?.({ submit: false });
        disposedRef.current = true;
        store.dispatch({ type: "REQ/STOP" });
        abortRef.current?.abort();
        abortRef.current = null;
        for (const cleanup of cleanupsRef.current.splice(0)) {
          try {
            cleanup();
          } catch {}
        }
      },
      reset() {
        disposedRef.current = false;
        localStateRef.current = {
          sessionId: null,
          startedAt: undefined,
          endedAt: undefined,
          lastError: undefined,
        };
      },
      getLocalState() {
        return localStateRef.current;
      },
      getState: store.getState,
      subscribe: store.subscribe,
      subscribeToKey: store.subscribeToKey,
    }),
    [store]
  );
}

export function useRemoteSpeechEngine(
  opts: RemoteSpeechEngineOptions
): WebSpeechEngine {
  const client = useMemo(
    () => resolveRemoteClient(opts.remoteRecognition),
    [opts.remoteRecognition]
  );

  return useRecordedSpeechEngine({
    ...opts,
    enabled: opts.enabled ?? isRemoteSpeechRecognitionConfigured(opts.remoteRecognition),
    recognition: opts.remoteRecognition,
    client,
    telemetryPrefix: "remote-speech",
    notConfiguredMessage: "Remote speech recognition client is not configured.",
    unsupportedMessage:
      "Remote speech recognition requires getUserMedia and MediaRecorder.",
    defaultMaxRecordingMs: getMaxRecordingMs(opts.remoteRecognition),
  });
}

export function useLocalSpeechEngine(
  opts: LocalSpeechEngineOptions
): WebSpeechEngine {
  const configured = isLocalSpeechRecognitionConfigured(opts.localRecognition);

  return useRecordedSpeechEngine({
    ...opts,
    enabled: opts.enabled ?? configured,
    recognition: opts.localRecognition,
    client: configured ? (opts.localRecognition?.client ?? null) : null,
    telemetryPrefix: "local-speech",
    notConfiguredMessage: "Local speech recognition client is not configured.",
    unsupportedMessage:
      "Local speech recognition requires getUserMedia and MediaRecorder.",
    defaultMaxRecordingMs: getLocalMaxRecordingMs(opts.localRecognition),
  });
}
