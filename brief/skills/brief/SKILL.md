---
name: brief
description: Turn any client input into standardized PRD artifacts. Use ONLY when explicitly invoked with /brief or when the user pastes a raw requirement document (KAK, RFQ, MOM) as the primary input. Do NOT invoke during active development, coding tasks, or general conversation.
---

# sandwich/brief

You are running the `brief` pipeline. Your job is to turn the client's input into four standardized artifacts in `docs/sandwich/brief/`.

## When to invoke this skill

- User pastes a KAK, RFQ, MOM, or meeting notes
- User says "brief this" / "run brief" / "buat brief" / "generate prd"
- User runs `/brief`

## Artifacts

All four are always generated (or updated) at: `docs/sandwich/brief/`

| File | Purpose |
|------|---------|
| `prd.md` | Canonical requirements — actors, modules, features, constraints |
| `user-flows.md` | Narrative user journeys (Jeff Patton backbone stories) |
| `technical-notes.md` | Tech lead's architecture notes — decisions, risks, stack |
| `client-questions.md` | Prioritized questions the team needs answered |

## Mode detection

Before running, check whether `docs/sandwich/brief/prd.md` already exists:

- **New mode** — file does not exist. Create all four from scratch.
- **Refine mode** — file exists AND user is providing new/updated requirements. Update all four, mark changed sections with `<!-- updated -->`.
- **Answer mode** — file exists AND user is pasting client answers to questions in `client-questions.md`. Integrate answers, move resolved questions to Answered section.

## Pipeline

Run these steps in order. Each step's output feeds the next.

1. **Detect mode** — check for existing `docs/sandwich/brief/prd.md`
2. **Read existing artifacts** — if refine/answer mode, read all four files
3. **Extract requirements** — parse the raw input into structured requirements (actors, modules, features, constraints, ambiguities)
4. **Write prd.md** — canonical requirements document
5. **Write user-flows.md** — narrative flows, one per major actor journey
6. **Write technical-notes.md** — tech lead's architecture notes
7. **Write client-questions.md** — prioritized questions for client
8. **Summarize** — print a one-paragraph summary of what was created/changed

## Output

After writing all four files, print:
```
✓ docs/sandwich/brief/prd.md
✓ docs/sandwich/brief/user-flows.md
✓ docs/sandwich/brief/technical-notes.md
✓ docs/sandwich/brief/client-questions.md

[one sentence summary of what the project is and what mode was used]
```

## Style rules

- Keep client's terminology — don't translate their module names
- Be opinionated in technical-notes.md — recommend, don't just list options
- client-questions.md max 5 questions per priority level
- user-flows.md is narrative, not UI spec — "requests asset collaboration" not "clicks the blue button"
