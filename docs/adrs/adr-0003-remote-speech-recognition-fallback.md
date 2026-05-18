# ADR-0003: Local and Remote Speech Recognition Fallback

## Status

- Accepted
- Date: 2026-05-18
- Version: 1.0
- Supersedes: None
- Superseded by: None

## Tags

voice, browser, accessibility, speech-recognition, fallback

## Context

`@plasius/voice` originally depended on browser Web Speech recognition through `SpeechRecognition` or `webkitSpeechRecognition`. That API is not available in every browser and can also fail when the browser-side recognition service is unavailable, blocked, or network-dependent.

The package needs a cross-browser recognition path while keeping provider credentials and speech-to-text vendor choices outside the browser bundle. It also needs a runtime rollout switch so consuming applications can enable or disable remote recognition through their own feature-flag or capability service.

## Decision

Add provider-neutral local and remote recognition engines plus a hybrid recognition engine:

- `useSpeechRecognitionEngine` selects a configured local recognizer first in `auto` mode, then Web Speech, then remote recognition.
- `useLocalSpeechEngine` records microphone audio with `MediaRecorder`, sends it to a caller-provided local `LocalSpeechRecognitionClient`, and dispatches transcripts back into the existing global voice store.
- Local clients may wrap native recognizers such as Apple Speech, Android `SpeechRecognizer`, Windows `SpeechRecognizer`, app-shell bridges, WebAssembly models, or WebGPU models.
- WebGPU local recognizers must declare `executionTarget: "webgpu"`. They are skipped when `navigator.gpu` is unavailable or when the host reports active GPU rendering through `gpuPolicy.isRenderingActive()` unless `allowDuringRendering` is explicitly set.
- When Web Speech is missing, or when it reports service-level errors such as `service-not-allowed` or `network`, the engine falls back to remote recognition if configured and enabled.
- `useRemoteSpeechEngine` records microphone audio with `MediaRecorder`, sends it to a caller-provided `RemoteSpeechRecognitionClient`, and dispatches final or partial transcripts back into the existing global voice store.
- `createFetchRemoteRecognitionClient` provides a default `multipart/form-data` HTTP client for application-owned speech-to-text endpoints.
- `remoteRecognition.enabled` is the package-level runtime switch. Consuming applications should wire it to their remote feature-flag or capability decision.

The package will not embed a speech-to-text vendor SDK or provider credentials.

## Alternatives Considered

- **Continue using Web Speech only**: rejected because it does not satisfy cross-browser availability and leaves browsers with no recognition path.
- **Bundle a specific cloud speech SDK**: rejected because it would leak provider assumptions into a generic package, increase bundle size, and risk exposing credentials in frontend code.
- **Require consumers to inject a complete custom engine**: retained as an escape hatch through `UseVoiceControlOptions.engine`, but rejected as the only solution because common browser and native fallback ordering should be supported by the package.
- **Always use WebGPU before remote recognition**: rejected because local rendering can be more important than transcription throughput. WebGPU recognition must be gated by host-provided rendering budget signals.

## Consequences

- Applications can support native/local recognizers first, Web Speech where useful, and remote recognition elsewhere.
- Remote recognition remains opt-in and remotely controllable by host applications.
- The browser bundle stays provider-neutral; speech provider credentials remain server-side.
- WebGPU local recognition is explicitly opt-in and rendering-aware.
- Remote fallback depends on microphone capture APIs such as `getUserMedia` and `MediaRecorder`, or on a consumer-provided custom engine for non-browser shells.
- Transcription latency can increase when audio must be uploaded after a push-to-talk or timed chunk.

## Related Decisions

- [ADR-0001: Voice Hooks and Intents](./adr-0001:%20Voice%20Hooks%20and%20Intents.md)

## References

- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
