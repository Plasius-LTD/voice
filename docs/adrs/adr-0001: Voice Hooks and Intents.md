# ADR-0001: Voice Hooks and Intents

## Status

- Proposed -> Accepted
- Date: 2025-09-24
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

Plasius apps require speech recognition with predictable controls, clear intent mapping, and React-friendly ergonomics. The Web Speech API is stateful and browser-dependent, so the package must expose explicit control, be safe to initialize, and avoid auto-starting by default.

## Decision

We will provide `@plasius/voice` with these structural choices:

- A provider + hook model (`VoiceProvider`, `useVoice`, `useVoiceControl`, `useVoiceIntents`).
- Explicit `start()` / `stop()` control; default `autoStart: false` to avoid unexpected mic usage.
- An intent registry for mapping phrases/regex to handlers with per-origin scoping.
- SSR-safe guards around Web Speech APIs.
- Publish ESM + CJS builds with TypeScript types.

## Consequences

- **Positive:** Predictable lifecycle and clear intent mapping; React-friendly integration; safer defaults.
- **Negative:** Requires manual start/stop wiring in consumers; Web Speech API limitations remain.
- **Neutral:** Consumers can layer their own UX flows without changing the core hooks.

## Alternatives Considered

- **Direct Web Speech API usage:** Rejected due to boilerplate and lack of consistent intent routing.
- **Auto-start by default:** Rejected for privacy and UX concerns.
