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

- **Node 18+** (or Bun) — the pipeline glue runs as TypeScript via `tsx`.
- **`pi` CLI** — for the Pi / OpenClaw / Hermes path.
- **For PDF / DOCX intake only** (Markdown / TXT / CSV need nothing extra):
  - PDF → PyMuPDF (`pip3 install pymupdf`) **or** poppler (`brew install poppler`)
  - DOCX → python-docx (`pip3 install python-docx`)

Keep the `breakdown/` folder intact wherever you put it — the extension loads its
sibling `lib/` and `agents/` by relative path, so don't copy the extension file
on its own.

### Pi (one session, quick try)

Point Pi straight at the extension file:

```bash
pi -e /absolute/path/to/breakdown/pi-extension/breakdown.ts
```

Then drop an intake file or run `/breakdown <path>`.

### Pi (persistent)

Pi auto-loads extensions from its extension directories
(`~/.pi/work-extensions/`, `~/.pi/personal-extensions/`). Place the `breakdown/`
package on the machine and have Pi load `breakdown/pi-extension/breakdown.ts`
every session — either by adding it to your Pi configuration or by symlinking the
package into one of those directories. (Exact persistence depends on your Pi
setup.)

### OpenClaw / Hermes (self-extending Pi agents)

Just ask, in plain English:

> install the breakdown ingredient from `<repo URL or path>`

They pick it up through the package's `pi` field (`extensions` + `skills`) and
self-install. This is the intended path for the team.

### Claude Code

The package is a Claude Code plugin (`.claude-plugin/plugin.json`) plus a skill
(`skills/using-breakdown/`):

1. Install the `breakdown/` directory as a local plugin (via your plugin
   marketplace or local-plugin path) so the `using-breakdown` skill loads at
   session start.
2. Drop intake or ask to break down a document — the skill routes it to the right
   mode and runs the pipeline via `workflow/breakdown.workflow.ts` (or by driving
   the agents directly per the skill).

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
