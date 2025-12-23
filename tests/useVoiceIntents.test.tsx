import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor, render } from "@testing-library/react";

const trackSpy = vi.fn();
const uuidSpy = vi.fn(() => "session-test");

vi.stubGlobal("crypto", { randomUUID: uuidSpy });

vi.mock("@plasius/nfr", () => ({
  track: (...args: any[]) => trackSpy(...args),
}));

async function loadModules() {
  vi.doMock("../src/stores/global.store.js", async () => {
    const actual = await vi.importActual<any>("../src/stores/global.store.js");
    const store = actual.createGlobalVoiceStore({
      permission: "granted",
      transcript: "",
      partial: "",
      wantListening: false,
      listening: false,
    });
    return { ...actual, globalVoiceStore: store };
  });

  const intents = await import("../src/components/useVoiceIntents.js");
  const storeModule = await import("../src/stores/global.store.js");
  return { ...intents, store: storeModule.globalVoiceStore };
}

describe("useVoiceIntents", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    uuidSpy.mockClear();
  });

  it("prefers registered handlers over activate callbacks", async () => {
    const { useVoiceIntents, getRegisteredIntentNames, store } = await loadModules();
    const activate = vi.fn();
    const handler = vi.fn().mockReturnValue("success");

    const { result, unmount } = renderHook(() =>
      useVoiceIntents({ origin: "shop", lang: "en-US", activate })
    );

    act(() =>
      result.current.registerVoiceIntents("shop", [
        { name: "cart.addItem", patterns: ["add to cart"], handler },
      ])
    );

    act(() => {
      store.dispatch({ type: "EVT/START" });
      store.dispatch({ type: "EVT/FINAL", payload: { text: "add to cart two" } });
    });

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(activate).not.toHaveBeenCalled();
    expect(getRegisteredIntentNames("shop")).toContain("cart.addItem");
    expect(trackSpy).toHaveBeenCalledWith("ui.voice", expect.objectContaining({
      phase: "intent",
      intent: "cart.addItem",
    }));
    unmount();
  });

  it("falls back to activate callback and stops when not continuous", async () => {
    const { useVoiceIntents, store } = await loadModules();
    const activate = vi.fn().mockResolvedValue("no-match");
    const redact = vi.fn((t: string) => t.replace(/secret/i, "[redacted]"));

    const { result, unmount } = renderHook(() =>
      useVoiceIntents({ origin: "page", interim: false, activate, redact })
    );

    act(() => {
      store.dispatch({ type: "EVT/START" });
      store.dispatch({ type: "EVT/FINAL", payload: { text: "search for secret shoes" } });
    });

    await waitFor(() => expect(activate).toHaveBeenCalledWith(
      "search.query",
      expect.objectContaining({ origin: "page" })
    ));

    await waitFor(() => expect(store.getState().wantListening).toBe(false));
    expect(redact).toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalledWith("ui.voice", expect.objectContaining({
      phase: "final",
      transcript: "search for [redacted] shoes",
    }));
    expect(uuidSpy).toHaveBeenCalled();
    result.current.unregisterVoiceIntents("page");
    unmount();
  });
});

describe("VoiceIntents component", () => {
  it("registers and unregisters intents when toggled", async () => {
    const registerVoiceIntents = vi.fn();
    const unregisterVoiceIntents = vi.fn();

    vi.doMock("../src/components/useVoiceIntents.js", async () => {
      const actual = await vi.importActual<any>("../src/components/useVoiceIntents.js");
      return {
        ...actual,
        useVoiceIntents: () => ({
          registerVoiceIntents,
          unregisterVoiceIntents,
        }),
      };
    });

    const { VoiceIntents } = await import("../src/components/voiceIntents.js");
    const { VoiceProvider } = await import("../src/components/voiceProvider.js");

    const intents = [
      { name: "hello", patterns: [/hello/], handler: vi.fn() },
    ];

    const { unmount, rerender } = render(
      <VoiceProvider>
        <VoiceIntents origin="demo" intents={intents} enabled />
      </VoiceProvider>
    );

    expect(registerVoiceIntents).toHaveBeenCalledWith("demo", intents);

    rerender(
      <VoiceProvider>
        <VoiceIntents origin="demo" intents={intents} enabled={false} />
      </VoiceProvider>
    );
    expect(unregisterVoiceIntents).toHaveBeenCalledWith("demo", ["hello"]);

    unmount();
  });
});
