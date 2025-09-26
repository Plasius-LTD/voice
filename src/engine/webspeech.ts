// Web Speech engine adapter — isolates browser quirks behind a tiny interface

export type SRHandlers = {
  onStart(): void;
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(err: unknown): void;
  onEnd(): void;
};

export type WebSpeechEngine = {
  start(h: SRHandlers): void;
  stop(): void;
  dispose(): void;
};

type SRCtor = new () => SpeechRecognition;

export function createWebSpeechEngine(opts: { lang: string; interim: boolean; continuous: boolean }): WebSpeechEngine | null {
  const SR = ((
    (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition
  ) as unknown) as SRCtor;

  if (!SR) return null;

  let rec: SpeechRecognition | null = null;
  let watchdog: number | null = null;

  const withCurrent = (fn: (r: SpeechRecognition) => void) => {
    const r = rec;
    if (!r) return;
    try { fn(r); } catch {}
  };

  const clearWatchdog = () => {
    if (watchdog != null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  const attach = (r: SpeechRecognition, h: SRHandlers) => {
    const lang = opts.lang || (navigator.language || 'en-GB');
    r.lang = lang;
    r.interimResults = !!opts.interim;
    (r as any).continuous = !!opts.continuous;

    r.onstart = () => {
      clearWatchdog();
      h.onStart();
    };
    r.onerror = (e: any) => {
      clearWatchdog();
      h.onError(e?.error ?? e ?? 'unknown');
    };
    r.onend = () => {
      clearWatchdog();
      h.onEnd();
    };
    r.onresult = (ev: any) => {
      let finalText = '';
      let interimText = '';
      const results: any = ev?.results ?? [];
      for (const res of results as any) {
        if (res && res.isFinal) finalText += res[0]?.transcript ?? '';
        else if (res) interimText += res[0]?.transcript ?? '';
      }
      if (interimText) h.onPartial(interimText);
      if (finalText) h.onFinal(finalText);
    };
  };

  return {
    start(h) {
      // Stop any previous instance *before* constructing a new one
      withCurrent((r) => { r.abort?.(); r.stop?.(); });

      rec = new SR();
      attach(rec as SpeechRecognition, h);

      // Watchdog for engines that never emit onstart/onerror/onend
      clearWatchdog();
      watchdog = globalThis.setTimeout(() => {
        withCurrent((r) => { r.abort?.(); r.stop?.(); });
      }, 1500);

      try {
        (rec as SpeechRecognition).start();
      } catch (e) {
        // Retry once with a fresh instance
        withCurrent((r) => r.abort?.());
        rec = new SR();
        attach(rec as SpeechRecognition, h);
        try { (rec as SpeechRecognition).start(); } catch {}
      }
    },
    stop() {
      clearWatchdog();
      withCurrent((r) => r.stop?.());
    },
    dispose() {
      clearWatchdog();
      withCurrent((r) => { r.abort?.(); r.stop?.(); });
      rec = null;
    },
  };
}
