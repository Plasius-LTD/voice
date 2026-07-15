# ADR-0004: Focused-Pane and Combat-Safe Voice Routing

## Status

- Proposed -> Accepted
- Date: 2026-07-12
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

The Player System can expose several simultaneous voice-capable surfaces. An
origin alone is too coarse to prevent a command registered for one focused pane
from being resolved while another pane is active. Combat-safe mode also needs a
bounded command set without disabling recognition or push-to-talk entirely.

## Decision

Extend `@plasius/voice` registrations with an optional `scope` containing:

- `focusedPanes`, which limits matching to the active pane;
- `commandFamily`, which can be filtered by the host's allow-list; and
- `allowInCombatSafe`, which is required for matching in combat-safe mode.

`useVoiceIntents` receives the active `focusedPane`, `allowedCommandFamilies`,
and `combatSafe` context. Existing registrations remain unrestricted when no
context is supplied. Combat-safe filtering is fail-closed, while command-family
and pane filters apply only to registrations that declare the relevant scope.

The control hook exposes reactive listening, desired-listening, PTT-active, and
PTT-pressed state, plus an imperative snapshot helper. Recognition and PTT
remain available in combat-safe mode; only unsafe intent resolution is removed.

## Alternatives Considered

- **Disable voice in combat-safe mode:** Rejected because bounded status and
  target commands must remain available during combat.
- **Require every consumer to filter transcripts:** Rejected because it spreads
  safety policy across host applications and can allow an unsafe handler to run.
- **Use origin names as pane identifiers:** Rejected because origin is a page or
  registration namespace, not a reliable representation of the currently
  focused surface.

## Consequences

- Hosts can keep recognition and push-to-talk active while constraining command
  resolution to the focused pane and safe command families.
- Combat-safe registrations must explicitly opt in, so existing commands do not
  become accidentally available during restricted interaction.
- Consumers that need focused or combat-safe routing must provide stable context
  values and annotate their registrations with the corresponding scope.

## Rollout and Testing

The inherited Player System rollout flag is
`harmony.player-system.audio.enabled`; hosts must use its remote enable/disable
and rollback path. Tests cover focused-pane routing, command-family filtering,
combat-safe fail-closed behavior, and live listening/PTT state exposure.
