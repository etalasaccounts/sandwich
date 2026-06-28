---
name: prep
description: Tech lead-level prioritization and impact analysis. Consumes brief artifacts, produces feature queue with scores, dependencies, and recommendations. All outputs validated with zod schemas and confidence checks. Use when you need to decide what to build next.
---

# sandwich/plan

You are running the `plan` pipeline. Your job: produce prioritization data that helps humans decide what to build next.

## When to invoke

- User runs `/prep`
- User asks "what should we build first" / "apa yang harus dikerjakan dulu"
- User has a brief and wants to start implementation
- User wants to understand the impact of a specific feature

## What it produces

Output is split into the **committed registry** (the source of truth) and
**git-ignored views** (disposable projections). A `.sandwich/.gitignore` is
written automatically to enforce this posture.

**Committed — `.sandwich/registry/`:**

| File | Purpose |
|------|---------|
| `project.json` | Project metadata, brief hashes, gate states |
| `features.json` | Canonical feature ledger — stable IDs, lifecycle, scores, human overrides, spec links, commits |
| `questions.json` | Client questions ↔ answers ↔ what they unblock |
| `decisions.json` | ADR-lite scope/architecture decisions |
| `journal.jsonl` | Append-only audit trail of every change |

**Git-ignored — rendered each run:**

| File | Purpose |
|------|---------|
| `feature-queue.md` | Human-readable projection of the registry |
| `impact-analysis.md` | Deep dive on a specific feature (on demand) |
| `.plan-context.json` | Validation/debug context |

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

8. **Present recommendation** — top 3 candidates with validation status

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

The feature queue is git-ignored because it's derivative work from brief. Can be regenerated at any time.

## Style rules

- Present data, don't argue
- If multiple good options exist, show tradeoffs
- Never recommend a blocked feature
- Flag confidence level on every feature
- Include source traceability (file:line)
