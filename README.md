# sandwich

Composable agent stack for software agencies. **All outputs validated with zod schemas and confidence checks.**

## Install

**Pi:**
```bash
\pi install https://github.com/etalasaccounts/sandwich.git
```

**Claude Code:**
```bash
claude install https://github.com/etalasaccounts/sandwich.git
```

## Why sandwich?

**Problem:** LLM output is non-deterministic. Agent pipes crash on malformed JSON. Low-confidence outputs treated same as high.

**Solution:**
- **Schema validation** on every agent output (zod)
- **Retry with repair** — agent fixes its own mistakes (max 3 retries)
- **Confidence scoring** — weighted by `[stated]`/`[inferred]`/`[assumed]` markers
- **Threshold blocking** — low confidence blocks execution, requires human review

## Ingredients

### order

Turns any messy client input (MOM, RFQ, KAK, verbal notes) into four standardized artifacts:

- `docs/sandwich/brief/prd.md` — Product Requirements Document
- `docs/sandwich/brief/user-flows.md` — User flow narratives
- `docs/sandwich/brief/technical-notes.md` — Tech lead's architecture notes
- `docs/sandwich/brief/client-questions.md` — Clarifying questions for client

**In pi:** type `/order` or paste your client document and describe it

### prep

Tech lead-level prioritization and impact analysis. Consumes brief artifacts to produce:

- `.sandwich/feature-queue.md` — Prioritized features with impact/effort/risk scores
- `.sandwich/impact-analysis.md` — Deep dive on a specific feature

**In pi:** type `/prep` to get prioritization data, or `/prep F-001` for impact analysis on a specific feature

### recipe

Generate machine-checkable spec for autonomous execution. Produces acceptance criteria, tasks, and harness definition.

- `.sandwich/specs/F-001.json` — Machine-readable spec
- `.sandwich/specs/F-001.md` — Human-readable spec

**In pi:** type `/recipe F-001` after you've picked a feature from the queue

## Pipeline

```
/order (PM dumps intake iteratively)
      ↓
Brief artifacts (prd.md, user-flows.md, etc.)
      ↓
/prep (tech lead prioritization)
      ↓
Feature queue + recommendation
      ↓
User picks feature
      ↓
/recipe F-001 (machine-checkable spec)
      ↓
/build → Superpowers executes
```

**Key insight:** Human makes decisions at each gate. AI automates analysis.

## Commands

| Command | Purpose |
|---------|---------|
| `/order` | Generate/update brief artifacts from client input |
| `/prep` | Smart: reconcile if brief changed, else use existing queue |
| `/prep --fresh` | Force re-extraction, ignore existing queue |
| `/prep F-001` | Deep impact analysis for specific feature |
| `/recipe F-001` | Generate machine-checkable spec for execution |

## Reconciliation

When brief changes after `/prep` has run:

```
/order --refine → brief artifacts update
        ↓
/prep → detects brief change
        ↓
    Reconciles:
      • New features → add to queue
      • Removed features → flag for review
      • Changed features → mark "needs-reanalysis"
        ↓
    Output: "3 added, 1 removed, 2 affected"
```

**Protection:** Features marked `in-progress` are never auto-removed, even if removed from brief.

## Validation Layer

Every agent output passes through:

```
Agent output → JSON parse → Zod schema → Confidence check
                    ↓              ↓               ↓
              malformed?      invalid?         too low?
                    ↓              ↓               ↓
               retry (3x)     retry (3x)      block + warn
```

### Schema validation

Every agent has a zod schema defining valid output:

```typescript
const FeatureSchema = z.object({
  id: z.string().regex(/^F-\d{3}$/),
  title: z.string().min(1).max(120),
  confidence: z.enum(["stated", "discussed", "inferred", "assumed"]),
  // ...
});
```

### Confidence scoring

Features are marked with confidence levels:

| Marker | Weight | Meaning |
|--------|--------|---------|
| `[stated]` | 1.0 | Explicitly stated in brief |
| `[discussed]` | 0.8 | Discussed but not specified |
| `[inferred]` | 0.5 | Logical inference |
| `[assumed]` | 0.2 | Assumption without evidence |

### Blocking thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Average confidence | < 0.4 | Block, require human review |
| Assumed features | > 30% | Block, ask for clarification |
| Validation failure | 3 retries | Block, show error |

## Output directories

| Directory | Git | Purpose |
|-----------|-----|---------|
| `docs/sandwich/brief/` | tracked | Brief artifacts (client-facing) |
| `.sandwich/` | ignored | Execution state (internal workflow) |
| `.sandwich/specs/` | ignored | Machine-checkable specs |

## Brief Modes

| Mode | Trigger | What happens |
|------|---------|--------------|
| **New** | No `docs/sandwich/brief/` exists | Creates all four artifacts from scratch |
| **Refine** | Brief exists + you add new input | Updates all artifacts, marks changed sections |
| **Answer** | Brief exists + you paste client answers | Integrates answers, moves resolved questions |
