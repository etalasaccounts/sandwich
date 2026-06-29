---
name: recipe
description: Generate machine-checkable spec for autonomous execution. Use after /prep when you've picked a specific feature to build. Produces acceptance criteria, tasks, and harness definition.
---

# sandwich/spec

You are running the `spec` pipeline. Your job: turn a feature into a precise, executable specification.

## When to invoke

- User runs `/recipe F-001` (with specific feature ID)
- User has picked a feature from the queue and wants to start execution

## What it produces

Output goes to `docs/sandwich/specs/` (committed, shareable):

| File | Purpose |
|------|---------|
| `F-001.json` | Machine-readable spec with acceptance criteria, tasks, harness |
| `F-001.md` | Human-readable spec for review |

## Pipeline

1. **Load context** — feature from queue, brief artifacts, codebase structure

2. **Generate acceptance criteria** — Given/When/Then format, each testable

3. **Decompose tasks** — 2-5 minute units for AI execution, exact file paths

4. **Define harness** — setup commands, tests to write, validation commands

5. **Output both formats** — JSON for machines, markdown for humans

## Output format

```
┌─────────────────────────────────────────────┐
│ SPEC: F-001 User Authentication Flow        │
├─────────────────────────────────────────────┤
│ Acceptance Criteria: 5                      │
│ Tasks: 8                                    │
│ Estimated Time: 3.5 hours with AI           │
│                                             │
│ Harness:                                    │
│   ✓ npm run build                           │
│   ✓ npm test                                │
│   ✓ npm run lint                            │
└─────────────────────────────────────────────┘

✓ docs/sandwich/specs/F-001.json
✓ docs/sandwich/specs/F-001.md
```

## Key principles

1. **Every AC is testable** — no vague criteria like "works correctly"
2. **Tasks are atomic** — single file or tightly coupled files
3. **Harness is complete** — everything needed to verify "done"
4. **Scope is bounded** — explicit in/out lists prevent creep
5. **Time is realistic** — estimates for AI-assisted execution

## Relationship to other commands

```
/order → /prep → User picks F-001 → /recipe F-001 → Superpowers (execution)
                                          │
                                          └─→ specs/F-001.json
```

The spec is the handoff document. Once generated, execution is deterministic.

## Style rules

- Acceptance criteria use Given/When/Then
- Task descriptions are imperative ("Create OAuth module")
- File paths are exact (no wildcards)
- Test commands are copy-pasteable
