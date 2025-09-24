import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- Mock the underlying hook that VoiceProvider uses ---
const startListening = vi.fn();
const stopListening = vi.fn();
const getMuted = vi.fn(() => false);
const setMuted = vi.fn();
const getVolume = vi.fn(() => 0.3);
const setVolume = vi.fn();
const isListening = vi.fn(() => false);

vi.mock("../src/components/useVoice", () => {
  return {
    useVoice: vi.fn(() => ({
      getMuted,
      setMuted,
      getVolume,
      setVolume,
      startListening,
      stopListening,
      isListening,
    })),
  };
});

import { VoiceProvider } from "../src/components/voiceProvider";
import { useVoiceControls } from "../src/components/useVoiceControls";

const ControlsUnderTest: React.FC = () => {
  const {
    muted,
    volume,
    listening,
    toggleMute,
    setVolume,
    bindPTT,
    registerPTTTarget,
    unregisterPTTTarget,
  } = useVoiceControls({ pttKey: " " });

  // expose helpers for register/unregister PTT target testing via DOM
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
        data-testid="vol"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.currentTarget.value))}
      />
      <button data-testid="ptt-inline" {...bindPTT}>
        ptt-inline
      </button>
      <button
        data-testid="attach-ptt"
        onClick={() => registerPTTTarget("#external-ptt")}
      >
        attach-ptt
      </button>
      <button data-testid="detach-ptt" onClick={() => unregisterPTTTarget()}>
        detach-ptt
      </button>
    </div>
  );
};

const renderWithProvider = (ui: React.ReactElement) =>
  render(<VoiceProvider>{ui}</VoiceProvider>);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // cleanup any stray element we might create for PTT targeting
  const ext = document.querySelector("#external-ptt");
  if (ext && ext.parentElement) ext.parentElement.removeChild(ext);
});

describe("useVoiceControls (focused)", () => {
  it("initializes from adapter (muted=false, volume=0.3, listening=false)", () => {
    renderWithProvider(<ControlsUnderTest />);
    expect(screen.getByTestId("muted").textContent).toBe("false");
    expect(screen.getByTestId("volume").textContent).toBe("0.3");
    expect(screen.getByTestId("listening").textContent).toBe("false");
    expect(getMuted).toHaveBeenCalled();
    expect(getVolume).toHaveBeenCalled();
    expect(isListening).toHaveBeenCalled();
  });

  it("toggleMute calls setMuted and flips UI", () => {
    renderWithProvider(<ControlsUnderTest />);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(setMuted).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("muted").textContent).toBe("true");
    fireEvent.click(screen.getByTestId("toggle"));
    expect(setMuted).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("muted").textContent).toBe("false");
  });

  it("setVolume clamps within [0,1] and calls adapter.setVolume", () => {
    renderWithProvider(<ControlsUnderTest />);

    fireEvent.change(screen.getByTestId("vol"), { target: { value: "0.5" } });
    expect(setVolume).toHaveBeenCalledWith(0.5);
    expect(screen.getByTestId("volume").textContent).toBe("0.5");

    fireEvent.change(screen.getByTestId("vol"), { target: { value: "1.5" } });
    expect(setVolume).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("volume").textContent).toBe("1");

    fireEvent.change(screen.getByTestId("vol"), { target: { value: "-0.2" } });
    expect(setVolume).toHaveBeenCalledWith(0);
    expect(screen.getByTestId("volume").textContent).toBe("0");
  });

  it("push-to-talk via inline bound element (mouse)", () => {
    renderWithProvider(<ControlsUnderTest />);
    const btn = screen.getByTestId("ptt-inline");

    fireEvent.mouseDown(btn);
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");

    fireEvent.mouseUp(btn);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");
  });

  it("push-to-talk via Space key (keyboard)", () => {
    renderWithProvider(<ControlsUnderTest />);

    fireEvent.keyDown(window, { key: " " });
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");

    fireEvent.keyUp(window, { key: " " });
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");
  });

  it("registerPTTTarget attaches handlers to external element and they work", () => {
    // create an external button that lives outside the component tree
    const ext = document.createElement("button");
    ext.id = "external-ptt";
    document.body.appendChild(ext);

    renderWithProvider(<ControlsUnderTest />);

    // Attach to #external-ptt
    fireEvent.click(screen.getByTestId("attach-ptt"));

    // Simulate pointer interaction on the external element
    fireEvent.mouseDown(ext);
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");

    fireEvent.mouseUp(ext);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");

    // Detach and ensure no more calls occur
    fireEvent.click(screen.getByTestId("detach-ptt"));
    fireEvent.mouseDown(ext);
    expect(startListening).toHaveBeenCalledTimes(1); // unchanged
  });
});
