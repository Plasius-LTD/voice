import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- Mock the underlying hook that VoiceProvider uses ---
// Path is relative to this test file (voice/tests/...)
const startListening = vi.fn();
const stopListening = vi.fn();
const getMuted = vi.fn(() => false);
const setMuted = vi.fn();
const getVolume = vi.fn(() => 0.75);
const setVolume = vi.fn();
const isListening = vi.fn(() => false);

vi.mock("../src/components/useVoice", () => {
  return {
    useVoice: vi.fn(() => ({
      // Methods our default adapter looks for
      getMuted,
      setMuted,
      getVolume,
      setVolume,
      startListening,
      stopListening,
      isListening,
      // Any other fields can be added here as your real hook grows
    })),
  };
});

import {
  VoiceProvider,
  useVoiceContext,
} from "../src/components/voiceProvider";
import { useVoiceControls } from "../src/components/useVoiceControls";

// Simple consumer that exposes the context keys for smoke testing
const ContextProbe: React.FC = () => {
  const ctx = useVoiceContext();
  return (
    <div>
      <button
        data-testid="has-context"
        onClick={() => {
          /* noop */
        }}
      >
        {ctx ? "yes" : "no"}
      </button>
    </div>
  );
};

const ControlsProbe: React.FC = () => {
  const { muted, volume, listening, toggleMute, setVolume, bindPTT } =
    useVoiceControls({ pttKey: " " });
  return (
    <div>
      <div data-testid="muted">{String(muted)}</div>
      <div data-testid="volume">{String(volume)}</div>
      <div data-testid="listening">{String(listening)}</div>
      <button data-testid="toggle" onClick={toggleMute}>
        toggle
      </button>
      <input
        aria-label="Volume"
        data-testid="volume-input"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.currentTarget.value))}
      />
      <button data-testid="ptt" {...bindPTT}>
        ptt
      </button>
    </div>
  );
};

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<VoiceProvider>{ui}</VoiceProvider>);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VoiceProvider + useVoiceContext", () => {
  it("provides context without throwing", () => {
    renderWithProvider(<ContextProbe />);
    expect(screen.getByTestId("has-context").textContent).toBe("yes");
  });
});

describe("useVoiceControls", () => {
  it("initializes from adapter (muted=false, volume=0.75, listening=false)", () => {
    renderWithProvider(<ControlsProbe />);
    expect(screen.getByTestId("muted").textContent).toBe("false");
    expect(screen.getByTestId("volume").textContent).toBe("0.75");
    expect(screen.getByTestId("listening").textContent).toBe("false");
    expect(getMuted).toHaveBeenCalled();
    expect(getVolume).toHaveBeenCalled();
    expect(isListening).toHaveBeenCalled();
  });

  it("toggleMute flips state and calls adapter.setMuted", () => {
    renderWithProvider(<ControlsProbe />);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(setMuted).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("muted").textContent).toBe("true");

    fireEvent.click(screen.getByTestId("toggle"));
    expect(setMuted).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("muted").textContent).toBe("false");
  });

  it("setVolume clamps to [0,1] and calls adapter.setVolume", () => {
    renderWithProvider(<ControlsProbe />);

    // Set to 0.5
    fireEvent.change(screen.getByTestId("volume-input"), {
      target: { value: "0.5" },
    });
    expect(setVolume).toHaveBeenCalledWith(0.5);
    expect(screen.getByTestId("volume").textContent).toBe("0.5");

    // Attempt to set above 1
    fireEvent.change(screen.getByTestId("volume-input"), {
      target: { value: "1.5" },
    });
    expect(setVolume).toHaveBeenCalledWith(1); // clamped by hook before calling adapter
    expect(screen.getByTestId("volume").textContent).toBe("1");

    // Attempt to set below 0
    fireEvent.change(screen.getByTestId("volume-input"), {
      target: { value: "-0.2" },
    });
    expect(setVolume).toHaveBeenCalledWith(0);
    expect(screen.getByTestId("volume").textContent).toBe("0");
  });

  it("push-to-talk via keyboard Space starts/stops listening", () => {
    renderWithProvider(<ControlsProbe />);

    // Key down (Space) starts listening
    fireEvent.keyDown(window, { key: " " });
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");

    // Key up (Space) stops listening
    fireEvent.keyUp(window, { key: " " });
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");
  });

  it("push-to-talk via pointer events on bound element", () => {
    renderWithProvider(<ControlsProbe />);

    const ptt = screen.getByTestId("ptt");

    fireEvent.mouseDown(ptt);
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");

    fireEvent.mouseUp(ptt);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");
  });
});
