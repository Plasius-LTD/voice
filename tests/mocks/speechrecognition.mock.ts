// tests/mocks/speechrecognition.mock.ts
import { vi } from "vitest";

// Stable, process-wide registries (persist across tests & re-imports)
const SR_INSTANCES_SYM = Symbol.for("__sr_instances__");
const SR_CONFIG_SYM = Symbol.for("__sr_config__");
const g: any = globalThis as any;
if (!g[SR_INSTANCES_SYM]) g[SR_INSTANCES_SYM] = [] as FakeSpeechRecognition[];


type Cfg = {
  autoEmitStart: boolean; // auto-call onstart on next microtask after start()
  autoEmitEndOnStop: boolean; // auto-call onend on next microtask after stop()/abort()
  throwIfDoubleStart: boolean; // mimic browsers throwing on start() when already started
};
const defaultCfg: Cfg = {
  autoEmitStart: false,
  autoEmitEndOnStop: false,
  throwIfDoubleStart: false,
};
if (!g[SR_CONFIG_SYM]) g[SR_CONFIG_SYM] = { ...defaultCfg } as Cfg;

/**
 * Minimal browser-like SR mock with lifecycle + state.
 * Defaults: manual control (tests call emitStart/emitEnd explicitly),
 * but you can enable autoEmit* for convenience.
 */

type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREventPayload = { results: SRResult[]; resultIndex?: number };

function getRegistry(): FakeSpeechRecognition[] {
  return (globalThis as any)[SR_INSTANCES_SYM] as FakeSpeechRecognition[];
}
function getCfg(): Cfg {
  return (globalThis as any)[SR_CONFIG_SYM] as Cfg;
}

export class FakeSpeechRecognition {
  // public SR shape
  lang = "en-GB";
  interimResults = false;
  continuous = false;

  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: any) => void;
  onresult?: (ev: any) => void;

  // test diagnostics
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;

  // internal state
  private _started = false;
  private _ended = false;
  // timers (so we can cancel if tests interleave)
  private _startTimer: number | null = null;
  private _endTimer: number | null = null;

  start() {
    this.startCalls++;
    if (this._started && getCfg().throwIfDoubleStart) {
      throw Object.assign(new Error("InvalidStateError"), { name: "InvalidStateError" });
    }
    this._started = true;
    this._ended = false;

    if (getCfg().autoEmitStart) {
      // next microtask → onstart
      this._startTimer = queueMicrotask(() => {
        this._startTimer = null as any;
        this.onstart?.();
      }) as unknown as number;
    }
  }

  stop() {
    this.stopCalls++;
    if (getCfg().autoEmitEndOnStop) {
      this._scheduleEnd();
    }
  }

  abort() {
    this.abortCalls++;
    if (getCfg().autoEmitEndOnStop) {
      this._scheduleEnd();
    }
  }

  private _scheduleEnd() {
    if (this._endTimer != null) return;
    this._endTimer = queueMicrotask(() => {
      this._endTimer = null as any;
      this._started = false;
      this._ended = true;
      this.onend?.();
    }) as unknown as number;
  }

  /** Manual emitters (tests call these for precise control) */
  emitStart() {
    this._started = true;
    this._ended = false;
    this.onstart?.();
  }
  emitEnd() {
    this._started = false;
    this._ended = true;
    this.onend?.();
  }
  emitError(error: string | { error: string }) {
    const payload = typeof error === "string" ? { error } : error;
    this.onerror?.(payload);
  }
  emitResult(evt: SREventPayload) {
    this.onresult?.(evt as any);
  }
}

export function _getSRInstances() {
  return getRegistry().slice();
}
export function _clearSRInstances() {
  const reg = getRegistry();
  reg.length = 0;
}

/** Test-time config toggles */
export function _setSRMockConfig(partial: Partial<Cfg>) {
  const cfg = getCfg();
  Object.assign(cfg, partial);
}

/** Install the constructor onto globalThis */
export function installSpeechRecognitionMock() {
  // If a mock is already installed, keep using it (idempotent)
  const existing =
    (globalThis as any).SpeechRecognition ??
    (globalThis as any).webkitSpeechRecognition;
  if (typeof existing === "function" && (existing as any).__isSRMock) {
    (globalThis as any).SpeechRecognition = existing;
    (globalThis as any).webkitSpeechRecognition = existing;
    return;
  }

  class SRMock extends FakeSpeechRecognition {
    static __isSRMock = true;
    constructor() {
      super();
      getRegistry().push(this);
    }
  }
  // mark for detection if code grabs the constructor directly
  (SRMock as any).__isSRMock = true;

  (globalThis as any).SpeechRecognition = SRMock as unknown as any;
  (globalThis as any).webkitSpeechRecognition = SRMock as unknown as any;
}