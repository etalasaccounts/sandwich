# Design: Deterministic Brief Artifacts & Centralized Layout

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plans
**Branch context:** `feat/pi-registry-write-gate`

## Problem

Artifacts produced by the brief pipeline (`/order`) come out in a **different
format on every run**: heading order shifts, tables turn into bullet lists,
sections appear/disappear, and confidence markers render three different ways
(`` `[stated]` `` vs `[stated]` vs `**stated**`).

Root cause: the brief agents emit the **final markdown directly**
(`brief/agents/02-write-prd.md:80` — "Output the complete `prd.md` as plain
markdown"), and the only validation is a length check:

```ts
export const PrdSchema = z.string().min(100, "PRD too short"); // brief/lib/validation.ts:28
```

The "## Structure" block in each prompt is advisory. Nothing enforces it, so the
model re-decides the format each run.

By contrast the **spec pipeline is stable**: the agent emits JSON, code validates
it against a Zod schema (`spec/lib/validation.ts`), and `writeSpec()`
(`plan/lib/plan-lib.ts:557`) renders the markdown from a hardcoded template. The
format lives in code, not in the model.

**Principle:** code for the deterministic, LLM for judgment. Rendering the final
format is deterministic and belongs in code; the model owns only *what goes in*.

## Scope

Two independent efforts under one design, delivered as **two implementation
plans** (A first — lower risk; then B — touches the registry write-gate).

### Effort A — Consistency (the original ask)
Move the brief pipeline to the spec pipeline's model.

### Effort B — Centralization
Collapse the current two-tree split (`docs/sandwich/` committed +
`.sandwich/` gitignored) into a single committed tree under `docs/sandwich/`.

### Out of scope
- Discover agents (`brief/agents/discover-*.md`) — already emit validated JSON.
- Requirements extraction (`01-extract-requirements.md`) — already JSON +
  `validateRequirements`.
- Reconcile summary (`06-reconcile-changes.md`) — produces a log line, not an
  artifact.

---

## Effort A — Consistency

### A.1 Per-artifact pipeline shape

```
agent → JSON → validate (Zod, retry via runAgentWithValidation)
            → write <artifact>.json (committed)
            → render<Artifact>(json) → <artifact>.md (committed, deterministic)
```

Reuses the existing `runAgentWithValidation` wrapper
(`spec/lib/agent-wrapper.ts`). Four artifacts: PRD, user-flows,
technical-notes, client-questions.

### A.2 Schemas (new contracts)

Confidence stops being a free-text marker the model types and becomes a typed
enum field; the **renderer** emits the `` `[stated]` `` marker. This removes the
single biggest source of drift.

```ts
const Confidence = z.enum(["stated", "discussed", "inferred", "assumed"]);

// prd.json
PrdDoc = {
  projectName: string,
  mode: enum(["create","refine","answer","brownfield"]),
  overview: string,                       // prose allowed
  projectState: { phase: string, hasExistingCodebase: boolean, briefSource: string },
  actors: { name: string, role: string, confidence: Confidence }[],   // >=1
  modules: {
    name: string,
    status: enum(["planned","exists","partial","broken"]),
    description: string,
    features: { text: string, confidence: Confidence }[],             // >=1
  }[],                                                                 // >=1
  integrations: { text: string, confidence: Confidence }[],
  constraints:  { text: string, confidence: Confidence }[],
  stakeholders: { name: string, role: string }[],
  timeline: string | null,
  openQuestionsCount: number,
}

// user-flows.json
UserFlowsDoc = {
  flows: {
    id: string,                 // UF-XXX
    title: string,
    actor: string,
    trigger: string,
    steps: string[],            // >=1, prose per step
    outcome: string,
    confidence: Confidence,
  }[],                          // >=1
}

// technical-notes.json
TechNotesDoc = {
  stack: { layer: string, choice: string, rationale: string }[],
  architectureNotes: { heading: string, body: string }[],   // prose body
  risks: { text: string, severity: enum(["low","medium","high"]) }[],
  openDecisions: { text: string, confidence: Confidence }[],
}

// client-questions.json
ClientQuestionsDoc = {
  questions: {
    id: string,                 // Q-XXX
    question: string,
    why: string,
    blocks: string[],           // module/feature references this question blocks
    priority: enum(["high","medium","low"]),
  }[],
}
```

Prose still lives where prose belongs (`overview`, `steps[]`, `rationale`,
`body`, `why`); only the skeleton is fixed.

### A.3 Renderers

Pure functions `renderPrd()`, `renderUserFlows()`, `renderTechNotes()`,
`renderClientQuestions()` — `JSON → markdown string`, mirroring `writeSpec()`
(`plan-lib.ts:557`). The "## Structure" markdown templates currently embedded in
the agent prompts move **into these functions**. The agent prompts keep only the
JSON shape + rules.

### A.4 Changelog (refine/answer mode)

`diffBriefDoc(oldJson, newJson)` compares the committed prior `<artifact>.json`
against the freshly generated one and renders a `## Changes since last run`
section listing added / removed / modified items. Deterministic, no model
involvement. On first run (no prior JSON) it renders nothing. This replaces the
old `<!-- updated -->` inline markers, which don't survive deterministic
rendering.

### A.5 Two shared fixes (both pipelines benefit)

1. **Lenient parse** in `agent-wrapper.ts:58`. Today:
   ```ts
   parsed = JSON.parse(rawOutput); // throws on fenced/preambled output → burns a retry
   ```
   Change to: extract fenced ```` ```json ```` block → else first balanced
   `{…}` → else whole output, *then* `JSON.parse`. Validation stays strict.

2. **No-questions guard** prepended to all four brief prompts:
   > Do NOT ask questions. Do NOT ask for clarification. The input is already in
   > this message — process it immediately. Your response must START with `{` —
   > no preamble.

   The brief prompts currently lack this; small models otherwise reply "Would
   you like me to…?" and the pipeline produces garbage.

---

## Effort B — Centralization

### B.1 Target layout

```
docs/sandwich/
  brief/      prd.{md,json}  user-flows.{md,json}
              technical-notes.{md,json}  client-questions.{md,json}  context.json
  plan/       feature-queue.md  impact-analysis.md  plan-context.json
  specs/      F-001.{md,json}  …
  registry/   project.json  features/…  journal.jsonl  views/…
```

- Everything committed. `.sandwich/` and `.sandwich/.gitignore` are removed.
- `feature-queue.md` lives under `docs/sandwich/plan/` (the plan pipeline owns
  the queue).

### B.2 Current → target moves

| Artifact | Current | Target |
|---|---|---|
| brief `.md` | `docs/sandwich/*.md` (flat) | `docs/sandwich/brief/*.md` |
| brief `.json` (new) | — | `docs/sandwich/brief/*.json` |
| brief context | `docs/sandwich/.brief-context.json` | `docs/sandwich/brief/context.json` |
| `feature-queue.md` | `docs/sandwich/feature-queue.md` | `docs/sandwich/plan/feature-queue.md` |
| `impact-analysis.md` | `.sandwich/impact-analysis.md` | `docs/sandwich/plan/impact-analysis.md` |
| `.plan-context.json` | `.sandwich/.plan-context.json` | `docs/sandwich/plan/plan-context.json` |
| registry | `.sandwich/registry/` | `docs/sandwich/registry/` |
| views | `.sandwich/views/` | `docs/sandwich/registry/views/` |

### B.3 Fix the brief read/write path bug

The brief pipeline writes to `docs/sandwich/*.md` (flat, after flatten commit
`6a2fadf`), but `readBriefArtifacts` (`plan-lib.ts:620`) still reads from
`docs/sandwich/brief/*.md` (nested). So `/recipe` currently can't see the brief.
The target layout (`docs/sandwich/brief/`) resolves this — both sides must point
at the new path. This is the canonical path after the migration; verify with a
full `/order` → `/recipe` round-trip.

### B.4 Path constants to update

- `brief/lib/brief-lib.ts:55–62` (`getBriefPaths`)
- `plan/lib/plan-lib.ts:106–113` (`getPlanPaths`), `:620` (`readBriefArtifacts`)
- `registry/registry-io.ts:60–72` (`sandwichDir`, `registryDir`, `viewsDir`,
  `featureQueueView`), `:89` (gitignore creation — remove), `:464–466` (registry
  path parsing), `:651`
- `registry/pi-gate.ts` — any `.sandwich/registry/` path assumptions in the
  write-gate.

### B.5 Migration note

This commits the registry (previously gitignored). Consequence: registry JSON
churns on every pipeline run and can conflict on merges. Accepted trade-off per
the "nothing ignored / single tree" decision. Because it touches the write-gate
on the current branch, B is implemented and verified separately from A. No
automatic migration of existing `.sandwich/` data is required (greenfield
pipeline state); document the one-time manual move if a live project exists.

---

## Testing

- **A:** unit tests per renderer (golden JSON → fixed markdown string); schema
  validation tests (valid/invalid fixtures); lenient-parse tests (fenced, raw,
  preambled). Run a real `/order` twice and assert byte-identical `.md` for
  identical JSON input.
- **B:** path-constant tests; full `/order` → `/prep` → `/recipe` round-trip
  asserting every artifact lands at its target path; write-gate selfcheck
  (`registry/registry.selfcheck.ts`, `plan/lib/validation.selfcheck.ts`) passes
  against the new registry location.

## Open questions

None. (TechNotesDoc shape confirmed during design.)
