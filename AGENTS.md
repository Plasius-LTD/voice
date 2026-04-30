# AGENTS.md

## 1. Scope and Purpose
- This guidance is intended for Codex usage under `~/.codex/` and applies as the default operating policy unless a more specific repo-local `AGENTS.md` overrides or refines it.
- Treat this as the current curated rule set, not as an append-only history log.
- The Plasius Ltd monorepo contains the public site, admin dashboard, backend API, and shared packages.

## 2. Instruction Priority and Conflict Handling
- Apply the most specific applicable rule.
- Repo-local `AGENTS.md` files may refine this file for a specific repository or subtree.
- Referenced companion markdown files expand this file and are part of the active instruction set.
- If rules appear contradictory and the conflict cannot be resolved safely from the written guidance, stop and ask the user how to resolve it before proceeding.
- Canonical architecture decision path: `docs/adrs/`. Any legacy references such as `docs/ADRS/`, `docs/ADR`, or similar should be merged into or interpreted as `docs/adrs/`.

## 3. Repository Map and Common Paths
- `packages/`: shared libraries (schema, auth, renderer, etc.)
- `frontend/`: public site (Vite)
- `dashboard/`: admin dashboard (Vite)
- `backend/`: Azure Functions API
- `docs/` and `specs/`: documentation and TypeSpec/OpenAPI
- Prefer editing source in `packages/`, `frontend/`, `dashboard/`, and `backend/`.
- Avoid editing generated output (`dist/`, `coverage/`, `tsp-output/`, `node_modules/`) unless explicitly requested.

## 4. Tooling and Common Commands
- Use npm (workspaces + Turbo).
- Install dependencies from the repo root with `npm install`.
- Common root commands:
  - `npm run build`
  - `npm run dev`
  - `npm run test`
  - `npm run typecheck`
  - `npm run generate:references`

## 5. Non-Negotiable Safety and Integrity Rules
- Secrets and PII must never be committed to version control.
- Sensitive values are only permitted in approved local metadata/config (for example `.env*`) and managed secret stores.
- If exposure occurs, treat it as a blocking incident and rotate/remediate immediately.
- Do not fake completion, CI status, CD status, release status, project status, or test execution.
- Do not publish packages directly from local machines; publish only through approved GitHub CD workflows.
- Do not bypass approved production deployment paths.
- Do not use ad hoc production deployment via manual Azure CLI changes, alternate workflows, or undocumented scripts.
- Keep public APIs stable unless the work intentionally changes them.

## 6. Core Engineering Rules
- Reuse `@plasius/*` packages as the default building blocks for all new features and tasks.
- Before implementing new functionality, evaluate existing `@plasius/*` packages and reuse them where they fit.
- Do not reimplement capabilities that already exist in `@plasius/*` packages.
- If needed behavior is missing, update the appropriate `@plasius/*` package first, including tests and docs, before consuming the new released version.
- Prefer durable fixes over short-term bypasses.
- Quick fixes are not acceptable for test coverage, CI/CD pipelines, or documentation updates.
- Do not remove tests, checks, or docs, lower quality thresholds, or bypass required cases merely to make work pass.
- Apply SOLID, KISS, and related engineering principles where appropriate.
- Preserve ACID properties and data integrity in transactional workflows where applicable.
- Keep code clean, maintainable, scalable, and testable.
- When adding or updating dependencies, prefer lazy-loading (dynamic import/code splitting) to avoid heavy first-load network use when applicable.
- Accessibility is a first-class quality requirement. User-facing software should target WCAG 2.2 AA or better, and accessibility regressions are release-blocking.

## 7. Work Definition and GitHub Project Governance
- GitHub Project is the source of truth for work definition, acceptance criteria, ownership, and completion state.
- Do not use repo comments, ad hoc conversations, or untracked local notes as the authoritative work definition for implementation.
- Design documents may precede tracked work, but implementation work should be represented in the GitHub Project hierarchy before execution.
- Work hierarchy is `Epic -> Feature -> Story -> Task`.
- Work items are GitHub Issues titled with prefixes:
  - `[EPIC]`
  - `[FEATURE]`
  - `[STORY]`
  - `[TASK]`
- All `Epic`, `Feature`, and `Story` items must be created and managed in the `plasius-ltd-site` repository.
- All `Task` items must be created in the repository/package where the code change will be implemented.
- When one Story requires changes in multiple repositories/packages, create one linked Task per affected repository/package.
- Every implementation Task must belong to a parent Feature. Do not create or execute standalone implementation Tasks outside a Feature.
- Non-implementation maintenance tasks should still be linked to a parent Feature when they are part of delivery scope. If they are truly repository-operational work, document explicitly why no product Feature applies.
- Before starting implementation work on any tracked item, assign the currently logged-in user's GitHub account to the active issue being worked on and move that issue to `In Progress`.
- Do not claim or begin work on an issue already `In Progress`, assigned, or otherwise actively owned by another person without user direction.
- If work is required and no suitable tracked item exists yet, create or request the appropriate issue before implementation begins.

## 8. Documentation Requirements
- Follow `CONTRIBUTING.md` and repo tooling conventions.
- Update `README.md` whenever structural changes are made.
- Update `README.md` for public-usage changes as well.
- `CHANGELOG.md` updates are default-required unless explicitly exempted.
- Strong default: every Story should add a line under `Unreleased` unless the change is purely internal, non-behavioral, or the user explicitly exempts it.
- Do not manually create, rename, move, or promote versioned/date-based release sections in `CHANGELOG.md`; the release pipeline owns release-entry generation/promotion.
- Architectural changes require ADRs in `docs/adrs/`.
- TDRs and design documents should also live under `docs/` using the repo's agreed structure.
- Ensure an ADR exists for meaningful architectural decisions affecting a package or system boundary.

## 9. Testing and Quality Gates
- After any change, run relevant BDD/TDD tests when they exist; mention if skipped.
- For fixes, add or update a BDD or TDD test that fails first and validate that it passes after the fix when practical.
- Define tests from requirements and acceptance criteria before implementation for tracked work.
- Create tests for all fixes and run relevant tests before considering the work complete.
- Run relevant validation for touched areas, including tests, type checks, and other checks appropriate to the repo.
- If validation is skipped, state exactly what was skipped and why.
- Maintain code coverage at 80% or higher where possible.
- Shader-related code is the standing coverage exception.
- Test coverage at 80%+ is a release gate unless an explicit approved exception applies.

## 10. Default Delivery Workflow
- The default for agent-driven engineering work is the full delivery workflow described in `WORKFLOW.md`.
- Do not skip these steps for normal feature, bug-fix, refactor, package, API, dashboard, frontend, backend, or release-bearing work.
- Most commits should follow the heavy-weight workflow to avoid drift and code hygiene issues.
- Only clearly trivial edits may use the trivial-edit exception described in `WORKFLOW.md`.

## 11. Dependency Hygiene Policy
- Dependency hygiene exists to avoid drift and reduce code hygiene issues.
- At the start of each Epic, review and update relevant `dependencies`, `devDependencies`, and `peerDependencies` for the Epic scope.
- Complete required dependency update work before or as part of the Epic when the Epic depends on it.
- Features may still trigger targeted dependency updates when specifically required.
- Avoid unrelated dependency churn outside the Epic scope unless necessary for correctness, security, or compatibility.
- Keep dependencies clean and free from known issues/defects relevant to the Epic scope.

## 12. Capability and Feature-Flag Governance
- Apply the detailed rules in `FLAGS_AND_CAPABILITIES.md`.
- Every Feature must have at least one named, remotely controllable feature flag before implementation starts.
- Capabilities are required only when user-visible entitlement, discoverability, navigation, configuration, role-based access, or similar product access concerns are involved.
- Capabilities do not replace the Feature-flag requirement.
- If a feature is both user-visible and rollout-sensitive, use both mechanisms together.

## 13. Release and Deployment Governance
- A feature or bug fix is not complete until all relevant documentation is updated, required validation is green, and applicable merge/release-bearing pipeline obligations have been satisfied.
- Production releases must be executed only through `.github/workflows/cd.yml` on `main` using the GitHub `production` environment.
- Required post-release validation: confirm the `cd.yml` run succeeded and verify backend sensitive envs are mapped via `secretref` in Azure Container Apps.
- CI must be verified after push for tracked implementation work.
- `cd.yml` verification is required only when the change is merge/release-bearing on `main`.
- Do not mark merge/release-bearing work complete until the relevant CI and CD gates have succeeded.

## 14. Package Creation Rules
- Use `/Users/philliphounslow/plasius/schema` (`@plasius/schema`) as the baseline template when creating new `@plasius/*` packages.
- Copy template runtime/tooling files at project creation: `.nvmrc` and `.npmrc`.
- Create and maintain required package docs from the start:
  - `README.md`
  - `CHANGELOG.md`
  - `AGENTS.md`
- Include required legal/compliance files and folders used by the template/repo standards:
  - `LICENSE`
  - `SECURITY.md`
  - `CONTRIBUTING.md`
  - `legal/` documents, including CLA-related files where applicable
- Include architecture/design documentation requirements:
  - ADRs in `docs/adrs/`
  - TDRs for technical decisions/direction
  - Design documents for significant implementation plans and system behavior
- Define test scripts/strategy at creation time.
- New packages should be created with tests, docs, and coverage expectations from the outset.

## 15. Companion Guidance Files
- `WORKFLOW.md`: detailed delivery workflow, task sequencing, and trivial-edit exception.
- `FLAGS_AND_CAPABILITIES.md`: detailed capability and feature-flag governance.
- `RETROSPECTIVE_RULES.md`: retrospective learnings and promotion guidance for durable future rules.
- `NFR.md`: mandatory source of truth for non-functional acceptance criteria for new features.

## 16. Local Repository Guidance
The following repo- or directory-specific guidance from the previous local `AGENTS.md` remains active where it does not conflict with the curated governance above or companion files.

### Scope
- @plasius/voice is a TypeScript/React hook + provider library for speech recognition and voice intent mapping.
- Source of truth is `src/`; `dist/` and `coverage/` are generated.

### Working conventions
- Keep changes focused; avoid edits in `dist/`, `coverage/`, `node_modules/`, `temp/` unless explicitly requested.
- Use TypeScript + ESM (package.json "type": "module") and prefer named exports.
- Follow existing patterns in `src/` (hooks, providers, intent registration).

### Commands
- `npm run build` (tsup)
- `npm test` (vitest)
- `npm run lint` (eslint)

### Docs/tests
- Update README or docs if public API changes.
- Add/adjust tests in `tests/` when behavior changes.
- Architectural changes require ADRs in `docs/adrs/` (or the repo ADRs folder); ensure a package-function ADR exists.

### Review checklist
- Build passes, tests pass, no changes in generated artifacts.

### AI guidance
- After any change, run relevant BDD/TDD tests when they exist; mention if skipped.
- For fixes, add/update a BDD or TDD test that fails first and validate it passes after the fix when possible.
- When adding or updating dependencies, prefer lazy-loading (dynamic import/code splitting) to avoid heavy first-load network use when applicable.
