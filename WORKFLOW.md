# WORKFLOW.md

## 1. Purpose
This file defines the default heavy-weight delivery process for agent-driven work. The goal is to prevent drift, maintain code hygiene, and ensure implementation follows tracked requirements rather than ad hoc edits.

## 2. Default Rule
- Use this workflow for most implementation work.
- Do not skip these steps for normal features, bug fixes, refactors, package changes, API work, frontend work, backend work, dashboard work, documentation work that alters meaning/requirements, or release-bearing changes.
- The heavy-weight process is the default.
- Only the narrow trivial-edit exception may bypass this workflow.

## 3. Work Definition Order
1. Produce or update the design document.
2. Refine the design into tracked GitHub Project work using the hierarchy `Epic -> Feature -> Story -> Task`.
3. Use GitHub Issues with title prefixes `[EPIC]`, `[FEATURE]`, `[STORY]`, and `[TASK]` to delineate level.
4. Ensure ownership is visible by assigning the currently logged-in user's GitHub account to the issue actively being worked on.
5. Move the active issue to `In Progress` before implementation begins.
6. Ensure the parent Feature has the required rollout controls:
   - create a named, remotely controllable feature flag;
   - add capabilities only when user-visible entitlement/discoverability, navigation, configuration, or similar access concerns require them.

## 4. Story/Task Execution Loop
For each Story or Task contained in the Feature:
1. Read the design document, GitHub Project item, and acceptance criteria.
2. Derive tests from the requirements and acceptance criteria before implementation.
3. For fixes, add or update a failing verification test first when practical.
4. Implement the code as designed.
5. Run relevant tests and validation.
6. If tests fail, return to implementation and continue iterating until the required validation passes.
7. Update documentation required by the change, including `CHANGELOG.md` under `Unreleased` unless explicitly exempted.
8. Proceed to the next Story/Task only when the current item satisfies its acceptance criteria and required validation.

## 5. Feature Completion Rule
- Continue the Story/Task loop until all required child items of the Feature are complete.
- Do not mark the Feature complete while any required child Story/Task remains incomplete.
- Every Feature must have a feature flag before implementation starts.
- Capabilities are added only when the Feature involves user-visible entitlement/discoverability or similar access concerns.

## 6. Delivery Order After Implementation
1. Commit the completed change set.
2. Push the branch.
3. Verify CI success.
4. If the work is merge/release-bearing on `main`, verify the relevant `cd.yml` path for each affected repository.
5. For production releases on `main`, confirm deployment used `.github/workflows/cd.yml` with the GitHub `production` environment.
6. For production releases, verify backend sensitive envs are mapped via `secretref` in Azure Container Apps.
7. Only then mark the work complete.

## 7. Completion Gates
A feature or bug fix is not complete until:
- requirements and acceptance criteria are satisfied;
- required child Stories/Tasks are complete;
- relevant tests and validation are green;
- required documentation is updated;
- CI has succeeded;
- and CD has been verified when the change is merge/release-bearing on `main`.

## 8. Trivial-Edit Exception
The trivial-edit exception is intentionally narrow.

Allowed trivial-only examples:
- spelling fixes
- grammar fixes
- comment wording fixes
- formatting-only changes
- document-only changes that do not alter requirements, behavior, architecture, process expectations, public meaning, or release obligations

The trivial-edit exception does **not** apply to:
- code behavior changes
- API changes
- config changes affecting runtime behavior
- test logic changes
- documentation changes that alter requirements, architecture, acceptance criteria, rollout behavior, or operational expectations
- any tracked feature, story, or task implementation work
- anything merge/release-bearing beyond a trivial non-semantic edit

For a true trivial edit:
- full Epic/Feature/Story/Task breakdown is not required;
- issue creation may be omitted if the user explicitly wants a tiny local correction;
- still avoid unsafe shortcuts;
- still report what was changed.

## 9. Relationship to Other Governance
- `AGENTS.md` is the curated top-level rule set.
- `FLAGS_AND_CAPABILITIES.md` governs rollout controls.
- `RETROSPECTIVE_RULES.md` governs how lessons are captured and promoted.
- `NFR.md` is mandatory for non-functional acceptance criteria.
