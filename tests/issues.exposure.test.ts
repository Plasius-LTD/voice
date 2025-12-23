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

    const { result } = renderHook(() =>
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

    act(() => result.current.start());

    expect(injectedStore.getState().wantListening).toBe(true);
  });

  it("useVoiceIntents does not crash if telemetry tracking throws", async () => {
    vi.doMock("@plasius/nfr", () => ({
      track: () => {
        throw new Error("telemetry failed");
      },
    }));

    const { useVoiceIntents } = await import("../src/components/useVoiceIntents.js");

    expect(() =>
      renderHook(() =>
        useVoiceIntents({
          origin: "issue-telemetry",
          autoStart: true,
        })
      )
    ).not.toThrow();
  });

  it("useVoiceIntents flags error if crypto.randomUUID is unavailable", async () => {
    vi.doMock("@plasius/nfr", () => ({
      track: vi.fn(),
    }));

    // @ts-expect-error simulate missing crypto
    const originalCrypto = globalThis.crypto;
    // @ts-expect-error simulate missing crypto
    globalThis.crypto = undefined;

    const { useVoiceIntents } = await import("../src/components/useVoiceIntents.js");

    const { result } = renderHook(() =>
      useVoiceIntents({
        origin: "issue-crypto",
        autoStart: true,
      })
    );
    expect(result.current.error).toMatch(/crypto\.randomUUID/i);

    // @ts-expect-error restore crypto
    globalThis.crypto = originalCrypto;
  });
});
