# RETROSPECTIVE_RULES.md

## 1. Purpose
This file captures retrospective learnings and governs how rejected or revised approaches should influence future guidance without polluting the curated active rule set in `AGENTS.md`.

## 2. Core Rule
- Do not automatically convert every user rejection into a permanent active rule in `AGENTS.md`.
- `AGENTS.md` should remain curated, current, and operationally clear.
- Use this file to record candidate lessons first.

## 3. Rejection Handling Process
When the user rejects a proposed change or approach:
1. Stop and ask for the rejection reason if the reason is not already clear.
2. Determine whether the rejection is:
   - task-specific;
   - repo-specific and likely to recur;
   - or a broader standing preference.
3. If the lesson is task-specific, apply it only to the current task and do not promote it to persistent guidance.
4. If the lesson appears durable and likely to recur, record it here as a retrospective note.
5. Promote a retrospective lesson into `AGENTS.md` only when it is clearly durable, repo-relevant, and broadly useful across future tasks.

## 4. Conflicting Guidance Process
- If a proposed new durable rule conflicts with an existing active rule, do not silently supersede it.
- Ask the user which rule should remain active.
- Only after user confirmation should the active curated guidance in `AGENTS.md` be updated.
- Historical notes may remain here for traceability, but `AGENTS.md` should contain only the current active rule set.

## 5. Suggested Retrospective Entry Format
Use entries such as:
- Date:
- Context:
- Rejected approach:
- Reason for rejection:
- Durable lesson candidate:
- Scope assessment: task-specific / repo-specific / standing preference
- Promotion status: not promoted / promoted to AGENTS.md

## 6. Promotion Standard
Promote a lesson from this retrospective file to `AGENTS.md` only when:
- the lesson is durable;
- it is likely to recur;
- it is useful across future tasks;
- it is not merely stylistic or one-off;
- and it improves operational quality without creating noise or contradiction.
