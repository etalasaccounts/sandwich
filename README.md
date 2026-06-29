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

## Ingredients

| Command | Role |
|---------|------|
| `/order` | Turn any client input into four standardized brief artifacts |
| `/prep` | Tech lead prioritization — score features, build the queue |
| `/recipe` | Generate a machine-checkable spec for one feature |
| `/status` | Morning-check dashboard — what's blocking, what's next |

---

## How to use it (daily flow)

### 1. Brief a project

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

---

### 2. Refine the brief (when client answers arrive)

Paste the client's answers alongside `/order`. The skill detects `answer` mode and integrates them — resolved questions are cleared, affected features are updated.

```
/order
[paste client's answers here]
```

---

### 3. Prioritize features

```
/prep
```

Reads the brief, extracts all features, scores them (impact × urgency × risk ÷ effort), and writes the registry. On re-run it reconciles — new features are added, dropped features are flagged, and any feature that was in-progress is never auto-removed.

**The registry** (`.sandwich/registry/`) is committed to git — it's the source of truth that survives across re-runs. A rendered view (`docs/sandwich/feature-queue.md`) is generated each run and committed alongside the brief artifacts.

---

### 4. Spec a feature

Pick a feature ID from the queue and run:

```
/recipe F-001
```

Generates a machine-checkable spec with acceptance criteria, tasks, and test harness definition. Updates the registry: `F-001` moves to `speced`, `specRef` is set.

---

### 5. Morning check

```
/status
```

Shows a dashboard: gates, open client questions (and what they block), stale specs, and recommended next action. Useful at the start of any session to reorient.

For a full maintenance report (billing evidence, SLA log):

```
/status --report
```

---

## Full command reference

| Command | Behavior |
|---------|----------|
| `/order` | Generate or update brief artifacts (auto-detects mode) |
| `/prep` | Smart reconcile if brief changed, else use existing queue |
| `/prep --fresh` | Force re-extraction, ignore existing registry |
| `/prep F-001` | Deep impact analysis for a specific feature |
| `/recipe F-001` | Generate spec for a feature |
| `/status` | Morning-check dashboard |
| `/status --report` | Full maintenance/SLA report from journal |

---

## Registry (single source of truth)

The registry lives in `.sandwich/registry/` and is committed to git. It never loses state between re-runs.

| File | Purpose |
|------|---------|
| `project.json` | Project metadata, brief hashes, gate states |
| `features.json` | Canonical feature ledger — stable IDs, lifecycle, scores, human overrides, spec links |
| `questions.json` | Client questions ↔ answers ↔ what they unblock |
| `decisions.json` | ADR-lite scope/architecture decisions |
| `journal.jsonl` | Append-only audit trail — every gate, reconciliation, drift event |

**Rendered views** (`docs/sandwich/feature-queue.md`) are committed — generated fresh each run from the registry, shareable with PMs.

### Stable feature IDs

A feature keeps its ID (`F-001`, `F-002`, …) across re-runs even if the brief rewrites its title, because matching uses a content fingerprint — not position or exact text. Human overrides (pinned priority, pinned lifecycle) survive every reconciliation.

## Pipeline diagram

```
/order  ──→  brief artifacts
                   │
                   ▼
                 /prep  ──→  feature-queue.md
                                   │
                                   ▼
                            /recipe F-001  ──→  spec + registry update
                                   │
                                   ▼
                            Superpowers (execution)
```

Human picks features. AI automates analysis and record-keeping.

---

## Reconciliation

When brief changes mid-project:

```
/order  →  brief artifacts update
               ↓
           /prep  →  detects brief change
               ↓
           Reconciles:
             • New features → added to registry with new ID
             • Missing features → flagged as orphaned (never deleted if in-progress)
             • Changed features → flagged needsReanalysis, stale spec flagged
               ↓
           Output: "3 added, 1 orphaned, 2 stale specs"
```

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
| `urgency` | Time pressure factor (1.0 / 1.5 / 2.0) |

Priority is computed deterministically in code: `(impact × urgency × (10 − risk)) ÷ effort`, normalized to 0–100. Same inputs always produce the same ranking — no LLM variance.

Human overrides (pin a priority, force a lifecycle) survive every re-run.

---

## Output directories

| Directory | Git | Purpose |
|-----------|-----|---------|
| `docs/sandwich/` | tracked | Brief artifacts, feature queue, specs — everything shareable |
| `docs/sandwich/specs/` | tracked | Machine-checkable specs |
| `docs/sandwich/intake/` | tracked | Raw PM inputs (KAK, MOM, meeting notes) |
| `.sandwich/registry/` | tracked | Pipeline state (source of truth) |
