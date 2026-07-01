# sandwich

> **Alpha — expect bugs.** APIs and file formats may change without notice. Use in production at your own risk.

Composable agent stack for software agencies. Turns messy client input into a validated, scored feature registry — then hands off to [Superpowers](https://github.com/obra/Superpowers) for execution.

All outputs validated with Zod schemas. The model never computes priority numbers — code does.

---

## Install

**Pi:**
```bash
\pi install https://github.com/etalasaccounts/sandwich.git
```

**Claude Code:**
```bash
claude install https://github.com/etalasaccounts/sandwich.git
```

After installing, restart your AI session so the skills are discovered.

---

## Commands

| Command | Role |
|---------|------|
| `/order` | Turn any client input into four standardized brief artifacts |
| `/prep` | Tech lead prioritization — score features, build the queue |
| `/status` | Morning-check dashboard — what's blocking, what's next |

---

## Daily flow

### 1. Take the order

Paste a KAK, RFQ, MOM, meeting notes, or just describe the project. The skill detects the context automatically.

```
/order
```

Produces four artifacts in `docs/sandwich/`:

| File | Purpose |
|------|---------|
| `prd.md` | Canonical requirements — modules, features, constraints, confidence markers |
| `user-flows.md` | Narrative user journeys |
| `technical-notes.md` | Tech lead's architecture notes — decisions, risks |
| `client-questions.md` | Prioritized questions to send the client before starting |

Share `client-questions.md` with the client and wait for answers before running `/prep`.

### 2. Refine the brief

Paste the client's answers alongside `/order`. The skill detects answer mode and integrates them — resolved questions are cleared, affected features are updated.

```
/order
[paste client's answers here]
```

### 3. Prioritize features

```
/prep
```

Reads the brief, extracts all features, scores them, and writes the registry. On re-run it reconciles — new features are added, dropped features are flagged, and any feature that was in-progress is never auto-removed.

Produces `docs/sandwich/feature-queue.md` — shareable with PMs.

### 4. Pick a feature and hand off to Superpowers

Pick a feature ID from the queue, then use [Superpowers brainstorming](https://github.com/obra/Superpowers) to design and execute it:

```
/brainstorm
I want to build F-001 (User authentication flow) from the feature queue.
[paste the feature details from feature-queue.md]
```

Superpowers takes it from here: design conversation → implementation plan → subagent execution.

### 5. Morning check

```
/status
```

Shows gates, open client questions (and what they block), stale features, and recommended next action.

```
/status --report
```

Full maintenance report — useful for billing evidence and SLA logs.

---

## Full command reference

| Command | Behavior |
|---------|----------|
| `/order` | Generate or update brief artifacts (auto-detects mode) |
| `/prep` | Smart reconcile if brief changed, else use existing queue |
| `/prep --fresh` | Force re-extraction, ignore existing registry |
| `/prep F-001` | Deep impact analysis for a specific feature |
| `/status` | Morning-check dashboard |
| `/status --report` | Full maintenance/SLA report from journal |

---

## Pipeline

```
/order  ──→  brief artifacts
                   │
                   ▼
                 /prep  ──→  feature-queue.md
                                   │
                                   ▼
                         Human picks a feature
                                   │
                                   ▼
                         Superpowers brainstorming
                         → writing-plans
                         → subagent-driven-development
```

Sandwich handles requirements capture and prioritization. Superpowers handles design and execution.

---

## Registry

The registry lives in `.sandwich/registry/` and is committed to git. It never loses state between re-runs.

| File | Purpose |
|------|---------|
| `project.json` | Project metadata, brief hashes, gate states |
| `features.json` | Canonical feature ledger — stable IDs, lifecycle, scores, human overrides |
| `questions.json` | Client questions ↔ answers ↔ what they unblock |
| `decisions.json` | ADR-lite scope/architecture decisions |
| `journal.jsonl` | Append-only audit trail — every gate, reconciliation, drift event |

A feature keeps its ID (`F-001`, `F-002`, …) across re-runs even if the brief rewrites its title, because matching uses a content fingerprint — not position or exact text. Human overrides (pinned priority, pinned lifecycle) survive every reconciliation.

---

## Validation layer

Every agent output passes through:

```
Agent output → JSON parse → Zod schema → Confidence check
                    ↓              ↓               ↓
              malformed?      invalid?         too low?
                    ↓              ↓               ↓
               retry (3x)     retry (3x)      block + warn
```

| Marker | Weight | Meaning |
|--------|--------|---------|
| `[stated]` | 1.0 | Explicitly stated in brief |
| `[discussed]` | 0.8 | Discussed but not specified |
| `[inferred]` | 0.5 | Logical inference |
| `[assumed]` | 0.2 | Assumption without evidence |

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Average confidence | < 0.4 | Block, require human review |
| Assumed features | > 30% | Block, ask for clarification |

### Priority scoring

The model never computes a priority number. It supplies four dimension scores:

| Dimension | What it measures |
|-----------|-----------------|
| `impact` | Business/user value (1–10) |
| `effort` | Relative dev cost (1–10) |
| `risk` | Technical uncertainty (1–10) |
| `urgency` | Time pressure factor (0.8 / 1.0 / 1.2 / 1.5) |

Priority is computed deterministically in code: `(impact × urgency × (10 − risk)) ÷ effort`, normalized to 0–100. Same inputs always produce the same ranking — no LLM variance.

---

## Output directories

| Directory | Git | Purpose |
|-----------|-----|---------|
| `docs/sandwich/` | tracked | Brief artifacts and feature queue — everything shareable |
| `docs/sandwich/intake/` | tracked | Raw PM inputs (KAK, MOM, meeting notes) |
| `.sandwich/registry/` | tracked | Pipeline state (source of truth) |
