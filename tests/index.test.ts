import { describe, it, expect, vi } from "vitest";
import * as index from "../src/index";

describe("index.ts exports", () => {
  it("should export expected members", () => {
    expect(index).toBeDefined();
    // Spot check a few known exports
    expect(typeof index.useVoice).toBe("function");
    expect(typeof index.VoiceProvider).toBe("function");
  });
});
