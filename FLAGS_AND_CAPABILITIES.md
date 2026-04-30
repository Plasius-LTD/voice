# FLAGS_AND_CAPABILITIES.md

## 1. Purpose
This file defines the rollout and access-governance model for Features.

## 2. Primary Rules
- Every parent Feature must have at least one named, remotely controllable feature flag before implementation starts.
- The feature flag is part of the Feature definition and must be recorded in the Feature, child Stories/Tasks, and any ADR/TDR or implementation notes when relevant.
- Capabilities are required only when user-visible entitlement, discoverability, navigation, configuration, role-based access, or similar product-access concerns are involved.
- Capabilities do not remove the requirement for a Feature flag.
- If a Feature is both user-visible and rollout-sensitive, use both together.

## 3. Capability vs Feature-Flag Model
### Capabilities are the primary remote gating mechanism for:
- user-visible product access
- discoverability
- navigation visibility
- role-shaped access
- per-user or per-group entitlements
- payload-bearing UI configuration
- admin and entitlement-oriented surfaces

### Feature flags are the primary remote gating mechanism for:
- rollout safety
- canary exposure
- percentage rollout
- kill switches
- implementation-path selection
- backend operational rollback
- backend-only behavior changes
- validation-path rollout
- auth/session safety rollouts
- staged migrations
- cohort or percentage exposure

## 4. Composition Rules
- Backend systems may evaluate feature flags before emitting or honoring a capability.
- Frontend clients should consume capability decisions as their primary source of truth for user-visible product access instead of duplicating rollout logic in local env flags.
- Do not expose a user-visible feature in the frontend based only on build-time or local runtime env vars when the feature-flag service or capabilities service can provide a remote decision.
- If a frontend route, menu item, page section, or action is hidden or shown for product reasons, add or reuse a capability contract rather than introducing a frontend-only boolean flag.
- If a backend behavior must be remotely disabled without redeploying, add or reuse a feature flag rather than relying only on code constants or local env configuration.
- Plain env flags are permitted only as documented break-glass controls or local-development overrides; they must not be the normal production control plane for a feature.

## 5. Task and Inheritance Rules
- Every implementation Task must belong to a parent Feature.
- Every parent Feature must have a feature flag before downstream implementation Tasks are marked complete.
- Child Stories and Tasks inherit the parent Feature flag unless there is an explicitly documented reason to add a second feature flag.
- When a Feature spans multiple repositories/packages, every linked Task in every repository/package must reference the same parent Feature and its associated feature flag.
- If work must begin before the Feature flag exists, the first task in the Feature must create the Feature flag and no downstream implementation task may be marked complete until that flag exists.

## 6. Completion and Documentation Rules
- Do not mark a Feature, Story, or Task done until the associated feature flag has documented enable/disable behavior, test coverage, and rollback instructions where applicable.
- When introducing a new gate, document why it is a capability, a feature flag, or a composed gate using both.
- Record the operator-facing rollback path.
- Implementation notes, rollout checklists, and ADRs must describe:
  - the capability name, when applicable;
  - the feature-flag key;
  - the source-of-truth evaluator;
  - and whether any env override is break-glass-only.

## 7. Testing Rules
- Tests for capability-gated features must cover:
  - unauthorized state;
  - authorized state;
  - payload/config-driven state when applicable.
- Tests for feature-flagged features must cover:
  - enabled state;
  - disabled state;
  - rollback/fallback state when applicable.

## 8. Current Application Guidance
- Admin and entitlement-oriented surfaces should be modeled as capabilities first, with the mandatory parent Feature flag still present.
- Linked accounts and similar user-facing discoverability concerns should move to capability-led gating.
- Session revocation, shared validation, and similar backend rollout controls should remain feature-flag-led.
