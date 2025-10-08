// File: voice/src/components/voiceIntents.tsx
import React, { useEffect, useRef } from "react";
import { useVoiceIntents, type IntentHandler } from "./useVoiceIntents.js";
import { VoiceProvider, useVoiceContext } from "./voiceProvider.js";

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
 * Internal component that does the actual registration work using the hook.
 * Separated so we can optionally wrap it with <VoiceProvider/> when no provider
 * is present in the tree, preventing "Invalid hook call" errors in tests/apps
 * that render <VoiceIntents/> without the provider.
 */
const VoiceIntentsInner: React.FC<VoiceIntentsProps> = ({
  origin,
  intents,
  enabled = true,
}) => {
  const registeredNamesRef = useRef<string[] | null>(null);
  const { unregisterVoiceIntents, registerVoiceIntents } = useVoiceIntents();

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
 * React component that auto-registers voice intents while it is mounted.
 * Intents are unregistered on unmount, or when `enabled` flips to false.
 *
 * This component is resilient: if it's rendered outside a <VoiceProvider/>,
 * it will automatically wrap itself with a provider so hooks remain valid.
 *
 * Pro tip: memoize `intents` with useMemo to avoid churn.
 */
export const VoiceIntents: React.FC<VoiceIntentsProps> = (props) => {
  // Safe even without provider: useContext returns the default value.
  const ctx = useVoiceContext?.();
  const content = <VoiceIntentsInner {...props} />;

  // If there is no provider in the tree, supply one so that useVoiceIntents()
  // (which depends on provider-backed context/state) is called validly.
  return ctx ? content : <VoiceProvider>{content}</VoiceProvider>;
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
  const { unregisterVoiceIntents, registerVoiceIntents } = useVoiceIntents();
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
