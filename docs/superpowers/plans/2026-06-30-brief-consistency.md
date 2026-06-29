# Brief Artifact Consistency (Effort A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the brief pipeline (`/order`) emit byte-identical-format artifacts on every run by moving it to the spec pipeline's model: agent → JSON → Zod validation → deterministic code renderer.

**Architecture:** Each brief agent stops writing final markdown and instead emits a typed JSON document. Code validates it with Zod (reusing `runAgentWithValidation` + retry), persists `<artifact>.json`, then renders `<artifact>.md` from a pure render function. Confidence becomes a typed enum field; the renderer emits the `` `[stated]` `` marker, so markers can no longer drift. A deterministic JSON diff produces a "Changes since last run" changelog in refine/answer mode.

**Tech Stack:** TypeScript (ESM, `--experimental-strip-types`), zod ^3.25, Node built-ins. No test framework — plain `node:assert` self-check files.

## Global Constraints

- Runtime: `node --experimental-strip-types`; all intra-repo imports use `.js`/`.ts` specifiers exactly as neighboring files do (e.g. `runAgentWithValidation` is imported from `../../spec/lib/agent-wrapper.js`).
- zod version: `^3.25.76` (already a root dependency). Use zod 3.x APIs only.
- No new npm dependencies (per project: pi extensions stay dependency-light).
- Tests are self-check files run with `node --experimental-strip-types <file>`; each uses `import { strict as assert } from "node:assert"` and the `check(name, fn)` pattern from `plan/lib/validation.selfcheck.ts`.
- This plan is **Effort A only** — it keeps the current flat output paths (`docs/sandwich/prd.md`, etc.). Relocation to `docs/sandwich/brief/` is Effort B and is explicitly NOT done here.
- Validators MUST return the `ValidationResult<T>` shape from `spec/lib/validation.ts` (fields: `valid`, `data?`, `errors[]`, `warnings[]`, `confidence{score, level, blockers[]}`) so they plug into `runAgentWithValidation`.

---

## File Structure

**Create:**
- `brief/lib/brief-schemas.ts` — Zod schemas (`PrdDocSchema`, `UserFlowsDocSchema`, `TechNotesDocSchema`, `ClientQuestionsDocSchema`), inferred types, and validators (`validatePrdDoc`, …).
- `brief/lib/brief-render.ts` — pure renderers (`renderPrd`, `renderUserFlows`, `renderTechNotes`, `renderClientQuestions`), `diffBriefDoc`, `renderChangelog`.
- `brief/lib/validation.selfcheck.ts` — plain-assert tests for the above + the shared parse fix.

**Modify:**
- `spec/lib/agent-wrapper.ts` — add lenient `extractJson()` and use it before `JSON.parse` (shared fix, benefits spec + brief).
- `brief/lib/brief-lib.ts` — add `*Json` entries to `BriefPaths`/`getBriefPaths`, add `readBriefDocs()` + `writeBriefArtifact()`.
- `brief/agents/02-write-prd.md`, `03-write-user-flows.md`, `04-write-technical-notes.md`, `05-write-client-questions.md` — emit JSON, add no-questions guard.
- `brief/workflow/brief.workflow.ts` — Phase 5 rewritten to validate + render + write per artifact.
- `package.json` — add the brief self-check to the `test` script.

---

## Task 1: Lenient JSON extraction in the shared agent wrapper

**Files:**
- Modify: `spec/lib/agent-wrapper.ts` (add `extractJson`, use it at the parse site ~line 57-61)
- Test: `brief/lib/validation.selfcheck.ts` (created here; also covers later tasks)

**Interfaces:**
- Produces: `export function extractJson(raw: string): string` — returns the most-likely JSON substring (fenced ```` ```json ```` block → first balanced `{…}` → trimmed whole string). Pure; does not call `JSON.parse`.

- [ ] **Step 1: Write the failing test**

Create `brief/lib/validation.selfcheck.ts`:

```ts
// Self-check for the brief consistency layer (schemas, renderers, parse).
// Run: node --experimental-strip-types brief/lib/validation.selfcheck.ts
// Plain asserts, no framework. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { extractJson } from "../../spec/lib/agent-wrapper.ts";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

// --- extractJson ---
check("extractJson unwraps a ```json fence", () => {
  const raw = "Sure!\n```json\n{\"a\":1}\n```\nDone";
  assert.deepEqual(JSON.parse(extractJson(raw)), { a: 1 });
});
check("extractJson finds a bare object after preamble", () => {
  const raw = "Here you go: {\"a\":2} thanks";
  assert.deepEqual(JSON.parse(extractJson(raw)), { a: 2 });
});
check("extractJson passes through clean JSON", () => {
  assert.deepEqual(JSON.parse(extractJson("{\"a\":3}")), { a: 3 });
});

console.log(`\n${n} brief checks passed.`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: FAIL — `extractJson` is not exported from `agent-wrapper.ts` (import error / undefined).

- [ ] **Step 3: Implement `extractJson` and use it**

In `spec/lib/agent-wrapper.ts`, add this exported function (near the other utilities, e.g. above `runAgentWithValidation`):

```ts
// Pull the most-likely JSON payload out of a model response. Small models
// wrap output in ```json fences or add preamble; strict JSON.parse on the
// raw string would throw and burn a retry. Extract leniently, validate strictly.
export function extractJson(raw: string): string {
  const text = raw.trim();

  // 1. Fenced block: ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim()) return fence[1].trim();

  // 2. First balanced { ... } (object) — scan respecting strings/escapes.
  const start = text.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  // 3. Give up gracefully — return the trimmed text for JSON.parse to report.
  return text;
}
```

Then change the parse site (currently `spec/lib/agent-wrapper.ts:57-61`):

```ts
      // Parse JSON (lenient extraction, strict parse)
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(rawOutput));
      } catch (e) {
        throw new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: PASS — `3 brief checks passed.`

- [ ] **Step 5: Verify the spec pipeline still self-checks**

Run: `npm test`
Expected: existing `plan` + `registry` checks still PASS (the parse change is backward-compatible — clean JSON passes through unchanged).

- [ ] **Step 6: Commit**

```bash
git add spec/lib/agent-wrapper.ts brief/lib/validation.selfcheck.ts
git commit -m "feat: lenient JSON extraction in shared agent wrapper"
```

---

## Task 2: Brief document schemas + validators

**Files:**
- Create: `brief/lib/brief-schemas.ts`
- Test: `brief/lib/validation.selfcheck.ts` (append)

**Interfaces:**
- Produces:
  - `PrdDoc`, `UserFlowsDoc`, `TechNotesDoc`, `ClientQuestionsDoc` (inferred types)
  - `validatePrdDoc(o: unknown): ValidationResult<PrdDoc>` and the three siblings
  - `PrdDocSchema`, `UserFlowsDocSchema`, `TechNotesDocSchema`, `ClientQuestionsDocSchema`
- Consumes: `ValidationResult<T>` type from `spec/lib/validation.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `brief/lib/validation.selfcheck.ts` (before the final `console.log`):

```ts
import {
  validatePrdDoc,
  validateUserFlowsDoc,
  validateTechNotesDoc,
  validateClientQuestionsDoc,
  type PrdDoc,
} from "./brief-schemas.ts";

const VALID_PRD: PrdDoc = {
  projectName: "Acme",
  mode: "create",
  overview: "A thing.",
  projectState: { phase: "greenfield", hasExistingCodebase: false, briefSource: "Conversation" },
  actors: [{ name: "User", role: "buys", confidence: "stated" }],
  modules: [{ name: "Auth", status: "planned", description: "Login", features: [{ text: "OAuth", confidence: "stated" }] }],
  integrations: [],
  constraints: [],
  stakeholders: [],
  timeline: null,
  openQuestionsCount: 0,
};

check("validatePrdDoc accepts a well-formed PRD", () => {
  const r = validatePrdDoc(VALID_PRD);
  assert.equal(r.valid, true);
  assert.equal(r.data?.actors[0].confidence, "stated");
});
check("validatePrdDoc rejects empty modules", () => {
  const r = validatePrdDoc({ ...VALID_PRD, modules: [] });
  assert.equal(r.valid, false);
});
check("validatePrdDoc rejects a bad confidence enum", () => {
  const bad = { ...VALID_PRD, actors: [{ name: "U", role: "r", confidence: "maybe" }] };
  assert.equal(validatePrdDoc(bad).valid, false);
});
check("validateUserFlowsDoc requires UF-### ids and >=1 step", () => {
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated" }] }).valid, true);
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "F1", title: "t", actor: "a", trigger: "x", steps: [], outcome: "o", confidence: "stated" }] }).valid, false);
});
check("validateTechNotesDoc requires stack or architectureNotes", () => {
  assert.equal(validateTechNotesDoc({ stack: [{ layer: "db", choice: "pg", rationale: "ok" }], architectureNotes: [], risks: [], openDecisions: [] }).valid, true);
  assert.equal(validateTechNotesDoc({ stack: [], architectureNotes: [], risks: [], openDecisions: [] }).valid, false);
});
check("validateClientQuestionsDoc accepts empty questions and Q-### ids", () => {
  assert.equal(validateClientQuestionsDoc({ questions: [] }).valid, true);
  assert.equal(validateClientQuestionsDoc({ questions: [{ id: "Q-001", question: "q", why: "w", blocks: [], priority: "high" }] }).valid, true);
  assert.equal(validateClientQuestionsDoc({ questions: [{ id: "1", question: "q", why: "w", blocks: [], priority: "nope" }] }).valid, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: FAIL — cannot import from `./brief-schemas.ts` (module not found).

- [ ] **Step 3: Implement `brief/lib/brief-schemas.ts`**

```ts
import { z } from "zod";
import type { ValidationResult } from "../../spec/lib/validation.js";

export const ConfidenceSchema = z.enum(["stated", "discussed", "inferred", "assumed"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const MarkedItem = z.object({
  text: z.string().min(1),
  confidence: ConfidenceSchema,
});

export const PrdDocSchema = z.object({
  projectName: z.string().min(1),
  mode: z.string().min(1), // mirrors the brief BriefMode; render-only, no enum coupling
  overview: z.string().min(1),
  projectState: z.object({
    phase: z.string().min(1),
    hasExistingCodebase: z.boolean(),
    briefSource: z.string().min(1),
  }),
  actors: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    confidence: ConfidenceSchema,
  })).min(1, "At least one actor required"),
  modules: z.array(z.object({
    name: z.string().min(1),
    status: z.enum(["planned", "exists", "partial", "broken"]),
    description: z.string().min(1),
    features: z.array(MarkedItem).min(1, "Each module needs at least one feature"),
  })).min(1, "At least one module required"),
  integrations: z.array(MarkedItem),
  constraints: z.array(MarkedItem),
  stakeholders: z.array(z.object({ name: z.string().min(1), role: z.string().min(1) })),
  timeline: z.string().nullable(),
  openQuestionsCount: z.number().int().min(0),
});
export type PrdDoc = z.infer<typeof PrdDocSchema>;

export const UserFlowsDocSchema = z.object({
  flows: z.array(z.object({
    id: z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX"),
    title: z.string().min(1),
    actor: z.string().min(1),
    trigger: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1, "A flow needs at least one step"),
    outcome: z.string().min(1),
    confidence: ConfidenceSchema,
  })).min(1, "At least one user flow required"),
});
export type UserFlowsDoc = z.infer<typeof UserFlowsDocSchema>;

export const TechNotesDocSchema = z.object({
  stack: z.array(z.object({
    layer: z.string().min(1),
    choice: z.string().min(1),
    rationale: z.string().min(1),
  })),
  architectureNotes: z.array(z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  })),
  risks: z.array(z.object({
    text: z.string().min(1),
    severity: z.enum(["low", "medium", "high"]),
  })),
  openDecisions: z.array(MarkedItem),
}).refine(
  (d) => d.stack.length + d.architectureNotes.length >= 1,
  { message: "technical-notes needs at least one stack entry or architecture note" },
);
export type TechNotesDoc = z.infer<typeof TechNotesDocSchema>;

export const ClientQuestionsDocSchema = z.object({
  questions: z.array(z.object({
    id: z.string().regex(/^Q-\d{3}$/, "Question id must be Q-XXX"),
    question: z.string().min(1),
    why: z.string().min(1),
    blocks: z.array(z.string()),
    priority: z.enum(["high", "medium", "low"]),
  })),
});
export type ClientQuestionsDoc = z.infer<typeof ClientQuestionsDocSchema>;

// Generic validator factory → returns the ValidationResult<T> shape that
// runAgentWithValidation expects.
function makeValidator<T>(schema: z.ZodType<T>): (o: unknown) => ValidationResult<T> {
  return (output: unknown): ValidationResult<T> => {
    const r = schema.safeParse(output);
    if (r.success) {
      return {
        valid: true,
        data: r.data,
        errors: [],
        warnings: [],
        confidence: { score: 1, level: "confirmed", blockers: [] },
      };
    }
    return {
      valid: false,
      errors: r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      warnings: [],
      confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] },
    };
  };
}

export const validatePrdDoc = makeValidator(PrdDocSchema);
export const validateUserFlowsDoc = makeValidator(UserFlowsDocSchema);
export const validateTechNotesDoc = makeValidator(TechNotesDocSchema);
export const validateClientQuestionsDoc = makeValidator(ClientQuestionsDocSchema);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: PASS — all checks (parse + schema) report ✓.

- [ ] **Step 5: Commit**

```bash
git add brief/lib/brief-schemas.ts brief/lib/validation.selfcheck.ts
git commit -m "feat: zod schemas + validators for brief documents"
```

---

## Task 3: Deterministic renderers

**Files:**
- Create: `brief/lib/brief-render.ts`
- Test: `brief/lib/validation.selfcheck.ts` (append)

**Interfaces:**
- Consumes: `PrdDoc`, `UserFlowsDoc`, `TechNotesDoc`, `ClientQuestionsDoc` from `./brief-schemas.ts`.
- Produces:
  - `renderPrd(doc: PrdDoc, prev?: PrdDoc): string`
  - `renderUserFlows(doc: UserFlowsDoc, prev?: UserFlowsDoc): string`
  - `renderTechNotes(doc: TechNotesDoc, prev?: TechNotesDoc): string`
  - `renderClientQuestions(doc: ClientQuestionsDoc, prev?: ClientQuestionsDoc): string`

- [ ] **Step 1: Write the failing tests**

Append to `brief/lib/validation.selfcheck.ts`:

```ts
import { renderPrd, renderUserFlows, renderTechNotes, renderClientQuestions } from "./brief-render.ts";

check("renderPrd is deterministic for identical input", () => {
  const a = renderPrd(VALID_PRD);
  const b = renderPrd(VALID_PRD);
  assert.equal(a, b);
});
check("renderPrd emits the confidence marker, not a raw enum word", () => {
  const md = renderPrd(VALID_PRD);
  assert.ok(md.includes("`[stated]` OAuth"), "feature should render with `[stated]` marker");
  assert.ok(md.includes("# Acme — Product Requirements Document"));
});
check("renderUserFlows lists numbered steps", () => {
  const md = renderUserFlows({ flows: [{ id: "UF-001", title: "Login", actor: "User", trigger: "click", steps: ["open", "submit"], outcome: "in", confidence: "stated" }] });
  assert.ok(md.includes("### UF-001 — Login"));
  assert.ok(md.includes("1. open"));
  assert.ok(md.includes("2. submit"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: FAIL — cannot import `./brief-render.ts`.

- [ ] **Step 3: Implement `brief/lib/brief-render.ts`**

```ts
import type {
  PrdDoc,
  UserFlowsDoc,
  TechNotesDoc,
  ClientQuestionsDoc,
} from "./brief-schemas.js";

const mark = (c: string): string => `\`[${c}]\``;
const today = (): string => new Date().toISOString().split("T")[0];

// --- Changelog (deterministic JSON diff) ---

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function diffBriefDoc(prev: unknown, next: unknown, path = ""): string[] {
  const changes: string[] = [];
  if (Array.isArray(prev) && Array.isArray(next)) {
    const max = Math.max(prev.length, next.length);
    for (let i = 0; i < max; i++) {
      const p = `${path}[${i}]`;
      if (i >= prev.length) changes.push(`added ${p}`);
      else if (i >= next.length) changes.push(`removed ${p}`);
      else changes.push(...diffBriefDoc(prev[i], next[i], p));
    }
  } else if (isObj(prev) && isObj(next)) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in prev)) changes.push(`added ${p}`);
      else if (!(k in next)) changes.push(`removed ${p}`);
      else changes.push(...diffBriefDoc(prev[k], next[k], p));
    }
  } else if (JSON.stringify(prev) !== JSON.stringify(next)) {
    changes.push(`changed ${path || "(root)"}`);
  }
  return changes;
}

export function renderChangelog(changes: string[]): string {
  if (changes.length === 0) return "";
  return ["", "## Changes since last run", ...changes.map((c) => `- ${c}`), ""].join("\n");
}

function withChangelog<T>(body: string, doc: T, prev?: T): string {
  if (!prev) return body;
  const log = renderChangelog(diffBriefDoc(prev, doc));
  return log ? `${body}\n${log}\n` : body;
}

// --- Renderers ---

export function renderPrd(doc: PrdDoc, prev?: PrdDoc): string {
  const lines: string[] = [
    `# ${doc.projectName} — Product Requirements Document`,
    "",
    `> Generated by sandwich/brief · mode: ${doc.mode} · ${today()}`,
    "",
    `## Overview`,
    doc.overview,
    "",
    `## Project State`,
    `| | |`,
    `|--|--|`,
    `| **Phase** | ${doc.projectState.phase} |`,
    `| **Has existing codebase** | ${doc.projectState.hasExistingCodebase ? "Yes" : "No"} |`,
    `| **Brief source** | ${doc.projectState.briefSource} |`,
    "",
    `## Actors`,
    `| Actor | Role | Confidence |`,
    `|-------|------|------------|`,
    ...doc.actors.map((a) => `| ${a.name} | ${a.role} | ${a.confidence} |`),
    "",
    `## Modules & Features`,
    ...doc.modules.flatMap((m) => [
      `### ${m.name}`,
      `> Status: \`${m.status}\``,
      "",
      m.description,
      "",
      `**Features:**`,
      ...m.features.map((f) => `- ${mark(f.confidence)} ${f.text}`),
      "",
    ]),
    `## Integrations`,
    ...(doc.integrations.length
      ? doc.integrations.map((i) => `- ${mark(i.confidence)} ${i.text}`)
      : ["_None._"]),
    "",
    `## Constraints`,
    ...(doc.constraints.length
      ? doc.constraints.map((c) => `- ${mark(c.confidence)} ${c.text}`)
      : ["_None._"]),
    "",
    `## Stakeholders`,
    ...(doc.stakeholders.length
      ? doc.stakeholders.map((s) => `- ${s.name} — ${s.role}`)
      : ["_Identify during client kickoff._"]),
    "",
    `## Timeline`,
    doc.timeline ?? "Not specified",
    "",
    `## Open Questions`,
    `${doc.openQuestionsCount} questions remain — see \`client-questions.md\``,
    "",
    `---`,
    `> **For task breakdown pipeline:** Items marked ${mark("assumed")} must be validated before generating tasks. Items marked ${mark("inferred")} should be confirmed with the team. Items marked ${mark("stated")} are locked requirements.`,
    "",
  ];
  return withChangelog(lines.join("\n"), doc, prev);
}

export function renderUserFlows(doc: UserFlowsDoc, prev?: UserFlowsDoc): string {
  const lines: string[] = [
    `# User Flows`,
    "",
    `> Generated by sandwich/brief · ${today()}`,
    "",
    ...doc.flows.flatMap((f) => [
      `### ${f.id} — ${f.title}`,
      `- **Actor:** ${f.actor}`,
      `- **Trigger:** ${f.trigger}`,
      `- **Confidence:** ${mark(f.confidence)}`,
      "",
      `**Steps:**`,
      ...f.steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      `**Outcome:** ${f.outcome}`,
      "",
    ]),
  ];
  return withChangelog(lines.join("\n"), doc, prev);
}

export function renderTechNotes(doc: TechNotesDoc, prev?: TechNotesDoc): string {
  const lines: string[] = [
    `# Technical Notes`,
    "",
    `> Generated by sandwich/brief · ${today()}`,
    "",
    `## Stack`,
    ...(doc.stack.length
      ? [
          `| Layer | Choice | Rationale |`,
          `|-------|--------|-----------|`,
          ...doc.stack.map((s) => `| ${s.layer} | ${s.choice} | ${s.rationale} |`),
        ]
      : ["_Not specified._"]),
    "",
    `## Architecture Notes`,
    ...(doc.architectureNotes.length
      ? doc.architectureNotes.flatMap((a) => [`### ${a.heading}`, a.body, ""])
      : ["_None._", ""]),
    `## Risks`,
    ...(doc.risks.length
      ? doc.risks.map((r) => `- **[${r.severity}]** ${r.text}`)
      : ["_None identified._"]),
    "",
    `## Open Decisions`,
    ...(doc.openDecisions.length
      ? doc.openDecisions.map((d) => `- ${mark(d.confidence)} ${d.text}`)
      : ["_None._"]),
    "",
  ];
  return withChangelog(lines.join("\n"), doc, prev);
}

export function renderClientQuestions(doc: ClientQuestionsDoc, prev?: ClientQuestionsDoc): string {
  const lines: string[] = [
    `# Client Questions`,
    "",
    `> Generated by sandwich/brief · ${today()}`,
    "",
    ...(doc.questions.length
      ? doc.questions.flatMap((q) => [
          `### ${q.id} (${q.priority})`,
          q.question,
          "",
          `- **Why:** ${q.why}`,
          `- **Blocks:** ${q.blocks.length ? q.blocks.join(", ") : "—"}`,
          "",
        ])
      : ["_No open questions._", ""]),
  ];
  return withChangelog(lines.join("\n"), doc, prev);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: PASS — all render checks ✓.

- [ ] **Step 5: Commit**

```bash
git add brief/lib/brief-render.ts brief/lib/validation.selfcheck.ts
git commit -m "feat: deterministic renderers + changelog for brief documents"
```

---

## Task 4: Changelog diff tests

**Files:**
- Test: `brief/lib/validation.selfcheck.ts` (append)

**Interfaces:**
- Consumes: `diffBriefDoc`, `renderChangelog` from `./brief-render.ts` (add to the existing import line from Task 3).

- [ ] **Step 1: Write the failing tests**

Add `diffBriefDoc, renderChangelog` to the brief-render import, then append:

```ts
check("diffBriefDoc reports a changed leaf with its path", () => {
  const a = { overview: "x", openQuestionsCount: 0 };
  const b = { overview: "y", openQuestionsCount: 0 };
  assert.deepEqual(diffBriefDoc(a, b), ["changed overview"]);
});
check("diffBriefDoc reports added/removed array items", () => {
  const a = { modules: [{ name: "A" }] };
  const b = { modules: [{ name: "A" }, { name: "B" }] };
  assert.deepEqual(diffBriefDoc(a, b), ["added modules[1]"]);
});
check("diffBriefDoc returns empty for identical docs", () => {
  assert.deepEqual(diffBriefDoc(VALID_PRD, VALID_PRD), []);
});
check("renderChangelog is empty when nothing changed", () => {
  assert.equal(renderChangelog([]), "");
});
check("renderPrd appends a changelog only when prev differs", () => {
  assert.ok(!renderPrd(VALID_PRD).includes("Changes since last run"));
  const changed = { ...VALID_PRD, overview: "different" };
  assert.ok(renderPrd(changed, VALID_PRD).includes("## Changes since last run"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: FAIL — `diffBriefDoc`/`renderChangelog` not imported (reference error) until the import line is updated. (The functions already exist from Task 3; this task locks their behavior.)

- [ ] **Step 3: Make it pass**

Confirm the import line reads:

```ts
import { renderPrd, renderUserFlows, renderTechNotes, renderClientQuestions, diffBriefDoc, renderChangelog } from "./brief-render.ts";
```

No implementation change is expected — the Task 3 code already satisfies these. If a test fails on behavior, fix `diffBriefDoc`/`renderChangelog` in `brief-render.ts` to match.

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add brief/lib/validation.selfcheck.ts
git commit -m "test: lock changelog diff behavior for brief documents"
```

---

## Task 5: Brief paths + document I/O

**Files:**
- Modify: `brief/lib/brief-lib.ts` (`BriefPaths` interface ~line 24-31, `getBriefPaths` ~line 54-64; add new exports near the I/O section ~line 222+)
- Test: `brief/lib/validation.selfcheck.ts` (append)

**Interfaces:**
- Produces:
  - Extended `BriefPaths` with `prdJson`, `userFlowsJson`, `technicalNotesJson`, `clientQuestionsJson`.
  - `readBriefDocs(projectRoot: string): { prd?: PrdDoc; userFlows?: UserFlowsDoc; technicalNotes?: TechNotesDoc; clientQuestions?: ClientQuestionsDoc }` — prior JSON docs (for changelog), `undefined` per artifact if absent.
  - `writeBriefArtifact(projectRoot: string, kind: "prd" | "userFlows" | "technicalNotes" | "clientQuestions", doc: unknown, rendered: string): { json: string; md: string }` — writes `<artifact>.json` and the rendered `<artifact>.md`, returns both paths.
- Consumes: `PrdDoc` etc. types from `./brief-schemas.js`.

- [ ] **Step 1: Write the failing test**

Append to `brief/lib/validation.selfcheck.ts`:

```ts
import { mkdtempSync, rmSync, readFileSync as rf, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pj } from "node:path";
import { getBriefPaths, readBriefDocs, writeBriefArtifact } from "./brief-lib.ts";

check("writeBriefArtifact writes json + md and readBriefDocs reads it back", () => {
  const dir = mkdtempSync(pj(tmpdir(), "brief-io-"));
  try {
    const paths = getBriefPaths(dir);
    assert.ok(paths.prdJson.endsWith("prd.json"));
    const out = writeBriefArtifact(dir, "prd", VALID_PRD, "# rendered");
    assert.ok(existsSync(out.json) && existsSync(out.md));
    assert.equal(rf(out.md, "utf8"), "# rendered");
    const back = readBriefDocs(dir);
    assert.equal(back.prd?.projectName, "Acme");
    assert.equal(back.userFlows, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: FAIL — `readBriefDocs`/`writeBriefArtifact` not exported; `paths.prdJson` undefined.

- [ ] **Step 3: Implement the additions in `brief/lib/brief-lib.ts`**

Add to the imports at the top:

```ts
import type {
  PrdDoc,
  UserFlowsDoc,
  TechNotesDoc,
  ClientQuestionsDoc,
} from "./brief-schemas.js";
```

Extend the `BriefPaths` interface (after `clientQuestions: string;`):

```ts
  prdJson: string;
  userFlowsJson: string;
  technicalNotesJson: string;
  clientQuestionsJson: string;
```

Extend the `getBriefPaths` return object (after `clientQuestions: join(root, "client-questions.md"),`):

```ts
    prdJson: join(root, "prd.json"),
    userFlowsJson: join(root, "user-flows.json"),
    technicalNotesJson: join(root, "technical-notes.json"),
    clientQuestionsJson: join(root, "client-questions.json"),
```

Append to the I/O section (end of file):

```ts
const JSON_PATH_KEY = {
  prd: "prdJson",
  userFlows: "userFlowsJson",
  technicalNotes: "technicalNotesJson",
  clientQuestions: "clientQuestionsJson",
} as const;

const MD_PATH_KEY = {
  prd: "prd",
  userFlows: "userFlows",
  technicalNotes: "technicalNotes",
  clientQuestions: "clientQuestions",
} as const;

export type BriefDocKind = keyof typeof JSON_PATH_KEY;

function readJsonIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function readBriefDocs(projectRoot: string): {
  prd?: PrdDoc;
  userFlows?: UserFlowsDoc;
  technicalNotes?: TechNotesDoc;
  clientQuestions?: ClientQuestionsDoc;
} {
  const p = getBriefPaths(projectRoot);
  return {
    prd: readJsonIfExists<PrdDoc>(p.prdJson),
    userFlows: readJsonIfExists<UserFlowsDoc>(p.userFlowsJson),
    technicalNotes: readJsonIfExists<TechNotesDoc>(p.technicalNotesJson),
    clientQuestions: readJsonIfExists<ClientQuestionsDoc>(p.clientQuestionsJson),
  };
}

export function writeBriefArtifact(
  projectRoot: string,
  kind: BriefDocKind,
  doc: unknown,
  rendered: string,
): { json: string; md: string } {
  ensureBriefDir(projectRoot);
  const paths = getBriefPaths(projectRoot);
  const jsonPath = paths[JSON_PATH_KEY[kind]];
  const mdPath = paths[MD_PATH_KEY[kind]];
  writeFileSync(jsonPath, JSON.stringify(doc, null, 2), "utf8");
  writeFileSync(mdPath, rendered, "utf8");
  return { json: jsonPath, md: mdPath };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types brief/lib/validation.selfcheck.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add brief/lib/brief-lib.ts brief/lib/validation.selfcheck.ts
git commit -m "feat: brief document json paths + read/write helpers"
```

---

## Task 6: Rewrite the four agent prompts to emit JSON

**Files:**
- Modify: `brief/agents/02-write-prd.md`, `brief/agents/03-write-user-flows.md`, `brief/agents/04-write-technical-notes.md`, `brief/agents/05-write-client-questions.md`

**Interfaces:**
- Produces: prompts whose output is a single JSON object matching the Task 2 schemas. No markdown structure templates remain in the prompts (that lives in the renderers now).

This task has no unit test (it's prompt content); it is verified by the Task 7 integration run. Each prompt must (a) state the exact JSON shape, (b) include the no-questions guard, (c) end requiring the response to start with `{`.

- [ ] **Step 1: Replace `brief/agents/02-write-prd.md` with:**

````markdown
# Write PRD (structured)

You receive a JSON context: `{ "context": {...}, "requirements": {...}, "existingPrd": <prior PrdDoc JSON or null> }`.

Do NOT ask questions. Do NOT ask for clarification. The input is already in this
message — process it immediately. Your response must START with `{` — no preamble,
no markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "projectName": "string",
  "mode": "create | refine | answer | brownfield",
  "overview": "2-3 sentence prose: what this product is, who it's for, the core problem",
  "projectState": { "phase": "string", "hasExistingCodebase": true, "briefSource": "string" },
  "actors": [{ "name": "string", "role": "string", "confidence": "stated | discussed | inferred | assumed" }],
  "modules": [{
    "name": "string",
    "status": "planned | exists | partial | broken",
    "description": "one sentence",
    "features": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }]
  }],
  "integrations": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }],
  "constraints": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }],
  "stakeholders": [{ "name": "string", "role": "string" }],
  "timeline": "string or null",
  "openQuestionsCount": 0
}
```

## Rules

- Never invent features not present in `requirements`.
- Do NOT recommend a tech stack — that belongs in technical-notes.
- `confidence` reflects how firmly the source supports the item: `stated` = explicit in input, `discussed` = mentioned, `inferred` = derived, `assumed` = your guess.
- At least one actor and one module (each module ≥1 feature).
- `openQuestionsCount` = number of items you would ask the client about.
- In refine/answer mode, base the document on `existingPrd` and fold in the new input; emit the FULL updated document (a code layer computes the changelog).
- Output ONLY the JSON object.
````

- [ ] **Step 2: Replace `brief/agents/03-write-user-flows.md` with:**

````markdown
# Write User Flows (structured)

You receive `{ "context": {...}, "requirements": {...}, "existingUserFlows": <prior UserFlowsDoc JSON or null> }`.

Do NOT ask questions. Do NOT ask for clarification. The input is already in this
message — process it immediately. Your response must START with `{` — no preamble,
no markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "flows": [{
    "id": "UF-001",
    "title": "string",
    "actor": "string",
    "trigger": "what starts the flow",
    "steps": ["step 1", "step 2"],
    "outcome": "end state",
    "confidence": "stated | discussed | inferred | assumed"
  }]
}
```

## Rules

- `id` MUST be `UF-` followed by three digits, sequential from `UF-001`.
- Each flow needs at least one step; steps are short imperative phrases.
- Derive flows from the modules/features in `requirements`; cover the primary actor journeys.
- In refine/answer mode, base on `existingUserFlows` and emit the FULL updated set.
- Output ONLY the JSON object.
````

- [ ] **Step 3: Replace `brief/agents/04-write-technical-notes.md` with:**

````markdown
# Write Technical Notes (structured)

You receive `{ "context": {...}, "requirements": {...}, "existingTechnicalNotes": <prior TechNotesDoc JSON or null> }`.

Do NOT ask questions. Do NOT ask for clarification. The input is already in this
message — process it immediately. Your response must START with `{` — no preamble,
no markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "stack": [{ "layer": "e.g. frontend / backend / db", "choice": "string", "rationale": "string" }],
  "architectureNotes": [{ "heading": "string", "body": "prose" }],
  "risks": [{ "text": "string", "severity": "low | medium | high" }],
  "openDecisions": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }]
}
```

## Rules

- Provide at least one `stack` entry OR one `architectureNotes` entry.
- Recommend a stack only where the requirements/codebase justify it; put the reason in `rationale`.
- `risks` and `openDecisions` may be empty arrays if none apply.
- In refine/answer mode, base on `existingTechnicalNotes` and emit the FULL updated document.
- Output ONLY the JSON object.
````

- [ ] **Step 4: Replace `brief/agents/05-write-client-questions.md` with:**

````markdown
# Write Client Questions (structured)

You receive `{ "context": {...}, "requirements": {...}, "existingClientQuestions": <prior ClientQuestionsDoc JSON or null>, "existingPrd": <string or null>, "existingTechnicalNotes": <string or null> }`.

Do NOT ask questions of the system. Do NOT ask for clarification. The input is
already in this message — process it immediately. Your response must START with
`{` — no preamble, no markdown fences, no explanation. (The `question` fields below
ARE the questions for the client — that is the deliverable.)

Output a single JSON object with EXACTLY this shape:

```json
{
  "questions": [{
    "id": "Q-001",
    "question": "the question to ask the client",
    "why": "why this matters / what it unblocks",
    "blocks": ["module or feature names this blocks"],
    "priority": "high | medium | low"
  }]
}
```

## Rules

- `id` MUST be `Q-` followed by three digits, sequential from `Q-001`.
- Derive questions from ambiguities and `assumed`/`inferred` items in the requirements.
- `questions` may be an empty array if nothing is unclear.
- In refine/answer mode, drop questions the new input has answered; keep the rest.
- Output ONLY the JSON object.
````

- [ ] **Step 5: Commit**

```bash
git add brief/agents/02-write-prd.md brief/agents/03-write-user-flows.md brief/agents/04-write-technical-notes.md brief/agents/05-write-client-questions.md
git commit -m "feat: brief agents emit structured JSON with no-questions guard"
```

---

## Task 7: Wire the workflow to validate + render + write

**Files:**
- Modify: `brief/workflow/brief.workflow.ts` (imports ~line 18-31; Phase 5 ~line 155-215)
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: `validatePrdDoc`/`validateUserFlowsDoc`/`validateTechNotesDoc`/`validateClientQuestionsDoc` + types (`brief-schemas`); `renderPrd`/`renderUserFlows`/`renderTechNotes`/`renderClientQuestions` (`brief-render`); `readBriefDocs`/`writeBriefArtifact` (`brief-lib`); `runAgentWithValidation` (`spec/lib/agent-wrapper`).

- [ ] **Step 1: Add the brief self-check to `package.json`**

Change the `test` script to:

```json
    "test": "node --experimental-strip-types plan/lib/validation.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types brief/lib/validation.selfcheck.ts"
```

- [ ] **Step 2: Run the full suite to confirm wiring**

Run: `npm test`
Expected: plan, registry, AND brief checks all PASS.

- [ ] **Step 3: Update workflow imports**

In `brief/workflow/brief.workflow.ts`, add after the existing `../lib/validation.js` import block:

```ts
import {
  validatePrdDoc,
  validateUserFlowsDoc,
  validateTechNotesDoc,
  validateClientQuestionsDoc,
  type PrdDoc,
  type UserFlowsDoc,
  type TechNotesDoc,
  type ClientQuestionsDoc,
} from "../lib/brief-schemas.js";
import {
  renderPrd,
  renderUserFlows,
  renderTechNotes,
  renderClientQuestions,
} from "../lib/brief-render.js";
import { runAgentWithValidation, type RepairContext } from "../../spec/lib/agent-wrapper.js";
```

Add `readBriefDocs, writeBriefArtifact` to the existing import from `../lib/brief-lib.js`.

Add the repair helper near the top (after `readAgent`):

```ts
function withRepair(prompt: string, repair?: RepairContext): string {
  if (!repair) return prompt;
  return `${prompt}\n\n## REPAIR REQUIRED\n\nYour previous output was rejected. Fix the issues and output ONLY corrected JSON.\n\nPrevious output:\n\`\`\`\n${repair.previousOutput.slice(0, 2000)}\n\`\`\`\n\nErrors:\n${repair.errors.map((e) => `- ${e}`).join("\n")}`;
}
```

- [ ] **Step 4: Replace Phase 5 (the `// Phase 5: Generate (parallel)` block through the `writeBriefArtifacts(projectRoot, after);` call and the four `log(\`✓ ${paths...}\`)` lines)**

```ts
// Phase 5: Generate (each artifact: validated JSON → render → write json+md)
phase("Generate");
const prevDocs = readBriefDocs(projectRoot);

async function generateDoc<T>(
  file: string,
  validator: (o: unknown) => import("../../spec/lib/validation.js").ValidationResult<T>,
  contextObj: unknown,
  label: string,
): Promise<T> {
  const prompt = readAgent(file);
  const res = await runAgentWithValidation<T>(
    (repair) =>
      agent(
        `${withRepair(prompt, repair)}\n\nContext:\n${JSON.stringify(contextObj, null, 2)}`,
        { label, phase: "Generate" },
      ),
    validator,
    { maxRetries: 3, timeoutMs: 90000 },
  );
  return res.result;
}

const [prdDoc, flowsDoc, techDoc, questionsDoc] = await Promise.all([
  generateDoc<PrdDoc>("02-write-prd.md", validatePrdDoc,
    { context, requirements, existingPrd: prevDocs.prd ?? null }, "write-prd"),
  generateDoc<UserFlowsDoc>("03-write-user-flows.md", validateUserFlowsDoc,
    { context, requirements, existingUserFlows: prevDocs.userFlows ?? null }, "write-user-flows"),
  generateDoc<TechNotesDoc>("04-write-technical-notes.md", validateTechNotesDoc,
    { context, requirements, existingTechnicalNotes: prevDocs.technicalNotes ?? null }, "write-technical-notes"),
  generateDoc<ClientQuestionsDoc>("05-write-client-questions.md", validateClientQuestionsDoc,
    { context, requirements, existingClientQuestions: prevDocs.clientQuestions ?? null,
      existingPrd: existingArtifacts.prd ?? null, existingTechnicalNotes: existingArtifacts.technicalNotes ?? null },
    "write-client-questions"),
]);

const w1 = writeBriefArtifact(projectRoot, "prd", prdDoc, renderPrd(prdDoc, prevDocs.prd));
const w2 = writeBriefArtifact(projectRoot, "userFlows", flowsDoc, renderUserFlows(flowsDoc, prevDocs.userFlows));
const w3 = writeBriefArtifact(projectRoot, "technicalNotes", techDoc, renderTechNotes(techDoc, prevDocs.technicalNotes));
const w4 = writeBriefArtifact(projectRoot, "clientQuestions", questionsDoc, renderClientQuestions(questionsDoc, prevDocs.clientQuestions));

const after = {
  prd: renderPrd(prdDoc, prevDocs.prd),
  userFlows: renderUserFlows(flowsDoc, prevDocs.userFlows),
  technicalNotes: renderTechNotes(techDoc, prevDocs.technicalNotes),
  clientQuestions: renderClientQuestions(questionsDoc, prevDocs.clientQuestions),
};

[w1, w2, w3, w4].forEach((w) => { log(`✓ ${w.json}`); log(`✓ ${w.md}`); });
```

(The post-generation `validateBriefArtifacts` / `validateBriefForPlanning` blocks below still operate on the `after` strings and need no change. The Reconcile phase still receives `before`/`after` strings and is unchanged.)

- [ ] **Step 5: Type-check the workflow compiles**

Run: `node --experimental-strip-types --check brief/workflow/brief.workflow.ts`
Expected: no syntax/strip errors. (Note: `agent`, `parallel`, `phase`, `log`, `args` are pi-runtime globals injected at execution — `--check` validates syntax only.)

- [ ] **Step 6: Integration verification — run `/order` twice**

In a scratch project with a sample brief input, run the brief workflow once, copy the four `.md` files, run it again with the *same* input, and diff.

Run (manual, in a throwaway dir): trigger `/order "<same short idea>"` twice.
Expected:
- Four `.md` + four `.json` files exist in `docs/sandwich/`.
- Second run's `.md` files are **format-identical** to the first (only `Generated: <date>` and genuine content changes differ — structure, headings, marker formatting are stable).
- `prd.json` etc. are valid JSON matching the schemas.

- [ ] **Step 7: Commit**

```bash
git add brief/workflow/brief.workflow.ts package.json
git commit -m "feat: brief workflow validates JSON and renders deterministically"
```

---

## Self-Review

**Spec coverage (design §A):**
- §A.1 per-artifact pipeline → Task 7 (workflow) ✓
- §A.2 schemas + typed confidence → Task 2 ✓
- §A.3 renderers (templates moved out of prompts) → Task 3 + Task 6 ✓
- §A.4 changelog → Task 3 (`diffBriefDoc`/`renderChangelog`) + Task 4 (tests) + Task 7 (wired via `prev`) ✓
- §A.5 lenient parse → Task 1 ✓; no-questions guard → Task 6 ✓
- Out-of-scope items (discover, extract, reconcile) untouched ✓
- Effort B (path relocation) intentionally excluded — paths stay flat ✓

**Type consistency:** validators return `ValidationResult<T>` (spec) everywhere; renderer signatures `render*(doc, prev?)` match Task 7 call sites; `writeBriefArtifact(kind, doc, rendered)` and `readBriefDocs()` keys (`prd`/`userFlows`/`technicalNotes`/`clientQuestions`) match between Task 5 and Task 7; `BriefDocKind` union matches the `*Json` path keys.

**Placeholder scan:** no TBD/TODO; all code blocks complete; all commands have expected output.

**Note for executor:** `validateBriefArtifacts`/`validateBriefForPlanning` in `brief/lib/validation.ts` still take the rendered markdown strings and are reused as-is; do not delete them. They now receive deterministic markdown, so their length/marker heuristics still hold.
