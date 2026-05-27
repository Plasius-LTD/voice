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
} from "../src/engine/remoteSpeechRecognition.js";
import {
  isWebSpeechUnavailableError,
  useSpeechRecognitionEngine,
} from "../src/engine/useSpeechRecognitionEngine.js";

type MediaRecorderEventHandler = ((event: Event) => void) | null;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn((type: string) => type.includes("webm"));

  readonly mimeType: string;
  readonly stream: MediaStream;
  state: RecordingState = "inactive";
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
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["captured audio"], { type: this.mimeType }),
    });
    this.onstop?.(new Event("stop"));
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
      fetch: fetchMock as unknown as typeof fetch,
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
});
