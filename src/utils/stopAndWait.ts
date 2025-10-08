type StopResult =
  | { reason: "end" }
  | { reason: "error"; error?: unknown }
  | { reason: "timeout" };

const stopTokens = new WeakMap<SpeechRecognition, number>();

interface StopOptions {
  timeoutMs?: number;
  mode?: "stop" | "abort+stop";
  signal?: AbortSignal; // optional external cancel
}

export function stopAndWaitGeneric(
  target: SpeechRecognition,
  opts: StopOptions = {}
): Promise<StopResult> {
  const { timeoutMs = 800, mode = "stop", signal } = opts;

  // Invalidate any previous wait for this target
  const token = (stopTokens.get(target) ?? 0) + 1;
  stopTokens.set(target, token);

  let settled = false;
  let timeoutId: number | undefined;

  return new Promise<StopResult>((resolve) => {
    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      target.removeEventListener("end", onend as EventListener);
      target.removeEventListener("error", onerror as EventListener);
      signal?.removeEventListener("abort", onabort);
    };

    const finish = (result: StopResult) => {
      // Ignore if a newer call superseded us
      if (stopTokens.get(target) !== token) return;
      cleanup();
      resolve(result);
    };

    const onend = () => finish({ reason: "end" });

    const onerror = (e: any) => {
      const err = e?.error ?? e;
      finish({ reason: "error", error: err });
    };

    const onabort = () => finish({ reason: "timeout" });

    target.addEventListener("end", onend as EventListener, { once: true });
    target.addEventListener("error", onerror as EventListener, {
      once: true,
    });

    if (signal) {
      if (signal.aborted) return finish({ reason: "timeout" });
      signal.addEventListener("abort", onabort, { once: true });
    }

    timeoutId = window.setTimeout(() => {
      // timeout treated like an external cancel
      if (stopTokens.get(target) !== token) return;
      finish({ reason: "timeout" });
    }, timeoutMs);

    // Call stop/abort after listeners are attached
    queueMicrotask(() => {
      try {
        if (mode === "abort+stop") {
          (target as any).abort?.(); // fast cancel
        }
      } catch (e) {
        // report as error but still invoke stop
        // Note: do not early-return; try stopping as well
      }
      try {
        (target as any).stop?.();
      } catch (e) {
        // Surface immediate failure if no events will ever fire
        finish({ reason: "error", error: e });
      }
    });
  });
}

// Convenience wrappers matching your originals
export const stopOnlyAndWait = (t: SpeechRecognition, timeoutMs = 800) =>
  stopAndWaitGeneric(t, { timeoutMs, mode: "stop" });

export const stopAndWait = (t: SpeechRecognition, timeoutMs = 800) =>
  stopAndWaitGeneric(t, { timeoutMs, mode: "abort+stop" });
