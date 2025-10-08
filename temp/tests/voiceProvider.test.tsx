import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// --- Mock the underlying hook that VoiceProvider uses ---
// Use vi.hoisted so the spy exists before the mock factory runs (hoisted by Vitest)
const { useVoiceSpy } = vi.hoisted(() => ({
  useVoiceSpy: vi.fn((opts?: any) => ({
    __id: opts?.origin ?? "default",
    getMuted: vi.fn(() => false),
  })),
}));

// Match the provider's ESM import path ("./useVoiceIntents.js")
vi.mock("../src/components/useVoiceIntents.js", () => ({
  useVoiceIntents: useVoiceSpy,
}));

import {
  VoiceProvider,
  useVoiceContext,
  WithVoice,
} from "../src/components/voiceProvider.js";

// Helper components
const Probe: React.FC = () => {
  const voice = useVoiceContext();
  return <div data-testid="id">{String((voice as any).__id)}</div>;
};

const ThrowOutsideProbe: React.FC = () => {
  // Rendering this outside a provider should throw
  useVoiceContext();
  return null;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VoiceProvider", () => {
  it("throws if useVoiceContext() is called outside provider", () => {
    // expect the render to throw synchronously
    expect(() => render(<ThrowOutsideProbe />)).toThrowError(
      /useVoiceContext must be used within a <VoiceProvider>/
    );
  });

  it("provides a voice instance to children", () => {
    render(
      <VoiceProvider>
        <Probe />
      </VoiceProvider>
    );
    expect(screen.getByTestId("id").textContent).toBe("default");
  });

  it("forwards options to useVoice", () => {
    render(
      <VoiceProvider options={{ origin: "SettingsPage", lang: "en-GB" }}>
        <Probe />
      </VoiceProvider>
    );
    expect(useVoiceSpy).toHaveBeenCalledTimes(1);
    expect(useVoiceSpy).toHaveBeenCalledWith({
      origin: "SettingsPage",
      lang: "en-GB",
    });
    expect(screen.getByTestId("id").textContent).toBe("SettingsPage");
  });

  it("supports WithVoice render-prop component", () => {
    render(
      <VoiceProvider options={{ origin: "WithVoice" }}>
        <WithVoice>
          {(voice) => (
            <div data-testid="with">{String((voice as any).__id)}</div>
          )}
        </WithVoice>
      </VoiceProvider>
    );
    expect(screen.getByTestId("with").textContent).toBe("WithVoice");
  });

  it("isolates instances across multiple providers", () => {
    render(
      <div>
        <VoiceProvider options={{ origin: "Left" }}>
          <div data-testid="left">
            <Probe />
          </div>
        </VoiceProvider>
        <VoiceProvider options={{ origin: "Right" }}>
          <div data-testid="right">
            <Probe />
          </div>
        </VoiceProvider>
      </div>
    );

    const ids = screen.getAllByTestId("id").map((el) => el.textContent);
    expect(ids).toContain("Left");
    expect(ids).toContain("Right");
  });
});
