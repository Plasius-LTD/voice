// useVoice.ts — slim adapter: initialize engine, expose status, and process intents
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@plasius/nfr";
import { useWebSpeechEngine } from "../engine/useWebSpeechEngine.js";
import {
  globalVoiceStore,
  type GlobalVoiceState,
  type GlobalVoiceStore,
} from "../stores/global.store.js";

// ──────────────────────────────────────────────────────────────────────────────
// Public options & return type
// ──────────────────────────────────────────────────────────────────────────────
export type VoiceIntentOpts = {
  origin?: string;
  lang?: string; // e.g. "en-GB"
  interim?: boolean; // partial transcripts
  continuous?: boolean; // keep listening until stopped (optional)
  redact?: (t: string) => string; // optional PII redaction
  activate?: (
    intent: string,
    meta: {
      sessionId: string;
      origin?: string;
      lang?: string;
      params?: Record<string, unknown>;
    }
  ) =>
    | Promise<"success" | "no-match" | boolean>
    | "success"
    | "no-match"
    | boolean;
};

export type VoiceIntentView = {
  permission: "granted" | "denied" | "prompt" | "unsupported";
  sessionId: string | null; // local session id for current/last recognition session
  lang: string;
  partial?: string;
  transcript?: string;
  error?: string;
  registerVoiceIntents: (origin: string, intents: RegisteredIntent[]) => void;
  unregisterVoiceIntents: (origin: string, names?: string[]) => void;
  registerGlobalIntents: (intents: RegisteredIntent[]) => void;
  getRegisteredIntentNames: (origin?: string) => string[];
  subscribe?: GlobalVoiceStore["subscribe"];
  subscribeToKey?: GlobalVoiceStore["subscribeToKey"];
  getState?: () => GlobalVoiceState;
};

// ──────────────────────────────────────────────────────────────────────────────
// Intent registry (in-memory; serializable names surfaced for debug)
// ──────────────────────────────────────────────────────────────────────────────
export type IntentActivationResult = "success" | "no-match" | boolean;
export type IntentMeta = {
  sessionId: string;
  origin?: string;
  lang?: string;
  params?: Record<string, unknown>;
};
export type IntentHandler = (
  meta: IntentMeta
) => Promise<IntentActivationResult> | IntentActivationResult;
export type RegisteredIntent = {
  name: string;
  patterns?: (string | RegExp)[];
  handler: IntentHandler;
};

// Keyed by origin ("*" = global)
const intentRegistry: Map<string, RegisteredIntent[]> = new Map();

function registerVoiceIntents(
  origin: string,
  intents: RegisteredIntent[]
): void {
  const existing = intentRegistry.get(origin) || [];
  const byName = new Map<string, RegisteredIntent>(
    existing.map((i) => [i.name, i])
  );
  for (const i of intents) byName.set(i.name, i);
  intentRegistry.set(origin, Array.from(byName.values()));
}

function unregisterVoiceIntents(origin: string, names?: string[]): void {
  const existing = intentRegistry.get(origin) || [];
  if (!names || names.length === 0) {
    intentRegistry.set(origin, []);
    return;
  }
  const nameSet = new Set(names);
  intentRegistry.set(
    origin,
    existing.filter((i) => !nameSet.has(i.name))
  );
}

function registerGlobalIntents(intents: RegisteredIntent[]): void {
  registerVoiceIntents("*", intents);
}

export function getRegisteredIntentNames(origin?: string): string[] {
  const names = new Set<string>();
  if (origin && intentRegistry.get(origin))
    intentRegistry.get(origin)!.forEach((i) => names.add(i.name));
  if (intentRegistry.get("*"))
    intentRegistry.get("*")!.forEach((i) => names.add(i.name));
  return Array.from(names);
}

// ──────────────────────────────────────────────────────────────────────────────
// Slim hook: wires engine ↔ intents, exposes engine status
// ──────────────────────────────────────────────────────────────────────────────
export function useVoiceIntents(opts: VoiceIntentOpts = {}): VoiceIntentView {
  const {
    origin,
    lang = "en-GB",
    interim = true,
    continuous = false,
    redact,
    activate,
  } = opts;

  const engineRef = useRef<ReturnType<typeof useWebSpeechEngine> | null>(null);
  const prevFinalRef = useRef<string>("");
  const localSessionRef = useRef<{ sessionId: string | null; lastListening: boolean }>({
    sessionId: null,
    lastListening: false,
  });

  // Initial view state from global store
  const [view, setView] = useState<VoiceIntentView>(() => {
    const s0 = globalVoiceStore.getState();
    return {
      permission: s0.permission,
      sessionId: localSessionRef.current?.sessionId ?? null,
      lang: lang,
      partial: s0.partial,
      transcript: s0.transcript,
      error: s0.lastError,
      registerVoiceIntents,
      unregisterVoiceIntents,
      registerGlobalIntents,
      getRegisteredIntentNames,
      subscribe: globalVoiceStore.subscribe,
      subscribeToKey: globalVoiceStore.subscribeToKey,
      getState: globalVoiceStore.getState,
    };
  });

  // (Re)create engine when options change, bind to global store
  useEffect(() => {
    // Dispose any existing engine instance
    engineRef.current?.dispose?.();
    // Create engine bound to the shared global store
    const engine = useWebSpeechEngine({ lang, interim, continuous });
    engineRef.current = engine;

    // Initialize view from the current global state
    setView((v) => ({
      ...v,
      permission: globalVoiceStore.getState().permission,
      sessionId: localSessionRef.current.sessionId,
      lang,
      partial: globalVoiceStore.getState().partial,
      transcript: globalVoiceStore.getState().transcript,
      error: globalVoiceStore.getState().lastError,
      subscribe: globalVoiceStore.subscribe,
      subscribeToKey: globalVoiceStore.subscribeToKey,
      getState: globalVoiceStore.getState,
    }));

    // Subscribe to global store updates to keep view in sync
    const unsub = globalVoiceStore.subscribe(() => {
      const s = globalVoiceStore.getState();
      setView((v) => ({
        ...v,
        permission: s.permission,
        sessionId: localSessionRef.current.sessionId,
        lang: s.lang,
        partial: s.partial,
        transcript: s.transcript,
        error: s.lastError,
        subscribe: globalVoiceStore.subscribe,
        subscribeToKey: globalVoiceStore.subscribeToKey,
        getState: globalVoiceStore.getState,
      }));

      // Detect listening start/stop transitions to manage a local session id
      const listening = s.listening === true;
      if (listening && !localSessionRef.current.lastListening) {
        // transitioned to listening → start a new local session
        localSessionRef.current.sessionId = crypto.randomUUID();
      }
      if (!listening && localSessionRef.current.lastListening) {
        // transitioned to not listening → close session
        // (keep the last sessionId until next start, helps with final flush)
      }
      localSessionRef.current.lastListening = listening;

      // Process new final transcripts → intents/activation/telemetry
      if (s.transcript && s.transcript !== prevFinalRef.current) {
        prevFinalRef.current = s.transcript;
        const text = redact ? redact(s.transcript) : s.transcript;
        const inferred = inferIntent(text, origin);
        track("ui.voice", {
          phase: "final",
          origin,
          sessionId: localSessionRef.current.sessionId,
          transcript: text,
        });
        track("ui.voice", {
          phase: "intent",
          origin,
          sessionId: localSessionRef.current.sessionId,
          intent: inferred.name,
          params: inferred.params,
        });

        const runRegistered = () => {
          const lists = [
            origin ? intentRegistry.get(origin) : undefined,
            intentRegistry.get("*"),
          ].filter(Boolean) as RegisteredIntent[][];
          for (const list of lists) {
            const match = list.find((i) => i.name === inferred.name)?.handler;
            if (match)
              return match({
                sessionId: localSessionRef.current.sessionId!,
                origin,
                lang: s.lang,
                params: inferred.params,
              });
          }
          return undefined;
        };
        const maybeFromRegistry = runRegistered();
        const maybe =
          maybeFromRegistry !== undefined
            ? maybeFromRegistry
            : typeof activate === "function"
              ? activate(inferred.name, {
                  sessionId: localSessionRef.current.sessionId!,
                  origin,
                  lang: s.lang,
                  params: inferred.params,
                })
              : undefined;

        Promise.resolve(maybe)
          .then((res) => {
            const activationResult =
              res === "no-match" || res === false ? "no-match" : "success";
            track("ui.voice", {
              phase: "activate",
              origin,
              sessionId: localSessionRef.current.sessionId,
              intent: inferred.name,
              activationResult,
              params: inferred.params,
            });
            if (!continuous) engine.stop();
          })
          .catch((err) => {
            track("ui.voice", {
              phase: "error",
              origin,
              sessionId: localSessionRef.current.sessionId,
              error: String(err),
            });
          });
      }
    });

    return () => {
      unsub();
      engine.dispose();
      engineRef.current = null;
    };
  }, [lang, interim, continuous, origin, redact, activate]);

  // Auto-start on mount (if supported)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    track("ui.voice", { phase: "start", origin, lang });
    prevFinalRef.current = globalVoiceStore.getState().transcript || "";
    // Generate a fresh local session id when we explicitly start
    localSessionRef.current.sessionId = crypto.randomUUID();
    engine.start();
    return () => {
      engineRef.current?.stop();
    };
  }, [origin, lang]);

  return view;
}

// ──────────────────────────────────────────────────────────────────────────────
// Intent inference (kept local to this adapter)
// ──────────────────────────────────────────────────────────────────────────────
function resolveRegisteredIntent(
  text: string,
  origin?: string
): { name: string; params?: Record<string, unknown> } | null {
  const hay = text.toLowerCase();
  const testList = (list?: RegisteredIntent[]) => {
    if (!list) return null;
    for (const i of list) {
      if (!i.patterns || i.patterns.length === 0) continue;
      for (const p of i.patterns) {
        if (typeof p === "string") {
          const re = new RegExp(
            `\\b${p.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&").replace(/\\s+/g, "\\s+")}\\b`,
            "i"
          );
          if (re.test(hay)) return { name: i.name };
        } else if (p.test(hay)) {
          return { name: i.name };
        }
      }
    }
    return null;
  };
  return (
    testList(intentRegistry.get(origin || "")) ||
    testList(intentRegistry.get("*")) ||
    null
  );
}

function inferIntent(
  text: string,
  origin?: string
): { name: string; params?: Record<string, unknown> } {
  return resolveRegisteredIntent(text, origin) ?? defaultInferIntent(text);
}

function defaultInferIntent(text: string): {
  name: string;
  params?: Record<string, unknown>;
} {
  const t = text.toLowerCase().trim();

  const NUMBER_WORDS: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    twentyone: 21,
    twentytwo: 22,
    twentythree: 23,
    twentyfour: 24,
    twentyfive: 25,
    twentysix: 26,
    twentyseven: 27,
    twentyeight: 28,
    twentynine: 29,
    thirty: 30,
    thirtyone: 31,
    thirtytwo: 32,
    thirtythree: 33,
    thirtyfour: 34,
    thirtyfive: 35,
    thirtysix: 36,
    thirtyseven: 37,
    thirtyeight: 38,
    thirtynine: 39,
    forty: 40,
    fortyone: 41,
    fortytwo: 42,
    fortythree: 43,
    fortyfour: 44,
    fortyfive: 45,
    fortysix: 46,
    fortyseven: 47,
    fortyeight: 48,
    fortynine: 49,
    fifty: 50,
    fiftyone: 51,
    fiftytwo: 52,
    fiftythree: 53,
    fiftyfour: 54,
    fiftyfive: 55,
    fiftysix: 56,
    fiftyseven: 57,
    fiftyeight: 58,
    fiftynine: 59,
    sixty: 60,
    sixtyone: 61,
    sixtytwo: 62,
    sixtythree: 63,
    sixtyfour: 64,
    sixtyfive: 65,
    sixtysix: 66,
    sixtyseven: 67,
    sixtyeight: 68,
    sixtynine: 69,
    seventy: 70,
    seventyone: 71,
    seventytwo: 72,
    seventythree: 73,
    seventyfour: 74,
    seventyfive: 75,
    seventysix: 76,
    seventyseven: 77,
    seventyeight: 78,
    seventynine: 79,
    eighty: 80,
    eightyone: 81,
    eightytwo: 82,
    eightythree: 83,
    eightyfour: 84,
    eightyfive: 85,
    eightysix: 86,
    eightyseven: 87,
    eightyeight: 88,
    eightynine: 89,
    ninety: 90,
    ninetyone: 91,
    ninetytwo: 92,
    ninetythree: 93,
    ninetyfour: 94,
    ninetyfive: 95,
    ninetysix: 96,
    ninetyseven: 97,
    ninetyeight: 98,
    ninetynine: 99,
    onehundred: 100,
  };
  function parseQuantity(text: string): number | undefined {
    const mNum = text.match(/\b(\d+)\b/);
    if (mNum) return parseInt(mNum?.[1] ?? "", 10);
    const mWord = text.match(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twentyone|twentytwo|twentythree|twentyfour|twentyfive|twentysix|twentyseven|twentyeight|twentynine | thirty | thirtyone | thirtytwo | thirtythree | thirtyfour | thirtyfive | thirtysix | thirtyseven | thirtyeight | thirtynine | forty | fortyone | fortytwo | fortythree | fortyfour | fortyfive |fortysix | fortyseven | fortyeight | fortynine | fifty | fiftyone | fiftytwo | fiftythree | fiftyfour | fiftyfive | fiftysix | fiftyseven | fiftyeight | fiftynine | sixty | sixtyone | sixtytwo | sixtythree | sixtyfour | sixtyfive | sixtysix | sixtyseven | sixtyeight | sixtynine | seventy | seventyone | seventytwo | seventythree | seventyfour | seventyfive | seventysix | seventyseven | seventyeight | seventynine | eighty | eightyone | eightytwo | eightythree | eightyfour | eightyfive | eightysix | eightyseven | eightyeight | eightynine | ninety | ninetyone | ninetytwo | ninetythree | ninetyfour | ninetyfive | ninetysix | ninetyseven | ninetyeight | ninetynine | onehundred) \b/i
    );
    if (mWord) return NUMBER_WORDS[(mWord?.[1] ?? "").toLowerCase()];
  }
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phrase = (p: string) =>
    new RegExp(`\\b${escapeRegex(p).replace(/\\s+/g, "\\s+")}\\b`, "i");
  const hasAny = (hay: string, needles: string[]) =>
    needles.some((n) => phrase(n).test(hay));

  const search = [
    "search",
    "search for",
    "find",
    "find me",
    "look for",
    "look up",
    "lookup",
    "seek",
    "query",
    "filter",
    "where is",
    "what is",
    "show me",
    "google",
    "bing",
  ];
  const closeMenu = [
    "close menu",
    "hide menu",
    "dismiss menu",
    "collapse menu",
    "shut menu",
  ];
  const openMenu = [
    "open menu",
    "show menu",
    "menu",
    "navigation",
    "nav menu",
    "hamburger",
    "main menu",
    "toggle menu",
  ];
  const openSettings = [
    "settings",
    "preferences",
    "options",
    "config",
    "configuration",
    "setup",
  ];
  const openProfile = [
    "profile",
    "my profile",
    "account",
    "my account",
    "user settings",
  ];
  const openHelp = [
    "help",
    "support",
    "assist",
    "assistance",
    "instructions",
    "documentation",
    "docs",
  ];
  const navBack = ["go back", "back", "previous", "prev", "backward"];
  const navNext = ["next", "forward", "continue", "proceed", "go on"];
  const navHome = ["home", "go home", "dashboard", "main screen", "start page"];
  const refresh = [
    "refresh",
    "reload",
    "update page",
    "hard refresh",
    "hard reload",
  ];
  const cartOpen = ["cart", "basket", "shopping cart"];
  const checkout = ["checkout", "buy", "purchase", "pay", "place order"];
  const saveForLater = [
    "save for later",
    "wishlist",
    "add to wishlist",
    "later",
    "remember this",
    "save item",
    "save it",
    "add to favorites",
    "favorite",
    "favourite",
    "bookmark",
    "add to bookmarks",
  ];
  const removeFromCart = [
    "remove from cart",
    "delete from cart",
    "discard item",
    "drop item",
    "take out of cart",
    "take out",
    "clear from cart",
  ];
  const findPrefixes = [
    "find",
    "find me",
    "look for",
    "look up",
    "show me",
    "search for",
  ];
  const cartAdd = [
    "add to cart",
    "add to basket",
    "add to bag",
    "put in cart",
    "put in basket",
    "add this",
    "add item",
    "add it",
    "get this",
    "get it",
    "buy this",
    "order this",
  ];
  const buyNow = [
    "buy now",
    "purchase now",
    "order now",
    "checkout now",
    "instant buy",
    "one click buy",
  ];
  const cartIncrease = [
    "add one",
    "one more",
    "increase quantity",
    "increase amount",
    "add another",
    "add more",
  ];
  const cartDecrease = [
    "remove one",
    "one less",
    "decrease quantity",
    "decrease amount",
    "take one out",
    "take one away",
  ];
  const saveFile = [
    "save",
    "save now",
    "store",
    "persist",
    "write",
    "commit",
    "apply changes",
    "save changes",
  ];

  if (hasAny(text, search)) return { name: "search.query" };
  if (hasAny(text, closeMenu)) return { name: "close.menu" };
  if (hasAny(text, openMenu)) return { name: "open.menu" };

  if (hasAny(text, openSettings)) return { name: "open.settings" };
  if (hasAny(text, openProfile)) return { name: "open.profile" };
  if (hasAny(text, openHelp)) return { name: "open.help" };

  if (hasAny(text, navBack)) return { name: "nav.back" };
  if (hasAny(text, navNext)) return { name: "nav.next" };
  if (hasAny(text, navHome)) return { name: "nav.home" };
  if (hasAny(text, refresh)) return { name: "app.refresh" };

  if (
    hasAny(text, findPrefixes) &&
    /\b(add to (cart|basket|bag)|put in (cart|basket)|buy|order)\b/.test(text)
  ) {
    return { name: "find.addToCart", params: {} };
  }
  if (hasAny(text, cartAdd))
    return { name: "cart.addItem", params: { qty: parseQuantity(text) ?? 1 } };
  if (hasAny(text, buyNow)) return { name: "cart.buyNow" };
  if (hasAny(text, cartIncrease))
    return {
      name: "cart.incrementItem",
      params: { qty: parseQuantity(text) ?? 1 },
    };
  if (hasAny(text, cartDecrease))
    return {
      name: "cart.decrementItem",
      params: { qty: parseQuantity(text) ?? 1 },
    };
  if (hasAny(text, saveForLater)) return { name: "cart.saveForLater" };
  if (hasAny(text, removeFromCart)) return { name: "cart.removeItem" };
  if (hasAny(text, checkout)) return { name: "cart.checkout" };
  if (hasAny(text, cartOpen)) return { name: "cart.open" };

  if (hasAny(text, saveFile)) return { name: "save.file" };

  return { name: "no.intent" };
}
