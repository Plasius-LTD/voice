# AGENTS.md

## Scope
- @plasius/voice is a TypeScript/React hook + provider library for speech recognition and voice intent mapping.
- Source of truth is `src/`; `dist/` and `coverage/` are generated.

## Working conventions
- Keep changes focused; avoid edits in `dist/`, `coverage/`, `node_modules/`, `temp/` unless explicitly requested.
- Use TypeScript + ESM (package.json "type": "module") and prefer named exports.
- Follow existing patterns in `src/` (hooks, providers, intent registration).

## Commands
- `npm run build` (tsup)
- `npm test` (vitest)
- `npm run lint` (eslint)

## Docs/tests
- Update README or docs if public API changes.
- Add/adjust tests in `tests/` when behavior changes.
- Architectural changes require ADRs in `docs/adrs/` (or the repo ADRs folder); ensure a package-function ADR exists.

## Review checklist
- Build passes, tests pass, no changes in generated artifacts.

## AI guidance
- After any change, run relevant BDD/TDD tests when they exist; mention if skipped.
- For fixes, add/update a BDD or TDD test that fails first and validate it passes after the fix when possible.
- When adding or updating dependencies, prefer lazy-loading (dynamic import/code splitting) to avoid heavy first-load network use when applicable.
