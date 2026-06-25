# Brief — Design Spec
_2026-06-25_

## Problem

Software agency projects start messy. Requirements arrive as meeting notes, RFQs,
RFPs, voice recordings transcribed to text, email threads, or verbal conversations.
None of them are ready to build from. Before any development work can start, someone
needs to turn that noise into a clear, shared understanding of what the client wants,
who their users are, and what's still unknown.

Jeff Patton's Story Mapping requires a narrative before the map — who the user is,
what they're trying to accomplish, what the context is. Without it, the map has no
spine. The `brief` ingredient produces exactly that: the narrative layer that makes
Story Mapping (and everything downstream) possible.

## Goal

A sandwich ingredient that accepts any raw client input — document or text — and
produces three artifacts that ground all downstream work:

1. **`prd.md`** — standardized PRD: problem, goals, non-goals, personas, constraints, success metrics
2. **`user-flows.md`** — backbone journeys in Story Mapping terms: actor → goal → key steps
3. **`client-questions.md`** — open gaps the client must answer before dev starts

Artifacts live in `docs/sandwich/brief/` in the consuming project repo, git-backed,
always current.

## Living Requirements

Requirements change. Clients clarify. Scope shifts. The skill must handle this —
not by regenerating everything, but by patching what changed.

Three modes, auto-detected from project state:

| Mode | Condition | What happens |
|---|---|---|
| **New** | `docs/sandwich/brief/` doesn't exist | Full pipeline: normalize → PRD → flows → gaps |
| **Refine** | Brief exists + new input provided (doc or text) | Diff analyst identifies what changed → targeted patch |
| **Answer** | Brief exists + client answered open questions | Impact analyst determines effect → patch PRD + flows |

Input can be a file path OR plain text — the skill handles both.

## Architecture

### Package structure

```
sandwich/
├── package.json                        ← pi install manifest (extensions + skills)
├── .claude-plugin/plugin.json          ← Claude Code install manifest
├── .claude-plugin/marketplace.json
└── brief/
    ├── package.json                    ← devDependencies only (pi-coding-agent, typebox, tsx)
    ├── agents/                         ← shared agent prompts (both harnesses)
    │   ├── brief-intake-normalizer.md  ← any format → structured PRD draft
    │   ├── brief-prd-generator.md      ← PRD draft → final prd.md
    │   ├── brief-flow-analyst.md       ← PRD → backbone user flows
    │   ├── brief-gap-detector.md       ← PRD + flows → client-questions.md
    │   ├── brief-diff-analyst.md       ← old brief + new input → what changed
    │   └── brief-impact-analyst.md     ← change description → which artifacts to patch
    ├── skills/
    │   └── brief/
    │       └── SKILL.md                ← mode detection + when/how to invoke run_brief
    ├── pi-extension/
    │   └── brief.ts                    ← ~80 lines: resources_discover + run_brief tool
    ├── workflow/
    │   └── brief.workflow.ts           ← Claude Code: deterministic pipeline orchestration
    └── lib/
        └── brief-lib.ts                ← state detection, file I/O, artifact writing
```

### Layer responsibilities

**`SKILL.md`** — the intelligence layer. Teaches the LLM:
- When to invoke `run_brief` (anytime a client drops intake or asks to update the brief)
- How to detect which mode based on `docs/sandwich/brief/` state
- What each artifact means and how downstream skills use them
- How to present results to the PM

**`brief.ts`** (pi extension) — the delivery layer for Pi/OpenClaw/Hermes:
- `resources_discover` → expose `skills/brief/` to pi's skill loader
- `before_agent_start` → inject a short system prompt telling the LLM about `run_brief`
- `registerTool("run_brief", ...)` → executes the pipeline by spawning agent sub-processes
- Minimal notify only: one `ctx.ui.notify` per completed pipeline step
- No widget, no footer, no UI modifications

**`brief.workflow.ts`** (Claude Code) — the deterministic layer for Claude Code:
- Orchestrates the same agents in sequence via Claude subagents
- Handles mode detection, retries on bad format, file writes
- Called by `SKILL.md` instructions when running in Claude Code

**`agents/*.md`** — the specialist layer, shared by both harnesses:
- Each agent has one job, one output format, one set of validation rules
- Frontmatter: `tools`, `model` (optional override)
- Used by both pi extension (via `spawnPiAgent`) and workflow (via subagents)

**`brief-lib.ts`** — the deterministic layer:
- `detectMode(cwd)` → reads `docs/sandwich/brief/` state, returns "new" | "refine" | "answer"
- `readExistingBrief(cwd)` → reads current artifacts
- `writeBriefArtifacts(cwd, artifacts)` → writes prd.md, user-flows.md, client-questions.md
- `backupBrief(cwd)` → copies current state to `docs/sandwich/brief/history/` before overwrite
- No LLM calls — pure I/O

### New mode pipeline

```
Input (file or text)
    ↓
brief-intake-normalizer    → structured PRD draft (any format in, consistent format out)
    ↓
brief-prd-generator        → final prd.md
    ↓
brief-flow-analyst         → user-flows.md (backbone: actor → goal → steps)
    ↓
brief-gap-detector         → client-questions.md (open gaps as a checkbox list)
    ↓
Write artifacts to docs/sandwich/brief/
Notify: "Brief created — X flows, Y questions"
```

### Refine mode pipeline

```
New input (file or text) + existing prd.md
    ↓
brief-diff-analyst         → what changed (plain text change summary)
    ↓
brief-impact-analyst       → which sections of prd.md and user-flows.md are affected
    ↓
brief-prd-generator        → updated prd.md (change summary + current PRD → patched PRD)
brief-flow-analyst         → updated user-flows.md (if flows are affected)
brief-gap-detector         → updated client-questions.md (new gaps only)
    ↓
Backup existing → write patched artifacts
Notify: "Brief updated — N sections changed, M new questions"
```

### Answer mode pipeline

```
PM's answers to open questions + existing brief
    ↓
brief-impact-analyst       → which sections of prd.md and user-flows.md are affected
    ↓
brief-prd-generator        → updated prd.md (answers incorporated)
brief-flow-analyst         → updated user-flows.md (if flows are affected)
    ↓
Mark answered questions in client-questions.md
Backup existing → write patched artifacts
Notify: "Brief updated — X questions resolved"
```

## Artifacts format

### `prd.md`
```markdown
# PRD — [Project Name]
_Last updated: YYYY-MM-DD_

## Problem
...

## Goals
...

## Non-Goals
...

## Personas
...

## Constraints
...

## Success Metrics
...
```

### `user-flows.md`
```markdown
# User Flows — [Project Name]
_Last updated: YYYY-MM-DD_

## [Flow Name]
**Actor:** ...
**Goal:** ...
**Steps:**
1. ...
2. ...
**Branches:**
- If X → ...
```

### `client-questions.md`
```markdown
# Client Questions — [Project Name]
_Last updated: YYYY-MM-DD_

- [ ] [Open question]
- [x] [Answered question] — Answer: ...
```

## Install

```bash
# Pi / OpenClaw / Hermes
pi install https://github.com/etalasaccounts/sandwich.git

# Claude Code
claude install https://github.com/etalasaccounts/sandwich.git
```

## What this is NOT

- Not a task breakdown tool — that is a separate sandwich ingredient
- Not a design tool — user flows are narrative, not wireframes
- Not a project management tool — no story points, no assignments, no sprints
- Not a one-shot generator — the brief evolves with the project

## Out of scope (for now)

- Multi-project support (one brief per repo is enough)
- Export to external tools (Notion, Linear, Confluence)
- Approval workflows or sign-off tracking
- Async client collaboration
