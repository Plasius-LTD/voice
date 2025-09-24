

import React, { createContext, useContext, useMemo } from "react";

// NOTE: Adjust the import path if your hook lives elsewhere
import { useVoice } from "./useVoice.js";

/**
 * VoiceContextValue
 * Infer the shape of the voice API directly from the useVoice hook to avoid
 * duplicating types. Whatever your hook returns becomes the context value.
 */
export type VoiceContextValue = ReturnType<typeof useVoice>;

/**
 * The React Context that exposes the voice API from `useVoice`.
 * It is intentionally initialized with `null` to force usage via the provider.
 */
const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Props accepted by the VoiceProvider. We forward the first parameter of
 * `useVoice` (if any) as `options`. This keeps the provider aligned with the
 * hook's signature without hard-coding a specific type name.
 */
export interface VoiceProviderProps {
  /**
   * Children that will be able to access the voice context.
   */
  readonly children: React.ReactNode;
  /**
   * Options forwarded to `useVoice(options)`; typed from the hook's parameters
   * to stay in lockstep with the hook's API.
   */
  readonly options?: Parameters<typeof useVoice>[0];
}

/**
 * VoiceProvider
 *
 * Wrap any part of your app that needs voice features. Internally it calls
 * `useVoice(options)` exactly once and exposes the resulting API through
 * context so that multiple components can consume it without re-instantiating
 * the hook/state.
 */
export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children, options }) => {
  const api = useVoice(options as Parameters<typeof useVoice>[0]);

  // Avoid unnecessary provider updates if the hook returns a stable reference
  // but still memoize to be explicit about intent.
  const value = useMemo(() => api, [api]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

/**
 * useVoiceContext
 *
 * Consumer hook for anything inside the provider. We throw a helpful error if
 * it's used outside of the provider to fail fast during development/testing.
 */
export const useVoiceContext = (): VoiceContextValue => {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error("useVoiceContext must be used within a <VoiceProvider>.");
  }
  return ctx;
};

/**
 * WithVoice
 *
 * Optional render-prop convenience component for class components or
 * situations where hooks are awkward. This is entirely optional—feel free to
 * delete if you want to keep the API purely hook-based.
 */
export interface WithVoiceProps {
  readonly children: (voice: VoiceContextValue) => React.ReactNode;
}

export const WithVoice: React.FC<WithVoiceProps> = ({ children }) => {
  const voice = useVoiceContext();
  return <>{children(voice)}</>;
};

export default VoiceProvider;