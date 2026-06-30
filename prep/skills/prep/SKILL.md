---
name: prep
description: Tech lead-level prioritization and impact analysis. Consumes brief artifacts, produces feature queue with scores, dependencies, and recommendations. All outputs validated with zod schemas and confidence checks. Use when you need to decide what to build next.
---

# sandwich/prep

You are running the `prep` pipeline. Your job: produce prioritization data that helps humans decide what to build next.

## When to invoke

- User runs `/prep`
- User asks "what should we build first" / "apa yang harus dikerjakan dulu"
- User has a brief and wants to start implementation
- User wants to understand the impact of a specific feature

## What it produces

Output is split into the **committed registry** (the source of truth) and
**committed views** (shareable projections in `docs/sandwich/`). A `.sandwich/.gitignore` is
written automatically to keep machine state hidden.

**Committed — `.sandwich/registry/`:**

| File | Purpose |
|------|---------|
| `project.json` | Project metadata, brief hashes, gate states |
| `features.json` | Canonical feature ledger — stable IDs, lifecycle, scores, human overrides, spec links, commits |
| `questions.json` | Client questions ↔ answers ↔ what they unblock |
| `decisions.json` | ADR-lite scope/architecture decisions |
| `journal.jsonl` | Append-only audit trail of every change |

**Committed views — rendered each run to `docs/sandwich/`:**

| File | Purpose |
|------|---------|
| `feature-queue.md` | Human-readable projection of the registry (shareable with PMs) |

**Git-ignored (machine state):**

| File | Purpose |
|------|---------|
| `.sandwich/impact-analysis.md` | Deep dive on a specific feature (on demand) |
| `.sandwich/.plan-context.json` | Validation/debug context |

Feature identity is stable: a feature keeps its ID (and its spec, commits, and
human overrides) across re-runs even if the brief rewore its title, because
matching is by content fingerprint — never by position or exact text.

## Pipeline

1. **Read brief artifacts** — prd.md, user-flows.md, technical-notes.md, client-questions.md

2. **Validate brief** — check completeness, warn if critical artifacts missing

3. **Extract features** — parse all features with validation + retry (max 3 attempts)

4. **Check confidence** — if confidence < 0.4, block and require human review

5. **Reconcile** — if brief changed, merge with existing queue (preserve in-progress work)

6. **Analyze dependencies** — build dependency graph with validation

7. **Score features** — the agent supplies four dimension scores (impact, effort, risk, urgency); code computes the priority deterministically as `(impact × urgency × (10 − risk)) ÷ effort`, normalized to 0-100. The model never supplies the number, so the ranking is always reproducible.

8. **Write registry files** — write `features.json`, `project.json`, `questions.json`, `decisions.json`, and append to `journal.jsonl`. The pi-gate validates each write against the schema; if validation fails it prints the exact errors — fix the field and retry.

9. **Run the deterministic renderer** — after all registry files are written, run:
   ```bash
   node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/render.ts
   ```
   `SANDWICH_ROOT` is injected into your context at session start. The script reads the registry, renders `docs/sandwich/feature-queue.md`, and exits 1 with exact errors if the registry is invalid. Fix any errors and re-run.

10. **Present recommendation** — top 3 candidates with validation status

## Validation layer

Every agent output passes through:

1. **Schema validation** — zod schema catches format errors
2. **Retry with repair** — on validation failure, agent retries with error message
3. **Confidence scoring** — based on confidence markers in features
4. **Threshold blocking** — low confidence (< 0.4) blocks execution

```
Agent output → JSON parse → Schema validate → Confidence check
                    ↓              ↓                ↓
              malformed?      invalid?          too low?
                    ↓              ↓                ↓
               retry (3x)     retry (3x)       block + warn
```

**Confidence weights:**
- `[stated]` = 1.0
- `[discussed]` = 0.8
- `[inferred]` = 0.5
- `[assumed]` = 0.2

**Blocking thresholds:**
- Average confidence < 0.4 → block
- > 30% assumed features → block

## Output format

```
┌─────────────────────────────────────────────┐
│ FEATURE QUEUE                               │
├─────────────────────────────────────────────┤
│ Priority 1 (Recommended)                    │
│                                             │
│ F-001: User authentication flow             │
│   Impact: 9/10 | Effort: 5/10 | Risk: 3/10  │
│   Priority Score: 85                        │
│   Unblocks: F-003, F-007, F-012             │
│   Source: prd.md L45-52                     │
│                                             │
├─────────────────────────────────────────────┤
│ VALIDATION                                  │
│                                             │
│ Confidence: 0.87                            │
│ All outputs validated: ✓                    │
├─────────────────────────────────────────────┤
│ RECOMMENDATION                              │
│                                             │
│ Start with F-001. Unblocks 5 features,      │
│ low risk, well-understood domain.           │
└─────────────────────────────────────────────┘
```

## Commands

| Command | Behavior |
|---------|----------|
| `/prep` | Smart: reconcile if brief changed, else use existing queue |
| `/prep --fresh` | Force re-extraction, ignore existing queue |
| `/prep [feature-id]` | Deep impact analysis for specific feature |
| `/prep --impact-only [feature-id]` | Skip prioritization, just analyze impact |
| `/prep --queue-only` | Update queue without recommendation |

## Key principles

1. **Human decides, AI analyzes** — provide data, not orders
2. **Unblocking is high value** — features that enable others score higher
3. **Confidence matters** — `[assumed]` features flagged for validation
4. **Execution state aware** — if F-001 is already in progress, don't recommend it
5. **Brief is source of truth** — never invent features not in brief
6. **Preserves in-progress work** — reconciliation never auto-removes active features

## Reconciliation behavior

When brief changes after initial `/prep`:

```
/order --refine → brief artifacts update
        ↓
/prep → detects brief change
        ↓
    Reconciles:
      • New features → add to queue
      • Removed features → flag for review (preserve if in-progress)
      • Changed features → mark "needs-reanalysis"
        ↓
    Output: "3 added, 1 removed, 2 affected"
```

### Removal actions

| Status | Action |
|--------|--------|
| in-progress | `preserve_and_flag` — never auto-remove active work |
| done | `keep_as_history` — preserve completed features |
| queued | `flag_for_review` — ask human to confirm removal |

## Relationship to other ingredients

```
/order → /prep → User picks → /recipe → Superpowers (execution)
           │
           └─→ feature-queue.md (execution state)
```

The feature queue is committed to `docs/sandwich/` — shareable with PMs. It can be regenerated at any time from the registry.

## Registry file schemas (MANDATORY)

**These are exact schemas. Use these field names and types precisely.**
**Do NOT invent field names. Do NOT wrap arrays in objects.**

> **A deterministic gate validates every registry write.** Writes to
> `.sandwich/registry/*` are checked against these schemas in code before they
> land: the priority number is recomputed from your dimension scores (you never
> set it), recoverable mistakes are auto-corrected, and anything that can't be
> validated is rejected with the exact errors to fix. Follow the schema and the
> write succeeds on the first try.

Registry files go in `.sandwich/registry/`. Create the directory if it doesn't exist.

### features.json — bare JSON array

```json
[
  {
    "id": "F-001",
    "fingerprint": "user-auth-core",
    "title": "User authentication flow",
    "description": "OAuth2 login with Google and email/password",
    "type": "feature",
    "module": "Auth",
    "confidence": "stated",
    "lifecycle": "proposed",
    "flags": { "needsReanalysis": false, "stale": false, "orphaned": false },
    "provenance": { "file": "prd.md", "lines": "45-52", "briefHash": "a3f2c1d8" },
    "dependsOn": [],
    "blocks": ["F-003", "F-007"],
    "blockedBy": [],
    "score": {
      "impact": { "score": 9, "factors": ["Unblocks 5 downstream features"] },
      "effort": { "score": 5, "factors": ["OAuth integration"] },
      "risk": { "score": 3, "factors": ["Well-understood pattern"] },
      "urgency": { "factor": 1.5, "reason": "Blocks other features" },
      "priority": 85,
      "formulaVersion": 1
    },
    "overrides": {},
    "specRef": null,
    "commits": [],
    "createdAt": "2026-06-29T12:00:00.000Z",
    "updatedAt": "2026-06-29T12:00:00.000Z"
  }
]
```

| Field | Type | Valid values |
|-------|------|-------------|
| `id` | string | `F-001`, `F-002`, ... (zero-padded 3 digits) |
| `type` | enum | `feature`, `improvement`, `bugfix`, `infrastructure` |
| `confidence` | enum | `stated`, `discussed`, `inferred`, `assumed` |
| `lifecycle` | enum | `proposed`, `queued`, `speced`, `building`, `review`, `done`, `deferred`, `rejected` |
| `provenance` | object | `{ "file": "prd.md", "lines": "45-52", "briefHash": "<16-char sha256 prefix>" }` |
| `score.urgency.factor` | number | `0.8`, `1.0`, `1.2`, or `1.5` only |
| `score.priority` | number | Computed: `(impact.score × urgency.factor × (10 − risk.score)) ÷ effort.score`, 0–100 |
| `score.formulaVersion` | number | Always `1` |
| `fingerprint` | string | Lowercase, punctuation-stripped: `title + "\|" + module` |

### project.json — single object

```json
{
  "schemaVersion": 1,
  "name": "Project Name",
  "briefHashes": {
    "prd": "a3f2c1d8e9b4f7a6",
    "userFlows": "b4g3d2e9f0a5b8c7",
    "technicalNotes": null,
    "clientQuestions": "d6i5f4a1b2c7d0e9"
  },
  "gates": {
    "briefApproved": { "passed": false },
    "queueApproved": { "passed": false }
  },
  "createdAt": "2026-06-29T12:00:00.000Z",
  "updatedAt": "2026-06-29T12:00:00.000Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | number | Always `1` |
| `briefHashes.*` | string or null | SHA-256 prefix (16 chars) of each brief artifact |
| `gates.*` | object | `{ "passed": boolean, "by"?: string, "at"?: string }` |

### questions.json — bare JSON array

```json
[
  {
    "id": "Q1",
    "text": "What is the warranty period end date?",
    "priority": 1,
    "status": "open",
    "unblocks": ["F-005", "F-006"]
  }
]
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `Q1`, `Q2`, `Q3` — no dash, no zero-padding |
| `text` | string | The question (NOT `question`) |
| `priority` | number | `1`, `2`, or `3` |
| `status` | enum | `open` or `answered` |
| `answer` | string | Only present when `status` is `answered` |
| `unblocks` | string[] | Feature IDs (NOT `blocksFeature` or `blocks`) |

### journal.jsonl — one JSON object per line, append-only

```
{"ts":"2026-06-29T12:00:00.000Z","actor":"system","type":"feature-added","target":"F-001","summary":"New feature: User auth flow"}
```

| Field | Type | Notes |
|-------|------|-------|
| `ts` | string | ISO timestamp (NOT `timestamp`) |
| `actor` | string | `"system"` or person handle (NOT `agent`) |
| `type` | enum | `brief-changed`, `feature-added`, `feature-rescored`, `lifecycle-changed`, `override-set`, `question-answered`, `decision-recorded`, `reconciled`, `gate-passed`, `spec-generated`, `build-completed`, `drift-detected` |
| `target` | string | Optional. e.g. `"F-001"`, `"Q3"` |
| `summary` | string | Short description (NOT `details`) |

### Common mistakes — DO NOT make these

| Wrong | Correct |
|-------|---------|
| `{ "features": [...] }` | bare array `[...]` |
| `{ "questions": [...] }` | bare array `[...]` |
| `"lifecycle": "ready"` | `"lifecycle": "proposed"` |
| `"lifecycle": "blocked"` | `"lifecycle": "queued"` + `"blockedBy": [...]` |
| `"question": "..."` | `"text": "..."` |
| `"blocksFeature": [...]` | `"unblocks": [...]` |
| `"timestamp": "..."` | `"ts": "..."` |
| `"action": "..."` | `"type": "..."` |
| `"source": "prd.md"` | `"provenance": { "file": "prd.md", "briefHash": "..." }` |
| `"status": "queued"` | `"lifecycle": "queued"` |
| `"id": "Q-001"` | `"id": "Q1"` |
| `"specLink": null` | `"specRef": null` |
| `"humanOverride": null` | `"overrides": {}` |

## Style rules

- Present data, don't argue
- If multiple good options exist, show tradeoffs
- Never recommend a blocked feature
- Flag confidence level on every feature
- Include source traceability (file:line)
