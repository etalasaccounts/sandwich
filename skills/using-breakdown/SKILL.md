---
name: using-breakdown
description: Use when a project manager shares client intake (any format), asks to break down a brief/PRD, refine project scope, answer client questions, review scope, or manage the task registry. Routes to the correct breakdown pipeline mode automatically.
---

# Using Breakdown

Breakdown turns client intake into a standardized PRD and a refined task breakdown that the team builds from, and keeps it current as requirements evolve. State lives in the consuming project's `docs/breakdown/`. Your job is to detect the right mode from what the human gives you and run it — no menus, no mid-pipeline gates.

## How to run a stage

Each stage is an agent prompt in `agents/`. Run the agent named below as a subagent, passing the documented input. The pipeline's deterministic glue (parsing, ID assignment, file writes, backups) is in `lib/breakdown-lib.ts`.

- On Pi / OpenClaw / Hermes: the `breakdown` extension exposes the `run_breakdown` tool and `/breakdown`, `/refine` commands — prefer those; they run the full TypeScript pipeline.
- On Claude Code: run the workflow at `workflow/breakdown.workflow.ts`, or drive the agents directly per the sequence below.

## Mode Detection

First, inspect `docs/breakdown/` (the `readProjectState` helper in `lib/breakdown-lib.ts` returns exactly this snapshot — call it, or read the files directly):

1. **No `task-registry.json`** → this is a **New Project**.
2. **`task-registry.json` exists** → read it, then classify what the human just gave you:
   - A document/paste of requirements that overlaps the existing `source.md` but adds or changes scope → **Refine**.
   - A plain-English description of a change ("we're adding X", "cut Y") → **Refine** (additions) or **Manage** (cuts/status changes).
   - Text that answers open items in `client-questions.md` → **Answer Questions**.
   - "What can we start / what's the status / any risks?" → **Scope Review**.
   - A document whose scope does not overlap `source.md` at all → likely a different **New Project** (see Overwrite Safety).

## New Project

1. Run `breakdown-intake-normalizer` on the raw intake → a PRD. Read its `## Intake Quality` block.
   - `confidence: needs-more` → ask the human the 1–3 specific questions named in `gaps`, wait, then re-run the normalizer with their answers folded in. (Note: the Pi `run_breakdown` tool and the Claude Code workflow do not pause for this — the Pi tool proceeds with a warning, and the workflow returns a `needs-more` status with the gaps for you to act on. When you are driving the agents yourself, prefer the ask-and-rerun behavior above.)
   - `confidence: ambiguous` → proceed; unclear items will be marked `[ASSUMPTION]` / `[PENDING CLIENT INPUT]` in the outputs.
   - `confidence: sufficient` → proceed.
2. The PRD becomes `docs/breakdown/source.md`.
3. Run the pipeline in order: `breakdown-classifier` → `breakdown-flow-analyst` → `breakdown-nfr-extractor` → `breakdown-feature-extractor` → `breakdown-tech-spec` → `breakdown-task-generator` (once per feature, in parallel) → `breakdown-dependency-mapper`.
4. Write all artifacts to `docs/breakdown/`. Report: project name, module count, task count, total story points, and the count of open client questions.

## Refine

Triggered by new scope, a CR, a revised brief, or a discovery note. Run `breakdown-refine-analyst` (diff new input against `source.md` + existing module list) → `breakdown-clarification-analyst` (map to stability patches + new scope) → `breakdown-task-generator` for any new scope. Apply patches; only affected tasks change. Back up before writing.

## Answer Questions

The human supplies client answers. Run `breakdown-clarification-analyst` with the answers mapped to the open items in `client-questions.md`. Update task stability, add tasks for newly-confirmed scope, and check off answered questions (`- [ ]` → `- [x]`).

## Scope Review

Deterministic, no agent. Report from the registry: stability breakdown (stable / provisional / blocked-by-design), tasks ready to start (stable + pending), fully-blocked modules, broken dependencies, and registry integrity issues.

## Manage

Direct registry edits, no agent. Mark tasks/modules obsolete, or override stability. Always record a reason and back up first.

## Overwrite Safety

If `task-registry.json` already exists and the incoming intake looks like a wholly different project (no overlap with `source.md`), do NOT overwrite silently. Tell the human what exists and what would be replaced, and proceed only on explicit confirmation. Every other mode runs without a gate. This check is your responsibility as the agent — the packaged `run_breakdown` tool and workflow do not themselves prompt before overwriting, so you must perform this confirmation before invoking them on a path that already has a registry.

## Invariants

- Task IDs are immutable once assigned. Never renumber.
- Never overwrite a task whose status is `in-progress` or `done`.
- Always back up `docs/breakdown/` to `docs/breakdown/history/<timestamp>-*` before writing.
