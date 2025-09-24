// useVoice.ts
import { useEffect, useRef, useState } from "react";
import { track } from "@plasius/nfr";
import { createStore } from "@plasius/react-state";

type VoiceOpts = {
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

type VoiceState = {
  listening: boolean;
  transcript: string;
  partial: string;
  error?: string;
  sessionId: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// React-State integration: slice types, initial state, actions, reducer
// ──────────────────────────────────────────────────────────────────────────────
export type VoiceSessionStatus = "idle" | "listening" | "ended" | "error";

export type VoiceSession = {
  id: string;
  origin?: string;
  lang: string;
  status: VoiceSessionStatus;
  transcript: string;
  partial: string;
  intent?: string;
  activationResult?: "success" | "no-match";
  error?: string;
  startedAt?: number;
  latencyMs?: number;
  lastParams?: Record<string, unknown>;
};

export type VoiceSliceState = {
  bySession: Record<string, VoiceSession>;
  currentSessionId?: string;
  registered: Record<string, string[]>; // origin -> intent names (debug/visibility only)
};

export const voiceInitialState: VoiceSliceState = {
  bySession: {},
  currentSessionId: undefined,
  registered: {},
};

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

// In-memory registry keyed by origin ("*" is global). Functions are kept outside state for serializability.
const intentRegistry: Map<string, RegisteredIntent[]> = new Map();

// Action types
export type VoiceAction =
  | {
      type: "VOICE/START";
      payload: {
        sessionId: string;
        origin?: string;
        lang: string;
        startedAt: number;
      };
    }
  | { type: "VOICE/PARTIAL"; payload: { sessionId: string; partial: string } }
  | {
      type: "VOICE/FINAL";
      payload: { sessionId: string; transcript: string; latencyMs: number };
    }
  | {
      type: "VOICE/INTENT";
      payload: {
        sessionId: string;
        intent: string;
        params?: Record<string, unknown>;
      };
    }
  | {
      type: "VOICE/ACTIVATE";
      payload: {
        sessionId: string;
        intent: string;
        activationResult: "success" | "no-match";
      };
    }
  | { type: "VOICE/ERROR"; payload: { sessionId: string; error: string } }
  | { type: "VOICE/REGISTER_INTENTS"; payload: { origin: string; names: string[] } }
  | { type: "VOICE/UNREGISTER_INTENTS"; payload: { origin: string; names?: string[] } }
  | { type: "VOICE/SET_ORIGIN"; payload: { sessionId: string; origin?: string } }
  | { type: "VOICE/END"; payload: { sessionId: string; latencyMs: number } };

// Action creators (optional helpers)
export const voiceActions = {
  start: (p: VoiceAction & { type: "VOICE/START" }) => p,
  partial: (p: VoiceAction & { type: "VOICE/PARTIAL" }) => p,
  final: (p: VoiceAction & { type: "VOICE/FINAL" }) => p,
  intent: (p: VoiceAction & { type: "VOICE/INTENT" }) => p,
  activate: (p: VoiceAction & { type: "VOICE/ACTIVATE" }) => p,
  error: (p: VoiceAction & { type: "VOICE/ERROR" }) => p,
  end: (p: VoiceAction & { type: "VOICE/END" }) => p,
  registerIntents: (p: VoiceAction & { type: "VOICE/REGISTER_INTENTS" }) => p,
  unregisterIntents: (p: VoiceAction & { type: "VOICE/UNREGISTER_INTENTS" }) => p,
  setOrigin: (p: VoiceAction & { type: "VOICE/SET_ORIGIN" }) => p
};

export function voiceReducer(
  state: VoiceSliceState = voiceInitialState,
  action: VoiceAction
): VoiceSliceState {
  switch (action.type) {
    case "VOICE/START": {
      const { sessionId, origin, lang, startedAt } = action.payload;
      return {
        ...state,
        currentSessionId: sessionId,
        bySession: {
          ...state.bySession,
          [sessionId]: {
            id: sessionId,
            origin,
            lang,
            status: "listening",
            transcript: "",
            partial: "",
            startedAt,
          },
        },
      };
    }
    case "VOICE/PARTIAL": {
      const { sessionId, partial } = action.payload;
      const s = state.bySession[sessionId];
      if (!s) return state;
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: { ...s, partial },
        },
      };
    }
    case "VOICE/FINAL": {
      const { sessionId, transcript, latencyMs } = action.payload;
      const s = state.bySession[sessionId];
      if (!s) return state;
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: { ...s, transcript, partial: "", latencyMs },
        },
      };
    }
    case "VOICE/INTENT": {
      const { sessionId, intent, params } = action.payload;
      const s = state.bySession[sessionId];
      if (!s) return state;
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...s,
            intent,
            ...(params ? { lastParams: params } : {}),
          },
        },
      };
    }
    case "VOICE/ACTIVATE": {
      const { sessionId, intent, activationResult } = action.payload;
      const s = state.bySession[sessionId];
      if (!s) return state;
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: { ...s, intent, activationResult },
        },
      };
    }
    case "VOICE/ERROR": {
      const { sessionId, error } = action.payload;
      const s = state.bySession[sessionId];
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: s
            ? { ...s, status: "error", error }
            : {
                id: sessionId,
                status: "error",
                lang: "",
                transcript: "",
                partial: "",
                error,
              },
        },
      };
    }
    case "VOICE/SET_ORIGIN": {
      const { sessionId, origin } = action.payload;
      const s = state.bySession[sessionId];
      if (!s) return state;
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: { ...s, origin },
        },
      };
    }
    case "VOICE/REGISTER_INTENTS": {
      const { origin, names } = action.payload;
      const current = state.registered[origin] || [];
      const next = Array.from(new Set([...current, ...names]));
      return { ...state, registered: { ...state.registered, [origin]: next } };
    }
    case "VOICE/UNREGISTER_INTENTS": {
      const { origin, names } = action.payload;
      if (!state.registered[origin]) return state;
      const next = !names || names.length === 0
        ? []
        : (state.registered[origin] || []).filter((n) => !names.includes(n));
      return { ...state, registered: { ...state.registered, [origin]: next } };
    }
    case "VOICE/END": {
      const { sessionId, latencyMs } = action.payload;
      const s = state.bySession[sessionId];
      if (!s) return state;
      return {
        ...state,
        bySession: {
          ...state.bySession,
          [sessionId]: { ...s, status: "ended", latencyMs },
        },
      };
    }
    default:
      return state;
  }
}

const store = createStore<VoiceSliceState, VoiceAction>(
  voiceReducer,
  voiceInitialState
);

/** Pages (VM) call this on mount to register their available intents/handlers. */
export function registerVoiceIntents(origin: string, intents: RegisteredIntent[]): void {
  const existing = intentRegistry.get(origin) || [];
  const byName = new Map<string, RegisteredIntent>(existing.map(i => [i.name, i]));
  for (const i of intents) byName.set(i.name, i);
  const updated = Array.from(byName.values());
  intentRegistry.set(origin, updated);
  store?.dispatch(
    voiceActions.registerIntents({
      type: "VOICE/REGISTER_INTENTS",
      payload: { origin, names: updated.map(i => i.name) },
    })
  );
}

/** Pages (VM) call this on unmount; omit names to remove all for origin. */
export function unregisterVoiceIntents(origin: string, names?: string[]): void {
  const existing = intentRegistry.get(origin) || [];
  let updated: RegisteredIntent[];
  if (!names || names.length === 0) {
    updated = [];
  } else {
    const nameSet = new Set(names);
    updated = existing.filter(i => !nameSet.has(i.name));
  }
  intentRegistry.set(origin, updated);
  store?.dispatch(
    voiceActions.unregisterIntents({
      type: "VOICE/UNREGISTER_INTENTS",
      payload: { origin, names },
    })
  );
}

/** Register intents globally available everywhere. */
export function registerGlobalIntents(intents: RegisteredIntent[]): void {
  registerVoiceIntents("*", intents);
}

/** Debug/telemetry helper to view available intents. */
export function getRegisteredIntentNames(origin?: string): string[] {
  const names = new Set<string>();
  if (origin && intentRegistry.get(origin)) intentRegistry.get(origin)!.forEach(i => names.add(i.name));
  if (intentRegistry.get("*")) intentRegistry.get("*")!.forEach(i => names.add(i.name));
  return Array.from(names);
}

export function useVoice(
  opts: VoiceOpts = {}
) {
  const {
    origin,
    lang = "en-GB",
    interim = true,
    continuous = false,
    redact,
    activate,
  } = opts;
  const [state, setState] = useState<VoiceState>({
    listening: false,
    transcript: "",
    partial: "",
    sessionId: crypto.randomUUID(),
  });

  const recRef = useRef<SpeechRecognition | null>(null);
  const startedAt = useRef<number>(0);
  const dispatch = store?.dispatch;
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec: SpeechRecognition = new SR();
    rec.lang = lang;
    rec.interimResults = interim;
    rec.continuous = continuous;

    rec.onstart = () => {
      startedAt.current = performance.now();
      let newSessionId = "";
      setState((s) => {
        newSessionId = crypto.randomUUID();
        return {
          ...s,
          listening: true,
          partial: "",
          transcript: "",
          error: undefined,
          sessionId: newSessionId,
        };
      });
      store?.dispatch(
        voiceActions.start({
          type: "VOICE/START",
          payload: {
            sessionId: newSessionId,
            origin,
            lang,
            startedAt: startedAt.current,
          },
        })
      );
      track("ui.voice", {
        phase: "start",
        origin,
        sessionId: newSessionId,
        lang,
      });
    };

    rec.onresult = (ev) => {
      let finalText = "";
      let interimText = "";
      for (const res of ev.results as any) {
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (interim && interimText) {
        const text = redact ? redact(interimText) : interimText;
        setState((s) => ({ ...s, partial: text }));
        dispatch(
          voiceActions.partial({
            type: "VOICE/PARTIAL",
            payload: { sessionId: state.sessionId, partial: text },
          })
        );
        track("ui.voice", {
          phase: "partial",
          origin,
          sessionId: state.sessionId,
          transcript: text,
        });
      }
      if (finalText) {
        const text = redact ? redact(finalText) : finalText;
        const latencyMs = Math.round(performance.now() - startedAt.current);
        setState((s) => ({ ...s, transcript: text, partial: "" }));
        dispatch(
          voiceActions.final({
            type: "VOICE/FINAL",
            payload: {
              sessionId: state.sessionId,
              transcript: text,
              latencyMs,
            },
          })
        );
        track("ui.voice", {
          phase: "final",
          origin,
          sessionId: state.sessionId,
          transcript: text,
          latencyMs,
        });
        // Intent mapping (very basic rule demo)
        const inferred = inferIntent(text, origin);
        dispatch(
          voiceActions.intent({
            type: "VOICE/INTENT",
            payload: {
              sessionId: state.sessionId,
              intent: inferred.name,
              params: inferred.params,
            },
          })
        );
        track("ui.voice", {
          phase: "intent",
          origin,
          sessionId: state.sessionId,
          intent: inferred.name,
          params: inferred.params,
        });
        // Try a registered handler first (origin > global), else fall back to `activate` prop
        const runRegistered = () => {
          const lists = [
            origin ? intentRegistry.get(origin) : undefined,
            intentRegistry.get("*"),
          ].filter(Boolean) as RegisteredIntent[][];
          for (const list of lists) {
            const match = list.find(i => i.name === inferred.name)?.handler;
            if (match) {
              return match({
                sessionId: state.sessionId,
                origin,
                lang,
                params: inferred.params,
              });
            }
          }
          return undefined;
        };
        const maybeFromRegistry = runRegistered();
        const maybe =
          maybeFromRegistry !== undefined
            ? maybeFromRegistry
            : typeof activate === "function"
            ? activate(inferred.name, {
                sessionId: state.sessionId,
                origin,
                lang,
                params: inferred.params,
              })
            : undefined;
        Promise.resolve(maybe)
          .then((res) => {
            const activationResult =
              res === "no-match" || res === false ? "no-match" : "success";
            dispatch(
              voiceActions.activate({
                type: "VOICE/ACTIVATE",
                payload: {
                  sessionId: state.sessionId,
                  intent: inferred.name,
                  activationResult,
                },
              })
            );
            track("ui.voice", {
              phase: "activate",
              origin,
              sessionId: state.sessionId,
              intent: inferred.name,
              activationResult,
              params: inferred.params,
            });
          })
          .catch((err) => {
            dispatch(
              voiceActions.error({
                type: "VOICE/ERROR",
                payload: { sessionId: state.sessionId, error: String(err) },
              })
            );
            track("ui.voice", {
              phase: "error",
              origin,
              sessionId: state.sessionId,
              error: String(err),
            });
          });
      }
    };

    rec.onerror = (e: any) => {
      setState((s) => ({
        ...s,
        error: e?.error || "unknown",
        listening: false,
      }));
      dispatch(
        voiceActions.error({
          type: "VOICE/ERROR",
          payload: { sessionId: state.sessionId, error: e?.error || "unknown" },
        })
      );
      track("ui.voice", {
        phase: "error",
        origin,
        sessionId: state.sessionId,
        error: e?.error,
      });
    };

    rec.onend = () => {
      const latencyMs = Math.round(performance.now() - startedAt.current);
      setState((s) => ({ ...s, listening: false }));
      dispatch(
        voiceActions.end({
          type: "VOICE/END",
          payload: { sessionId: state.sessionId, latencyMs },
        })
      );
      track("ui.voice", {
        phase: "end",
        origin,
        sessionId: state.sessionId,
        latencyMs,
      });
    };

    recRef.current = rec;
    return () => rec.stop();
  }, [origin, lang, interim, continuous]);

  const start = () => recRef.current?.start();
  const stop = () => recRef.current?.stop();

  return { ...state, start, stop, supported: !!recRef.current };
}

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

  // Number parsing helpers
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
  };
  function parseQuantity(t: string): number | undefined {
    const mNum = t.match(/\b(\d+)\b/);
    if (mNum) return parseInt(mNum?.[1] ?? "", 10);
    const mWord = t.match(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i
    );
    if (mWord) return NUMBER_WORDS[(mWord?.[1] ?? "").toLowerCase()];
  }

  // Helpers
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phrase = (p: string) =>
    new RegExp(`\\b${escapeRegex(p).replace(/\\s+/g, "\\s+")}\\b`, "i");
  const hasAny = (hay: string, needles: string[]) =>
    needles.some((n) => phrase(n).test(hay));

  // Intents and expansive synonyms (broad by design; we'll narrow later)
  const closeMenu = [
    "close menu",
    "hide menu",
    "dismiss menu",
    "collapse menu",
    "shut menu",
  ]; // check before open
  const openMenu = [
    "open menu",
    "show menu",
    "menu",
    "navigation",
    "nav menu",
    "hamburger",
    "main menu",
    "toggle menu", // ambiguous, treat as open for now
  ];

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

  // Funnel-specific intents for Search -> Find -> Cart -> Buy
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

  // Order matters: more specific first
  // Prefer explicit find-to-cart flows before generic search
  // e.g., "find red shoes and add to cart"
  if (
    hasAny(t, findPrefixes) &&
    /\b(add to (cart|basket|bag)|put in (cart|basket)|buy|order)\b/.test(t)
  ) {
    return { name: "find.addToCart", params: {} };
  }

  // Explicit cart actions
  if (hasAny(t, cartAdd))
    return { name: "cart.addItem", params: { qty: parseQuantity(t) ?? 1 } };
  if (hasAny(t, buyNow)) return { name: "cart.buyNow" };
  if (hasAny(t, cartIncrease))
    return {
      name: "cart.incrementItem",
      params: { qty: parseQuantity(t) ?? 1 },
    };
  if (hasAny(t, cartDecrease))
    return {
      name: "cart.decrementItem",
      params: { qty: parseQuantity(t) ?? 1 },
    };

  if (hasAny(t, closeMenu)) return { name: "close.menu" };
  if (hasAny(t, openMenu)) return { name: "open.menu" };

  if (hasAny(t, search)) return { name: "search.query" };
  // Ensure cart-specific "save for later" wins over generic save
  if (hasAny(t, saveForLater)) return { name: "cart.saveForLater" };
  if (hasAny(t, saveFile)) return { name: "save.file" };

  if (hasAny(t, openSettings)) return { name: "open.settings" };
  if (hasAny(t, openProfile)) return { name: "open.profile" };
  if (hasAny(t, openHelp)) return { name: "open.help" };

  if (hasAny(t, navBack)) return { name: "nav.back" };
  if (hasAny(t, navNext)) return { name: "nav.next" };
  if (hasAny(t, navHome)) return { name: "nav.home" };
  if (hasAny(t, refresh)) return { name: "app.refresh" };

  // Prefer explicit removal and checkout over generic cart open
  if (hasAny(t, removeFromCart)) return { name: "cart.removeItem" };
  if (hasAny(t, checkout)) return { name: "cart.checkout" };
  if (hasAny(t, cartOpen)) return { name: "cart.open" };

  return { name: "no.intent" };
}
