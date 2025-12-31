import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("potential issues", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("useVoice start/stop stays in sync when a shared store is provided", async () => {
    const storeModule = await import("../src/stores/global.store.js");
    const injectedStore = storeModule.createGlobalVoiceStore();
    const { useVoice } = await import("../src/components/useVoice.js");

    const { result, unmount } = renderHook(() =>
      useVoice({
        intents: { origin: "issue", globalStore: injectedStore },
        control: {
          globalStore: injectedStore,
          enableGlobalKeyboard: false,
          enableGlobalMouse: false,
          enableGlobalTouch: false,
        },
      })
    );

    try {
      act(() => result.current.start());
      expect(injectedStore.getState().wantListening).toBe(true);
    } finally {
      unmount();
    }
  });

  it("useVoiceIntents does not crash if telemetry tracking throws", async () => {
    vi.doMock("@plasius/nfr", () => ({
      track: () => {
        throw new Error("telemetry failed");
      },
    }));

    const { useVoiceIntents } = await import(
      "../src/components/useVoiceIntents.js"
    );

    const { unmount } = renderHook(() =>
      useVoiceIntents({
        origin: "issue-telemetry",
        autoStart: true,
      })
    );
    try {
      // if the hook were to throw, the test would already fail; we just ensure cleanup
    } finally {
      unmount();
    }
  });

  it("useVoiceIntents flags error if crypto.randomUUID is unavailable", async () => {
    vi.doMock("@plasius/nfr", () => ({
      track: vi.fn(),
    }));

    // Simulate missing crypto.randomUUID (jsdom defines crypto with a getter-only property)
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true,
    });

    const { useVoiceIntents } = await import(
      "../src/components/useVoiceIntents.js"
    );

    const { result, unmount } = renderHook(() =>
      useVoiceIntents({
        origin: "issue-crypto",
        autoStart: true,
      })
    );
    try {
      expect(result.current.error).toMatch(/crypto\.randomUUID/i);
    } finally {
      if (originalDesc)
        Object.defineProperty(globalThis, "crypto", originalDesc);
      unmount();
    }
  });
});
