import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebSpeechEngine, type SRHandlers } from '../src/engine/webspeech';

// A controllable mock of the Web Speech API recognizer
class MockSR implements SpeechRecognition {
  // SpeechRecognition interface fields
  lang = '';
  continuous = false as any; // Chromium allows boolean but TS marks as readonly
  interimResults = false;

  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
  onerror: ((this: SpeechRecognition, ev: any) => any) | null = null;
  onresult: ((this: SpeechRecognition, ev: any) => any) | null = null;
  onnomatch: ((this: SpeechRecognition, ev: any) => any) | null = null;
  addEventListener: any;
  removeEventListener: any;
  dispatchEvent: any;

  // Control flags
  id: number;
  throwOnStart = false;
  silent = false;     // if true, do not emit any events after start()
  emitError: any = null; // if set, call onerror with this value
  script: Array<() => void> = []; // queued actions to invoke during start()

  // Spyable methods
  start = vi.fn(() => {
    if (this.throwOnStart) throw new Error('start-failure');
    if (this.silent) return; // watchdog should handle
    // Emit onstart → (optional) result → (optional) end
    this.onstart?.(new Event('start'));
    // run scripted actions (may push results/end)
    for (const step of this.script) step();
  });
  stop = vi.fn(() => {
    // When stop is called, emit onend by default
    this.onend?.(new Event('end'));
  });
  abort = vi.fn(() => {
    // Aborting also ends the session
    this.onend?.(new Event('end'));
  });

  constructor(id: number) {
    this.id = id;
  }
}

// Install a factory for window.SpeechRecognition / webkitSpeechRecognition
function installSRFactory(sequence: MockSR[]) {
  let idx = 0;
  const Ctor = vi.fn(() => {
    const inst = sequence[idx] ?? new MockSR(9999);
    idx = Math.min(idx + 1, sequence.length);
    return inst as unknown as SpeechRecognition;
  });
  (globalThis as any).SpeechRecognition = undefined;
  (globalThis as any).webkitSpeechRecognition = Ctor;
  return { Ctor };
}

// Utility to craft a Web Speech results event payload
function mkResults({ finalText = '', interimText = '' }: { finalText?: string; interimText?: string }) {
  const results: any[] = [];
  if (interimText) {
    results.push({ isFinal: false, 0: { transcript: interimText } });
  }
  if (finalText) {
    results.push({ isFinal: true, 0: { transcript: finalText } });
  }
  return { results };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  delete (globalThis as any).SpeechRecognition;
  delete (globalThis as any).webkitSpeechRecognition;
});

describe('createWebSpeechEngine', () => {
  it('returns null when no SR constructor is available', () => {
    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: true, continuous: false });
    expect(engine).toBeNull();
  });

  it('attaches handlers and uses provided lang/interim/continuous (with defaults)', () => {
    const a = new MockSR(1);
    installSRFactory([a]);

    const engine = createWebSpeechEngine({ lang: 'en-US', interim: true, continuous: true });
    expect(engine).not.toBeNull();

    const on = { onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() } satisfies SRHandlers;

    engine!.start(on);

    // Start should emit onstart via mock
    expect(on.onStart).toHaveBeenCalledTimes(1);
    // Engine should have configured recognizer properties
    expect(a.lang).toBe('en-US');
    expect(a.interimResults).toBe(true);
    expect((a as any).continuous).toBe(true);
  });

  it('falls back to navigator.language and then en-GB when lang is empty', () => {
    const a = new MockSR(1);
    const original = (globalThis as any).navigator?.language;
    (globalThis as any).navigator = { ...(globalThis as any).navigator, language: 'fr-FR' };
    installSRFactory([a]);

    const engine = createWebSpeechEngine({ lang: '' as any, interim: false, continuous: false });
    engine!.start({ onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });

    expect(a.lang).toBe('fr-FR');

    // Now remove navigator.language to hit hard default
    ;(globalThis as any).navigator = { ...(globalThis as any).navigator, language: undefined };
    const b = new MockSR(2);
    installSRFactory([b]);
    const engine2 = createWebSpeechEngine({ lang: '' as any, interim: false, continuous: false });
    engine2!.start({ onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });
    expect(b.lang).toBe('en-GB');

    // restore
    if (original) (globalThis as any).navigator.language = original;
  });

  it('emits partial and final texts via handlers from onresult', () => {
    const a = new MockSR(1);
    a.script.push(() => a.onresult?.(mkResults({ interimText: 'hello', finalText: 'world' })));
    installSRFactory([a]);

    const on = { onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() } satisfies SRHandlers;
    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: true, continuous: false });
    engine!.start(on);

    expect(on.onPartial).toHaveBeenCalledWith('hello');
    expect(on.onFinal).toHaveBeenCalledWith('world');
  });

  it('stop() calls underlying stop on the current recognizer and clears watchdog', () => {
    const a = new MockSR(1);
    a.silent = true; // do not emit onstart; ensure watchdog is armed
    installSRFactory([a]);

    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: false, continuous: false });
    engine!.start({ onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });

    engine!.stop();
    expect(a.stop).toHaveBeenCalledTimes(1);

    // advance time — if watchdog were still live, it would call abort/stop again
    vi.advanceTimersByTime(2000);
    expect(a.abort).toHaveBeenCalledTimes(0);
  });

  it('dispose() aborts and stops the recognizer and clears it', () => {
    const a = new MockSR(1);
    a.silent = true;
    installSRFactory([a]);

    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: false, continuous: false });
    engine!.start({ onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });

    engine!.dispose();
    expect(a.abort).toHaveBeenCalledTimes(1);
    expect(a.stop).toHaveBeenCalledTimes(1);

    // further stop calls should be safe
    expect(() => engine!.stop()).not.toThrow();
  });

  it('watchdog aborts a silent recognizer after ~1500ms', () => {
    const a = new MockSR(1);
    a.silent = true;
    installSRFactory([a]);

    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: false, continuous: false });
    engine!.start({ onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });

    // not yet
    vi.advanceTimersByTime(1400);
    expect(a.abort).toHaveBeenCalledTimes(0);
    // after 1500ms
    vi.advanceTimersByTime(200);
    expect(a.abort).toHaveBeenCalledTimes(1);
    expect(a.stop).toHaveBeenCalledTimes(1);
  });

  it('retries once if start() throws, creating a fresh recognizer', () => {
    const a = new MockSR(1);
    a.throwOnStart = true;
    const b = new MockSR(2);
    // On second instance, emit a final result
    b.script.push(() => b.onresult?.(mkResults({ finalText: 'ok' })));

    installSRFactory([a, b]);

    const on = { onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() } satisfies SRHandlers;
    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: false, continuous: false });
    engine!.start(on);

    // First instance threw → second should have been constructed and used
    expect(on.onStart).toHaveBeenCalledTimes(1);
    expect(on.onFinal).toHaveBeenCalledWith('ok');
    expect(a.start).toHaveBeenCalledTimes(1);
    expect(b.start).toHaveBeenCalledTimes(1);
  });

  it('starting a new session stops the previous recognizer before constructing a new one', () => {
    const first = new MockSR(1);
    const second = new MockSR(2);
    installSRFactory([first, second]);

    const engine = createWebSpeechEngine({ lang: 'en-GB', interim: false, continuous: false });
    const on: SRHandlers = { onStart: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() };

    engine!.start(on);
    expect(first.start).toHaveBeenCalledTimes(1);

    engine!.start(on);
    // First should have been asked to stop/abort when starting the second
    expect(first.abort).toHaveBeenCalledTimes(1);
    expect(first.stop).toHaveBeenCalledTimes(1);
    // And then second started
    expect(second.start).toHaveBeenCalledTimes(1);
  });
});
