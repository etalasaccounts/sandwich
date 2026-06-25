# Breakdown

Turns client intake (any format) into a standardized PRD and a refined task
breakdown, and keeps it current as requirements evolve. Runs on Pi, OpenClaw,
Hermes, and Claude Code from one package.

## Layout

- `agents/` — 12 agent prompts, shared by every harness
- `lib/breakdown-lib.ts` — pure functions (parsing, ID assignment, doc building)
- `skills/using-breakdown/SKILL.md` — session intelligence (auto mode detection)
- `pi-extension/breakdown.ts` — Pi / OpenClaw / Hermes runtime
- `workflow/breakdown.workflow.ts` — Claude Code Workflow runtime
- `.claude-plugin/plugin.json` / `package.json` — distribution manifests

## State

All artifacts live in the consuming project's `docs/breakdown/`:
`task-registry.json`, `source.md`, `task-breakdown.md`, `user-flows.md`,
`client-recommendations.md`, `client-questions.md`, `technical-spec.md`, and
`modules/*.md`. The format is identical across harnesses — a project started on
one can continue on another.

## Pipeline

Intake Normalizer → Classifier → Flow Analyst → NFR Extractor → Feature
Extractor → Tech Spec → Task Generator (parallel per feature) → Dependency
Mapper → artifacts.

## Modes

New Project, Refine, Answer Questions, Scope Review, Manage. The
`using-breakdown` skill detects the right mode from project state and the
request — no menus, no mid-pipeline gates.

## Installation

### Prerequisites

- **`pi` CLI** — for the Pi / OpenClaw / Hermes path.
- **Node 18+** (or Bun) — the pipeline glue runs as TypeScript via `tsx`.
- **For PDF / DOCX intake only** (Markdown / TXT / CSV need nothing extra):
  - PDF → PyMuPDF (`pip3 install pymupdf`) **or** poppler (`brew install poppler`)
  - DOCX → python-docx (`pip3 install python-docx`)

### Pi / OpenClaw / Hermes

```bash
pi install https://github.com/etalasaccounts/sandwich.git
```

Start a new Pi session and run `/breakdown <path-to-intake>` to verify.

### Claude Code

```bash
claude install https://github.com/etalasaccounts/sandwich.git
```

The `using-breakdown` skill loads automatically. Drop an intake file or ask to
break down a document — the skill routes to the right mode automatically.

### Verify the install

Start a session, run `/breakdown <path-to-a-small-test-intake>`, and confirm the
artifacts appear in `<project>/docs/breakdown/` (`task-registry.json`,
`task-breakdown.md`, `source.md`, …).

## Test

```bash
cd breakdown
npm install
npm test
```
