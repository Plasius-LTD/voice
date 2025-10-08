import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";

// --- Mock the underlying hook that VoiceProvider uses ---
// Path is relative to this test file (voice/tests/...)
const startListening = vi.fn();
const stopListening = vi.fn();
const getMuted = vi.fn(() => false);
const setMuted = vi.fn();
const getVolume = vi.fn(() => 0.75);
const setVolume = vi.fn();
const isListening = vi.fn(() => false);

vi.mock("../src/components/useVoiceIntents.js", () => {
  return {
    useVoiceIntents: vi.fn(() => ({
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

vi.mock("../src/hooks/useVoiceIntents.js", () => {
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

import {
  VoiceProvider,
  useVoiceContext,
} from "../../src/components/voiceProvider.js";
import { useVoiceControl } from "../../src/components/useVoiceControl.js";
import { globalVoiceStore } from "../../src/stores/global.store.js";

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
  const pttKeyCodes = ["Space"]; // test configuration
  const [state, setState] = React.useState(globalVoiceStore.getState());

  React.useEffect(() => {
    // Re-render on any state change
    const unsub = globalVoiceStore.subscribe(() =>
      setState(globalVoiceStore.getState())
    );
    return unsub;
  }, []);

  const {
    setMuted: setMutedCmd,
    setVolume: setVolumeCmd,
    pttButtonProps,
  } = useVoiceControl({
    pttKeyCodes,
  });

  return (
    <div>
      <div data-testid="muted">{String(state.muted)}</div>
      <div data-testid="volume">{String(state.volume)}</div>
      <div data-testid="listening">{String(state.listening)}</div>
      <button data-testid="toggle" onClick={() => setMutedCmd(!state.muted)}>
        toggle
      </button>
      <input
        aria-label="Volume"
        data-testid="volume-input"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={state.volume}
        onChange={(e) => setVolumeCmd(parseFloat(e.currentTarget.value))}
      />
      <button data-testid="ptt" {...pttButtonProps}>
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
  it("initializes from adapter (muted=false, volume=0.75, listening=false)", async () => {
    renderWithProvider(<ControlsProbe />);

    // The hook initializes from the adapter in a useEffect; wait for it to apply
    await waitFor(() => {
      expect(screen.getByTestId("muted").textContent).toBe("false");
      expect(screen.getByTestId("volume").textContent).toBe("0.75");
      expect(screen.getByTestId("listening").textContent).toBe("false");
    });

    const s = globalVoiceStore.getState();
    expect(s.volume).toBe(0.75);
    expect(s.muted).toBe(false);
    expect(s.listening).toBe(false);

    expect(getMuted).toHaveBeenCalled();
    expect(getVolume).toHaveBeenCalled();
    expect(isListening).toHaveBeenCalled();
  });

  it("toggleMute flips state and calls adapter.setMuted", async () => {
    renderWithProvider(<ControlsProbe />);

    // Ensure effect-driven init completed
    await waitFor(() => {
      expect(screen.getByTestId("muted").textContent).toBe("false");
    });

    fireEvent.click(screen.getByTestId("toggle"));
    await waitFor(() => expect(setMuted).toHaveBeenCalledWith(true));
    expect(screen.getByTestId("muted").textContent).toBe("true");

    fireEvent.click(screen.getByTestId("toggle"));
    await waitFor(() => expect(setMuted).toHaveBeenCalledWith(false));
    expect(screen.getByTestId("muted").textContent).toBe("false");
  });

  it("setVolume clamps to [0,1] and calls adapter.setVolume", async () => {
    renderWithProvider(<ControlsProbe />);

    // Set to 0.5
    fireEvent.change(screen.getByTestId("volume-input"), {
      target: { value: "0.5" },
    });
    await waitFor(() => expect(setVolume).toHaveBeenCalledWith(0.5));
    expect(screen.getByTestId("volume").textContent).toBe("0.5");

    // Attempt to set above 1 (should clamp to 1)
    fireEvent.change(screen.getByTestId("volume-input"), {
      target: { value: "1.5" },
    });
    await waitFor(() => expect(setVolume).toHaveBeenCalledWith(1));
    expect(screen.getByTestId("volume").textContent).toBe("1");

    // Attempt to set below 0 (should clamp to 0)
    fireEvent.change(screen.getByTestId("volume-input"), {
      target: { value: "-0.2" },
    });
    await waitFor(() => expect(setVolume).toHaveBeenCalledWith(0));
    expect(screen.getByTestId("volume").textContent).toBe("0");
  });

  it("push-to-talk via keyboard Space starts/stops listening", async () => {
    renderWithProvider(<ControlsProbe />);

    await waitFor(() => expect(getMuted).toHaveBeenCalled());

    fireEvent.keyDown(window, {
      key: " ",
      code: "Space",
      ctrlKey: true,
      repeat: false,
    });
    await waitFor(() => expect(startListening).toHaveBeenCalledTimes(1));

    fireEvent.keyUp(window, { key: " ", code: "Space", ctrlKey: true });
    await waitFor(() => expect(stopListening).toHaveBeenCalledTimes(1));
  });

  it("push-to-talk via pointer events on bound element", async () => {
    renderWithProvider(<ControlsProbe />);

    const ptt = screen.getByTestId("ptt");

    fireEvent.pointerDown(ptt);
    await waitFor(() => expect(startListening).toHaveBeenCalledTimes(1));

    fireEvent.pointerUp(ptt);
    await waitFor(() => expect(stopListening).toHaveBeenCalledTimes(1));
  });
});
