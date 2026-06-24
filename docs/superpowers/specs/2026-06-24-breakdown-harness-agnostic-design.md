# Breakdown — Harness-Agnostic Design

_Spec date: 2026-06-24_
_Status: approved_

## Overview

Breakdown is a multi-agent pipeline that converts client intake documents into a
standardized set of project artifacts: task registry, user flows, technical spec,
client questions, and per-module task files. It is currently implemented as a Pi
agent extension and is tightly coupled to the Pi harness.

This spec defines the redesign that makes Breakdown installable and runnable
across Pi, OpenClaw, Hermes, and Claude Code — while preserving (and in some
cases improving) the quality of its outputs.

---

## Goals

- PM can drop any intake format and get project artifacts with no manual
  pre-processing
- Pipeline runs on Pi, OpenClaw, Hermes, and Claude Code without degrading
  quality on any harness
- Refinement happens conversationally — PM describes a change, AI detects the
  right mode and runs it
- No interactive gates mid-pipeline — the agent runs fully, writes artifacts, PM
  reviews at their own pace
- Artifacts live in `docs/breakdown/` in the project repo, portable across
  harnesses

---

## Architecture

The package is structured in three layers sharing a common core:

```
breakdown-plugin/
  agents/                         ← 12 agent .md files — shared by all harnesses
    breakdown-intake-normalizer.md  (NEW)
    breakdown-classifier.md
    breakdown-flow-analyst.md
    breakdown-nfr-extractor.md
    breakdown-feature-extractor.md
    breakdown-tech-spec.md
    breakdown-task-generator.md
    breakdown-dependency-mapper.md
    breakdown-clarification-analyst.md
    breakdown-refine-analyst.md
    breakdown-spec-updater.md
    breakdown-gap-suggester.md
  lib/
    breakdown-lib.ts              ← pure functions, zero harness dependency
  skills/
    using-breakdown.md            ← session intelligence skill (harness-agnostic)
  pi-extension/
    breakdown.ts                  ← Pi extension, interactive gates removed
    themeMap.ts
  workflow/
    breakdown.workflow.ts         ← Claude Code Workflow script
  .claude-plugin/
    plugin.json                   ← Claude Code plugin manifest
  README.md
```

### Layer 1 — Shared core (agents + lib)

The agent `.md` files are the intellectual property of the pipeline. They define
what each stage produces, in what format, and with what quality bar. They are
harness-agnostic: written as actions ("read the document", "output a JSON block"),
never naming a specific tool or runtime.

`breakdown-lib.ts` contains all pure parsing and document-building functions.
No Pi imports. Testable with plain `tsx`. Unchanged from the current implementation.

### Layer 2 — Pi extension (Pi, OpenClaw, Hermes)

`pi-extension/breakdown.ts` is the existing orchestration layer, with two changes:

1. All interactive gates removed (`ctx.ui.select`, `ctx.ui.input`, review gate,
   PM interview). Pipeline runs fully and writes all artifacts. The agent reports
   a summary.
2. TUI widget kept for progress display (it adds value on Pi, costs nothing to
   keep).

OpenClaw and Hermes are Pi-based agents and install this layer identically to Pi.

### Layer 3 — Claude Code Workflow

`workflow/breakdown.workflow.ts` orchestrates the same agents using Claude Code's
native `agent()`, `pipeline()`, and `parallel()` primitives. Schema-enforced
outputs replace the TypeScript retry logic. No Pi dependency.

Both layers read and write `docs/breakdown/` in the same format. A project
started on Pi can be continued on Claude Code and vice versa.

---

## State: `docs/breakdown/`

The directory in the project repo is the single source of truth for project state.
Any harness can read it to determine what has already been done.

```
docs/breakdown/
  task-registry.json        ← structured task registry (presence = project exists)
  source.md                 ← normalized PRD from original intake (used for diffing)
  task-breakdown.md         ← summary with links to module files
  user-flows.md             ← backbone artifact for PoC/UAT
  client-recommendations.md ← gap analysis for the client
  client-questions.md       ← open - [ ] / answered - [x] questions
  technical-spec.md         ← architecture decisions
  modules/
    <module-slug>.md        ← per-module task detail files
  history/
    <timestamp>-*           ← automatic backup before every write
```

---

## Session Intelligence — `skills/using-breakdown.md`

This skill replaces the wizard UI. It is loaded at session start by any harness
and teaches the AI to determine the correct pipeline mode by reading `docs/breakdown/`.

### Mode detection logic

```
1. Does docs/breakdown/task-registry.json exist?
   NO  → NEW PROJECT
   YES → existing project — read it, then check the conversation

2. What did the human provide?
   A document / file / paste of content
     No source.md or content is structurally new → NEW PROJECT (confirm before overwrite)
     Overlaps source.md but adds or changes scope  → REFINE
   Plain-English description of changes            → REFINE
   Answers matching items in client-questions.md   → ANSWER QUESTIONS
   "What can we start / what's the status?"        → SCOPE REVIEW
   "Mark X as obsolete / out of scope"             → MANAGE REGISTRY

3. Safety rule: if task-registry.json exists and the incoming intake looks like
   a completely new project (no overlap with source.md), show what would be
   overwritten and ask for explicit confirmation before proceeding.
   All other modes are friction-free.
```

### Human refinement triggers (examples)

| PM says | AI does |
|---|---|
| "We're adding a loyalty program" | REFINE on the description |
| Drops an updated MoM | PRD Normalizer → diff vs source.md → REFINE on delta |
| "The client answered the payment questions" | ANSWER QUESTIONS |
| "Cut the analytics module for v1" | MANAGE REGISTRY — obsolete module |
| "What can we start building right now?" | SCOPE REVIEW |
| Drops a completely different brief | NEW PROJECT — confirms before overwriting |

---

## New Stage: Intake Normalizer

A new agent (`breakdown-intake-normalizer.md`) runs as step 0 before the existing
Classifier. Its sole job is to synthesize a coherent PRD from any PM input format.

### Accepts

Voice transcripts, meeting notes / MoM, email threads, RFDs, informal briefs,
Notion or Google Docs pastes, or any combination of the above.

### Outputs

A structured PRD in a consistent format:

```markdown
PROJECT_NAME: <extracted or inferred>
PROJECT_TYPE: <web app | mobile | api | platform | ...>
CLIENT_CONTEXT: <1-2 sentences on client and domain>

## Objective
<what the project must achieve>

## User Types
- <Actor>: <role description>

## Core Features
### <Feature Name>
- <requirement>

## Out of Scope (if stated)
- <item>

## Open Questions (verbatim from intake)
- <ambiguity or gap found in the raw input>

## Intake Quality
confidence: sufficient | needs-more | ambiguous
gaps: <specific missing pieces, if any>
```

The PRD output becomes `source.md`. All future refinements diff against it.

### Confidence field behaviour

| Value | Meaning | Action |
|---|---|---|
| `sufficient` | Enough to produce meaningful output | Run pipeline immediately |
| `needs-more` | Too thin — fewer than ~3 identifiable features or no clear user types | AI asks 1–3 targeted questions, waits for answers, reruns Normalizer |
| `ambiguous` | Unclear in specific areas but enough to run | Run pipeline, mark unclear items as `[ASSUMPTION]` in outputs |

`needs-more` threshold is deliberately high. A one-paragraph brief with a project
name and rough user types is `ambiguous`, not `needs-more`.

---

## Full Pipeline Sequence

```
PM Input (any format)
    ↓
[0] Intake Normalizer     → structured PRD + confidence
    ↓ (if needs-more: AI asks targeted questions, reruns)
[1] Classifier            → normalized text + PROJECT_NAME
[2] Flow Analyst          → user flows + gaps + client recommendations
[3] NFR Extractor         → non-functional requirement tasks (JSON)
[4] Feature Extractor     → feature list (JSON)
[5] Tech Spec             → architecture decisions (markdown)
[6] Task Generator        → tasks per feature, parallel fan-out (markdown)
[7] Dependency Mapper     → blockedBy/blocks graph (JSON)
    ↓
docs/breakdown/ written
    ↓
Agent reports summary: project name, modules, task count, story points, open questions
```

Stages 1–7 are unchanged from the current implementation. The Intake Normalizer
is additive; the existing pipeline quality is preserved.

---

## Refinement Modes

Four modes, all friction-free (no interactive gates):

### Refine
Triggered when the PM provides new scope — a CR, a revised brief, a discovery
note. The Refine Analyst diffs the new input against `source.md`, identifies what
changed, and the pipeline touches only affected tasks. The registry grows
incrementally.

### Answer Questions
Triggered when the PM provides client answers. The Clarification Analyst maps
each answer to open items in `client-questions.md`, updates task stability, adds
tasks for newly-confirmed scope. Questions are checked off (`- [ ]` → `- [x]`).

### Manage Registry
Direct mutations, no LLM. PM says "cut analytics for v1" or "mark payment tasks
as stable". Fast and deterministic.

### Scope Review
Registry health check, no LLM. Reports stability breakdown, tasks ready to start,
broken dependencies, registry integrity issues.

### Refinement contract

- Task IDs are stable — once assigned, an ID never changes unless the task is
  explicitly obsoleted
- History is backed up before every write — `docs/breakdown/history/<timestamp>-*`
- Tasks with status `in-progress` or `done` are never overwritten by the pipeline

---

## Interactive Gates — Removed

The current Pi extension has three interactive pause points:

1. **Wizard menu** (session start) — replaced by `using-breakdown.md` skill
2. **PM interview** (mid-pipeline gap questions) — removed; gaps go to
   `client-questions.md` for async resolution
3. **Review gate** (approve before writing files) — removed; pipeline writes
   everything, PM reviews artifacts at their own pace

The only remaining confirmation: overwriting an existing project when the new
intake appears to be a completely different project (not a refinement).

---

## Installation

| Harness | Install mechanism | What loads |
|---|---|---|
| Pi | `pi --install breakdown` or agent self-installs | `pi-extension/breakdown.ts` |
| OpenClaw | Agent: "install breakdown" | Same as Pi |
| Hermes | Agent: "install breakdown" | Same as Pi |
| Claude Code (local) | Plugin marketplace | `skills/using-breakdown.md` + `workflow/` |
| Claude Code (cloud) | Plugin pre-installed in workspace | Same as Claude Code local |

---

## Out of Scope

- Real-time collaboration / multi-user editing of the registry
- Direct Jira / Linear / Notion sync (separate integration layer)
- Automated task status updates from git commits
- Support for harnesses other than Pi and Claude Code in this iteration

---

## Open Questions

None — all design decisions resolved during brainstorming session (2026-06-24).
