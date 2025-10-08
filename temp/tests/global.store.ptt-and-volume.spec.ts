import { describe, it, expect } from "vitest";
import { createGlobalVoiceStore } from "../src/stores/global.store";

describe("Global voice store — volume & PTT", () => {
  it("clamps volume to [0,1]", () => {
    const store = createGlobalVoiceStore();
    store.dispatch({ type: "INT/SET_VOLUME", payload: { volume: 1.5 } });
    expect(store.getState().volume).toBe(1);
    store.dispatch({ type: "INT/SET_VOLUME", payload: { volume: -0.25 } });
    expect(store.getState().volume).toBe(0);
    store.dispatch({ type: "INT/SET_VOLUME", payload: { volume: 0.42 } });
    expect(store.getState().volume).toBe(0.42);
  });

  it("PTT hold mode: pressed => active, released => inactive", () => {
    const store = createGlobalVoiceStore({ pttEnabled: true, pttHold: true });
    store.dispatch({
      type: "EVT/PTT_PRESSED",
      payload: { source: "keyboard" },
    });
    expect(store.getState().pttPressed).toBe(true);
    expect(store.getState().pttActive).toBe(true);
    store.dispatch({
      type: "EVT/PTT_RELEASED",
      payload: { source: "keyboard" },
    });
    expect(store.getState().pttPressed).toBe(false);
    expect(store.getState().pttActive).toBe(false);
  });

  it("PTT toggle mode: toggle flips active; pressed/released do not change active directly", () => {
    const store = createGlobalVoiceStore({ pttEnabled: true, pttHold: false });
    store.dispatch({ type: "EVT/PTT_PRESSED", payload: { source: "mouse" } });
    expect(store.getState().pttPressed).toBe(true);
    expect(store.getState().pttActive).toBe(false); // still false until toggle
    store.dispatch({ type: "EVT/PTT_RELEASED", payload: { source: "mouse" } });
    expect(store.getState().pttPressed).toBe(false);
    store.dispatch({ type: "EVT/PTT_TOGGLE", payload: { source: "mouse" } });
    expect(store.getState().pttActive).toBe(true);
    store.dispatch({ type: "EVT/PTT_TOGGLE", payload: { source: "mouse" } });
    expect(store.getState().pttActive).toBe(false);
  });

  it("REQ/START/STOP set wantListening only (engine manages actual listening)", () => {
    const store = createGlobalVoiceStore();
    expect(store.getState().wantListening).toBe(false);
    store.dispatch({ type: "REQ/START" });
    expect(store.getState().wantListening).toBe(true);
    store.dispatch({ type: "REQ/STOP" });
    expect(store.getState().wantListening).toBe(false);
  });
});
