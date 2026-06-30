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
/prep

# Impact analysis for specific feature
/prep F-001

# Update queue only (no recommendation)
/prep --queue-only

# Impact analysis only (skip prioritization)
/prep --impact-only F-001
```

## Output

Output is split between committed views and machine state:

| File | Location | Git | Purpose |
|------|----------|-----|---------|
| `feature-queue.md` | `docs/sandwich/` | tracked | Ordered feature list — shareable with PMs |
| `impact-analysis.md` | `.sandwich/` | ignored | Deep dive on a specific feature |
| `.plan-context.json` | `.sandwich/` | ignored | Raw extraction output for debugging |

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
/order → /prep → User picks → /recipe → Superpowers (execution)
           │
           └─→ .sandwich/registry/ (source of truth) → docs/sandwich/feature-queue.md
```

The feature queue is committed to `docs/sandwich/` so PMs can see it. It can be regenerated at any time from the registry.
