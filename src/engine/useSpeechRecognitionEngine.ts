import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@plasius/nfr";
import {
  globalVoiceStore as defaultGlobalVoiceStore,
  type GlobalVoiceStore,
} from "../stores/global.store.js";
import {
  useWebSpeechEngine,
  type WebSpeechEngine,
} from "./useWebSpeechEngine.js";
import {
  isLocalSpeechRecognitionConfigured,
  isRemoteSpeechRecognitionConfigured,
  useLocalSpeechEngine,
  useRemoteSpeechEngine,
  type LocalSpeechRecognitionConfig,
  type RemoteSpeechRecognitionConfig,
} from "./remoteSpeechRecognition.js";

export type SpeechRecognitionEngineMode =
  | "auto"
  | "local"
  | "web-speech"
  | "remote";

export type SpeechRecognitionEngineOptions = {
  lang: string;
  interim: boolean;
  continuous: boolean;
  mode?: SpeechRecognitionEngineMode;
  localRecognition?: LocalSpeechRecognitionConfig;
  remoteRecognition?: RemoteSpeechRecognitionConfig;
  globalStore?: GlobalVoiceStore;
};

const getSpeechRecognitionCtor = () =>
  (globalThis as any).SpeechRecognition ||
  (globalThis as any).webkitSpeechRecognition;

export function isWebSpeechUnavailableError(error?: string): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("service-not-allowed") ||
    normalized.includes("network") ||
    normalized.includes("language-unavailable") ||
    normalized.includes("language-not-supported") ||
    normalized.includes("audio-capture") ||
    normalized.includes("not-supported")
  );
}

const emit = (name: string, props?: Record<string, unknown>) => {
  try {
    track(name, props as any);
  } catch {}
};

export function useSpeechRecognitionEngine(
  opts: SpeechRecognitionEngineOptions
): WebSpeechEngine {
  const store = opts.globalStore ?? defaultGlobalVoiceStore;
  const mode = opts.mode ?? "auto";
  const [failedTiers, setFailedTiers] = useState<{
    local?: boolean;
    webSpeech?: boolean;
  }>({});
  const hasWebSpeech = typeof getSpeechRecognitionCtor() === "function";
  const localConfigured = isLocalSpeechRecognitionConfigured(
    opts.localRecognition
  );
  const remoteConfigured = isRemoteSpeechRecognitionConfigured(
    opts.remoteRecognition
  );
  const previousLocalConfigRef = useRef<LocalSpeechRecognitionConfig | undefined>();
  const previousRemoteConfigRef = useRef<RemoteSpeechRecognitionConfig | undefined>();

  useEffect(() => {
    const localRecognitionChanged =
      previousLocalConfigRef.current !== opts.localRecognition;
    const remoteRecognitionChanged =
      previousRemoteConfigRef.current !== opts.remoteRecognition;

    if (localRecognitionChanged || remoteRecognitionChanged) {
      setFailedTiers({});
      previousLocalConfigRef.current = opts.localRecognition;
      previousRemoteConfigRef.current = opts.remoteRecognition;
    }
  }, [mode, localConfigured, remoteConfigured, opts.localRecognition, opts.remoteRecognition]);

  const useLocal =
    mode === "local" ||
    (mode === "auto" && localConfigured && !failedTiers.local);

  const useRemote =
    mode === "remote" ||
    (mode === "auto" &&
      remoteConfigured &&
      !useLocal &&
      (!hasWebSpeech || !!failedTiers.webSpeech));
  const useWebSpeech =
    mode === "web-speech" ||
    (mode === "auto" &&
      !useLocal &&
      !useRemote &&
      hasWebSpeech &&
      !failedTiers.webSpeech);

  const localSpeechEngine = useLocalSpeechEngine({
    lang: opts.lang,
    interim: opts.interim,
    continuous: opts.continuous,
    enabled: useLocal,
    localRecognition: opts.localRecognition,
    globalStore: store,
  });
  const webSpeechEngine = useWebSpeechEngine({
    lang: opts.lang,
    interim: opts.interim,
    continuous: opts.continuous,
    enabled: useWebSpeech,
    globalStore: store,
  });
  const remoteSpeechEngine = useRemoteSpeechEngine({
    lang: opts.lang,
    interim: opts.interim,
    continuous: opts.continuous,
    enabled: useRemote,
    remoteRecognition: opts.remoteRecognition,
    globalStore: store,
  });

  useEffect(() => {
    if (mode !== "auto" || !useLocal) return;

    return store.subscribeToKey("lastError", (error) => {
      if (!error) return;
      setFailedTiers((current) => ({ ...current, local: true }));
      emit("speech-recognition:fallback-local", { error });
    });
  }, [mode, store, useLocal]);

  useEffect(() => {
    if (mode !== "auto" || !remoteConfigured || !useWebSpeech) return;

    return store.subscribeToKey("lastError", (error) => {
      if (!isWebSpeechUnavailableError(error)) return;
      setFailedTiers((current) => ({ ...current, webSpeech: true }));
      emit("speech-recognition:fallback-remote", { error });
    });
  }, [mode, remoteConfigured, store, useWebSpeech]);

  return useMemo(
    () =>
      useLocal
        ? localSpeechEngine
        : useRemote
          ? remoteSpeechEngine
          : webSpeechEngine,
    [localSpeechEngine, remoteSpeechEngine, useLocal, useRemote, webSpeechEngine]
  );
}
