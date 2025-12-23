import { describe, it, expect, vi } from "vitest";
import { buildDefaultAdapter } from "../src/utils/voiceAdapter.js";

// Helper to make a fake voice object
const mk = (impl: Record<string, any>) => impl as any;

describe("buildDefaultAdapter", () => {
  it("prefers method fallbacks then properties", () => {
    const voice = mk({
      getMuted: vi.fn(() => true),
      setMuted: vi.fn(),
      getVolume: vi.fn(() => 0.4),
      setVolume: vi.fn(),
      startListening: vi.fn(),
      stopListening: vi.fn(),
      isListening: vi.fn(() => false),
    });
    const a = buildDefaultAdapter(voice);
    expect(a.getMuted()).toBe(true);
    expect(a.getVolume()).toBe(0.4);
    expect(a.isListening()).toBe(false);
    a.setMuted(false);
    a.setVolume(0.7);
    a.startListening();
    a.stopListening();
    expect(voice.setMuted).toHaveBeenCalledWith(false);
    expect(voice.setVolume).toHaveBeenCalledWith(0.7);
    expect(voice.startListening).toHaveBeenCalled();
    expect(voice.stopListening).toHaveBeenCalled();
  });

  it("falls back to properties when methods missing", () => {
    const voice = mk({
      muted: true,
      volume: 0.2,
      listening: true,
    });
    const a = buildDefaultAdapter(voice);
    expect(a.getMuted()).toBe(true);
    expect(a.getVolume()).toBe(0.2);
    expect(a.isListening()).toBe(true);
    a.setVolume(0.5);
    expect(voice.volume).toBe(0.5);
  });

  it("uses mute/unmute fallbacks when setMuted is absent", () => {
    const mute = vi.fn();
    const unmute = vi.fn();
    const voice = mk({ mute, unmute });

    const a = buildDefaultAdapter(voice);
    a.setMuted(true);
    a.setMuted(false);

    expect(mute).toHaveBeenCalledTimes(1);
    expect(unmute).toHaveBeenCalledTimes(1);
  });

  it("handles missing members with safe defaults", () => {
    const voice = mk({});
    const a = buildDefaultAdapter(voice);
    expect(a.getMuted()).toBe(false);
    expect(a.getVolume()).toBe(1);
    expect(a.isListening()).toBe(false);
    // none of these should throw
    expect(() => a.setMuted(true)).not.toThrow();
    expect(() => a.setVolume(0.3)).not.toThrow();
    expect(() => a.startListening()).not.toThrow();
    expect(() => a.stopListening()).not.toThrow();
  });
});
