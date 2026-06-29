import type {
  IntentMeta,
  RegisteredIntent,
} from "./components/useVoiceIntents.js";

export const SPELL_CASTING_FEATURE_FLAG_ID = "voice.spell-casting-mode.enabled";

export type SpellCastingTargetMode = "entity" | "location";

export interface SpellCastingIntent {
  readonly effect: string;
  readonly mode: SpellCastingTargetMode;
  readonly rawUtterance: string;
  readonly target: string;
}

export interface SpellCastingIntentMeta {
  readonly lang?: IntentMeta["lang"];
  readonly origin?: IntentMeta["origin"];
  readonly params?: Record<string, unknown>;
  readonly rawUtterance?: string;
  readonly sessionId: IntentMeta["sessionId"];
}

export type SpellCastingIntentHandler = (
  intent: SpellCastingIntent,
  meta: SpellCastingIntentMeta
) => ReturnType<RegisteredIntent["handler"]>;

const CAST_SEPARATOR = " cast ";
const COMMA_CAST_SEPARATOR = ", cast ";

export const SPELL_CASTING_PATTERNS = Object.freeze([
  /^\s*on\b.+(?:,\s*|\s+)cast\b.+/i,
  /^\s*at\b.+(?:,\s*|\s+)cast\b.+/i,
] as const);

function normalizeSpeechSegment(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function parseDirectedCast(
  normalized: string,
  mode: SpellCastingTargetMode,
  prefix: "at " | "on "
): SpellCastingIntent | null {
  const body = normalized.slice(prefix.length).trim();
  const bodyLower = body.toLowerCase();
  const explicitSeparatorIndex = bodyLower.indexOf(COMMA_CAST_SEPARATOR);
  const castOccurrences = bodyLower.split(CAST_SEPARATOR).length - 1;
  const castIndex =
    explicitSeparatorIndex >= 0
      ? explicitSeparatorIndex + 1
      : castOccurrences === 1
        ? bodyLower.indexOf(CAST_SEPARATOR)
        : -1;

  if (castIndex <= 0) {
    return null;
  }

  const rawTarget = body.slice(0, castIndex).trim().replace(/,+$/u, "");
  const rawEffect = body.slice(castIndex + CAST_SEPARATOR.length).trim();
  const target = normalizeSpeechSegment(rawTarget);
  const effect = normalizeSpeechSegment(rawEffect);

  if (!target || !effect) {
    return null;
  }

  return {
    effect,
    mode,
    rawUtterance: normalized,
    target,
  };
}

export function parseSpellCastingUtterance(
  utterance: string
): SpellCastingIntent | null {
  const normalized = normalizeSpeechSegment(utterance);
  if (!normalized) {
    return null;
  }

  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower.startsWith("on ")) {
    return parseDirectedCast(normalized, "entity", "on ");
  }
  if (normalizedLower.startsWith("at ")) {
    return parseDirectedCast(normalized, "location", "at ");
  }

  return null;
}

export function createSpellCastingIntent(
  handler: SpellCastingIntentHandler
): RegisteredIntent {
  return {
    name: "spell.cast.declaration",
    patterns: [...SPELL_CASTING_PATTERNS],
    handler: (meta) => {
      const rawUtterance =
        typeof meta.params?.utterance === "string"
          ? meta.params.utterance
          : typeof meta.params?.transcript === "string"
            ? meta.params.transcript
            : "";
      const intent = parseSpellCastingUtterance(rawUtterance);
      if (!intent) {
        return "no-match";
      }

      return handler(intent, {
        ...meta,
        rawUtterance,
      });
    },
  };
}
