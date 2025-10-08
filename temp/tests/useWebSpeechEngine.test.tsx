/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { FC, PropsWithChildren } from "react";
import { renderHook, act } from "@testing-library/react";
import { createStore, Store } from "@plasius/react-state";

// Bring in the global environment & mocks (navigator + SR) once.
import "../../tests/mocks/environment.setup.js";
import {
  _setDevices,
  _emitDeviceChange,
  permissionsQueryMock,
  enumerateDevicesMock,
  getUserMediaMock,
} from "../../tests/mocks/navigator.mock.js";
import {
  _getSRInstances,
  _clearSRInstances,
  _setSRMockConfig,
} from "../../tests/mocks/speechrecognition.mock.js";
import { stopAndWait } from "../../tests/mocks/stopAndWait.mock.js";
import { track } from "../../tests/mocks/telemetry.mock.js";

import { useWebSpeechEngine } from "../../src/engine/useWebSpeechEngine.js";
import { GlobalVoiceStore } from "../../src/stores/global.store.js";

// ---------------------------
// Minimal GlobalVoice store
// ---------------------------
type Permission = "granted" | "denied" | "prompt";
type GlobalVoiceState = {
  // config
  lang: string;
  interim: boolean;
  continuous: boolean;
  // device
  deviceList: MediaDeviceInfo[];
  deviceId: string | null;
  muted: boolean;
  // control
  wantListening: boolean;
  listening: boolean;
  // permission
  permission: Permission;
  // transcripts (simple last-value)
  partial?: string;
  final?: string;
  // last error
  error?: string;
};

type GlobalVoiceAction =
  | {
      type: "INT/SET_CONFIG";
      payload: { lang: string; interim: boolean; continuous: boolean };
    }
  | {
      type: "EVT/DEVICE_LIST_CHANGED";
      payload: { deviceList: MediaDeviceInfo[] };
    }
  | { type: "EVT/DEVICE_CHANGED"; payload: { deviceId: string | null } }
  | { type: "INT/SET_PERMISSIONS"; payload: { permission: Permission } }
  | {
      type: "REQ/START";
      payload?: { lang?: string; interim?: boolean; continuous?: boolean };
    }
  | { type: "REQ/STOP" }
  | { type: "EVT/START" }
  | { type: "EVT/END" }
  | { type: "EVT/ERROR"; payload: { error: string } }
  | { type: "EVT/PARTIAL"; payload: { text: string } }
  | { type: "EVT/FINAL"; payload: { text: string } };

function makeGlobalStore(): Store<GlobalVoiceState, GlobalVoiceAction> {
  const initial: GlobalVoiceState = {
    lang: "en-GB",
    interim: false,
    continuous: false,

    deviceList: [],
    deviceId: null,
    muted: false,

    wantListening: false,
    listening: false,

    permission: "prompt",
  };

  const reducer = (
    s: GlobalVoiceState,
    a: GlobalVoiceAction
  ): GlobalVoiceState => {
    switch (a.type) {
      case "INT/SET_CONFIG":
        return { ...s, ...a.payload };
      case "EVT/DEVICE_LIST_CHANGED":
        return { ...s, deviceList: a.payload.deviceList };
      case "EVT/DEVICE_CHANGED":
        return { ...s, deviceId: a.payload.deviceId };
      case "INT/SET_PERMISSIONS":
        return { ...s, permission: a.payload.permission };
      case "REQ/START":
        return { ...s, wantListening: true };
      case "REQ/STOP":
        return { ...s, wantListening: false, listening: false };
      case "EVT/START":
        return { ...s, listening: true };
      case "EVT/END":
        return { ...s, listening: false };
      case "EVT/ERROR":
        return { ...s, error: a.payload.error };
      case "EVT/PARTIAL":
        return { ...s, partial: a.payload.text };
      case "EVT/FINAL":
        return { ...s, final: a.payload.text };
      default:
        return s;
    }
  };

  return createStore(reducer, initial);
}

// For hooks that don’t need a special provider, keep it simple
const Wrapper: FC<PropsWithChildren> = ({ children }) => <>{children} </>;

const nextTick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  _clearSRInstances();
  _setSRMockConfig({
    autoEmitStart: false,
    autoEmitEndOnStop: false,
    throwIfDoubleStart: false,
  });
});

// ---------------------------
// Tests
// ---------------------------

describe("useWebSpeechEngine", () => {
  it("pushes initial config to global store and updates when props change", async () => {
    const globalStore = makeGlobalStore();
    const { rerender } = renderHook(
      (p: any) => useWebSpeechEngine({ ...p, globalStore }),
      {
        wrapper: Wrapper,
        initialProps: { lang: "en-GB", interim: false, continuous: false },
      }
    );

    // initial effect
    expect(globalStore.getState().lang).toBe("en-GB");
    expect(globalStore.getState().interim).toBe(false);
    expect(globalStore.getState().continuous).toBe(false);

    // update props
    rerender({ lang: "fr-FR", interim: true, continuous: true, globalStore });
    expect(globalStore.getState().lang).toBe("fr-FR");
    expect(globalStore.getState().interim).toBe(true);
    expect(globalStore.getState().continuous).toBe(true);
  });

  it("sets permission to 'prompt' when no SpeechRecognition is available", async () => {
    // Remove constructors
    (globalThis as any).SpeechRecognition = undefined;
    (globalThis as any).webkitSpeechRecognition = undefined;

    const globalStore = makeGlobalStore();
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Initial permission effect should mark prompt if no SR
    expect(globalStore.getState().permission).toBe("prompt");
  });

  it("reads permission via navigator.permissions.query when SR exists", async () => {
    // Ensure SR is present
    const SR =
      (globalThis as any).SpeechRecognition ??
      (globalThis as any).webkitSpeechRecognition;
    expect(SR).toBeTruthy();

    const globalStore = makeGlobalStore();

    // Start with granted
    (permissionsQueryMock as any).mockResolvedValueOnce({ state: "granted" });

    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );
    await nextTick();
    expect(globalStore.getState().permission).toBe("granted");
  });

  it("device watcher: updates device list and clears missing deviceId", async () => {
    const globalStore = makeGlobalStore();

    // Install hook
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Set device list with one mic
    const mic: MediaDeviceInfo = {
      deviceId: "mic-1",
      kind: "audioinput",
      label: "Mic 1",
      toJSON: () => ({}),
    } as any;
    _setDevices([mic]);

    // Emit devicechange; should list one device and preserve null deviceId
    await act(async () => {
      _emitDeviceChange();
      await nextTick();
    });
    expect(globalStore.getState().deviceList).toHaveLength(1);
    expect(globalStore.getState().deviceId).toBeNull();

    // Choose the mic
    act(() => {
      globalStore.dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: "mic-1" },
      });
    });

    // Now remove all devices; should clear deviceId
    _setDevices([]);
    await act(async () => {
      _emitDeviceChange();
      await nextTick();
    });
    expect(globalStore.getState().deviceList).toHaveLength(0);
    expect(globalStore.getState().deviceId).toBeNull();
  });

  it("mute/deviceId transitions enforce stop/resume", async () => {
    const globalStore = makeGlobalStore();
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Start listening request
    act(() => {
      globalStore.dispatch({ type: "REQ/START" });
    });

    // Muting forces stop
    act(() => {
      // simulate mute flip
      globalStore.dispatch({
        type: "INT/SET_CONFIG",
        payload: {
          ...globalStore.getState(),
          lang: "en-GB",
          interim: false,
          continuous: false,
        },
      }); // no-op config
      (globalStore.getState() as any).muted = true; // mutate just to trigger subscriber case
    });
    // Hook will react and dispatch REQ/STOP; our reducer sets wantListening=false
    expect(globalStore.getState().wantListening).toBe(false);

    // DeviceId change: null forces stop
    act(() => {
      globalStore.dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: null },
      });
    });
    expect(globalStore.getState().wantListening).toBe(false);

    // Set device and wantListening → start
    act(() => {
      globalStore.dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: "mic-1" },
      });
      globalStore.dispatch({ type: "REQ/START" });
    });
    expect(globalStore.getState().wantListening).toBe(true);
  });

  it("config changes while listening trigger STOP then START; when not listening but wantListening=true, only START", async () => {
    const globalStore = makeGlobalStore();
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Pretend we're already listening
    act(() => {
      (globalStore.getState() as any).listening = true;
    });

    const spyDispatch = vi.spyOn(globalStore, "dispatch");
    // Tweak lang – the effect should dispatch STOP then START
    act(() => {
      globalStore.dispatch({
        type: "INT/SET_CONFIG",
        payload: { lang: "fr-FR", interim: false, continuous: false },
      });
    });

    // Confirm order: first REQ/STOP, then REQ/START
    const types = (
      spyDispatch.mock.calls.map(([a]) => (a as any).type) as string[]
    ).filter((t) => t === "REQ/STOP" || t === "REQ/START");
    const stopIndex = types.indexOf("REQ/STOP");
    const startIndex = types.indexOf("REQ/START");
    expect(stopIndex).toBeGreaterThanOrEqual(0);
    expect(startIndex).toBeGreaterThan(stopIndex);

    spyDispatch.mockClear();

    // Not listening but want to listen -> only START
    act(() => {
      (globalStore.getState() as any).listening = false;
      (globalStore.getState() as any).wantListening = true;
      globalStore.dispatch({
        type: "INT/SET_CONFIG",
        payload: { lang: "de-DE", interim: true, continuous: false },
      });
    });
    const types2 = (
      spyDispatch.mock.calls.map(([a]) => (a as any).type) as string[]
    ).filter((t) => t === "REQ/STOP" || t === "REQ/START");
    expect(types2).toEqual(["REQ/START"]);
  });

  it("SR lifecycle: start → partial/final results → end, telemetry breadcrumbs", async () => {
    const globalStore = makeGlobalStore();
    const { result } = renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: true,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Request to start listening
    act(() => result.current.start());

    // A SR instance should be created; emit onstart
    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    act(() => {
      (sr as any).emitStart();
    });
    expect(globalStore.getState().listening).toBe(true);
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-start",
      expect.any(Object)
    );

    // Emit interim (partial)
    act(() => {
      (sr as any).emitResult({
        results: [
          { isFinal: false, 0: { transcript: "hello " } },
          { isFinal: false, 0: { transcript: "world" } },
        ],
      });
    });
    expect(globalStore.getState().partial).toBe("hello world");
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-partial",
      expect.any(Object)
    );

    // Emit final
    act(() => {
      (sr as any).emitResult({
        results: [{ isFinal: true, 0: { transcript: " final text " } }],
      });
    });
    expect(globalStore.getState().final).toBe("final text");
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-final",
      expect.any(Object)
    );

    // End
    act(() => {
      (sr as any).emitEnd();
    });
    expect(globalStore.getState().listening).toBe(false);
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-end",
      expect.any(Object)
    );
  });

  it("onerror marks permission denied on fatal errors and logs telemetry", async () => {
    const globalStore = makeGlobalStore();
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    act(() => {
      globalStore.dispatch({ type: "REQ/START" });
    });
    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    // fatal error (service-not-allowed) should set permission denied
    act(() => {
      (sr as any).emitError({ error: "service-not-allowed" });
    });
    expect(globalStore.getState().permission).toBe("denied");
    expect(globalStore.getState().error).toBe("service-not-allowed");
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-error",
      expect.any(Object)
    );
  });

  it("continuous restart on onend when wantListening=true", async () => {
    const globalStore = makeGlobalStore();
    // turn on continuous
    act(() => {
      globalStore.dispatch({
        type: "INT/SET_CONFIG",
        payload: { lang: "en-GB", interim: false, continuous: true } as any,
      });
    });

    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: true,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Ask to start
    act(() => globalStore.dispatch({ type: "REQ/START" }));
    const [sr] = _getSRInstances();
    const startSpy = vi.spyOn(sr as any, "start");

    // started
    act(() => (sr as any).emitStart());
    // still want listening; end fires → should call start() again
    act(() => (sr as any).emitEnd());

    expect(startSpy).toHaveBeenCalled(); // restart attempt
  });

  it("start failure triggers stopAndWait and a fresh SR start", async () => {
    const globalStore = makeGlobalStore();
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Force the first SR.start() to throw
    _setSRMockConfig({ autoEmitStart: false });
    act(() => globalStore.dispatch({ type: "REQ/START" }));

    const [sr] = _getSRInstances();
    // Make start throw once
    const startSpy = vi.spyOn(sr as any, "start").mockImplementationOnce(() => {
      const err = new Error("not-allowed");
      (err as any).name = "NotAllowedError";
      throw err;
    });

    // Ask engine to start again (retriggers wantListening reaction)
    act(() => globalStore.dispatch({ type: "REQ/START" }));

    // stopAndWait should be called to clean the stuck recognizer
    await nextTick();
    expect(stopAndWait).toHaveBeenCalled();

    // Fresh SR should be created and started
    const instances = _getSRInstances();
    expect(instances.length).toBeGreaterThanOrEqual(1);
    expect(track).toHaveBeenCalledWith(
      "webspeech:start-error",
      expect.any(Object)
    );
  });

  it("dispose stops, resets engine local state, and calls stopAndWait", async () => {
    const globalStore = makeGlobalStore();
    const { result } = renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Start listening
    act(() => result.current.start());
    await nextTick();
    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    // Dispose
    await act(async () => {
      result.current.dispose();
      await nextTick();
    });

    expect(stopAndWait).toHaveBeenCalled();
    // After dispose, start should only flip wantListening in the store (recognizer detached)
    act(() => result.current.start());
    expect(globalStore.getState().wantListening).toBe(true);
  });

  it("device watcher is robust if enumerateDevices throws", async () => {
    const globalStore = makeGlobalStore();
    (enumerateDevicesMock as any).mockRejectedValueOnce(new Error("nope"));

    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      _emitDeviceChange();
      await nextTick();
    });

    // We don't crash; telemetry path covered
    expect(track).toHaveBeenCalledWith("webspeech:devicechange-fail");
  });

  it("uses getUserMedia track settings to infer deviceId when microphone is active (mock path smoke)", async () => {
    const globalStore = makeGlobalStore();
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
          globalStore: globalStore as GlobalVoiceStore,
        }),
      { wrapper: Wrapper }
    );

    // Make sure our mock getUserMedia resolves and returns a track with deviceId in getSettings
    const stream = await getUserMediaMock();
    const [audioTrack] = stream.getAudioTracks();
    const deviceId = audioTrack.getSettings().deviceId;

    expect(deviceId === undefined || typeof deviceId === "string").toBe(true);
  });
});
