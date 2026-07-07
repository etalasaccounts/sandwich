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
# Step 1: register the sandwich marketplace
claude plugin marketplace add etalasaccounts/sandwich

# Step 2: install
claude plugin install sandwich
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

Produces `docs/sandwich/feature-queue.md` — shareable with PMs — plus a `docs/sandwich/specs/F-XXX.md` for every active feature: scope and an acceptance-criteria checklist, ready to hand to Superpowers.

### 4. Pick a feature and hand off to Superpowers

Sandwich stops at the feature queue. For design, implementation planning, and execution, use **[Superpowers](https://github.com/obra/Superpowers)** — it's more mature and purpose-built for that phase.

**Install Superpowers first if you haven't:**

```bash
# Pi
\pi install https://github.com/obra/Superpowers.git

# Claude Code (Superpowers is in the official marketplace)
claude plugin install superpowers
```

**Then hand off from the queue:**

Pick the top feature from `docs/sandwich/feature-queue.md` — say it's `F-001` — and open its spec, `docs/sandwich/specs/F-001.md`. It already has the scope and acceptance-criteria checklist Superpowers needs; paste it in to start a brainstorming session:

```
/brainstorm

[paste the contents of docs/sandwich/specs/F-001.md]
```

Superpowers walks you through: approach options → design approval → implementation plan with actual code → subagent execution task by task. As each acceptance criterion is proven, flip `"done": true` for it in `F-001.json` and re-run `render-specs.ts` to check it off in the spec.

> **Why not stay in sandwich?** Superpowers' brainstorming skill enforces a human approval gate before any code is written, proposes 2-3 implementation approaches with tradeoffs, and produces implementation plans with full code in every step. That's the right tool for execution — sandwich's job ends at "what to build and in what order."

### 5. Morning check

```
/status
```

Shows open client questions (and what they block), stale features, and recommended next action.

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
| `/prep --done F-001 [sha...]` | Mark a feature done and record its commits |
| `/prep F-001` | Deep impact analysis for a specific feature |
| `/status` | Morning-check dashboard |
| `/status --report` | Full maintenance/SLA report from journal |

---

## Pipeline

```
/order → /prep → docs/sandwich/specs/F-XXX.md → superpowers:brainstorming → build
                 └─ feature-queue.md (priorities + links)
```

After `/prep`, every active feature has its own `docs/sandwich/specs/F-XXX.md` — scope plus an acceptance-criteria checklist, generated deterministically from the registry. Pick the top feature off `feature-queue.md` and hand its spec file straight to Superpowers brainstorming as the starting point. As implementation proves each acceptance criterion, flip it to `"done": true` in the feature's `F-XXX.json` and re-run `render-specs.ts` (or the next `/prep`) to check it off in the rendered markdown.

Sandwich handles requirements capture and prioritization. Superpowers handles design and execution.

---

## Registry

The registry lives in `.sandwich/registry/` and is committed to git. It never loses state between re-runs.

| File | Purpose |
|------|---------|
| `project.json` | Project metadata, brief hashes |
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
| `docs/sandwich/specs/` | tracked | Per-feature specs (`F-XXX.json` + rendered `F-XXX.md`) — the dev's starting point for Superpowers |
| `.sandwich/registry/` | tracked | Pipeline state (source of truth) |
