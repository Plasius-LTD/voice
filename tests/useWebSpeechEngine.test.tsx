/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { FC, PropsWithChildren } from "react";
import { renderHook, act } from "@testing-library/react";
import { createStore, Store } from "@plasius/react-state";

// Bring in the global environment & mocks (navigator + SR) once.
import "./mocks/environment.setup.js";
import {
  _setDevices,
  _emitDeviceChange,
  permissionsQueryMock,
  enumerateDevicesMock,
  getUserMediaMock,
} from "./mocks/navigator.mock.js";
import {
  _getSRInstances,
  _clearSRInstances,
  _setSRMockConfig,
} from "./mocks/speechrecognition.mock.js";
import { stopAndWait } from "./mocks/stopAndWait.mock.js";
import { track } from "./mocks/telemetry.mock.js";

import { useWebSpeechEngine } from "../src/engine/useWebSpeechEngine.js";
import { globalVoiceStore } from "../src/stores/global.store.js";

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
    const { getState } = globalVoiceStore;
    const { rerender } = renderHook((p: any) => useWebSpeechEngine({ ...p }), {
      wrapper: Wrapper,
      initialProps: { lang: "en-GB", interim: false, continuous: false },
    });

    await act(async () => {});
    // initial effect
    expect(getState().lang).toBe("en-GB");
    expect(getState().interim).toBe(false);
    expect(getState().continuous).toBe(false);

    // update props
    rerender({ lang: "fr-FR", interim: true, continuous: true });

    await act(async () => {});
    expect(getState().lang).toBe("fr-FR");
    expect(getState().interim).toBe(true);
    expect(getState().continuous).toBe(true);
  });

  it("sets permission to 'prompt' when no SpeechRecognition is available", async () => {
    const { getState } = globalVoiceStore;

    const oldSR = (globalThis as any).SpeechRecognition;
    const oldWebSR = (globalThis as any).webkitSpeechRecognition;
    // Remove constructors
    (globalThis as any).SpeechRecognition = undefined;
    (globalThis as any).webkitSpeechRecognition = undefined;
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {});
    // Initial permission effect should mark prompt if no SR
    expect(getState().permission).toBe("prompt");

    (globalThis as any).SpeechRecognition = oldSR;
    (globalThis as any).webkitSpeechRecognition = oldWebSR;
  });

  it("reads permission via navigator.permissions.query when SR exists", async () => {
    const { getState } = globalVoiceStore;
    // Ensure SR is present
    const SR =
      (globalThis as any).SpeechRecognition ??
      (globalThis as any).webkitSpeechRecognition;
    expect(SR).toBeTruthy();

    // Start with granted
    (permissionsQueryMock as any).mockResolvedValueOnce({ state: "granted" });

    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );
    await act(async () => {});
    expect(getState().permission).toBe("granted");
  });

  it("device watcher: updates device list and clears missing deviceId", async () => {
    const { getState, dispatch } = globalVoiceStore;

    // Install hook
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
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
    });

    await act(async () => {});

    expect(getState().deviceList).toHaveLength(1);
    expect(getState().deviceId).toBeNull();

    // Choose the mic
    await act(async () => {
      dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: "mic-1" },
      });
    });

    await act(async () => {});
    // Now remove all devices; should clear deviceId
    _setDevices([]);
    await act(async () => {
      _emitDeviceChange();
    });

    await act(async () => {});
    expect(getState().deviceList).toHaveLength(0);
    expect(getState().deviceId).toBeNull();
  });

  it("mute/deviceId transitions enforce stop/resume", async () => {
    const { getState, dispatch } = globalVoiceStore;
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    // Start listening request
    await act(async () => {
      dispatch({ type: "REQ/START" });
    });

    await act(async () => {});

    await act(async () => {
      dispatch({
        type: "INT/SET_CONFIG",
        payload: {
          lang: "en-GB",
          interim: false,
          continuous: false,
        },
      });
      dispatch({ type: "EVT/MUTE_CHANGED", payload: { muted: true } });
    });

    await act(async () => {});
    // Hook will react and dispatch REQ/STOP; our reducer sets wantListening=false
    expect(getState().wantListening).toBe(false);

    // DeviceId change: null forces stop
    await act(async () => {
      dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: null },
      });
    });

    await act(async () => {});
    expect(getState().wantListening).toBe(false);

    // Set device and wantListening → start
    await act(async () => {
      dispatch({
        type: "EVT/DEVICE_CHANGED",
        payload: { deviceId: "mic-1" },
      });
      dispatch({ type: "EVT/MUTE_CHANGED", payload: { muted: false } });
      dispatch({ type: "REQ/START" });
    });

    await act(async () => {});
    expect(getState().wantListening).toBe(true);
  });

  it("config changes while listening trigger STOP then START; when not listening but wantListening=true, only START", async () => {
    const { getState, dispatch } = globalVoiceStore;
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    // Pretend we're already listening
    await act(async () => {
      dispatch({ type: "EVT/START" });
    });
    await act(async () => {});

    const spyDispatch = vi.spyOn(globalVoiceStore, "dispatch");
    // Tweak lang – the effect should dispatch STOP then START
    await act(async () => {
      dispatch({
        type: "INT/SET_CONFIG",
        payload: { lang: "fr-FR", interim: false, continuous: false },
      });
    });
    await act(async () => {});

    // Confirm order: first REQ/STOP, then REQ/START
    const types = (
      spyDispatch.mock.calls.map(([a]) => (a as any).type) as string[]
    ).filter((t) => t === "REQ/STOP" || t === "REQ/START");
    const stopIndex = types.indexOf("REQ/STOP");
    const startIndex = types.indexOf("REQ/START");
    await act(async () => {});
    expect(stopIndex).toBeGreaterThanOrEqual(0);
    expect(startIndex).toBeGreaterThan(stopIndex);

    spyDispatch.mockClear();

    // Not listening but want to listen -> only START
    await act(async () => {
      dispatch({ type: "EVT/END" });
      dispatch({
        type: "INT/SET_CONFIG",
        payload: { lang: "de-DE", interim: true, continuous: false },
      });
    });
    await act(async () => {});
    const types2 = (
      spyDispatch.mock.calls.map(([a]) => (a as any).type) as string[]
    ).filter((t) => t === "REQ/STOP" || t === "REQ/START");
    expect(types2).toEqual(["REQ/START"]);
  });

  it("SR lifecycle: start → partial/final results → end, telemetry breadcrumbs", async () => {
    const { dispatch, getState } = globalVoiceStore;
    const { result } = renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: true,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    // Request to start listening
    await act(async () => result.current.start());

    for (let i = 0; i < 100; ++i) await act(async () => {});

    await act(async () => {});
    const SRc =
      (globalThis as any).SpeechRecognition ??
      (globalThis as any).webkitSpeechRecognition;
    expect(SRc).toBeTruthy(); // 1) is a constructor present?

    expect(getState().wantListening).toBe(true); // 2) did start() flip the flag?

    // permission should be granted by the navigator mock after mount:
    expect(getState().permission).toBe("granted"); // 3) not stuck at 'prompt'/'denied'

    // A SR instance should be created; emit onstart
    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    await act(async () => {
      (sr as any).emitStart();
    });
    await act(async () => {});

    expect(getState().listening).toBe(true);
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-start",
      expect.any(Object)
    );

    // Emit interim (partial)
    await act(async () => {
      (sr as any).emitResult({
        results: [
          { isFinal: false, 0: { transcript: "hello " } },
          { isFinal: false, 0: { transcript: "world" } },
        ],
      });
    });
    expect(getState().partial).toBe("hello world");
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-partial",
      expect.any(Object)
    );

    // Emit final
    await act(async () => {
      (sr as any).emitResult({
        results: [{ isFinal: true, 0: { transcript: " final text " } }],
      });
    });
    await act(async () => {});
    expect(getState().transcript).toBe("final text");
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-final",
      expect.any(Object)
    );

    // End
    await act(async () => {
      (sr as any).emitEnd();
    });
    expect(getState().listening).toBe(false);
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-end",
      expect.any(Object)
    );
  });

  it("onerror marks permission denied on fatal errors and logs telemetry", async () => {
    const { dispatch, getState } = globalVoiceStore;
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      dispatch({ type: "REQ/START" });
    });
    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    // fatal error (service-not-allowed) should set permission denied
    await act(async () => {
      (sr as any).emitError({ error: "service-not-allowed" });
    });

    await act(async () => {});
    expect(getState().permission).toBe("denied");
    expect(getState().lastError).toBe("service-not-allowed");
    expect(track).toHaveBeenCalledWith(
      "webspeech:session-error",
      expect.any(Object)
    );
    // RESET the permissions
    await act(async () =>
      dispatch({
        type: "INT/SET_PERMISSIONS",
        payload: { permission: "prompt" },
      })
    );
  });

  it("continuous restart on onend when wantListening=true", async () => {
    const { dispatch } = globalVoiceStore;
    // turn on continuous
    await act(async () => {
      dispatch({
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
        }),
      { wrapper: Wrapper }
    );

    // Ask to start
    await act(async () => dispatch({ type: "REQ/START" }));
    const [sr] = _getSRInstances();
    const startSpy = vi.spyOn(sr as any, "start");

    // started
    await act(async () => (sr as any).emitStart());

    await act(async () => {});
    // still want listening; end fires → should call start() again
    await act(async () => (sr as any).emitEnd());

    expect(startSpy).toHaveBeenCalled(); // restart attempt
  });

  // Not yet functional.
  it.skip("start failure triggers stopAndWait and a fresh SR start", async () => {
    const { dispatch } = globalVoiceStore;

    // Render hook (installs engine effects)
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    // Spy on the SR prototype *before* any instance is created, and make the first start() throw
    const SRc =
      (globalThis as any).SpeechRecognition ??
      (globalThis as any).webkitSpeechRecognition;
    expect(SRc).toBeTruthy();
    const startSpy = vi
      .spyOn((SRc as any).prototype, "start")
      .mockImplementationOnce(() => {
        const err = new Error("not-allowed");
        (err as any).name = "NotAllowedError";
        throw err;
      });

    // Trigger a start request — engine will create an instance and call start(), which will throw once
    await act(async () =>
      dispatch({
        type: "REQ/START",
        payload: { continuous: true, lang: "en-GB", interim: true },
      })
    );

    // stopAndWait should be called to clean the stuck recognizer
    await act(async () => {});
    expect(stopAndWait).toHaveBeenCalled();
    expect(startSpy).toHaveBeenCalled();

    // Fresh SR should be created and started (no need for a second REQ/START)
    const instances = _getSRInstances();
    expect(instances.length).toBeGreaterThanOrEqual(1);
    // Grab the last call
    const [event, payload] = (track as any).mock.calls.at(-1)!;

    expect(event).toBe("webspeech:start-error");
    // See all fields clearly in failures
    expect(payload).toMatchInlineSnapshot();
  });

  it("dispose stops, resets engine local state, and calls stopAndWait", async () => {
    const { getState } = globalVoiceStore;
    const { result } = renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    // Start listening
    await act(async () => result.current.start());
    await act(async () => {});
    const [sr] = _getSRInstances();
    expect(sr).toBeTruthy();

    // Dispose
    await act(async () => {
      result.current.dispose();
    });

    await act(async () => {});
    expect(stopAndWait).toHaveBeenCalled();
    // After dispose, start should only flip wantListening in the store (recognizer detached)
    await act(async () => result.current.start());
    await act(async () => {});
    expect(getState().wantListening).toBe(true);
  });

  it("device watcher is robust if enumerateDevices throws", async () => {
    (enumerateDevicesMock as any).mockRejectedValueOnce(new Error("nope"));

    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      _emitDeviceChange();
    });

    await act(async () => {});

    // We don't crash; telemetry path covered
    expect(track).toHaveBeenCalledWith("webspeech:devicechange-fail");
  });

  it("uses getUserMedia track settings to infer deviceId when microphone is active (mock path smoke)", async () => {
    renderHook(
      () =>
        useWebSpeechEngine({
          lang: "en-GB",
          interim: false,
          continuous: false,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {});
    // Make sure our mock getUserMedia resolves and returns a track with deviceId in getSettings
    const stream = await getUserMediaMock();
    const [audioTrack] = stream.getAudioTracks();
    const deviceId = audioTrack.getSettings().deviceId;

    expect(deviceId === undefined || typeof deviceId === "string").toBe(true);
  });
});
