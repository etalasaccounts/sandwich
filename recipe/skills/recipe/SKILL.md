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

## Output file schemas (MANDATORY)

**Use these field names and types exactly. Do NOT invent field names.**

### Spec JSON — `docs/sandwich/specs/F-001.json`

```json
{
  "featureId": "F-001",
  "title": "User authentication flow",
  "summary": "OAuth2 login with Google and email/password",
  "acceptanceCriteria": [
    {
      "id": "AC-001",
      "given": "User is on the login page",
      "when": "User clicks Google Sign-In",
      "then": "User is authenticated and redirected to dashboard",
      "testable": true,
      "testCommand": "npm test -- --grep 'Google OAuth'"
    }
  ],
  "scope": {
    "inScope": ["OAuth2 integration", "Session management"],
    "outOfScope": ["Password recovery", "2FA"]
  },
  "tasks": [
    {
      "id": "T-001",
      "description": "Create OAuth module",
      "files": ["src/auth/oauth.ts"],
      "acceptanceCriteria": ["AC-001"],
      "estimatedMinutes": 30
    }
  ],
  "harness": {
    "setup": ["npm install"],
    "testsToWrite": ["src/auth/__tests__/oauth.test.ts"],
    "validators": ["npm run build", "npm test", "npm run lint"]
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `acceptanceCriteria[].id` | string | `AC-001`, `AC-002`, ... |
| `tasks[].id` | string | `T-001`, `T-002`, ... |
| `tasks[].acceptanceCriteria` | string[] | Must reference existing AC IDs |
| `tasks[].estimatedMinutes` | number | 1–60 (tasks must be atomic) |
| `harness.validators` | string[] | At least one command required |

### Registry update — after writing the spec

Update the feature in `.sandwich/registry/features.json`:
- Set `lifecycle` to `"speced"` (only if currently `"proposed"` or `"queued"`)
- Set `specRef` to `"docs/sandwich/specs/F-001.json"`
- Set `flags.stale` to `false`
- Set `updatedAt` to current ISO timestamp

Append to `.sandwich/registry/journal.jsonl`:
```
{"ts":"2026-06-29T12:00:00.000Z","actor":"system","type":"spec-generated","target":"F-001","summary":"Spec generated for User auth flow"}
```

Journal field names: `ts` (NOT `timestamp`), `actor` (NOT `agent`), `type` (NOT `action`), `summary` (NOT `details`).

## Style rules

- Acceptance criteria use Given/When/Then
- Task descriptions are imperative ("Create OAuth module")
- File paths are exact (no wildcards)
- Test commands are copy-pasteable
