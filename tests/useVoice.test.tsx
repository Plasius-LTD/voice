import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const trackSpy = vi.fn();
const mockEngine = { start: vi.fn(), stop: vi.fn(), dispose: vi.fn() };

vi.mock("@plasius/nfr", () => ({
  track: (...args: any[]) => trackSpy(...args),
}));

vi.mock("../src/engine/useWebSpeechEngine.js", () => ({
  useWebSpeechEngine: () => mockEngine,
}));

async function loadModules() {
  vi.doMock("../src/stores/global.store.js", async () => {
    const actual = await vi.importActual<any>("../src/stores/global.store.js");
    const store = actual.createGlobalVoiceStore({
      permission: "granted",
      wantListening: false,
      listening: false,
    });
    return { ...actual, globalVoiceStore: store };
  });

  const voice = await import("../src/components/useVoice.js");
  const storeModule = await import("../src/stores/global.store.js");
  return { ...voice, store: storeModule.globalVoiceStore };
}

describe("useVoice", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("composes intents and control APIs and forwards start/stop", async () => {
    const { useVoice, store } = await loadModules();

    const { result } = renderHook(() =>
      useVoice({
        intents: { origin: "demo", autoStart: false },
        control: {
          enableGlobalKeyboard: false,
          enableGlobalMouse: false,
          enableGlobalTouch: false,
          engine: mockEngine,
        },
      })
    );

    expect(result.current.intents.permission).toBe("granted");
    expect(store.getState().wantListening).toBe(false);

    act(() => result.current.start());
    expect(store.getState().wantListening).toBe(true);

    act(() => result.current.control.setMuted(true));
    expect(store.getState().muted).toBe(true);

    act(() => result.current.stop());
    expect(store.getState().wantListening).toBe(false);

    act(() => result.current.control.dispose());
    expect(mockEngine.dispose).toHaveBeenCalled();
  });
});
