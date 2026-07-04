---
name: order
description: Take a project order and produce the kitchen brief — four standardized documents (prd.md, user-flows.md, technical-notes.md, client-questions.md) that the rest of the pipeline needs to cook. Use ONLY when explicitly invoked with /order, or when the user asks to document/brief a project. Do NOT invoke during active development, coding tasks, or general conversation.
---

# /order

You are taking an order. Your job: produce four standardized documents in `docs/sandwich/` that feed the downstream pipeline.

## When to invoke

- User runs `/order`
- User pastes a KAK, RFQ, MOM, or meeting notes
- User says "brief this" / "buat brief" / "document this project" / "generate prd"
- User is onboarding onto a project with no order yet

## Artifacts

All four are always written to `docs/sandwich/`:

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
| `brownfield` | Codebase exists, no `docs/sandwich/prd.md` yet |
| `refine` | Brief exists + new requirements input |
| `answer` | Brief exists + input looks like answers to client-questions.md |

## Pipeline

**Do NOT ask questions. Do NOT ask for clarification. The input is already in this message — process it immediately.**

1. **Detect context** — check: does `docs/sandwich/prd.md` exist? does a codebase exist (`package.json`, `src/`, etc.)? what kind of input is this?

2. **Discover** *(brownfield only)* — scan file tree, read key files, read git history in parallel

3. **Extract requirements** — parse input (or codebase signals) into structured requirements with confidence levels: `stated`, `discussed`, `inferred`, `assumed`

4. **Generate all four artifacts** — for each artifact, in parallel:
   a. Write the JSON document to `docs/sandwich/<artifact>.json` (exact schema below — your JSON must match it precisely)
   b. Run the deterministic renderer:
      ```bash
      node --experimental-strip-types $SANDWICH_ROOT/order/scripts/render.ts <kind>
      ```
      `SANDWICH_ROOT` is injected into your context at session start as
      plain text (e.g. `SANDWICH_ROOT=/path/to/plugin`) — it is NOT a live
      shell environment variable, and Bash tool calls do not share shell
      state with each other. Read the path from your context and substitute
      it literally in place of `$SANDWICH_ROOT` above before running — do
      not rely on `$SANDWICH_ROOT` to shell-expand, since nothing exported it.

   The script validates your JSON and writes the `.md`. If validation fails, it prints the exact errors — fix your JSON and re-run.

   | Artifact | kind argument |
   |----------|--------------|
   | `docs/sandwich/prd.json` | `prd` |
   | `docs/sandwich/user-flows.json` | `user-flows` |
   | `docs/sandwich/technical-notes.json` | `technical-notes` |
   | `docs/sandwich/client-questions.json` | `client-questions` |

5. **Reconcile** *(refine/answer only)* — summarize what changed

## Output

```
✓ docs/sandwich/prd.md
✓ docs/sandwich/user-flows.md
✓ docs/sandwich/technical-notes.md
✓ docs/sandwich/client-questions.md

[one sentence: project name, mode used, N questions remain / N inferred items to validate]
```

## Style rules

- Keep client's terminology — do not translate module names
- Be opinionated in technical-notes.md
- client-questions.md: max 5 per priority level, Priority 1 = blocks task breakdown
- user-flows.md: narrative, not UI spec — "requests collaboration" not "clicks button"
- Brownfield: every inferred item carries `inferred` confidence — do not present guesses as facts

---

## Output schemas (MANDATORY)

**These are exact schemas. Use these field names and types precisely.**
**Do NOT invent field names. Do NOT add extra wrappers.**
**Each JSON file must start with `{` — no markdown fences, no preamble.**

> A deterministic renderer (`order/scripts/render.ts`) validates every JSON you write. Validation errors print the exact field and message — follow the schema and the first write succeeds.

### prd.json

```json
{
  "projectName": "My Project",
  "mode": "greenfield-doc",
  "overview": "A platform that...",
  "projectState": {
    "phase": "planning",
    "hasExistingCodebase": false,
    "orderSource": "KAK document"
  },
  "actors": [
    { "name": "End User", "role": "Primary consumer of the platform", "confidence": "stated" }
  ],
  "modules": [
    {
      "name": "Auth",
      "status": "planned",
      "description": "Handles user authentication and session management",
      "features": [
        { "text": "OAuth2 login with Google", "confidence": "stated" }
      ]
    }
  ],
  "integrations": [
    { "text": "Firebase Auth", "confidence": "inferred" }
  ],
  "constraints": [
    { "text": "Must support mobile browsers", "confidence": "stated" }
  ],
  "stakeholders": [
    { "name": "PT Maju Bersama", "role": "Client" }
  ],
  "timeline": "3 months",
  "openQuestionsCount": 3
}
```

| Field | Type | Valid values |
|-------|------|-------------|
| `mode` | enum | `greenfield-doc`, `greenfield-idea`, `brownfield`, `refine`, `answer` |
| `projectState.hasExistingCodebase` | boolean | `true` or `false` |
| `actors[].confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |
| `modules[].status` | enum | `planned`, `exists`, `partial`, `broken` |
| `modules[].features[].confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |
| `integrations[].confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |
| `constraints[].confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |
| `timeline` | string or null | `null` if unknown |
| `openQuestionsCount` | integer ≥ 0 | count of questions in client-questions.json |

Constraints: `actors` ≥ 1, `modules` ≥ 1, each `module.features` ≥ 1.

### user-flows.json

```json
{
  "flows": [
    {
      "id": "UF-001",
      "title": "User logs in with Google",
      "actor": "End User",
      "trigger": "User clicks 'Login with Google' on landing page",
      "steps": [
        "User is redirected to Google OAuth consent screen",
        "User grants permission",
        "System creates session, redirects to dashboard"
      ],
      "outcome": "User is authenticated and sees their dashboard",
      "confidence": "stated"
    }
  ]
}
```

| Field | Type | Valid values |
|-------|------|-------------|
| `flows[].id` | string | `UF-001`, `UF-002`, ... (zero-padded 3 digits) |
| `flows[].confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |
| `flows[].steps` | string[] | at least 1 step |

Constraints: `flows` ≥ 1.

### technical-notes.json

```json
{
  "stack": [
    { "layer": "Frontend", "choice": "Next.js 14", "rationale": "Client's team already familiar" },
    { "layer": "Database", "choice": "PostgreSQL", "rationale": "Relational data, complex queries needed" }
  ],
  "architectureNotes": [
    {
      "heading": "Multi-tenancy approach",
      "body": "Row-level security via tenant_id on all tables. Chosen over separate schemas to reduce ops overhead."
    }
  ],
  "risks": [
    { "text": "OAuth integration may hit rate limits during demo day", "severity": "medium" }
  ],
  "openDecisions": [
    { "text": "S3 vs GCS for file storage — cost comparison pending", "confidence": "assumed" }
  ]
}
```

| Field | Type | Valid values |
|-------|------|-------------|
| `risks[].severity` | enum | `low`, `medium`, `high` |
| `openDecisions[].confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |

Constraints: `stack.length + architectureNotes.length` ≥ 1 (at least one of the two must be non-empty).

### client-questions.json

```json
{
  "questions": [
    {
      "id": "Q-001",
      "question": "What is the expected concurrent user load at peak?",
      "why": "Determines whether we need horizontal scaling from day one",
      "blocks": ["Auth", "Infrastructure"],
      "priority": "high"
    }
  ]
}
```

| Field | Type | Valid values |
|-------|------|-------------|
| `questions[].id` | string | `Q-001`, `Q-002`, ... (zero-padded 3 digits) |
| `questions[].priority` | enum | `high`, `medium`, `low` |
| `questions[].blocks` | string[] | module or feature names this question blocks |

Constraints: `questions` can be empty (no open questions is valid).

### Common mistakes — DO NOT make these

| Wrong | Correct |
|-------|---------|
| `{ "prd": { ... } }` | bare object `{ "projectName": ... }` |
| `{ "flows": [...] }` wrapped in outer key | bare `{ "flows": [...] }` directly |
| `"confidence": "[stated]"` | `"confidence": "stated"` (no brackets) |
| `"status": "ready"` | `"status": "planned"` |
| `"id": "UF-1"` | `"id": "UF-001"` (zero-padded) |
| `"id": "Q1"` | `"id": "Q-001"` (with dash, zero-padded) |
| `"timeline": ""` | `"timeline": null` |
