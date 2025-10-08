// tests/useVoiceControls.passthrough.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceProvider } from "../../src/components/voiceProvider.js";
import { useVoiceControl } from "../../src/components/useVoiceControl.js";
import { globalVoiceStore } from "../../src/stores/global.store.js";

// Mock underlying voice adapter methods used by the hook via useVoiceContext()
const startListening = vi.fn();
const stopListening = vi.fn();
const getMuted = vi.fn(() => false);
const setMuted = vi.fn();
const getVolume = vi.fn(() => 0.3);
const setVolume = vi.fn();
const isListening = vi.fn(() => false);

vi.mock("../src/components/useVoiceIntents.js", () => {
  return {
    useVoiceIntents: vi.fn(() => ({
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

const Controls: React.FC = () => {
  const { listening, volume, muted } = globalVoiceStore.getState();
  const { setVolume } = useVoiceControl({ pttKeys: ["Space"] });

  const bindPTT = {
    onMouseDown: () =>
      globalVoiceStore.dispatch({
        type: "EVT/PTT_PRESSED",
        payload: { source: "mouse" },
      }),
    onMouseUp: () =>
      globalVoiceStore.dispatch({
        type: "EVT/PTT_RELEASED",
        payload: { source: "mouse" },
      }),
  };
  return (
    <div>
      <div data-testid="muted">{String(muted)}</div>
      <div data-testid="volume">{String(volume)}</div>
      <div data-testid="listening">{String(listening)}</div>
      <input
        aria-label="Volume"
        data-testid="vol"
        type="range"
        min={0}
        max={1}
        step={0.01}
        onChange={(e) =>
          setVolume(parseFloat((e.target as HTMLInputElement).value))
        }
      />
      <button data-testid="ptt" {...bindPTT}>
        ptt
      </button>
    </div>
  );
};

const renderWithProvider = (ui: React.ReactElement) =>
  render(<VoiceProvider>{ui}</VoiceProvider>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useVoiceControls – passthrough + actions", () => {
  it("does not call adapter setters on mount, reads initial state via adapter", () => {
    renderWithProvider(<Controls />);
    expect(screen.getByTestId("muted").textContent).toBe("false");
    expect(screen.getByTestId("volume").textContent).toBe("0.3");
    expect(screen.getByTestId("listening").textContent).toBe("false");

    // No writes on mount
    expect(setMuted).not.toHaveBeenCalled();
    expect(setVolume).not.toHaveBeenCalled();
  });

  it("toggleMute flips UI and calls adapter.setMuted", () => {
    renderWithProvider(<Controls />);
    fireEvent.click(screen.getByTestId("toggle"));
    act(async () => {});
    expect(setMuted).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("muted").textContent).toBe("true");
  });

  it("setVolume clamps and calls adapter.setVolume with clamped value", () => {
    renderWithProvider(<Controls />);

    fireEvent.change(screen.getByTestId("vol"), { target: { value: "0.5" } });
    act(async () => {});
    expect(setVolume).toHaveBeenCalledWith(0.5);
    expect(screen.getByTestId("volume").textContent).toBe("0.5");

    fireEvent.change(screen.getByTestId("vol"), { target: { value: "1.5" } });
    act(async () => {});
    expect(setVolume).toHaveBeenLastCalledWith(1);
    expect(screen.getByTestId("volume").textContent).toBe("1");

    fireEvent.change(screen.getByTestId("vol"), { target: { value: "-0.2" } });
    act(async () => {});
    expect(setVolume).toHaveBeenLastCalledWith(0);
    expect(screen.getByTestId("volume").textContent).toBe("0");
  });

  it("PTT start/stop via mouse updates UI immediately and calls adapter", () => {
    renderWithProvider(<Controls />);
    const ptt = screen.getByTestId("ptt");

    fireEvent.mouseDown(ptt);
    act(async () => {});
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");

    fireEvent.mouseUp(ptt);
    act(async () => {});
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");
  });

  it("PTT via Space key", () => {
    renderWithProvider(<Controls />);
    fireEvent.keyDown(window, { key: "Space" });
    act(async () => {});
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("true");
    fireEvent.keyUp(window, { key: "Space" });
    act(async () => {});
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("listening").textContent).toBe("false");
  });
});
