// File: voice/src/components/voiceIntents.tsx
import React, { useEffect, useRef } from "react";
import type { IntentHandler } from "./useVoice";
import { registerVoiceIntents, unregisterVoiceIntents } from "./useVoice.js";

export type IntentSpec = {
  /** Unique intent name */
  name: string;
  /** String or RegExp patterns that should match the user's utterance */
  patterns: (string | RegExp)[];
  /** Handler invoked when the intent matches. Return a result object/promise. */
  handler: IntentHandler;
};

export type VoiceIntentsProps = {
  /** Page/scope identifier. Use "*" for global intents. */
  origin: string;
  /** Intents to register while the component is mounted */
  intents: IntentSpec[];
  /** Toggle registration on/off without unmounting */
  enabled?: boolean;
};

/**
 * React component that auto-registers voice intents while it is mounted.
 * Intents are unregistered on unmount, or when `enabled` flips to false.
 *
 * Pro tip: memoize `intents` with useMemo to avoid churn.
 */
export const VoiceIntents: React.FC<VoiceIntentsProps> = ({
  origin,
  intents,
  enabled = true,
}) => {
  const registeredNamesRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      // If we were previously registered, unregister now.
      if (registeredNamesRef.current) {
        unregisterVoiceIntents(origin, registeredNamesRef.current);
        registeredNamesRef.current = null;
      }
      return;
    }

    // Register all intents and remember their names for clean unregistration.
    registerVoiceIntents(origin, intents);
    registeredNamesRef.current = intents.map((i) => i.name);

    return () => {
      if (registeredNamesRef.current) {
        unregisterVoiceIntents(origin, registeredNamesRef.current);
        registeredNamesRef.current = null;
      }
    };
    // We intentionally don't diff deep on intents; recommend memoization by caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, enabled, intents]);

  return null;
};

/**
 * Hook version if you prefer using hooks rather than a component.
 * Registers intents on mount and unregisters on unmount.
 */
export function useAutoVoiceIntents(
  origin: string,
  intents: IntentSpec[],
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    registerVoiceIntents(origin, intents);
    return () =>
      unregisterVoiceIntents(
        origin,
        intents.map((i) => i.name)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, enabled, intents]);
}
