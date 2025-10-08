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

[Unreleased]: https://github.com/Plasius-LTD/voice/compare/v1.1.0-beta.0...HEAD
[1.0.0]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.0
[1.0.4]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.4
[1.0.5]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.5
[1.0.6]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.6
[1.0.7]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.7
[1.0.8]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.8
[1.0.9]: https://github.com/Plasius-LTD/voice/releases/tag/v1.0.9
[1.1.0-beta.0]: https://github.com/Plasius-LTD/voice/releases/tag/v1.1.0-beta.0
