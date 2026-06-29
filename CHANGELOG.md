# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.12] - 2026-06-29

- **Added**
  - Spell casting utterance parsing helpers and a reusable registered intent factory for MCC-style spoken spell declarations.
  - (placeholder)

- **Changed**
  - Refreshed the published `@plasius/nfr`, `@plasius/react-state`, and `@plasius/translations` dependencies to their latest released versions.
  - Registered intent handlers now receive the matched spoken utterance in `params.utterance` so scoped parsers can inspect the original transcript.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.11] - 2026-06-22

- **Added**
  - Remote speech recognition fallback support with fetch-backed and custom client adapters for browsers where Web Speech is unavailable or service-disabled.
  - Local speech recognition adapter support so native, WebGPU, WebAssembly, or app-shell recognizers can run before Web Speech or remote fallback.
  - `useSpeechRecognitionEngine`, `useRemoteSpeechEngine`, and remote recognition helper exports for provider-neutral speech-to-text integration.
  - WebGPU local-recognition policy controls for rendering-aware fallback and short command-capture bounds.
  - Browser voice MUD demo for microphone permission, Web Speech navigation, transcript mirroring, typed fallback, and command parser testing.
  - Consumer upgrade guidance for wiring recognition engines when using `VoiceProvider` and `useVoiceIntents` directly.
  - `createGlobalVoiceStore` from the package entrypoint for consumers that need shared-store intent/control composition.
  - (placeholder)

- **Changed**
  - `useVoiceControl` now uses an auto-selecting recognition engine and can switch through local, Web Speech, and remote recognizers as availability changes.
  - Collapsed the legacy `temp/tests/` voice-intent corpus into the maintained `tests/` suite and kept the canonical registry coverage in `tests/useVoiceIntents.test.tsx`.
  - (placeholder)

- **Fixed**
  - Treat Web Speech `service-not-allowed` as a recognizer service failure instead of a microphone permission denial so remote fallback can still run.
  - Restored deterministic coverage for the Web Speech start-error recovery path so failed starts are verified to stop the stale recognizer, emit telemetry, and create a fresh session.
  - Hardened local, remote, and Web Speech recognition lifecycle cleanup so disabling, disposing, or changing devices does not restart stale sessions or surface teardown aborts as user-facing errors.
  - Removed stale suppressed test files outside the active Vitest include path so lint, type, and coverage signals reflect the maintained suite only.
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.10] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed dependencies to the latest stable published versions.
  - Migrated the Vitest worker configuration to the supported Vitest 4 top-level settings for CI single-worker runs.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.9] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.8] - 2026-04-02

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.7] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.5] - 2026-03-01

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.4] - 2026-03-01

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.2] - 2026-02-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.1] - 2026-01-22

- **Added**
  - (placeholder)

- **Changed**
  - Add `main`, `module`, and `types` fields alongside the export map for dual ESM/CJS consumers.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0] - 2025-12-31

- **Added**
  - Expanded README with end-to-end usage and intent registration examples.
  - Broader test coverage for voice controls, intents, adapter utilities, and lifecycle helpers; coverage ignores temp artifacts.
  - New `useVoice` convenience hook that composes intents and controls with shared `start`/`stop` helpers.
  - Issue exposure tests covering store sync, telemetry errors, and crypto support.

- **Changed**
  - `useVoiceControl` now subscribes to PTT state with `useSyncExternalStore` so button props stay in sync without extra renders.
  - `useVoiceIntents` now defaults `autoStart` to `false` to avoid unexpected microphone activation; opt in with `autoStart: true`.
  - `useVoice` now ensures intents and controls share a single store (including injected stores) to keep state aligned.
  - `useVoiceIntents` telemetry is now error-tolerant and requires `crypto.randomUUID`; unsupported browsers get a clear error instead of silent fallback.

- **Fixed**
  - `pttButtonProps["aria-pressed"]` now reflects the latest store state, avoiding stale pressed indicators.

- **Security**
  - (placeholder)

## [1.1.0-beta.10] - 2025-10-30

- **Added**
  - `useVoiceIntents` exposes `start`/`stop` controls and dispatches configuration directly to the global store, removing the need for a `useWebSpeechRecognition` passthrough.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.9] - 2025-10-16

- **Added**
  - Reset for useWebSpeechEngine added
  - track add for dispose events

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.8] - 2025-10-14

- **Added**
  - (placeholder)

- **Changed**
  - Restoring testing
  - Cleaned up useWebSpeechEngine to be a cleaner implementation.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.7] - 2025-10-09

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.6] - 2025-10-09

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.5] - 2025-10-09

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.4] - 2025-10-09

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.3] - 2025-10-09

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.2] - 2025-10-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.1] - 2025-10-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.0] - 2025-10-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.0] - 2025-10-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0-beta.0] - 2025-10-08

- **Added**
  - New `useVoiceControl` hook consolidating voice control concerns (mute, volume, push‑to‑talk, global input listeners) with a clean API. (`src/components/useVoiceControl.ts`)
  - New `useWebSpeechEngine` hook to manage SpeechRecognition lifecycle with a testable interface. (`src/engine/useWebSpeechEngine.ts`)
  - Global voice store for app‑level state (mute, volume, PTT state, language) and intent/event wiring. (`src/stores/global.store.ts`)
  - `voiceAdapter` abstraction and `stopAndWait` utility to coordinate engine start/stop. (`src/utils/voiceAdapter.ts`, `src/utils/stopAndWait.ts`)
  - Test scaffolding and mocks for Web Speech, timers, environment and telemetry. (`tests/mocks/*`, `tests/types/webspeech.d.ts`)

- **Changed**
  - `voiceProvider.tsx` and `voiceIntents.tsx` updated to integrate with the new global store and engine hook.
  - Build & tooling updates: TypeScript, Vite, Rollup, ESLint/TS‑ESLint, and Testing Library version bumps (see **Chore/Deps**).
  - Export surface reorganised in `src/index.ts` to surface the new hooks and store.

- **Removed**
  - Deprecated `useVoice` and `useVoiceControls` hooks removed. (`src/components/useVoice.ts`, `src/components/useVoiceControls.ts`)
  - Legacy WebSpeech engine removed in favour of `useWebSpeechEngine`. (`src/engine/webspeech.ts`)
  - Old test files replaced/relocated under `temp/tests/` with new mocks.

- **Fixed**
  - More reliable start/stop sequencing for SpeechRecognition with guard logic and deterministic tests.
  - Push‑to‑talk interactions are now handled consistently across keyboard, pointer and touch with store‑driven hold/toggle modes.

- **Chore/Deps**
  - React 19.2, React‑DOM 19.2, TypeScript 5.9.3, Vite 7.1.8, Rollup 4.52.3.
  - `@typescript-eslint/*` 8.45, `@testing-library/jest-dom` 6.9.1, and assorted minor updates (`dom-selector`, `strip-literal`, `tsx`, etc.).
  - `@plasius/react-state` 1.0.13 (now a peer dep on React 19) and `@plasius/translations` 1.0.7.

### Migration notes

- Replace usages of `useVoice`/`useVoiceControls` with `useVoiceControl`.
- If you bound PTT to `Space` only, pass `pttKeyCodes={["Space"]}` to preserve that behaviour. The default now includes `ControlLeft`, `Space`, `ControlRight`.
- Wire UI components to the global store where needed and prefer `useWebSpeechEngine` for engine lifecycle.

## [1.0.9] - 2025-09-26

- **Added**
  - (placeholder)

- **Changed**
  - Separated WebSpeech engine into its own module (`engine/webspeech.ts`) for clearer responsibilities and improved testability.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.8] - 2025-09-26

- **Added**
  - Additional logging for exceptions raised during SpeechRegonition start, end, error etc.

- **Changed**
  - (placeholder)

- **Fixed**
  - stabilize SpeechRecognition start by stopping previous instance before starting a new one, defaulting lang/flags, and adding a watchdog retry to prevent immediate stop/abort races.

- **Security**
  - (placeholder)

## [1.0.7] - 2025-09-25

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - Added fallback handling in `useVoice` to ensure `listening` state updates correctly by dispatching `VOICE/START` on `SpeechRecognition.onstart`. This resolves the issue where `listening` never flipped to `true` despite microphone permissions being granted.

- **Security**
  - (placeholder)

## [1.0.6] - 2025-09-25

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - add startup watchdog with recognizer recreate to ensure listening flag is set when onstart fails to fire

- **Security**
  - (placeholder)

## [1.0.5] - 2025-09-25

- **Added**
  - Additional state tests

- **Changed**
  - (placeholder)

- **Fixed**
  - Fixed the state.listening flag not being updated correctly to external libraries. 

- **Security**
  - (placeholder)

## [1.0.4] - 2025-09-25

- **Added**
  - VoiceIntents auto-register/unregister mechanism added

- **Changed**
  - README.md update

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.0] - 2025-09-24

- **Added**

  - Initial Commit
  - CD pipeline added major, minor and patch flags for the pipeline

- **Changed**

  - (placeholder)

- **Fixed**

  - (placeholder)

- **Security**
  - (placeholder)

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user‑visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/voice/compare/v1.1.12...HEAD
[1.0.0]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.0
[1.0.4]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.4
[1.0.5]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.5
[1.0.6]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.6
[1.0.7]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.7
[1.0.8]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.8
[1.0.9]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.9
[1.1.0-beta.0]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.0
[1.1.0-beta.1]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.1
[1.1.0-beta.2]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.2
[1.1.0-beta.3]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.3
[1.1.0-beta.4]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.4
[1.1.0-beta.5]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.5
[1.1.0-beta.6]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.6
[1.1.0-beta.7]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.7
[1.1.0-beta.8]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.8
[1.1.0-beta.9]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.9
[1.1.0-beta.10]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.10
[1.1.0]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0
[1.1.1]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.1

## [1.1.1] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[1.1.2]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.2
[1.1.4]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.4
[1.1.5]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.5
[1.1.7]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.7
[1.1.8]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.8
[1.1.9]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.9
[1.1.10]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.10
[1.1.11]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.11
[1.1.12]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.12
