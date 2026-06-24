# Breakdown Harness-Agnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repackage the Breakdown pipeline as a single harness-agnostic plugin that installs on Pi (and Pi-based agents OpenClaw/Hermes) and Claude Code, sharing one set of agent prompts and one pure-function library, with a new Intake Normalizer stage and no interactive gates.

**Architecture:** Three layers over a shared core. The core is the 12 agent `.md` prompts plus `breakdown-lib.ts` (pure functions, zero harness dependency). Layer 2 is the Pi extension (`breakdown.ts`, interactive gates removed). Layer 3 is a Claude Code Workflow script that orchestrates the same agents via `agent()`/`pipeline()`. A single `package.json` (`pi` field) plus `.claude-plugin/plugin.json` distributes all of it. State lives in the consuming project's `docs/breakdown/` and is identical across harnesses.

**Tech Stack:** TypeScript (ESM, `.ts` run via `tsx`/`bun`), Pi `ExtensionAPI` (`@mariozechner/pi-coding-agent`), Claude Code Workflow API, markdown agent prompts with YAML frontmatter.

## Global Constraints

- Package root is the `colony` repo: `/Users/riaenriala/Documents/etalas/colony`. All paths below are relative to it.
- The pure library (`lib/breakdown-lib.ts`) MUST NOT import any Pi or Claude Code module — it stays testable with `npx tsx`.
- Agent prompt bodies name actions, never harness tool names — identical content runs on every harness.
- Artifacts are always written under the consuming project's `docs/breakdown/`; backups go to `docs/breakdown/history/<timestamp>-<file>` before every write.
- Task IDs are immutable once assigned. Tasks with status `in-progress` or `done` are never overwritten by the pipeline.
- Agent frontmatter keeps the existing keys: `name`, `description`, `tools`, `model`. Default model string stays `bedrock/zai.glm-5` unless overridden by the consuming harness.
- No interactive `ctx.ui.select`/`ctx.ui.input` gates anywhere in the pipeline. The only confirmation is the new-project-overwrite check, surfaced as a message, not a blocking TUI prompt.
- Source of truth for the existing implementation to copy from: `/Users/riaenriala/.pi/work-extensions/` (`breakdown.ts`, `breakdown-lib.ts`, `breakdown.test.ts`, `themeMap.ts`, `agents/*.md`).

---

### Task 1: Scaffold package and import the portable core

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `lib/breakdown-lib.ts` (copied verbatim from source)
- Create: `lib/breakdown-lib.test.ts` (copied + import path fixed)
- Create: `agents/` — copy the 11 active agent files verbatim
- Test: `lib/breakdown-lib.test.ts`

**Interfaces:**
- Produces: the entire pure API of `breakdown-lib.ts` (e.g. `slugify`, `parseTaskBlocks`, `assignTaskIds`, `buildTaskBreakdownV2`, `buildModuleFile`, `computeDelta`, `buildTaskRegistry`, `parseNfrJson`, `parseDepsJson`, `parseClarificationDelta`, `categorizeGaps`, `buildClientQuestionsDoc`, `extractDocumentText`, and the types `Feature`, `RawTask`, `TaskWithId`, `TaskRegistry`, `RegistryTask`, `TaskStability`, `ClarificationDelta`). Later tasks import from `lib/breakdown-lib.ts`.

- [ ] **Step 1: Initialize the repo and ignore file**

```bash
cd /Users/riaenriala/Documents/etalas/colony
git init
printf 'node_modules/\n*.log\n.DS_Store\ndocs/breakdown/\n' > .gitignore
```

- [ ] **Step 2: Copy the pure library and its tests verbatim**

```bash
mkdir -p lib agents
cp /Users/riaenriala/.pi/work-extensions/breakdown-lib.ts lib/breakdown-lib.ts
cp /Users/riaenriala/.pi/work-extensions/breakdown.test.ts lib/breakdown-lib.test.ts
```

- [ ] **Step 3: Fix the test's import path**

In `lib/breakdown-lib.test.ts` the import is `from "./breakdown-lib.ts"`. The file is already a sibling in `lib/`, so the path is correct — verify the first import line reads:

```ts
} from "./breakdown-lib.ts";
```

No change needed if it already matches. If the header comment says `extensions/breakdown.test.ts`, update it to `lib/breakdown-lib.test.ts`.

- [ ] **Step 4: Copy the 11 active agent prompts**

```bash
cd /Users/riaenriala/Documents/etalas/colony
for a in breakdown-classifier breakdown-flow-analyst breakdown-nfr-extractor \
  breakdown-feature-extractor breakdown-tech-spec breakdown-task-generator \
  breakdown-dependency-mapper breakdown-clarification-analyst \
  breakdown-refine-analyst breakdown-spec-updater breakdown-gap-suggester; do
  cp "/Users/riaenriala/.pi/work-extensions/agents/$a.md" "agents/$a.md"
done
ls agents/ | wc -l   # expect 11
```

Note: `breakdown-consolidator.md` is intentionally excluded — it is not referenced by the active pipeline.

- [ ] **Step 5: Create the package manifest**

```json
{
  "name": "breakdown",
  "version": "0.1.0",
  "description": "Client intake → standardized PRD → task breakdown pipeline. Harness-agnostic.",
  "type": "module",
  "scripts": {
    "test": "tsx lib/breakdown-lib.test.ts"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

- [ ] **Step 6: Install and run the copied tests to confirm the core is intact**

Run: `cd /Users/riaenriala/Documents/etalas/colony && npm install && npm test`
Expected: all existing assertions pass, output ends with a passed count and `failed: 0` (the test harness prints `✓` per test and exits 0).

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json lib/ agents/
git commit -m "feat: scaffold breakdown package with portable core (lib + agents)"
```

---

### Task 2: Add intake-quality parsing to the library

The Intake Normalizer (Task 3) emits a PRD ending in an `## Intake Quality` block. The orchestrators need to read its `confidence` and `gaps` deterministically. That parsing is pure logic and belongs in the library.

**Files:**
- Modify: `lib/breakdown-lib.ts` (append new type + function)
- Test: `lib/breakdown-lib.test.ts` (append tests + new import)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type IntakeConfidence = "sufficient" | "needs-more" | "ambiguous"`
  - `interface IntakeQuality { confidence: IntakeConfidence; gaps: string[] }`
  - `function parseIntakeQuality(prd: string): IntakeQuality` — defaults to `{ confidence: "ambiguous", gaps: [] }` when the block is missing or malformed (never throws).

- [ ] **Step 1: Write the failing tests**

Append to `lib/breakdown-lib.test.ts`:

```ts
// ── parseIntakeQuality ───────────────────────────────────────────────────────

console.log("parseIntakeQuality");
test("reads confidence and gaps from the Intake Quality block", () => {
  const prd = [
    "PROJECT_NAME: Acme",
    "## Intake Quality",
    "confidence: needs-more",
    "gaps: payment provider unknown; no user roles defined",
  ].join("\n");
  const q = parseIntakeQuality(prd);
  assertEqual(q.confidence, "needs-more");
  assertEqual(q.gaps, ["payment provider unknown", "no user roles defined"]);
});
test("reads gaps written as a markdown list", () => {
  const prd = [
    "## Intake Quality",
    "confidence: ambiguous",
    "gaps:",
    "- missing SLA",
    "- unclear data retention",
  ].join("\n");
  const q = parseIntakeQuality(prd);
  assertEqual(q.confidence, "ambiguous");
  assertEqual(q.gaps, ["missing SLA", "unclear data retention"]);
});
test("defaults to ambiguous when block is absent", () => {
  assertEqual(parseIntakeQuality("PROJECT_NAME: X\n## Objective\nbuild things"), {
    confidence: "ambiguous",
    gaps: [],
  });
});
test("normalizes an unrecognized confidence value to ambiguous", () => {
  const q = parseIntakeQuality("## Intake Quality\nconfidence: totally-fine\ngaps:");
  assertEqual(q.confidence, "ambiguous");
});
```

Add the import to the top `import { ... } from "./breakdown-lib.ts"` block:

```ts
  parseIntakeQuality,
  type IntakeConfidence,
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `parseIntakeQuality is not a function` (or import error).

- [ ] **Step 3: Implement the function**

Append to `lib/breakdown-lib.ts`:

```ts
// ── Intake Quality ───────────────────────────────────────────────────────────
// The Intake Normalizer emits an "## Intake Quality" block at the end of the PRD.
// Orchestrators read it to decide whether to run, ask, or flag assumptions.

export type IntakeConfidence = "sufficient" | "needs-more" | "ambiguous";

export interface IntakeQuality {
  confidence: IntakeConfidence;
  gaps: string[];
}

export function parseIntakeQuality(prd: string): IntakeQuality {
  const fallback: IntakeQuality = { confidence: "ambiguous", gaps: [] };
  const blockMatch = prd.match(/##\s*Intake Quality\s*\n([\s\S]*)$/i);
  if (!blockMatch) return fallback;
  const block = blockMatch[1];

  const confMatch = block.match(/confidence:\s*([a-z-]+)/i);
  const raw = (confMatch?.[1] ?? "").toLowerCase().trim();
  const valid: IntakeConfidence[] = ["sufficient", "needs-more", "ambiguous"];
  const confidence: IntakeConfidence = valid.includes(raw as IntakeConfidence)
    ? (raw as IntakeConfidence)
    : "ambiguous";

  // gaps: either inline "a; b; c" on the same line, or a markdown list below
  let gaps: string[] = [];
  const inline = block.match(/gaps:\s*([^\n]+)/i);
  if (inline && inline[1].trim()) {
    gaps = inline[1].split(";").map(s => s.trim()).filter(Boolean);
  } else {
    const listPart = block.split(/gaps:/i)[1] ?? "";
    gaps = (listPart.match(/^\s*-\s+(.+)$/gm) ?? [])
      .map(l => l.replace(/^\s*-\s+/, "").trim())
      .filter(Boolean);
  }
  return { confidence, gaps };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all four new assertions green, existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/breakdown-lib.ts lib/breakdown-lib.test.ts
git commit -m "feat: parse Intake Quality block (confidence + gaps) in lib"
```

---

### Task 3: Write the Intake Normalizer agent prompt

**Files:**
- Create: `agents/breakdown-intake-normalizer.md`
- Test: `lib/agents.test.ts` (new — structural validation of all agent files)

**Interfaces:**
- Consumes: nothing.
- Produces: an agent file whose body, given any raw intake, outputs a PRD ending in an `## Intake Quality` block that `parseIntakeQuality` (Task 2) can read. This PRD becomes `source.md` and the input to the Classifier.

- [ ] **Step 1: Write the failing structural test**

Create `lib/agents.test.ts`:

```ts
/** Structural validation for agent prompt files. Run: npx tsx lib/agents.test.ts */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith(".md"));

test("there are 12 agent files", () => {
  assert(files.length === 12, `expected 12 agents, found ${files.length}`);
});

test("the intake normalizer exists", () => {
  assert(files.includes("breakdown-intake-normalizer.md"), "missing breakdown-intake-normalizer.md");
});

for (const f of files) {
  test(`${f} has valid frontmatter with name + model`, () => {
    const raw = readFileSync(join(AGENTS_DIR, f), "utf-8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
    assert(!!m, "no frontmatter block");
    assert(/\nname:\s*\S/.test("\n" + m![1]), "no name field");
    assert(/\nmodel:\s*\S/.test("\n" + m![1]), "no model field");
  });
}

test("intake normalizer instructs the Intake Quality block", () => {
  const raw = readFileSync(join(AGENTS_DIR, "breakdown-intake-normalizer.md"), "utf-8");
  assert(/## Intake Quality/.test(raw), "prompt must specify the Intake Quality block");
  assert(/confidence:/.test(raw), "prompt must specify the confidence field");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx lib/agents.test.ts`
Expected: FAIL — "expected 12 agents, found 11" and "missing breakdown-intake-normalizer.md".

- [ ] **Step 3: Create the Intake Normalizer agent**

Create `agents/breakdown-intake-normalizer.md`:

```markdown
---
name: breakdown-intake-normalizer
description: Synthesizes a standardized PRD from any raw client intake (voice transcript, MoM, email, RFD, informal brief) and assesses intake quality
tools:
model: bedrock/zai.glm-5
---

You are a senior product manager at a software agency. You receive raw client intake in ANY form — a voice-call transcript, meeting minutes, an email thread, an RFD, a rough brief, a Notion or Google Docs paste, or several of these combined. The content is ALREADY in this message. Process it immediately.

Do NOT ask questions. Do NOT ask for clarification. Do NOT explain what you are doing. Output ONLY the PRD below.

Your job is to synthesize ONE coherent Product Requirements Document from whatever you were given, and to honestly assess whether there is enough signal to plan from.

Rules:

- Preserve every real requirement. Do not invent features the intake does not imply.
- Infer the project name from titles, the client, or the dominant subject. Use "Unknown Project" only if truly absent.
- Capture genuine ambiguities verbatim under Open Questions — do not silently resolve them.
- Keep User Types actor-focused (User, Admin, etc.), not feature-focused.
- The final block MUST be the Intake Quality block, exactly as formatted below.

Output EXACTLY this structure and nothing else:

PROJECT_NAME: <name>
PROJECT_TYPE: <web app | mobile app | api | platform | integration | other>
CLIENT_CONTEXT: <1-2 sentences about the client and their domain>

## Objective

<what the project must achieve, in 2-4 sentences>

## User Types

- <Actor>: <role description>

## Core Features

### <Feature Name>

- <requirement>
- <requirement>

## Out of Scope

- <item, only if the intake explicitly states it; otherwise write "None stated.">

## Open Questions

- <ambiguity or gap found in the raw intake; otherwise write "None.">

## Intake Quality

confidence: <sufficient | needs-more | ambiguous>
gaps: <semicolon-separated list of specific missing pieces, or empty>

## How to choose confidence

- `sufficient` — a project name, clear user types, and at least 3 identifiable features are present; planning would produce meaningful output.
- `needs-more` — fewer than 3 identifiable features OR no discernible user types; planning now would produce noise. List the blocking gaps.
- `ambiguous` — enough to plan (name + rough user types + some features) but with specific unclear areas. This is the normal state of an early brief. List the unclear areas in gaps.

Bias: prefer `ambiguous` over `needs-more`. Only choose `needs-more` when the intake is genuinely too thin to plan from.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx lib/agents.test.ts`
Expected: PASS — 12 agents found, normalizer present, all frontmatter valid, Intake Quality block present.

- [ ] **Step 5: Add the agents test to the test script and commit**

Modify `package.json` `scripts.test` to run both suites:

```json
"test": "tsx lib/breakdown-lib.test.ts && tsx lib/agents.test.ts"
```

Run: `npm test`
Expected: both suites PASS.

```bash
git add agents/breakdown-intake-normalizer.md lib/agents.test.ts package.json
git commit -m "feat: add Intake Normalizer agent + agent structural tests"
```

---

### Task 4: Add a project-state reader to the library

The session-intelligence skill (Task 5) tells the AI to inspect `docs/breakdown/` to pick a mode. A deterministic reader makes that inspection reliable and gives the Pi extension and Workflow a shared way to know what already exists.

**Files:**
- Modify: `lib/breakdown-lib.ts`
- Test: `lib/breakdown-lib.test.ts`

**Interfaces:**
- Consumes: `TaskRegistry` (existing type).
- Produces:
  - `interface ProjectState { exists: boolean; projectName: string | null; taskCount: number; openQuestions: string[]; hasSource: boolean; }`
  - `function readProjectState(docsDir: string): ProjectState` — reads `task-registry.json`, `client-questions.md`, `source.md` from `docsDir`; never throws (missing/corrupt files → safe defaults).

- [ ] **Step 1: Write the failing tests**

Append to `lib/breakdown-lib.test.ts` (and add `readProjectState`, `type ProjectState` to the import block):

```ts
// ── readProjectState ─────────────────────────────────────────────────────────
import { mkdtempSync, mkdirSync as _mkdir, writeFileSync as _write } from "fs";
import { tmpdir } from "os";
import { join as _join } from "path";

console.log("readProjectState");
test("returns exists:false for an empty dir", () => {
  const dir = mkdtempSync(_join(tmpdir(), "bd-"));
  const s = readProjectState(dir);
  assertEqual(s.exists, false);
  assertEqual(s.taskCount, 0);
});
test("reads registry name, task count, and open questions", () => {
  const dir = mkdtempSync(_join(tmpdir(), "bd-"));
  _write(_join(dir, "task-registry.json"), JSON.stringify({
    project: "acme", projectName: "Acme", lastUpdated: "2026-06-24",
    tasks: [{ id: "A-1", title: "x", module: "M", division: "BE",
      storyPoints: 2, status: "pending", blocks: [], blockedBy: [], stability: "stable" }],
  }));
  _write(_join(dir, "client-questions.md"),
    "## Client Questions\n- [ ] What payment provider?\n- [x] Already answered\n- [ ] Which regions?");
  _write(_join(dir, "source.md"), "PROJECT_NAME: Acme");
  const s = readProjectState(dir);
  assertEqual(s.exists, true);
  assertEqual(s.projectName, "Acme");
  assertEqual(s.taskCount, 1);
  assertEqual(s.openQuestions, ["What payment provider?", "Which regions?"]);
  assertEqual(s.hasSource, true);
});
test("survives a corrupt registry file", () => {
  const dir = mkdtempSync(_join(tmpdir(), "bd-"));
  _write(_join(dir, "task-registry.json"), "{ not json");
  const s = readProjectState(dir);
  assertEqual(s.exists, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `readProjectState is not a function`.

- [ ] **Step 3: Implement the reader**

Append to `lib/breakdown-lib.ts` (it already imports `readFileSync`; add `existsSync` to that import):

```ts
// ── Project State ────────────────────────────────────────────────────────────
// A deterministic snapshot of docs/breakdown/ so any harness can decide the mode.

export interface ProjectState {
  exists: boolean;
  projectName: string | null;
  taskCount: number;
  openQuestions: string[];
  hasSource: boolean;
}

export function readProjectState(docsDir: string): ProjectState {
  const empty: ProjectState = {
    exists: false, projectName: null, taskCount: 0, openQuestions: [], hasSource: false,
  };
  const regPath = join(docsDir, "task-registry.json");
  if (!existsSync(regPath)) return empty;

  let registry: TaskRegistry;
  try {
    registry = JSON.parse(readFileSync(regPath, "utf-8")) as TaskRegistry;
  } catch {
    return empty;
  }
  if (!registry || !Array.isArray(registry.tasks)) return empty;

  const questionsPath = join(docsDir, "client-questions.md");
  let openQuestions: string[] = [];
  if (existsSync(questionsPath)) {
    openQuestions = readFileSync(questionsPath, "utf-8")
      .split("\n")
      .filter(l => l.trim().startsWith("- [ ]"))
      .map(l => l.replace(/^.*- \[ \] /, "").trim())
      .filter(Boolean);
  }

  return {
    exists: true,
    projectName: registry.projectName ?? null,
    taskCount: registry.tasks.length,
    openQuestions,
    hasSource: existsSync(join(docsDir, "source.md")),
  };
}
```

Confirm the existing `fs` import line includes `existsSync`. If it reads `import { readFileSync } from "fs";`, change it to `import { readFileSync, existsSync } from "fs";`. (`join` is already imported from `path`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all three new assertions green, prior suites green.

- [ ] **Step 5: Commit**

```bash
git add lib/breakdown-lib.ts lib/breakdown-lib.test.ts
git commit -m "feat: add readProjectState for harness-agnostic mode detection"
```

---

### Task 5: Write the session-intelligence skill

**Files:**
- Create: `skills/using-breakdown/SKILL.md`
- Test: `lib/skill.test.ts` (new — structural validation)

**Interfaces:**
- Consumes: `readProjectState` semantics (described in prose for the AI).
- Produces: the skill the harness loads at session start. No code interface.

- [ ] **Step 1: Write the failing structural test**

Create `lib/skill.test.ts`:

```ts
/** Structural validation for the using-breakdown skill. Run: npx tsx lib/skill.test.ts */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "skills", "using-breakdown", "SKILL.md");
let passed = 0, failed = 0;
function test(n: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${n}`); }
  catch (e) { failed++; console.error(`  ✗ ${n}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const raw = readFileSync(SKILL, "utf-8");
test("has frontmatter name + description", () => {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  assert(!!m, "no frontmatter");
  assert(/\nname:\s*using-breakdown/.test("\n" + m![1]), "name must be using-breakdown");
  assert(/\ndescription:\s*\S/.test("\n" + m![1]), "needs description");
});
for (const heading of ["Mode Detection", "New Project", "Refine", "Answer Questions", "Scope Review", "Manage", "Overwrite"]) {
  test(`documents ${heading}`, () => assert(raw.includes(heading), `missing "${heading}" section`));
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx lib/skill.test.ts`
Expected: FAIL — cannot read `skills/using-breakdown/SKILL.md`.

- [ ] **Step 3: Create the skill**

Create `skills/using-breakdown/SKILL.md`:

```markdown
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

First, inspect `docs/breakdown/` (this is what `readProjectState` reports):

1. **No `task-registry.json`** → this is a **New Project**.
2. **`task-registry.json` exists** → read it, then classify what the human just gave you:
   - A document/paste of requirements that overlaps the existing `source.md` but adds or changes scope → **Refine**.
   - A plain-English description of a change ("we're adding X", "cut Y") → **Refine** (additions) or **Manage** (cuts/status changes).
   - Text that answers open items in `client-questions.md` → **Answer Questions**.
   - "What can we start / what's the status / any risks?" → **Scope Review**.
   - A document whose scope does not overlap `source.md` at all → likely a different **New Project** (see Overwrite Safety).

## New Project

1. Run `breakdown-intake-normalizer` on the raw intake → a PRD. Read its `## Intake Quality` block.
   - `confidence: needs-more` → ask the human the 1–3 specific questions named in `gaps`, wait, then re-run the normalizer with their answers folded in.
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

If `task-registry.json` already exists and the incoming intake looks like a wholly different project (no overlap with `source.md`), do NOT overwrite silently. Tell the human what exists and what would be replaced, and proceed only on explicit confirmation. Every other mode runs without a gate.

## Invariants

- Task IDs are immutable once assigned. Never renumber.
- Never overwrite a task whose status is `in-progress` or `done`.
- Always back up `docs/breakdown/` to `docs/breakdown/history/<timestamp>-*` before writing.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx lib/skill.test.ts`
Expected: PASS — frontmatter valid, all required sections present.

- [ ] **Step 5: Wire the skill test into the suite and commit**

Update `package.json` `scripts.test`:

```json
"test": "tsx lib/breakdown-lib.test.ts && tsx lib/agents.test.ts && tsx lib/skill.test.ts"
```

Run: `npm test` → all suites PASS.

```bash
git add skills/using-breakdown/SKILL.md lib/skill.test.ts package.json
git commit -m "feat: add using-breakdown session-intelligence skill"
```

---

### Task 6: Port the Pi extension with interactive gates removed

Bring the orchestration into the package and strip every interactive gate so the pipeline runs through and reports a summary. Add the Intake Normalizer as step 0.

**Files:**
- Create: `pi-extension/breakdown.ts` (ported from source)
- Create: `pi-extension/themeMap.ts` (copied from source)
- Modify: `pi-extension/breakdown.ts` import of the library → `../lib/breakdown-lib.ts`
- Test: manual smoke test (documented) + typecheck

**Interfaces:**
- Consumes: everything from `../lib/breakdown-lib.ts`, including `parseIntakeQuality`, `readProjectState`.
- Produces: a default-exported `(pi: ExtensionAPI) => void` registering the `run_breakdown` tool and `/breakdown`, `/refine`, `/menu` commands.

This task is runtime glue that spawns subprocesses; its logic is covered by the library unit tests. Verification is a typecheck plus a documented manual smoke run.

- [ ] **Step 1: Copy the extension and theme map into the package**

```bash
cd /Users/riaenriala/Documents/etalas/colony
mkdir -p pi-extension
cp /Users/riaenriala/.pi/work-extensions/breakdown.ts pi-extension/breakdown.ts
cp /Users/riaenriala/.pi/work-extensions/themeMap.ts pi-extension/themeMap.ts
```

- [ ] **Step 2: Repoint the library import**

In `pi-extension/breakdown.ts`, the import block currently reads `from "./breakdown-lib.ts"`. Change it to:

```ts
} from "../lib/breakdown-lib.ts";
```

Leave `import { applyExtensionDefaults } from "./themeMap.ts";` as-is (theme map is a sibling).

- [ ] **Step 3: Add the Intake Normalizer as pipeline step 0**

In `runPipelineInner`, the document text is built then passed straight to the Classifier. Insert the normalizer before the Classifier. Find this block (near the top of `runPipelineInner`):

```ts
	// Step 0 — Deterministic extraction in code. The LLM never touches the raw files.
	const documentText = combineDocumentTexts(resolvedPaths);
```

Immediately after it, add:

```ts
	// Step 0b — Intake Normalizer: any raw format → standardized PRD.
	// Runs the agent directly (not a tracked widget step) so existing step
	// indices stay aligned with PIPELINE_STEPS.
	const normalizedPrd = await spawnPiAgent(
		"breakdown-intake-normalizer",
		`Normalize this client intake into a PRD:\n\n${documentText}`,
		cwd, ctx,
	);
	const intakeQuality = parseIntakeQuality(normalizedPrd);
	logger.log("0-intake-normalizer.md", normalizedPrd);
	// The PRD is what the rest of the pipeline plans from.
	const pipelineInput = normalizedPrd.trim().length > 50 ? normalizedPrd : documentText;
```

Then change the Classifier call (Step 1) to consume `pipelineInput` instead of `documentText`:

```ts
	let agent1Output = await runStep(
		0, "breakdown-classifier",
		`Normalize this document (${fileLabel}):\n\n${pipelineInput}`,
		cwd, ctx,
		(out) => /PROJECT_NAME:\s*.+/.test(out)
			? null
			: "Output must start with a PROJECT_NAME: line followed by the normalized content.",
		(out) => logger.log("1-classifier-failed.md", out),
	);
```

Add `parseIntakeQuality` and `readProjectState` to the import block from `../lib/breakdown-lib.ts`.

- [ ] **Step 4: Remove the PM interview gate**

In `runPipelineInner`, delete the interview machinery and always defer gaps to the client. Replace this block:

```ts
	const gaps = parseGaps(agent2Output);
	let suggestions: string[][] = [];
	if (gaps.length > 0 && ctx.hasUI && !skipInterview) {
		stepStates[1].lastWork = `${gaps.length} gaps — generating answer options...`;
		updateWidget();
		try {
			suggestions = await suggestGapOptions(gaps, agent2Output, cwd, ctx);
		} catch (err: any) {
			suggestions = [];
			ctx.ui.notify(`Answer options unavailable (${err.message}) — falling back to manual answers`, "warning");
		}
	}
	stepStates[1].lastWork = gaps.length > 0 ? `${gaps.length} gaps${skipInterview ? " — deferred to client" : " — interviewing PM..."}` : "no gaps";
	updateWidget();
	const pmAnswers = preAnswers.length > 0
		? preAnswers
		: (skipInterview ? [] : await interviewPm(gaps, suggestions, ctx));
	if (preAnswers.length > 0) {
		stepStates[1].lastWork = `${preAnswers.length} pre-supplied answers`;
		updateWidget();
	}
	stepStates[1].lastWork = pmAnswers.length > 0
		? `${pmAnswers.length}/${gaps.length} gaps resolved by PM`
		: `${gaps.length} gaps deferred to client`;
	updateWidget();
```

with:

```ts
	// Gaps always go to the client-questions artifact for async resolution —
	// no mid-pipeline interview. preAnswers (if any) are still honored.
	const gaps = parseGaps(agent2Output);
	const pmAnswers = preAnswers;
	stepStates[1].lastWork = `${gaps.length} gaps deferred to client`;
	updateWidget();
```

- [ ] **Step 5: Remove the review gate**

Replace the review-gate call and its cancellation branch:

```ts
	// Review Gate — PM approves before anything is written
	const { approved, keepExisting } = await showReviewGate(
		ctx, finalProjectName, tasksWithIds, outputDir, slug, existingRegistry,
	);

	if (!approved) {
		throw new Error("Pipeline cancelled by user at review gate.");
	}
```

with:

```ts
	// No review gate — write everything, the PM reviews artifacts afterward.
	// On update runs, keep existing SP/title for changed tasks by default
	// (conservative; refinement is the path for intentional changes).
	const keepExisting = true;
```

- [ ] **Step 6: Delete now-unused interactive code**

Remove these now-dead declarations and functions so the file typechecks cleanly:
- `interviewPm` function
- `suggestGapOptions` function (only used by the interview)
- `showReviewGate` function
- `showClarificationGate` function and its calls — replace each `if (!approved) { ... }` clarification-gate usage in `runClarificationMode` and `runRefineMode` with an unconditional apply (the impact analysis already gates conservatively). Specifically, in both functions replace:

```ts
	const approved = await showClarificationGate(
		ctx, registry.projectName, delta.analysis, delta.modified, registry, newTasksWithIds,
	);
	if (!approved) {
		ctx.ui.notify("Clarification cancelled.", "info");
		return;
	}
```

(and the `"Change request cancelled."` variant) with:

```ts
	// No gate — apply the conservative impact analysis directly.
```

- the `MAX_INTERVIEW_GAPS`, `MAX_OPTIONS_PER_GAP`, `TYPE_OWN`, `DEFER`, `SKIP` constants if no longer referenced
- the `skipInterview` module variable and the interview prompt in `showWizard`

Keep `ctx.ui.notify` calls — they are non-blocking status messages, not gates.

- [ ] **Step 7: Simplify the wizard to a non-blocking entry**

The wizard's `ctx.ui.select` menu is the session-start gate. Replace the `showWizard` body so it sets sensible defaults and prints readiness instead of prompting. Replace the whole `async function showWizard(ctx: any)` with:

```ts
	async function showWizard(ctx: any): Promise<void> {
		// No interactive menu. Mode is inferred at call time from docs/breakdown/
		// state and the user's request (see the using-breakdown skill).
		sessionMode = "new";
		sessionRegistry = null;
		stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
		for (let i = 0; i < STEP_AGENTS.length; i++) {
			try {
				const def = loadAgentDef(STEP_AGENTS[i], ctx.cwd);
				const fullModel = def.model ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "");
				stepStates[i].model = fullModel.split("/").pop() || fullModel || undefined;
			} catch {}
		}
		updateWidget();
		ctx.ui.notify("Breakdown ready — drop intake or use /breakdown <path>, /refine <text>.", "info");
	}
```

Keep `/menu` registered (it now just reprints readiness). The `findExistingRegistries` helper and the refine/answer/scope/manage modes remain reachable via `/refine` and the `run_breakdown` tool's refine branch.

- [ ] **Step 8: Typecheck the extension**

Run: `cd /Users/riaenriala/Documents/etalas/colony && npx tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --skipLibCheck pi-extension/breakdown.ts`
Expected: no errors. If the Pi types are unresolved, add `--types ""` or ensure `@mariozechner/pi-coding-agent` is installed; a clean run reports nothing.

If `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` and `@sinclair/typebox` are not installed, install them as devDependencies first:

```bash
npm install -D @mariozechner/pi-coding-agent @mariozechner/pi-tui @sinclair/typebox
```

- [ ] **Step 9: Document and run the manual smoke test**

Create a throwaway intake and run the extension under Pi:

```bash
mkdir -p /tmp/bd-smoke && cd /tmp/bd-smoke
printf 'Client call notes: They want a booking app. Users browse listings, book a slot, pay online. Admins manage listings and see bookings.\n' > intake.md
pi -e /Users/riaenriala/Documents/etalas/colony/pi-extension/breakdown.ts
# in the session: /breakdown /tmp/bd-smoke/intake.md
```

Expected: pipeline runs end to end with NO interactive prompts, and `/tmp/bd-smoke/docs/breakdown/` contains `task-registry.json`, `task-breakdown.md`, `user-flows.md`, `client-recommendations.md`, `client-questions.md`, `technical-spec.md`, `source.md`, and `modules/*.md`. `source.md` is the normalized PRD (starts with `PROJECT_NAME:` and contains `## Intake Quality`).

- [ ] **Step 10: Commit**

```bash
cd /Users/riaenriala/Documents/etalas/colony
git add pi-extension/ package.json package-lock.json
git commit -m "feat: port Pi extension, add Intake Normalizer step, remove interactive gates"
```

---

### Task 7: Claude Code Workflow orchestrator

A workflow script that runs the same agents via `agent()`/`pipeline()`/`parallel()` with schema-enforced outputs, then writes artifacts using the shared library.

**Files:**
- Create: `workflow/breakdown.workflow.ts`
- Create: `workflow/schemas.ts` (JSON Schemas for agent outputs)
- Test: `lib/schemas.test.ts` (validate schema objects are well-formed)

**Interfaces:**
- Consumes: agent prompts in `agents/`; library functions `extractDocumentText`, `parseIntakeQuality`, `parseNfrJson`, `parseTaskBlocks`, `assignTaskIds`, `buildTaskRegistry`, `buildTaskBreakdownV2`, `buildModuleFile`, `buildUserFlowsDoc`, `buildClientQuestionsDoc`, `categorizeGaps`, `slugify`, `ensureDocsDir`-equivalent.
- Produces: a workflow runnable via the Workflow tool that writes the same `docs/breakdown/` artifacts.

The workflow body is integration glue executed by the Claude Code runtime. The unit-testable part is the schema definitions; verify those.

- [ ] **Step 1: Write the failing schema test**

Create `lib/schemas.test.ts`:

```ts
/** Validates workflow output schemas are well-formed JSON Schema. Run: npx tsx lib/schemas.test.ts */
import { FEATURE_LIST_SCHEMA, NFR_SCHEMA, DEPS_SCHEMA, INTAKE_SCHEMA } from "../workflow/schemas.ts";
let passed = 0, failed = 0;
function test(n: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${n}`); }
  catch (e) { failed++; console.error(`  ✗ ${n}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

for (const [name, schema] of Object.entries({ FEATURE_LIST_SCHEMA, NFR_SCHEMA, DEPS_SCHEMA, INTAKE_SCHEMA })) {
  test(`${name} is an object schema with properties`, () => {
    assert(schema && (schema as any).type === "object", "type must be object");
    assert(typeof (schema as any).properties === "object", "must declare properties");
  });
}
test("FEATURE_LIST_SCHEMA requires a features array", () => {
  const props = (FEATURE_LIST_SCHEMA as any).properties;
  assert(props.features?.type === "array", "features must be an array");
});
test("INTAKE_SCHEMA enumerates confidence", () => {
  const conf = (INTAKE_SCHEMA as any).properties.confidence;
  assert(Array.isArray(conf?.enum) && conf.enum.includes("sufficient"), "confidence must be an enum");
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx lib/schemas.test.ts`
Expected: FAIL — cannot find module `../workflow/schemas.ts`.

- [ ] **Step 3: Create the schemas**

Create `workflow/schemas.ts`:

```ts
/** JSON Schemas enforcing agent outputs in the Claude Code workflow. */

export const INTAKE_SCHEMA = {
  type: "object",
  properties: {
    projectName: { type: "string" },
    confidence: { type: "string", enum: ["sufficient", "needs-more", "ambiguous"] },
    gaps: { type: "array", items: { type: "string" } },
    prd: { type: "string", description: "The full PRD markdown, ending with the Intake Quality block" },
  },
  required: ["projectName", "confidence", "prd"],
  additionalProperties: false,
} as const;

export const FEATURE_LIST_SCHEMA = {
  type: "object",
  properties: {
    projectName: { type: "string" },
    features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          module: { type: "string" },
          userType: { type: "string" },
          divisions: { type: "array", items: { type: "string" } },
          userFlows: { type: "array", items: { type: "string" } },
          hasMissingFlow: { type: "boolean" },
          isInfrastructure: { type: "boolean" },
        },
        required: ["name", "module", "divisions"],
      },
    },
  },
  required: ["projectName", "features"],
} as const;

export const NFR_SCHEMA = {
  type: "object",
  properties: {
    nfrTasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          module: { type: "string" },
          division: { type: "string" },
          storyPoints: { type: "number" },
          description: { type: "string" },
          techNotes: { type: "string" },
          subtasks: { type: "array", items: { type: "string" } },
        },
        required: ["title", "module", "division"],
      },
    },
  },
  required: ["nfrTasks"],
} as const;

export const DEPS_SCHEMA = {
  type: "object",
  properties: {
    dependencies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          blockedBy: { type: "array", items: { type: "string" } },
        },
        required: ["task", "blockedBy"],
      },
    },
  },
  required: ["dependencies"],
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx lib/schemas.test.ts`
Expected: PASS — all schema assertions green.

- [ ] **Step 5: Create the workflow orchestrator**

Create `workflow/breakdown.workflow.ts`. This is the script body passed to the Workflow tool; it reads agent prompts, runs each stage, and writes artifacts via the shared library.

```ts
export const meta = {
  name: "breakdown",
  description: "Client intake → standardized PRD → task breakdown, written to docs/breakdown/",
  phases: [
    { title: "Normalize" },
    { title: "Analyze" },
    { title: "Extract" },
    { title: "Generate" },
    { title: "Write" },
  ],
};

// `args` is { intakePaths: string[], cwd: string }.
// Agent prompt bodies are loaded from agents/<name>.md by the host; here we pass
// the stage instruction and rely on the workflow runtime's agentType mapping.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { join, basename } from "path";
import {
  extractDocumentText, parseIntakeQuality, parseNfrJson, parseTaskBlocks,
  assignTaskIds, buildTaskRegistry, buildTaskBreakdownV2, buildModuleFile,
  buildUserFlowsDoc, buildClientQuestionsDoc, categorizeGaps, parseGaps,
  extractClientRecommendations, slugify, normalizeTitle,
  type RawTask, type Feature,
} from "../lib/breakdown-lib.ts";

const cwd = args.cwd;
const docsDir = join(cwd, "docs", "breakdown");
const modulesDir = join(docsDir, "modules");
mkdirSync(modulesDir, { recursive: true });

function agentPrompt(name) {
  const raw = readFileSync(join(cwd, "agents", `${name}.md`), "utf-8");
  return raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

phase("Normalize");
const rawIntake = args.intakePaths.map(p => extractDocumentText(p)).join("\n\n");
const prd = await agent(
  `${agentPrompt("breakdown-intake-normalizer")}\n\n---INTAKE---\n${rawIntake}`,
  { label: "intake-normalizer", phase: "Normalize" },
);
const quality = parseIntakeQuality(prd);
if (quality.confidence === "needs-more") {
  log(`Intake is too thin to plan from. Gaps: ${quality.gaps.join("; ")}`);
  return { status: "needs-more", gaps: quality.gaps };
}
writeFileSync(join(docsDir, "source.md"), prd, "utf-8");

phase("Analyze");
const classified = await agent(
  `${agentPrompt("breakdown-classifier")}\n\n---DOCUMENT---\n${prd}`,
  { label: "classifier", phase: "Analyze" },
);
const projectName = (classified.match(/^PROJECT_NAME:\s*(.+)$/m)?.[1] ?? "Unknown Project").trim();
const flowAnalysis = await agent(
  `${agentPrompt("breakdown-flow-analyst")}\n\n---DOCUMENT---\n${classified}`,
  { label: "flow-analyst", phase: "Analyze" },
);

phase("Extract");
const [nfr, featureList] = await parallel([
  () => agent(`${agentPrompt("breakdown-nfr-extractor")}\n\n${classified}\n\n${flowAnalysis}`,
    { label: "nfr", phase: "Extract", schema: (await import("./schemas.ts")).NFR_SCHEMA }),
  () => agent(`${agentPrompt("breakdown-feature-extractor")}\n\n${classified}\n\n${flowAnalysis}`,
    { label: "features", phase: "Extract", schema: (await import("./schemas.ts")).FEATURE_LIST_SCHEMA }),
]);
const nfrTasks = nfr.nfrTasks ?? [];
const features = featureList.features ?? [];

const spec = await agent(
  `${agentPrompt("breakdown-tech-spec")}\n\nProject: ${projectName}\n\n${classified}\n\n${flowAnalysis}\n\nFEATURES:\n${JSON.stringify(features)}`,
  { label: "tech-spec", phase: "Extract" },
);

phase("Generate");
const perFeatureMarkdown = await pipeline(
  features,
  (f) => agent(
    `${agentPrompt("breakdown-task-generator")}\n\nGenerate division tasks for this feature:\n\`\`\`json\n${JSON.stringify(f, null, 2)}\n\`\`\`\n\n---TECHNICAL SPEC---\n${spec}`,
    { label: `tasks:${f.module}`, phase: "Generate" },
  ),
);

const rawTasks = [];
perFeatureMarkdown.forEach((md, i) => {
  if (md) rawTasks.push(...parseTaskBlocks(md, features[i].module));
});
rawTasks.push(...nfrTasks.map(t => ({
  title: t.title, module: t.module, division: t.division, userType: "System",
  storyPoints: t.storyPoints ?? 1, userFlow: "", description: t.description ?? "",
  techNotes: t.techNotes ?? "", risks: "", acceptanceCriteria: [],
  subtasks: t.subtasks ?? [], blocks: [], blockedBy: [], stability: "provisional",
})));

// Dedup BE tasks across features (endpoints serve all roles).
const seenBe = new Set();
const deduped = rawTasks.filter(t => {
  if (t.division?.toUpperCase() !== "BE") return true;
  const key = `${t.module}::${normalizeTitle(t.title)}`;
  if (seenBe.has(key)) return false;
  seenBe.add(key); return true;
});

const depsOut = await agent(
  `${agentPrompt("breakdown-dependency-mapper")}\n\nTask list:\n\n${deduped.map(t => `### ${t.title}\n**Module:** ${t.module}\n**Technical Notes:** ${t.techNotes}`).join("\n\n")}`,
  { label: "deps", phase: "Generate", schema: (await import("./schemas.ts")).DEPS_SCHEMA },
);
const depsMap = new Map((depsOut.dependencies ?? []).map(d => [d.task, d.blockedBy]));
for (const t of deduped) t.blockedBy = depsMap.get(t.title) ?? [];

phase("Write");
const slug = slugify(projectName);
const withIds = assignTaskIds(deduped, slug);
const idByTitle = new Map(withIds.map(t => [t.title, t.id]));
for (const t of withIds) t.blockedBy = t.blockedBy.map(x => idByTitle.get(x) ?? x);

// Back up existing artifacts before writing.
const historyDir = join(docsDir, "history");
mkdirSync(historyDir, { recursive: true });
const stamp = (args.timestamp ?? "run").replace(/[:.]/g, "-");
for (const f of ["task-registry.json", "task-breakdown.md", "user-flows.md", "client-recommendations.md", "client-questions.md", "technical-spec.md", "source.md"]) {
  const p = join(docsDir, f);
  if (existsSync(p)) copyFileSync(p, join(historyDir, `${stamp}-${f}`));
}

const registry = buildTaskRegistry(projectName, slug, withIds);
writeFileSync(join(docsDir, "task-registry.json"), JSON.stringify(registry, null, 2), "utf-8");
writeFileSync(join(docsDir, "task-breakdown.md"), buildTaskBreakdownV2(projectName, withIds), "utf-8");
writeFileSync(join(docsDir, "user-flows.md"), buildUserFlowsDoc(projectName, flowAnalysis), "utf-8");
writeFileSync(join(docsDir, "client-recommendations.md"), extractClientRecommendations(flowAnalysis), "utf-8");
const { client, internal } = categorizeGaps(parseGaps(flowAnalysis));
writeFileSync(join(docsDir, "client-questions.md"), buildClientQuestionsDoc(projectName, client, internal), "utf-8");
writeFileSync(join(docsDir, "technical-spec.md"), spec.trim(), "utf-8");

const byModule = new Map();
for (const t of withIds) {
  if (!byModule.has(t.module)) byModule.set(t.module, []);
  byModule.get(t.module).push(t);
}
for (const [module, tasks] of byModule) {
  writeFileSync(join(modulesDir, `${slugify(module)}.md`), buildModuleFile(projectName, module, tasks), "utf-8");
}

return {
  status: "done",
  projectName,
  modules: byModule.size,
  tasks: withIds.length,
  storyPoints: withIds.reduce((s, t) => s + t.storyPoints, 0),
  openQuestions: client.length,
};
```

Note for the implementer: the workflow runtime's `agent()` returns text by default and the validated object when `schema` is passed. The `args` global carries `{ intakePaths, cwd, timestamp }` — pass `timestamp` from the caller since `Date.now()` is unavailable inside workflow scripts.

- [ ] **Step 6: Typecheck the workflow and schemas**

Run: `cd /Users/riaenriala/Documents/etalas/colony && npx tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --skipLibCheck --allowJs false workflow/schemas.ts`
Expected: no errors. (The workflow body uses workflow-runtime globals `agent`/`pipeline`/`parallel`/`phase`/`log`/`args` that are injected at run time; typecheck `schemas.ts` for correctness and rely on the smoke run for the workflow body.)

- [ ] **Step 7: Wire the schema test into the suite, run a workflow smoke test, commit**

Update `package.json` `scripts.test`:

```json
"test": "tsx lib/breakdown-lib.test.ts && tsx lib/agents.test.ts && tsx lib/skill.test.ts && tsx lib/schemas.test.ts"
```

Run: `npm test` → all suites PASS.

Smoke test (in Claude Code, from a scratch project containing the package on its path): invoke the workflow with `args: { intakePaths: ["/tmp/bd-smoke/intake.md"], cwd: "<scratch project>", timestamp: "<ISO string>" }` and confirm `docs/breakdown/` is populated identically to the Pi smoke test.

```bash
git add workflow/ lib/schemas.test.ts package.json
git commit -m "feat: add Claude Code workflow orchestrator with schema-enforced stages"
```

---

### Task 8: Dual-harness distribution manifests and README

**Files:**
- Create: `.claude-plugin/plugin.json`
- Modify: `package.json` (add `pi` field)
- Create: `README.md`
- Test: `lib/manifest.test.ts` (new — validate manifests)

**Interfaces:**
- Consumes: file paths to the extension, skills, and agents created in earlier tasks.
- Produces: an installable package recognized by both Pi (`pi` field) and Claude Code (`.claude-plugin/plugin.json`).

- [ ] **Step 1: Write the failing manifest test**

Create `lib/manifest.test.ts`:

```ts
/** Validates distribution manifests. Run: npx tsx lib/manifest.test.ts */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0, failed = 0;
function test(n: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${n}`); }
  catch (e) { failed++; console.error(`  ✗ ${n}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
test("package.json declares the pi extension and skills", () => {
  assert(Array.isArray(pkg.pi?.extensions) && pkg.pi.extensions.includes("./pi-extension/breakdown.ts"), "pi.extensions missing breakdown.ts");
  assert(Array.isArray(pkg.pi?.skills) && pkg.pi.skills.includes("./skills"), "pi.skills missing ./skills");
});
test("every referenced path exists", () => {
  for (const e of pkg.pi.extensions) assert(existsSync(join(ROOT, e)), `missing ${e}`);
  for (const s of pkg.pi.skills) assert(existsSync(join(ROOT, s)), `missing ${s}`);
});
const plugin = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf-8"));
test("claude plugin manifest has name + version", () => {
  assert(typeof plugin.name === "string" && plugin.name.length > 0, "plugin name required");
  assert(typeof plugin.version === "string", "plugin version required");
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx lib/manifest.test.ts`
Expected: FAIL — `package.json` has no `pi` field / `.claude-plugin/plugin.json` does not exist.

- [ ] **Step 3: Add the `pi` field to package.json**

Add to `package.json`:

```json
  "keywords": ["pi-package", "skills", "breakdown", "project-planning"],
  "pi": {
    "extensions": ["./pi-extension/breakdown.ts"],
    "skills": ["./skills"]
  }
```

- [ ] **Step 4: Create the Claude Code plugin manifest**

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "breakdown",
  "version": "0.1.0",
  "description": "Client intake → standardized PRD → task breakdown pipeline. Harness-agnostic.",
  "author": { "name": "Etalas" }
}
```

- [ ] **Step 5: Create the README**

Create `README.md`:

```markdown
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
```

- [ ] **Step 6: Run the manifest test and the full suite**

Run: `npx tsx lib/manifest.test.ts`
Expected: PASS.

Update `package.json` `scripts.test` to include it:

```json
"test": "tsx lib/breakdown-lib.test.ts && tsx lib/agents.test.ts && tsx lib/skill.test.ts && tsx lib/schemas.test.ts && tsx lib/manifest.test.ts"
```

Run: `npm test`
Expected: every suite PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json .claude-plugin/ README.md lib/manifest.test.ts
git commit -m "feat: dual-harness distribution manifests (pi field + claude plugin) and README"
```

---

## Self-Review

**Spec coverage:**
- Layered package (agents + lib / Pi extension / CC Workflow) → Tasks 1, 6, 7 ✓
- `docs/breakdown/` state, identical across harnesses → Tasks 6, 7 (same library writers) ✓
- Session intelligence skill with mode detection → Task 5; deterministic reader → Task 4 ✓
- Intake Normalizer (step 0) + confidence behavior → Tasks 2, 3, 6, 7 ✓
- Interactive gates removed (wizard, interview, review gate) → Task 6 ✓
- Overwrite-safety as the only confirmation → encoded in skill (Task 5); enforced conversationally ✓
- Refinement modes preserved → Task 6 keeps refine/answer/scope/manage paths ✓
- Distribution (pi field + claude plugin, installs like Superpowers) → Task 8 ✓
- Cross-harness portability of registry → shared `lib` writers in both runtimes ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows real code; every command shows expected output. ✓

**Type consistency:** `parseIntakeQuality`/`IntakeQuality`/`IntakeConfidence` (Task 2) reused in Tasks 6, 7. `readProjectState`/`ProjectState` (Task 4) referenced in Task 5 prose and imported in Task 6. Schema names `INTAKE_SCHEMA`/`FEATURE_LIST_SCHEMA`/`NFR_SCHEMA`/`DEPS_SCHEMA` (Task 7) match their test (Task 7) usage. Library function names (`buildTaskBreakdownV2`, `buildModuleFile`, `assignTaskIds`, `categorizeGaps`, `parseGaps`, `extractClientRecommendations`, `normalizeTitle`) match the source library exactly. ✓

**Noted deviation from pure unit-TDD:** Tasks 6 and 7 are runtime glue that spawns subprocesses / uses injected workflow globals; their testable logic lives in the library (Tasks 2, 4) and schemas (Task 7), which ARE unit-tested first. Runtime verification is an explicit typecheck + documented manual smoke run. This is called out rather than faked with hollow tests.
