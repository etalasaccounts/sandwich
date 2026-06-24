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

## Install

- **Pi / OpenClaw / Hermes:** install the package; the `pi` field loads the
  extension and skills.
- **Claude Code:** install as a plugin; the skill loads at session start and the
  workflow runs the pipeline.

## Test

```bash
npm install
npm test
```
