import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./mocks/environment.setup.js";
import {
  _clearSRInstances,
  _getSRInstances,
} from "./mocks/speechrecognition.mock.js";
import { createGlobalVoiceStore } from "../src/stores/global.store.js";
import {
  createFetchRemoteRecognitionClient,
  type LocalSpeechRecognitionClient,
  type RemoteSpeechRecognitionClient,
  useRemoteSpeechEngine,
} from "../src/engine/remoteSpeechRecognition.js";
import {
  isWebSpeechUnavailableError,
  useSpeechRecognitionEngine,
} from "../src/engine/useSpeechRecognitionEngine.js";

type MediaRecorderEventHandler = ((event: Event) => void) | null;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn((type: string) => type.includes("webm"));
  static deferStop = false;

  readonly mimeType: string;
  readonly stream: MediaStream;
  state: RecordingState = "inactive";
  stopCalls = 0;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: MediaRecorderEventHandler = null;
  onstart: MediaRecorderEventHandler = null;
  onstop: MediaRecorderEventHandler = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
    this.onstart?.(new Event("start"));
  }

  stop() {
    if (this.state === "inactive") return;
    this.stopCalls += 1;
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["captured audio"], { type: this.mimeType }),
    });
    if (FakeMediaRecorder.deferStop) {
      queueMicrotask(() => this.onstop?.(new Event("stop")));
    } else {
      this.onstop?.(new Event("stop"));
    }
  }
}

const setSpeechRecognitionCtor = (value: unknown) => {
  (globalThis as any).SpeechRecognition = value;
  (globalThis as any).webkitSpeechRecognition = value;
};

describe("remote speech recognition fallback", () => {
  let originalMediaRecorder: unknown;
  let originalSpeechRecognition: unknown;
  let originalWebkitSpeechRecognition: unknown;
  let originalNavigatorGpu: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalMediaRecorder = (globalThis as any).MediaRecorder;
    originalSpeechRecognition = (globalThis as any).SpeechRecognition;
    originalWebkitSpeechRecognition = (globalThis as any).webkitSpeechRecognition;
    originalNavigatorGpu = Object.getOwnPropertyDescriptor(
      globalThis.navigator,
      "gpu"
    );
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.deferStop = false;
    FakeMediaRecorder.isTypeSupported.mockClear();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    _clearSRInstances();
  });

  afterEach(() => {
    (globalThis as any).MediaRecorder = originalMediaRecorder;
    (globalThis as any).SpeechRecognition = originalSpeechRecognition;
    (globalThis as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    if (originalNavigatorGpu) {
      Object.defineProperty(globalThis.navigator, "gpu", originalNavigatorGpu);
    } else {
      delete (globalThis.navigator as any).gpu;
    }
  });

  it("identifies Web Speech unavailable errors without treating all errors as fallback-safe", () => {
    expect(isWebSpeechUnavailableError()).toBe(false);
    expect(isWebSpeechUnavailableError("network")).toBe(true);
    expect(isWebSpeechUnavailableError("language-not-supported")).toBe(true);
    expect(isWebSpeechUnavailableError("audio-capture")).toBe(true);
    expect(isWebSpeechUnavailableError("permission-denied")).toBe(false);
  });

  it("posts recorded audio through the fetch remote recognition client", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ transcript: "search for black shoes" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createFetchRemoteRecognitionClient({
      endpoint: "/api/voice/speech-to-text",
      fieldName: "audio",
      fetch: fetchMock as unknown as typeof fetch,
      metadata: {
        source: "search-panel",
      },
    });

    const result = await client({
      audio: new Blob(["voice"], { type: "audio/webm" }),
      lang: "en-GB",
      interim: false,
      continuous: false,
      sessionId: "session-1",
      mimeType: "audio/webm",
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ transcript: "search for black shoes" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/voice/speech-to-text",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit).toBeDefined();
    expect(requestInit?.method).toBe("POST");
    const form = requestInit?.body as FormData;
    const audio = form.get("audio");
    expect(audio).toBeInstanceOf(File);
    expect((audio as File).name).toBe("speech.webm");
    expect((audio as File).type).toBe("audio/webm");
    expect(form.get("lang")).toBe("en-GB");
    expect(form.get("interim")).toBe("false");
    expect(form.get("continuous")).toBe("false");
    expect(form.get("sessionId")).toBe("session-1");
    expect(form.get("mimeType")).toBe("audio/webm");
    expect(form.get("source")).toBe("search-panel");
  });

  it("uses remote recognition when Web Speech is unavailable", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async (request) => {
      expect(request.audio.size).toBeGreaterThan(0);
      expect(request.lang).toBe("en-GB");
      return { transcript: "open dashboard" };
    });

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());
    expect(store.getState().listening).toBe(true);
    expect(FakeMediaRecorder.instances).toHaveLength(1);

    await act(async () => result.current.stop());

    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    expect(store.getState().transcript).toBe("open dashboard");
    expect(store.getState().listening).toBe(false);
  });

  it("uses configured local recognition before remote recognition", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const localClient: LocalSpeechRecognitionClient = vi.fn(async (request) => {
      expect(request.audio.size).toBeGreaterThan(0);
      return { transcript: "local platform transcript" };
    });
    const remoteClient: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote transcript",
    }));

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        localRecognition: {
          enabled: true,
          executionTarget: "native",
          adapterName: "apple-speech",
          client: localClient,
        },
        remoteRecognition: { enabled: true, client: remoteClient },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    await act(async () => result.current.stop());

    await waitFor(() => expect(localClient).toHaveBeenCalledTimes(1));
    expect(remoteClient).not.toHaveBeenCalled();
    expect(store.getState().transcript).toBe("local platform transcript");
  });

  it("honors explicit local recognition mode before remote recognition", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const localClient: LocalSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "forced local transcript",
    }));
    const remoteClient: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote transcript",
    }));

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        mode: "local",
        globalStore: store,
        localRecognition: {
          enabled: true,
          client: localClient,
        },
        remoteRecognition: { enabled: true, client: remoteClient },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    await act(async () => result.current.stop());

    await waitFor(() => expect(localClient).toHaveBeenCalledTimes(1));
    expect(remoteClient).not.toHaveBeenCalled();
    expect(store.getState().transcript).toBe("forced local transcript");
  });

  it("honors explicit remote recognition mode while Web Speech is available", async () => {
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "forced remote transcript",
    }));

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        mode: "remote",
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    await act(async () => result.current.stop());

    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    expect(_getSRInstances()).toHaveLength(0);
    expect(store.getState().transcript).toBe("forced remote transcript");
  });

  it("honors explicit Web Speech mode before configured remote recognition", async () => {
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote transcript",
    }));

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        mode: "web-speech",
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());

    expect(_getSRInstances()).toHaveLength(1);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(client).not.toHaveBeenCalled();
  });

  it("skips WebGPU local recognition while rendering is using the GPU", async () => {
    setSpeechRecognitionCtor(undefined);
    Object.defineProperty(globalThis.navigator, "gpu", {
      configurable: true,
      value: {},
    });
    const store = createGlobalVoiceStore();
    const localClient: LocalSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "webgpu transcript",
    }));
    const remoteClient: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote transcript",
    }));

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        localRecognition: {
          enabled: true,
          executionTarget: "webgpu",
          client: localClient,
          gpuPolicy: {
            isRenderingActive: () => true,
          },
        },
        remoteRecognition: { enabled: true, client: remoteClient },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    await act(async () => result.current.stop());

    await waitFor(() => expect(remoteClient).toHaveBeenCalledTimes(1));
    expect(localClient).not.toHaveBeenCalled();
    expect(store.getState().transcript).toBe("remote transcript");
  });

  it("falls back to remote recognition after Web Speech service failure", async () => {
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote fallback transcript",
    }));

    const { result } = renderHook(() =>
      useSpeechRecognitionEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());

    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    await act(async () => {
      (sr as any).emitError({ error: "service-not-allowed" });
    });

    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    expect(store.getState().permission).not.toBe("denied");

    await act(async () => result.current.stop());

    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    expect(store.getState().transcript).toBe("remote fallback transcript");
  });

  it("falls back to remote recognition when Web Speech start throws a service error", async () => {
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote start fallback transcript",
    }));
    const SRc =
      (globalThis as any).SpeechRecognition ??
      (globalThis as any).webkitSpeechRecognition;
    const startSpy = vi.spyOn(SRc.prototype, "start").mockImplementationOnce(() => {
      const error = new Error("service-not-allowed");
      error.name = "service-not-allowed";
      throw error;
    });

    try {
      const { result } = renderHook(() =>
        useSpeechRecognitionEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: store,
          remoteRecognition: { enabled: true, client },
        })
      );

      await act(async () => result.current.start());

      await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
      expect(store.getState().permission).not.toBe("denied");

      await act(async () => result.current.stop());

      await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
      expect(store.getState().transcript).toBe("remote start fallback transcript");
    } finally {
      startSpy.mockRestore();
    }
  });

  it("keeps equivalent inline remote config rerenders from restarting active recording", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "same session",
    }));

    const { result, rerender } = renderHook(({ revision }) => {
      void revision;
      return useRemoteSpeechEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        remoteRecognition: { enabled: true, client, chunkMs: 4000 },
      });
    }, { initialProps: { revision: 1 } });

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    const [firstRecorder] = FakeMediaRecorder.instances;

    rerender({ revision: 2 });
    await act(async () => {});

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(firstRecorder?.state).toBe("recording");
    expect(firstRecorder?.stopCalls).toBe(0);
  });

  it("restarts remote recording after an async device-change stop completes", async () => {
    setSpeechRecognitionCtor(undefined);
    FakeMediaRecorder.deferStop = true;
    const store = createGlobalVoiceStore({ deviceId: "mic-1" });
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "device session",
    }));

    const { result } = renderHook(() =>
      useRemoteSpeechEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    const [firstRecorder] = FakeMediaRecorder.instances;

    await act(async () => {
      store.dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: "mic-2" },
      });
    });

    expect(firstRecorder?.stopCalls).toBe(1);
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(2));
    expect(FakeMediaRecorder.instances[1]?.state).toBe("recording");
  });

  it("ignores aborted remote submit failures during normal stop handling", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const abortError = Object.assign(new Error("The operation was aborted."), {
      name: "AbortError",
    });
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => {
      throw abortError;
    });

    const { result } = renderHook(() =>
      useRemoteSpeechEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    await act(async () => result.current.stop());

    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    expect(store.getState().lastError).toBeUndefined();
  });

  it("disposes active remote recording without submitting buffered audio", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const client: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "should not submit",
    }));

    const { result } = renderHook(() =>
      useRemoteSpeechEngine({
        lang: "en-GB",
        interim: false,
        continuous: false,
        globalStore: store,
        remoteRecognition: { enabled: true, client },
      })
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    const [recorder] = FakeMediaRecorder.instances;

    await act(async () => result.current.dispose());
    await act(async () => {});

    expect(recorder?.stopCalls).toBe(1);
    expect(client).not.toHaveBeenCalled();

    result.current.reset();
    expect(result.current.getLocalState()).toEqual({
      sessionId: null,
      startedAt: undefined,
      endedAt: undefined,
      lastError: undefined,
    });
  });

  it("retries a failed local tier when the local recognizer config key changes", async () => {
    setSpeechRecognitionCtor(undefined);
    const store = createGlobalVoiceStore();
    const failingLocalClient: LocalSpeechRecognitionClient = vi.fn(async () => {
      throw new Error("local recognizer unavailable");
    });
    const repairedLocalClient: LocalSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "local repaired transcript",
    }));
    const remoteClient: RemoteSpeechRecognitionClient = vi.fn(async () => ({
      transcript: "remote transcript",
    }));

    const { result, rerender } = renderHook(
      ({ adapterName, localClient }) =>
        useSpeechRecognitionEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: store,
          localRecognition: {
            enabled: true,
            adapterName,
            client: localClient,
          },
          remoteRecognition: { enabled: true, client: remoteClient },
        }),
      {
        initialProps: {
          adapterName: "native-v1",
          localClient: failingLocalClient,
        },
      }
    );

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    await act(async () => result.current.stop());
    await waitFor(() =>
      expect(store.getState().lastError).toContain("local recognizer unavailable")
    );

    rerender({
      adapterName: "native-v2",
      localClient: repairedLocalClient,
    });
    await act(async () => {});

    await act(async () => result.current.start());
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(2));
    await act(async () => result.current.stop());

    await waitFor(() => expect(repairedLocalClient).toHaveBeenCalledTimes(1));
    expect(remoteClient).not.toHaveBeenCalled();
    expect(store.getState().transcript).toContain("local repaired transcript");
  });
});
