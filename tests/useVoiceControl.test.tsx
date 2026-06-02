import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVoiceControl } from "../src/components/useVoiceControl.js";
import { createGlobalVoiceStore } from "../src/stores/global.store.js";

const trackSpy = vi.fn();
const mockEngine = { start: vi.fn(), stop: vi.fn(), dispose: vi.fn() };

vi.mock("@plasius/nfr", () => ({
  track: (...args: any[]) => trackSpy(...args),
}));

vi.mock("../src/engine/useWebSpeechEngine.js", () => ({
  useWebSpeechEngine: () => mockEngine,
}));

describe("useVoiceControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies initial configuration to the store", () => {
    const store = createGlobalVoiceStore();
    renderHook(() =>
      useVoiceControl({
        globalStore: store,
        initialPttHold: false,
        initialPttEnabled: true,
        initialVolume: 2,
        engine: mockEngine,
      })
    );

    const state = store.getState();
    expect(state.pttHold).toBe(false);
    expect(state.pttEnabled).toBe(true);
    expect(state.volume).toBe(1);
  });

  it("responds to keyboard PTT events when enabled", () => {
    const store = createGlobalVoiceStore({ pttEnabled: true, pttHold: true });
    renderHook(() => useVoiceControl({ globalStore: store }));

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", repeat: false })
      );
    });

    expect(store.getState().pttPressed).toBe(true);
    expect(store.getState().wantListening).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });

    expect(store.getState().pttPressed).toBe(false);
    expect(store.getState().wantListening).toBe(false);
  });

  it("supports toggle mode via the imperative API", () => {
    const store = createGlobalVoiceStore({ pttEnabled: true, pttHold: false });
    const { result } = renderHook(() =>
      useVoiceControl({
        globalStore: store,
        enableGlobalKeyboard: false,
        enableGlobalMouse: false,
      })
    );

    act(() => result.current.pttButton());
    expect(store.getState().pttActive).toBe(true);
    expect(store.getState().wantListening).toBe(true);

    act(() => result.current.pttButton("toggle"));
    expect(store.getState().pttActive).toBe(false);
    expect(store.getState().wantListening).toBe(false);
  });

  it("dispatches global mouse interactions when configured", () => {
    const store = createGlobalVoiceStore({ pttEnabled: true, pttHold: false });
    renderHook(() =>
      useVoiceControl({
        globalStore: store,
        enableGlobalMouse: true,
        pttMouseButton: 0,
        enableGlobalKeyboard: false,
      })
    );

    act(() => {
      window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    });

    expect(store.getState().pttActive).toBe(true);
    expect(store.getState().wantListening).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    });

    expect(store.getState().pttPressed).toBe(false);
  });

  it("updates button props and PTT config helpers", () => {
    const store = createGlobalVoiceStore({ pttEnabled: true });
    const { result, rerender } = renderHook(() =>
      useVoiceControl({ globalStore: store, enableGlobalKeyboard: false })
    );

    act(() => result.current.setPTTButton({ mode: "toggle" }));
    expect(store.getState().pttHold).toBe(false);

    const propsA = result.current.pttButtonProps;
    expect(propsA["aria-pressed"]).toBe(false);

    act(() => propsA.onMouseDown());
    expect(store.getState().pttActive).toBe(true);

    rerender();
    const propsB = result.current.pttButtonProps;
    expect(propsB["aria-pressed"]).toBe(true);
  });

  it("clamps volume and forwards tracking when changed", () => {
    const store = createGlobalVoiceStore();
    const { result } = renderHook(() => useVoiceControl({ globalStore: store }));

    act(() => result.current.setVolume(1.5));
    expect(store.getState().volume).toBe(1);
    expect(trackSpy).toHaveBeenCalledWith("voice:set-volume", { volume: 1 });
  });

  it("mutes and proxies engine controls", () => {
    const store = createGlobalVoiceStore();
    const { result } = renderHook(() =>
      useVoiceControl({ globalStore: store, engine: mockEngine })
    );

    act(() => result.current.setMuted(true));
    expect(store.getState().muted).toBe(true);
    expect(store.getState().wantListening).toBe(false);

    act(() => {
      result.current.start();
      result.current.stop();
      result.current.dispose();
    });

    expect(mockEngine.start).toHaveBeenCalled();
    expect(mockEngine.stop).toHaveBeenCalled();
    expect(mockEngine.dispose).toHaveBeenCalled();
  });
});
