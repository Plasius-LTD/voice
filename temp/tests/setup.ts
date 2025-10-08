// test/setup.ts
import { vi } from "vitest";

export class FakeSR {
  lang = "en-GB";
  interimResults = false;
  continuous = false;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: any) => void;
  onresult?: (ev: any) => void;
  startCalls = 0;
  stopCalls = 0;

  start() {
    this.startCalls++; /* optionally auto-emit start */
  }
  stop() {
    this.stopCalls++;
    this.onend?.();
  }
  abort() {
    /* no-op or call onend */
  }

  emitStart() {
    this.onstart?.();
  }
  emitEnd() {
    this.onend?.();
  }
  emitError(error: string | { error: string }) {
    const e = typeof error === "string" ? { error } : error;
    this.onerror?.(e);
  }
  emitResult(payload: { results: any[]; resultIndex?: number }) {
    this.onresult?.(payload as any);
  }
}

export function installGlobals() {
  (globalThis as any).SpeechRecognition = FakeSR;
  (globalThis as any).webkitSpeechRecognition = FakeSR;

  const listeners = new Set<(...a: any[]) => void>();
  (globalThis as any).navigator = {
    mediaDevices: {
      addEventListener: (_: string, cb: any) => listeners.add(cb),
      removeEventListener: (_: string, cb: any) => listeners.delete(cb),
      get ondevicechange() {
        return undefined;
      },
      set ondevicechange(cb: any) {
        // support legacy setter by syncing with add/remove if you need
        if (cb) listeners.add(cb);
        else listeners.clear();
      },
      enumerateDevices: vi.fn().mockResolvedValue([]),
      _emitDeviceChange() {
        for (const cb of listeners) cb();
      },
    },
    permissions: {
      query: vi.fn().mockResolvedValue({ state: "granted" }),
    },
    language: "en-GB",
  };

  (globalThis as any).performance = {
    now: vi.fn().mockImplementation(() => Date.now()),
  };
  (globalThis as any).crypto = {
    randomUUID: vi.fn().mockReturnValue("uuid-1"),
  };
}
