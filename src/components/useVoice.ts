import { useMemo } from "react";
import {
  useVoiceIntents,
  type VoiceIntentOpts,
  type VoiceIntentView,
} from "./useVoiceIntents.js";
import {
  useVoiceControl,
  type UseVoiceControlOptions,
  type VoiceControlAPI,
} from "./useVoiceControl.js";

export type UseVoiceOptions = {
  intents?: VoiceIntentOpts;
  control?: UseVoiceControlOptions;
};

export type UseVoiceResult = {
  intents: VoiceIntentView;
  control: VoiceControlAPI;
  start: VoiceIntentView["start"];
  stop: VoiceIntentView["stop"];
};

/**
 * Convenience hook that wires voice intents + controls together.
 * Returns both APIs plus top-level start/stop helpers.
 */
export function useVoice(opts: UseVoiceOptions = {}): UseVoiceResult {
  const intents = useVoiceIntents(opts.intents);
  const control = useVoiceControl(opts.control);

  return useMemo(
    () => ({
      intents,
      control,
      start: intents.start,
      stop: intents.stop,
    }),
    [intents, control]
  );
}
