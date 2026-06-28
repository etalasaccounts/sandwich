---
name: order
description: Generate or update project brief artifacts (prd.md, user-flows.md, technical-notes.md, client-questions.md). Use ONLY when explicitly invoked with /order, or when the user asks to document/brief a project. Do NOT invoke during active development, coding tasks, or general conversation.
---

# sandwich/brief

You are running the `brief` pipeline. Your job: produce four standardized artifacts in `docs/sandwich/brief/` that feed the downstream task breakdown pipeline.

## When to invoke

- User runs `/order`
- User pastes a KAK, RFQ, MOM, or meeting notes
- User says "brief this" / "buat brief" / "document this project" / "generate prd"
- User is onboarding onto a project with no brief yet
- `/order --approve` — pass the brief gate once you've reviewed `client-questions.md` and it's ready to share with the client (regenerating the brief later clears this automatically)

## Artifacts

All four are always written to `docs/sandwich/brief/`:

| File | Purpose |
|------|---------|
| `prd.md` | Canonical requirements — actors, modules, features, constraints, confidence markers |
| `user-flows.md` | Narrative user journeys with module status (planned/exists/partial) |
| `technical-notes.md` | Tech lead's architecture notes — decisions, risks, current state |
| `client-questions.md` | Prioritized questions blocking task breakdown |

## Mode detection (automatic)

You detect the right mode — the user doesn't need to specify:

| Mode | Signals |
|------|---------|
| `greenfield-doc` | No codebase, formal document (KAK/RFQ/MOM, long structured text) |
| `greenfield-idea` | No codebase, conversational or vague input |
| `brownfield` | Codebase exists, no `docs/sandwich/brief/prd.md` yet |
| `refine` | Brief exists + new requirements input |
| `answer` | Brief exists + input looks like answers to client-questions.md |

## Pipeline

1. **Detect context** — check: does `docs/sandwich/brief/prd.md` exist? does a codebase exist (`package.json`, `src/`, etc.)? what kind of input is this?

2. **Discover** *(brownfield only)* — scan file tree, read key files, read git history in parallel

3. **Extract requirements** — parse input (or codebase signals) into structured requirements with confidence markers: `[stated]`, `[discussed]`, `[inferred]`, `[assumed]`

4. **Generate all four artifacts in parallel** — prd.md, user-flows.md, technical-notes.md, client-questions.md

5. **Reconcile** *(refine/answer only)* — summarize what changed

## Output

```
✓ docs/sandwich/brief/prd.md
✓ docs/sandwich/brief/user-flows.md
✓ docs/sandwich/brief/technical-notes.md
✓ docs/sandwich/brief/client-questions.md

[one sentence: project name, mode used, N questions remain / N inferred items to validate]
```

## Style rules

- Keep client's terminology — do not translate module names
- Be opinionated in technical-notes.md
- client-questions.md: max 5 per priority level, Priority 1 = blocks task breakdown
- user-flows.md: narrative, not UI spec — "requests collaboration" not "clicks button"
- Brownfield: every inferred item carries `[inferred]` — do not present guesses as facts
