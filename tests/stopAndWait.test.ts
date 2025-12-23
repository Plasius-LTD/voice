import { describe, it, expect, vi, beforeEach } from "vitest";

class FakeSpeechRecognition extends EventTarget {
  stop = vi.fn();
  abort = vi.fn();
}

describe("stopAndWait utilities", () => {
  let stopOnlyAndWait: (t: SpeechRecognition, timeoutMs?: number) => Promise<any>;
  let stopAndWaitGeneric: (
    t: SpeechRecognition,
    opts?: any
  ) => Promise<any>;
  let stopAndWait: (t: SpeechRecognition, timeoutMs?: number) => Promise<any>;

  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await vi.importActual<typeof import("../src/utils/stopAndWait.js")>(
      "../src/utils/stopAndWait.js"
    );
    stopOnlyAndWait = mod.stopOnlyAndWait;
    stopAndWaitGeneric = mod.stopAndWaitGeneric;
    stopAndWait = mod.stopAndWait;
  });

  it("resolves when an end event arrives", async () => {
    const target = new FakeSpeechRecognition();
    const promise = stopOnlyAndWait(target as any, 500);

    target.dispatchEvent(new Event("end"));
    await expect(promise).resolves.toEqual({ reason: "end" });
    expect(target.stop).toHaveBeenCalled();
  });

  it("surfaces errors from the recognition target", async () => {
    const target = new FakeSpeechRecognition();
    const promise = stopAndWaitGeneric(target as any, { mode: "stop" });

    target.dispatchEvent(new Event("error"));
    await expect(promise).resolves.toMatchObject({ reason: "error" });
  });

  it("handles abort+stop mode and timeout", async () => {
    const target = new FakeSpeechRecognition();
    const promise = stopAndWait(target as any, 200);

    vi.runAllTimers();
    await expect(promise).resolves.toEqual({ reason: "timeout" });
    expect(target.abort).toHaveBeenCalled();
    expect(target.stop).toHaveBeenCalled();
  });
});
