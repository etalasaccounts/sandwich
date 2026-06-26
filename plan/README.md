# sandwich/plan

Tech lead-level prioritization and impact analysis.

## What it does

Consumes brief artifacts and produces a prioritized feature queue with:
- Impact/effort/risk scores
- Dependency graph
- Recommendations with reasoning

## Usage

```bash
# Full prioritization pipeline
/plan

# Impact analysis for specific feature
/plan F-001

# Update queue only (no recommendation)
/plan --queue-only

# Impact analysis only (skip prioritization)
/plan --impact-only F-001
```

## Output

All output goes to `.sandwich/` (git-ignored):

| File | Purpose |
|------|---------|
| `feature-queue.md` | Ordered list of features with status, dependencies, scores |
| `impact-analysis.md` | Deep dive on a specific feature |
| `.plan-context.json` | Raw extraction output for debugging |

## Pipeline

```
┌────────┐     ┌──────┐     ┌─────────┐     ┌───────┐     ┌───────────┐
│  Read  │ →  │Extract│ →  │Analyze  │ →  │ Score │ →  │Recommend  │
└────────┘     └──────┘     └─────────┘     └───────┘     └───────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  brief/*.md   features.json   deps.json   scores.json   queue.md
```

## Key principles

1. **Human decides, AI analyzes** — provide data, not orders
2. **Unblocking is high value** — features that enable others score higher
3. **Confidence matters** — `[assumed]` features flagged for validation
4. **Execution state aware** — won't recommend features already in progress
5. **Brief is source of truth** — never invent features not in brief

## Scoring formula

```
priority = (impact × urgency × (10 - risk)) ÷ effort

Where urgency_factor:
- Blocking other features: 1.5
- Explicitly requested: 1.2
- Standard: 1.0
- Nice to have: 0.8
```

## Relationship to other ingredients

```
/brief → /plan → User picks → /spec → /build → Superpowers
           │
           └─→ feature-queue.md (execution state)
```

The feature queue is git-ignored because it's derivative work from brief. Can be regenerated at any time from brief + git state.
