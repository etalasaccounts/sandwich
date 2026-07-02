# Per-Feature Spec Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After `/prep`, every active feature gets `docs/sandwich/specs/F-XXX.json` (LLM-written, zod-validated) + `F-XXX.md` (deterministically rendered, with an acceptance-criteria checklist), guarded by an end-of-run completeness check that fails loudly.

**Architecture:** Extends the proven "LLM writes JSON → code validates/renders/verifies" pattern (`prep/scripts/render.ts`). Pure logic in `prep/lib/` (unit-tested via selfchecks), thin I/O scripts in `prep/scripts/` (invoked by the LLM per SKILL.md instructions — this is the only execution mechanism that actually runs in both Pi and Claude Code; the `*.workflow.ts` files are dead code in both runtimes).

**Tech Stack:** TypeScript run via `node --experimental-strip-types` (no build step), ESM (`"type": "module"`), zod ^3.25 (already a dependency). No new dependencies.

**Design doc:** `docs/superpowers/specs/2026-07-02-per-feature-specs-design.md`

## Global Constraints

- No new npm dependencies.
- Imports between local `.ts` files use the explicit `.ts` extension (matches `prep/scripts/render.ts`, selfchecks, `registry/registry-io.ts`).
- Selfchecks follow the existing no-framework pattern: `strict as assert`, a local `check(name, fn)` counter, exit non-zero on first failure (see `prep/lib/validation.selfcheck.ts`).
- Code and comments in English; the rendered spec `.md` hand-off section is in Bahasa Indonesia (approved copy is given verbatim in Task 2).
- Spec `.md` files are projections: overwritten on every render, never read back as state. Source of truth is the `.json`.
- Priority is NEVER stored in spec JSON — always joined from the registry via `effectivePriority`.
- Working branch: `feat/per-feature-specs` (already created; design doc committed on it).

---

### Task 1: Spec schema (`prep/lib/spec-schema.ts`)

**Files:**
- Create: `prep/lib/spec-schema.ts`
- Create: `prep/lib/spec.selfcheck.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Consumes: nothing (leaf module; zod only).
- Produces: `FeatureSpecSchema` (zod schema), `type FeatureSpec`, `validateFeatureSpec(o: unknown): { valid: boolean; data?: FeatureSpec; errors: string[] }`. Later tasks import all three from `prep/lib/spec-schema.ts`.

- [ ] **Step 1: Write the failing selfcheck**

Create `prep/lib/spec.selfcheck.ts`:

```ts
// Self-check for per-feature specs: schema, renderer, completeness audit.
// Run: node --experimental-strip-types prep/lib/spec.selfcheck.ts
// No framework: plain asserts. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { validateFeatureSpec, type FeatureSpec } from "./spec-schema.ts";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

export const validSpec = (): FeatureSpec => ({
  featureId: "F-001",
  title: "OTP Verification Flow",
  module: "auth",
  description: "Email verification dengan OTP (valid 15 menit) saat registrasi",
  scope: {
    inScope: ["Kirim OTP via email saat registrasi", "Validasi OTP 15 menit"],
    outOfScope: ["OTP via SMS"],
  },
  acceptanceCriteria: [
    { id: "AC1", text: "User menerima email OTP dalam 60 detik", done: false },
    { id: "AC2", text: "OTP ditolak setelah 15 menit", done: true },
  ],
  dependsOn: [],
  source: { file: "prd.md", lines: "31-33" },
});

// --- schema ---
check("schema accepts a well-formed spec", () => {
  const r = validateFeatureSpec(validSpec());
  assert.equal(r.valid, true);
  assert.equal(r.data?.featureId, "F-001");
});
check("schema rejects malformed featureId", () => {
  const r = validateFeatureSpec({ ...validSpec(), featureId: "F-1" });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("featureId")));
});
check("schema rejects empty acceptanceCriteria", () => {
  const r = validateFeatureSpec({ ...validSpec(), acceptanceCriteria: [] });
  assert.equal(r.valid, false);
});
check("schema rejects malformed AC id", () => {
  const bad = validSpec();
  bad.acceptanceCriteria[0].id = "criteria-1";
  assert.equal(validateFeatureSpec(bad).valid, false);
});
check("schema defaults done to false", () => {
  const raw = validSpec() as unknown as Record<string, unknown>;
  (raw.acceptanceCriteria as Array<Record<string, unknown>>).forEach((ac) => delete ac.done);
  const r = validateFeatureSpec(raw);
  assert.equal(r.valid, true);
  assert.equal(r.data?.acceptanceCriteria[0].done, false);
});
check("schema rejects empty inScope", () => {
  const bad = validSpec();
  bad.scope.inScope = [];
  assert.equal(validateFeatureSpec(bad).valid, false);
});
check("schema allows empty outOfScope and missing source.lines", () => {
  const ok = validSpec();
  ok.scope.outOfScope = [];
  delete (ok.source as { lines?: string }).lines;
  assert.equal(validateFeatureSpec(ok).valid, true);
});

console.log(`\n${n} checks passed.`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: FAIL — `Cannot find module '.../prep/lib/spec-schema.ts'`

- [ ] **Step 3: Implement the schema**

Create `prep/lib/spec-schema.ts`:

```ts
// Per-feature spec schema. The LLM writes docs/sandwich/specs/F-XXX.json to
// this shape during /prep; render-specs.ts validates and renders the .md
// projection. Content only — priority/lifecycle live in the registry.
import { z } from "zod";

export const AcceptanceCriterionSchema = z.object({
  id: z.string().regex(/^AC\d+$/, "must look like AC1, AC2, ..."),
  text: z.string().min(1),
  done: z.boolean().default(false),
});

export const FeatureSpecSchema = z.object({
  featureId: z.string().regex(/^F-\d{3}$/, "must look like F-001"),
  title: z.string().min(1),
  module: z.string().min(1),
  description: z.string().min(1),
  scope: z.object({
    inScope: z.array(z.string().min(1)).min(1),
    outOfScope: z.array(z.string().min(1)),
  }),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  dependsOn: z.array(z.string()),
  source: z.object({
    file: z.string().min(1),
    lines: z.string().optional(),
  }),
});

export type FeatureSpec = z.infer<typeof FeatureSpecSchema>;

export function validateFeatureSpec(o: unknown): {
  valid: boolean;
  data?: FeatureSpec;
  errors: string[];
} {
  const r = FeatureSpecSchema.safeParse(o);
  if (r.success) return { valid: true, data: r.data, errors: [] };
  return {
    valid: false,
    errors: r.error.errors.map(
      (e) => `${e.path.join(".") || "(root)"}: ${e.message}`
    ),
  };
}
```

- [ ] **Step 4: Run the selfcheck to verify it passes**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: 7 `✓` lines, then `7 checks passed.`

- [ ] **Step 5: Wire into package.json test script**

In `package.json`, change the `test` script from:

```json
"test": "node --experimental-strip-types prep/lib/validation.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types order/lib/validation.selfcheck.ts"
```

to:

```json
"test": "node --experimental-strip-types prep/lib/validation.selfcheck.ts && node --experimental-strip-types prep/lib/spec.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types order/lib/validation.selfcheck.ts"
```

Run: `npm test`
Expected: all four selfchecks pass.

- [ ] **Step 6: Commit**

```bash
git add prep/lib/spec-schema.ts prep/lib/spec.selfcheck.ts package.json
git commit -m "feat: zod schema for per-feature specs"
```

---

### Task 2: Deterministic spec renderer (`prep/lib/spec-render.ts`)

**Files:**
- Create: `prep/lib/spec-render.ts`
- Modify: `prep/lib/spec.selfcheck.ts` (append checks)

**Interfaces:**
- Consumes: `FeatureSpec` from `prep/lib/spec-schema.ts` (Task 1).
- Produces: `renderSpecMd(spec: FeatureSpec, priority: number): string`. Task 4's script imports it.

- [ ] **Step 1: Append failing checks to the selfcheck**

Append to `prep/lib/spec.selfcheck.ts`, before the final `console.log`:

```ts
// --- renderer ---
import { renderSpecMd } from "./spec-render.ts";

check("renderSpecMd renders header, scope, checklist, and hand-off", () => {
  const md = renderSpecMd(validSpec(), 27);
  assert.ok(md.startsWith("# F-001: OTP Verification Flow\n"));
  assert.ok(md.includes("**Module:** auth · **Priority:** 27/100 · **Depends on:** — · **Source:** prd.md:31-33"));
  assert.ok(md.includes("- [ ] **AC1** — User menerima email OTP dalam 60 detik"));
  assert.ok(md.includes("- [x] **AC2** — OTP ditolak setelah 15 menit"));
  assert.ok(md.includes("**In:**\n- Kirim OTP via email saat registrasi"));
  assert.ok(md.includes("**Out:**\n- OTP via SMS"));
  assert.ok(md.includes("superpowers:brainstorming"));
  assert.ok(md.includes("edit `F-001.json`, bukan file ini"));
});
check("renderSpecMd joins dependsOn and handles empty outOfScope", () => {
  const s = validSpec();
  s.dependsOn = ["F-002", "F-003"];
  s.scope.outOfScope = [];
  const md = renderSpecMd(s, 14);
  assert.ok(md.includes("**Depends on:** F-002, F-003"));
  assert.ok(md.includes("**Out:**\n- —"));
});
check("renderSpecMd omits :lines when source.lines missing", () => {
  const s = validSpec();
  delete (s.source as { lines?: string }).lines;
  const md = renderSpecMd(s, 5);
  assert.ok(md.includes("**Source:** prd.md\n") || md.includes("**Source:** prd.md*"), "no dangling colon");
  assert.ok(!md.includes("prd.md:undefined"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: FAIL — `Cannot find module '.../prep/lib/spec-render.ts'`

- [ ] **Step 3: Implement the renderer**

Create `prep/lib/spec-render.ts`:

```ts
// Deterministic markdown projection of a FeatureSpec. Pure: same input,
// same output — the .md is regenerated on every render and never read back.
import type { FeatureSpec } from "./spec-schema.ts";

export function renderSpecMd(spec: FeatureSpec, priority: number): string {
  const dep = spec.dependsOn.length ? spec.dependsOn.join(", ") : "—";
  const src = spec.source.lines
    ? `${spec.source.file}:${spec.source.lines}`
    : spec.source.file;
  const outScope = spec.scope.outOfScope.length
    ? spec.scope.outOfScope.map((s) => `- ${s}`)
    : ["- —"];

  const lines: string[] = [
    `# ${spec.featureId}: ${spec.title}`,
    "",
    `> **Module:** ${spec.module} · **Priority:** ${priority}/100 · **Depends on:** ${dep} · **Source:** ${src}`,
    "",
    spec.description,
    "",
    "## Scope",
    "",
    "**In:**",
    ...spec.scope.inScope.map((s) => `- ${s}`),
    "",
    "**Out:**",
    ...outScope,
    "",
    "## Acceptance Criteria",
    "",
    ...spec.acceptanceCriteria.map(
      (ac) => `- [${ac.done ? "x" : " "}] **${ac.id}** — ${ac.text}`
    ),
    "",
    "---",
    "",
    "## Mulai kerja",
    "",
    "1. Jalankan `superpowers:brainstorming` dengan file ini sebagai starting point —",
    "   scope & AC di atas adalah requirement; task breakdown dan pilihan teknis",
    "   diputuskan di sesi brainstorming (dengan akses codebase).",
    "2. Setelah implementasi, centang tiap AC yang sudah terbukti jalan",
    `   (update \`done\` di \`${spec.featureId}.json\`, lalu jalankan ulang render-specs).`,
    "",
    `_Generated by /prep — edit \`${spec.featureId}.json\`, bukan file ini (akan di-overwrite)._`,
    "",
  ];
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: 10 `✓` lines, `10 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add prep/lib/spec-render.ts prep/lib/spec.selfcheck.ts
git commit -m "feat: deterministic renderer for per-feature spec markdown"
```

---

### Task 3: Completeness audit logic (`prep/lib/completeness.ts`)

**Files:**
- Create: `prep/lib/completeness.ts`
- Modify: `prep/lib/spec.selfcheck.ts` (append checks)

**Interfaces:**
- Consumes: `Feature`, `Decision`, `JournalEvent`, `effectiveLifecycle` from `registry/registry-lib.ts` (existing exports).
- Produces:
  ```ts
  interface SpecPresence { jsonValid: boolean; errors: string[]; mdExists: boolean }
  interface CompletenessInput {
    projectExists: boolean;
    features: Feature[] | null;      // null = features.json missing/unreadable
    questionsExists: boolean;
    decisions: Decision[];           // [] when decisions.json absent
    journal: JournalEvent[];
    specs: Map<string, SpecPresence>; // keyed by feature id parsed from filename
    featureQueueExists: boolean;
  }
  function auditCompleteness(input: CompletenessInput): string[]  // [] = complete
  function decisionTargetsMissing(journal: JournalEvent[], decisions: Decision[]): string[]
  function featuresMissingSpecs(features: Feature[], specs: Map<string, SpecPresence>): string[]
  ```
  Tasks 5 and 7 import these from `prep/lib/completeness.ts`.

- [ ] **Step 1: Append failing checks to the selfcheck**

Append to `prep/lib/spec.selfcheck.ts` before the final `console.log`:

```ts
// --- completeness audit ---
import {
  auditCompleteness,
  decisionTargetsMissing,
  featuresMissingSpecs,
  type CompletenessInput,
} from "./completeness.ts";
import type { Feature, Decision, JournalEvent } from "../../registry/registry-lib.ts";

const feature = (id: string, lifecycle: Feature["lifecycle"] = "proposed"): Feature => ({
  id,
  fingerprint: `${id.toLowerCase()}-fp`,
  title: `Feature ${id}`,
  description: "",
  type: "feature",
  module: "core",
  confidence: "stated",
  lifecycle,
  flags: { needsReanalysis: false, stale: false, orphaned: false },
  provenance: { file: "prd.md", briefHash: "abc" },
  dependsOn: [],
  blocks: [],
  blockedBy: [],
  overrides: {},
  commits: [],
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
} as unknown as Feature);

const completeInput = (): CompletenessInput => ({
  projectExists: true,
  features: [feature("F-001"), feature("F-002", "done")],
  questionsExists: true,
  decisions: [],
  journal: [],
  specs: new Map([["F-001", { jsonValid: true, errors: [], mdExists: true }]]),
  featureQueueExists: true,
});

check("audit passes on a complete project", () => {
  assert.deepEqual(auditCompleteness(completeInput()), []);
});
check("audit flags missing registry files", () => {
  const errs = auditCompleteness({ ...completeInput(), projectExists: false, questionsExists: false, features: null });
  assert.ok(errs.some((e) => e.includes("project.json")));
  assert.ok(errs.some((e) => e.includes("features.json")));
  assert.ok(errs.some((e) => e.includes("questions.json")));
});
check("audit flags active feature without spec, ignores done/rejected", () => {
  const input = completeInput();
  input.specs = new Map();
  const errs = auditCompleteness(input);
  assert.ok(errs.some((e) => e.includes("F-001") && e.includes("spec")));
  assert.ok(!errs.some((e) => e.includes("F-002")), "done feature needs no spec");
});
check("audit flags invalid spec json and missing md separately", () => {
  const input = completeInput();
  input.specs = new Map([["F-001", { jsonValid: false, errors: ["title: Required"], mdExists: false }]]);
  const errs = auditCompleteness(input);
  assert.ok(errs.some((e) => e.includes("F-001.json") && e.includes("title: Required")));
  assert.ok(errs.some((e) => e.includes("F-001.md")));
});
check("audit flags orphan spec with no matching feature", () => {
  const input = completeInput();
  input.specs.set("F-099", { jsonValid: true, errors: [], mdExists: true });
  const errs = auditCompleteness(input);
  assert.ok(errs.some((e) => e.includes("F-099") && e.toLowerCase().includes("orphan")));
});
check("audit matches journal decisions to decisions.json numerically (D1 vs D-001)", () => {
  const journal: JournalEvent[] = [
    { ts: "2026-07-02T00:00:00.000Z", actor: "system", type: "decision-recorded", target: "D1", summary: "x" } as JournalEvent,
    { ts: "2026-07-02T00:00:00.000Z", actor: "system", type: "decision-recorded", target: "D2", summary: "y" } as JournalEvent,
  ];
  const decisions: Decision[] = [
    { id: "D-001", title: "t", status: "accepted", context: "c", decision: "d", at: "2026-07-02" } as Decision,
  ];
  assert.deepEqual(decisionTargetsMissing(journal, decisions), ["D2"]);
  const input = { ...completeInput(), journal, decisions };
  assert.ok(auditCompleteness(input).some((e) => e.includes("D2") && e.includes("decisions.json")));
});
check("audit flags missing feature-queue.md", () => {
  const errs = auditCompleteness({ ...completeInput(), featureQueueExists: false });
  assert.ok(errs.some((e) => e.includes("feature-queue.md")));
});
check("featuresMissingSpecs lists active features lacking a valid spec", () => {
  const specs = new Map([["F-001", { jsonValid: false, errors: ["x"], mdExists: true }]]);
  assert.deepEqual(featuresMissingSpecs([feature("F-001"), feature("F-002", "done")], specs), ["F-001"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: FAIL — `Cannot find module '.../prep/lib/completeness.ts'`

- [ ] **Step 3: Implement the audit**

Create `prep/lib/completeness.ts`:

```ts
// End-of-/prep completeness audit. Pure: the script gathers filesystem facts
// into CompletenessInput; this module only judges them. Closes the failure
// mode where the LLM silently skips writing an artifact (journal said a
// decision was recorded, decisions.json never got it) — every gap becomes a
// loud, actionable error the LLM must fix before /prep counts as done.
import {
  effectiveLifecycle,
  type Feature,
  type Decision,
  type JournalEvent,
} from "../../registry/registry-lib.ts";

export interface SpecPresence {
  jsonValid: boolean;
  errors: string[];
  mdExists: boolean;
}

export interface CompletenessInput {
  projectExists: boolean;
  features: Feature[] | null;
  questionsExists: boolean;
  decisions: Decision[];
  journal: JournalEvent[];
  specs: Map<string, SpecPresence>;
  featureQueueExists: boolean;
}

const numericId = (id: string): string => {
  const m = id.match(/(\d+)/);
  return m ? String(parseInt(m[1], 10)) : id;
};

const isActive = (f: Feature): boolean =>
  !["done", "rejected"].includes(effectiveLifecycle(f));

/** Journal decision-recorded targets with no matching decisions.json entry.
 *  Matching is numeric (journal often says "D1", schema ids are "D-001"). */
export function decisionTargetsMissing(
  journal: JournalEvent[],
  decisions: Decision[]
): string[] {
  const have = new Set(decisions.map((d) => numericId(d.id)));
  const missing: string[] = [];
  for (const e of journal) {
    if (e.type !== "decision-recorded" || !e.target) continue;
    if (!have.has(numericId(e.target)) && !missing.includes(e.target)) {
      missing.push(e.target);
    }
  }
  return missing;
}

/** Active features that lack a valid spec json (missing entry or invalid). */
export function featuresMissingSpecs(
  features: Feature[],
  specs: Map<string, SpecPresence>
): string[] {
  return features
    .filter(isActive)
    .filter((f) => !(specs.get(f.id)?.jsonValid))
    .map((f) => f.id);
}

export function auditCompleteness(input: CompletenessInput): string[] {
  const errors: string[] = [];

  if (!input.projectExists)
    errors.push(".sandwich/registry/project.json is missing — /prep must write it");
  if (input.features === null)
    errors.push(".sandwich/registry/features.json is missing or unreadable — /prep must write it");
  if (!input.questionsExists)
    errors.push(".sandwich/registry/questions.json is missing — /prep must write it (empty array is fine)");

  for (const target of decisionTargetsMissing(input.journal, input.decisions)) {
    errors.push(
      `journal.jsonl records decision ${target} but decisions.json has no matching entry — write the decision to .sandwich/registry/decisions.json`
    );
  }

  const features = input.features ?? [];
  for (const f of features.filter(isActive)) {
    const s = input.specs.get(f.id);
    if (!s) {
      errors.push(
        `${f.id} has no spec — write docs/sandwich/specs/${f.id}.json and re-run render-specs`
      );
      continue;
    }
    if (!s.jsonValid) {
      errors.push(
        `docs/sandwich/specs/${f.id}.json is invalid: ${s.errors.join("; ")}`
      );
    }
    if (!s.mdExists) {
      errors.push(
        `docs/sandwich/specs/${f.id}.md is missing — run render-specs`
      );
    }
  }

  const known = new Set(features.map((f) => f.id));
  for (const id of input.specs.keys()) {
    if (!known.has(id)) {
      errors.push(
        `docs/sandwich/specs/${id}.json is an orphan spec — no feature ${id} in the registry (remove it or fix the featureId)`
      );
    }
  }

  if (!input.featureQueueExists)
    errors.push("docs/sandwich/feature-queue.md is missing — run the feature-queue renderer");

  return errors;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: 18 `✓` lines, `18 checks passed.`

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: all four selfchecks pass.

```bash
git add prep/lib/completeness.ts prep/lib/spec.selfcheck.ts
git commit -m "feat: pure completeness audit for /prep artifacts"
```

---

### Task 4: `prep/scripts/render-specs.ts` (thin I/O)

**Files:**
- Create: `prep/scripts/render-specs.ts`

**Interfaces:**
- Consumes: `validateFeatureSpec` (Task 1), `renderSpecMd` (Task 2), `readFeatures`, `getRegistryPaths` from `registry/registry-io.ts`, `effectivePriority` from `registry/registry-lib.ts`, `getPrepPaths` from `prep/lib/prep-lib.ts` (`.specsDir` = `docs/sandwich/specs`).
- Produces: CLI contract used by SKILL.md — `node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/render-specs.ts [project-root]`; exit 0 with one `✓ <path>.md` line per spec, exit 1 printing every error.

- [ ] **Step 1: Implement the script**

Create `prep/scripts/render-specs.ts`:

```ts
#!/usr/bin/env node
// Deterministic renderer for per-feature specs.
// Usage: node --experimental-strip-types prep/scripts/render-specs.ts [project-root]
//
// Reads docs/sandwich/specs/*.json, validates each against FeatureSpecSchema,
// joins the registry for priority, renders docs/sandwich/specs/F-XXX.md.
// Exit 0 on success (one ✓ line per file), exit 1 listing ALL errors.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { validateFeatureSpec } from "../lib/spec-schema.ts";
import { renderSpecMd } from "../lib/spec-render.ts";
import { getPrepPaths } from "../lib/prep-lib.ts";
import { readFeatures } from "../../registry/registry-io.ts";
import { effectivePriority } from "../../registry/registry-lib.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const specsDir = getPrepPaths(projectRoot).specsDir;

if (!existsSync(specsDir)) {
  console.error(
    `✗ ${specsDir} not found — write the spec JSON files first (docs/sandwich/specs/F-XXX.json), then run this script.`
  );
  process.exit(1);
}

const features = readFeatures(projectRoot);
const priorityById = new Map(features.map((f) => [f.id, effectivePriority(f)]));

const jsonFiles = readdirSync(specsDir).filter((f) => f.endsWith(".json"));
if (jsonFiles.length === 0) {
  console.error(`✗ no spec JSON files in ${specsDir} — write docs/sandwich/specs/F-XXX.json first.`);
  process.exit(1);
}

const errors: string[] = [];
const written: string[] = [];

for (const file of jsonFiles.sort()) {
  const path = join(specsDir, file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    errors.push(`${file}: not valid JSON`);
    continue;
  }
  const r = validateFeatureSpec(parsed);
  if (!r.valid) {
    errors.push(...r.errors.map((e) => `${file}: ${e}`));
    continue;
  }
  const spec = r.data!;
  const expectedFile = `${spec.featureId}.json`;
  if (basename(file) !== expectedFile) {
    errors.push(`${file}: featureId is ${spec.featureId} — rename the file to ${expectedFile}`);
    continue;
  }
  if (!priorityById.has(spec.featureId)) {
    errors.push(`${file}: no feature ${spec.featureId} in the registry — fix the featureId or remove the file`);
    continue;
  }
  const mdPath = join(specsDir, `${spec.featureId}.md`);
  writeFileSync(mdPath, renderSpecMd(spec, priorityById.get(spec.featureId)!), "utf8");
  written.push(mdPath);
}

if (errors.length) {
  console.error(`✗ render-specs failed:`);
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}
written.forEach((p) => console.log(`✓ ${p}`));
```

- [ ] **Step 2: Verify against a scratch fixture**

```bash
FIX=$(mktemp -d)
mkdir -p "$FIX/docs/sandwich/specs" "$FIX/.sandwich/registry"
cat > "$FIX/.sandwich/registry/features.json" <<'EOF'
[{
  "id": "F-001", "fingerprint": "otp-auth", "title": "OTP Verification Flow",
  "description": "", "type": "feature", "module": "auth", "confidence": "stated",
  "lifecycle": "proposed",
  "flags": { "needsReanalysis": false, "stale": false, "orphaned": false },
  "provenance": { "file": "prd.md", "briefHash": "abc" },
  "dependsOn": [], "blocks": [], "blockedBy": [], "overrides": {},
  "score": { "impact": {"score": 9, "factors": ["core"]}, "effort": {"score": 3, "factors": ["std"]},
             "risk": {"score": 2, "factors": ["low"]}, "urgency": {"factor": 1.5, "reason": "blocks"},
             "priority": 27, "formulaVersion": 1 },
  "commits": [],
  "createdAt": "2026-07-02T00:00:00.000Z", "updatedAt": "2026-07-02T00:00:00.000Z"
}]
EOF
cat > "$FIX/docs/sandwich/specs/F-001.json" <<'EOF'
{
  "featureId": "F-001", "title": "OTP Verification Flow", "module": "auth",
  "description": "Email verification dengan OTP saat registrasi",
  "scope": { "inScope": ["Kirim OTP via email"], "outOfScope": [] },
  "acceptanceCriteria": [{ "id": "AC1", "text": "OTP ditolak setelah 15 menit", "done": false }],
  "dependsOn": [], "source": { "file": "prd.md", "lines": "31-33" }
}
EOF
node --experimental-strip-types prep/scripts/render-specs.ts "$FIX"
cat "$FIX/docs/sandwich/specs/F-001.md"
```

Expected: `✓ .../specs/F-001.md`, and the cat shows `# F-001: OTP Verification Flow`, `**Priority:** 27/100`, `- [ ] **AC1** — OTP ditolak setelah 15 menit`, and the `## Mulai kerja` footer.

Then verify the failure path:

```bash
echo '{ "featureId": "F-999" }' > "$FIX/docs/sandwich/specs/F-002.json"
node --experimental-strip-types prep/scripts/render-specs.ts "$FIX"; echo "exit=$?"
```

Expected: `✗ render-specs failed:` with `F-002.json: title: Required` (among others), `exit=1`. Keep `$FIX` for Task 5.

- [ ] **Step 3: Commit**

```bash
git add prep/scripts/render-specs.ts
git commit -m "feat: render-specs script — validated spec JSON to markdown"
```

---

### Task 5: `prep/scripts/verify-complete.ts` (thin I/O)

**Files:**
- Create: `prep/scripts/verify-complete.ts`

**Interfaces:**
- Consumes: `auditCompleteness`, `CompletenessInput`, `SpecPresence` (Task 3), `validateFeatureSpec` (Task 1), `getRegistryPaths`, `readFeatures`, `readDecisions`, `readJournal` from `registry/registry-io.ts`, `getPrepPaths` from `prep/lib/prep-lib.ts`.
- Produces: CLI contract used by SKILL.md — `node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/verify-complete.ts [project-root]`; exit 0 printing `✓ /prep output is complete`, exit 1 listing every gap.

- [ ] **Step 1: Implement the script**

Create `prep/scripts/verify-complete.ts`:

```ts
#!/usr/bin/env node
// Completeness gate for /prep. Run after registry writes + renderers.
// Usage: node --experimental-strip-types prep/scripts/verify-complete.ts [project-root]
//
// Gathers filesystem facts and judges them with auditCompleteness().
// Exit 0 when every expected artifact exists and validates; exit 1 with a
// precise, actionable list otherwise. The /prep skill must re-run until clean.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  auditCompleteness,
  type CompletenessInput,
  type SpecPresence,
} from "../lib/completeness.ts";
import { validateFeatureSpec } from "../lib/spec-schema.ts";
import { getPrepPaths } from "../lib/prep-lib.ts";
import {
  getRegistryPaths,
  readFeatures,
  readDecisions,
  readJournal,
} from "../../registry/registry-io.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const reg = getRegistryPaths(projectRoot);
const prep = getPrepPaths(projectRoot);

const specs = new Map<string, SpecPresence>();
if (existsSync(prep.specsDir)) {
  for (const file of readdirSync(prep.specsDir).filter((f) => f.endsWith(".json"))) {
    const id = file.replace(/\.json$/, "");
    let jsonValid = false;
    let errors: string[] = [];
    try {
      const r = validateFeatureSpec(JSON.parse(readFileSync(join(prep.specsDir, file), "utf8")));
      jsonValid = r.valid;
      errors = r.errors;
    } catch {
      errors = ["not valid JSON"];
    }
    specs.set(id, {
      jsonValid,
      errors,
      mdExists: existsSync(join(prep.specsDir, `${id}.md`)),
    });
  }
}

const input: CompletenessInput = {
  projectExists: existsSync(reg.project),
  features: existsSync(reg.features) ? readFeatures(projectRoot) : null,
  questionsExists: existsSync(reg.questions),
  decisions: readDecisions(projectRoot),
  journal: readJournal(projectRoot),
  specs,
  featureQueueExists: existsSync(prep.featureQueue),
};

const errors = auditCompleteness(input);
if (errors.length) {
  console.error(`✗ /prep output is incomplete (${errors.length} issue${errors.length > 1 ? "s" : ""}):`);
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}
console.log("✓ /prep output is complete");
```

- [ ] **Step 2: Verify against the Task 4 fixture**

Continuing with `$FIX` from Task 4 (remove the bad file, add the remaining artifacts):

```bash
rm "$FIX/docs/sandwich/specs/F-002.json"
node --experimental-strip-types prep/scripts/verify-complete.ts "$FIX"; echo "exit=$?"
```

Expected: exit=1, flagging missing `project.json`, `questions.json`, `feature-queue.md` (features.json and the F-001 spec pair exist).

```bash
cat > "$FIX/.sandwich/registry/project.json" <<'EOF'
{ "schemaVersion": 1, "name": "Fixture",
  "briefHashes": { "prd": null, "userFlows": null, "technicalNotes": null, "clientQuestions": null },
  "gates": { "briefApproved": { "passed": false }, "queueApproved": { "passed": false } },
  "createdAt": "2026-07-02T00:00:00.000Z", "updatedAt": "2026-07-02T00:00:00.000Z" }
EOF
echo '[]' > "$FIX/.sandwich/registry/questions.json"
touch "$FIX/docs/sandwich/feature-queue.md"
node --experimental-strip-types prep/scripts/verify-complete.ts "$FIX"; echo "exit=$?"
```

Expected: `✓ /prep output is complete`, exit=0.

Then the aresphi-class bug specifically:

```bash
echo '{"ts":"2026-07-02T00:00:00.000Z","actor":"system","type":"decision-recorded","target":"D1","summary":"x"}' > "$FIX/.sandwich/registry/journal.jsonl"
node --experimental-strip-types prep/scripts/verify-complete.ts "$FIX"; echo "exit=$?"
```

Expected: exit=1 with `journal.jsonl records decision D1 but decisions.json has no matching entry`.

- [ ] **Step 3: Commit**

```bash
git add prep/scripts/verify-complete.ts
git commit -m "feat: verify-complete gate — /prep fails loudly on missing artifacts"
```

---

### Task 6: Feature queue slims down (Spec column, no Details section)

**Files:**
- Modify: `registry/registry-io.ts` (function `renderFeatureQueue`, currently ~lines 643–749)
- Modify: `registry/registry.selfcheck.ts` (append one check)

**Interfaces:**
- Consumes: existing `renderFeatureQueue(projectRoot, features, project, recommendation?, report?)` — signature unchanged.
- Produces: `feature-queue.md` whose Queue table has a trailing `Spec` column linking `specs/F-XXX.md`, and which no longer contains the `## Details` section. `Changes Since Last Run`, `Recommendation`, `## Queue`, and `## History` are unchanged.

- [ ] **Step 1: Append a failing check to the registry selfcheck**

`renderFeatureQueue` writes to disk, so the check uses a temp dir. The file
already imports `mkdtempSync`, `tmpdir`, `join`, and `initProject` — add only
`readFileSync` to the existing `node:fs` import line, and add
`renderFeatureQueue` to the existing `./registry-io.ts` import block. Then
append this check to `registry/registry.selfcheck.ts` before the final
`console.log` (reuses the file's existing `speced` fixture array, defined at
~line 133, and `now` constant, defined at ~line 44):

```ts
// --- feature queue projection: spec links, no inline details ---
check("renderFeatureQueue links specs and drops the Details section", () => {
  const dir = mkdtempSync(join(tmpdir(), "sandwich-queue-"));
  renderFeatureQueue(dir, speced, initProject("X", now));
  const md = readFileSync(join(dir, "docs", "sandwich", "feature-queue.md"), "utf8");
  assert.ok(md.includes("| Spec |"), "queue table should have a Spec column");
  assert.ok(md.includes(`[specs/${speced[0].id}.md](specs/${speced[0].id}.md)`), "row should link the spec file");
  assert.ok(!md.includes("## Details"), "inline Details section should be gone");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL on the new check (no `Spec` column yet).

- [ ] **Step 3: Modify `renderFeatureQueue`**

In `registry/registry-io.ts`, replace the Queue table block:

```ts
  lines.push("## Queue", "");
  lines.push("| # | ID | Title | Module | Priority | Status |");
  lines.push("|---|----|-------|--------|----------|--------|");
  active.forEach((f, i) => {
    const pin = f.overrides.priority ? "📌" : "";
    lines.push(
      `| ${i + 1} | ${f.id} | ${f.title} | ${f.module} | ${pin}${effectivePriority(f)} | ${displayStatus(f)} |`
    );
  });
  lines.push("", "---", "");
```

with:

```ts
  lines.push("## Queue", "");
  lines.push("| # | ID | Title | Module | Priority | Status | Spec |");
  lines.push("|---|----|-------|--------|----------|--------|------|");
  active.forEach((f, i) => {
    const pin = f.overrides.priority ? "📌" : "";
    lines.push(
      `| ${i + 1} | ${f.id} | ${f.title} | ${f.module} | ${pin}${effectivePriority(f)} | ${displayStatus(f)} | [specs/${f.id}.md](specs/${f.id}.md) |`
    );
  });
  lines.push("", "---", "");
```

Then delete the entire Details block that follows (from `// Detail blocks` and `lines.push("## Details", "");` through the end of the `active.forEach((f) => { ... })` loop that renders per-feature headings, score tables, depends/blocked lines, description, and source — everything between the Queue block and the `// Shipped / rejected history` comment).

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: all checks pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add registry/registry-io.ts registry/registry.selfcheck.ts
git commit -m "feat: feature-queue links per-feature specs, drops inline details"
```

---

### Task 7: `/status` audits completeness (`renderStatus` + `prep/scripts/status.ts`)

**Files:**
- Modify: `registry/registry-io.ts` (function `renderStatus`, currently ~lines 756–811)
- Modify: `registry/registry.selfcheck.ts` (append one check)
- Create: `prep/scripts/status.ts`

**Interfaces:**
- Consumes: Task 3's `featuresMissingSpecs`, `decisionTargetsMissing`; existing registry readers.
- Produces: `renderStatus(features, project, journal, questions, audit?)` where `audit?: { missingSpecs: string[]; missingDecisionTargets: string[] }` — existing 4-arg callers keep compiling. CLI: `node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/status.ts [project-root] [--report]`.

- [ ] **Step 1: Append a failing check to the registry selfcheck**

Append to `registry/registry.selfcheck.ts` before the final `console.log`:

```ts
check("renderStatus surfaces completeness audit findings", () => {
  const txt = renderStatus(
    speced,
    initProject("X", now),
    [],
    [],
    { missingSpecs: ["F-004", "F-007"], missingDecisionTargets: ["D2"] }
  );
  assert.ok(txt.includes("F-004, F-007"), "should list features missing specs");
  assert.ok(txt.includes("D2"), "should list unrecorded decisions");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL — `renderStatus` takes 4 args / no audit lines rendered.

- [ ] **Step 3: Extend `renderStatus`**

In `registry/registry-io.ts`, change the signature:

```ts
export function renderStatus(
  features: Feature[],
  project: Project,
  journal: JournalEvent[],
  questions: Question[],
  audit?: { missingSpecs: string[]; missingDecisionTargets: string[] }
): string {
```

and inside the `// The action list` section, after the existing `todos` pushes and before `out.push("Awaiting you:");`, add:

```ts
  if (audit?.missingSpecs.length)
    todos.push(
      `Write missing spec file(s): ${audit.missingSpecs.join(", ")} → docs/sandwich/specs/, then run render-specs + verify-complete`
    );
  if (audit?.missingDecisionTargets.length)
    todos.push(
      `Journal records decision(s) ${audit.missingDecisionTargets.join(", ")} missing from decisions.json — restore them`
    );
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: all checks pass (the existing 4-arg `renderStatus` check still passes — the new param is optional).

- [ ] **Step 5: Create `prep/scripts/status.ts`**

```ts
#!/usr/bin/env node
// Deterministic /status dashboard. The status skill runs this and prints the
// output verbatim instead of hand-assembling the dashboard.
// Usage: node --experimental-strip-types prep/scripts/status.ts [project-root] [--report]

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  featuresMissingSpecs,
  decisionTargetsMissing,
  type SpecPresence,
} from "../lib/completeness.ts";
import { validateFeatureSpec } from "../lib/spec-schema.ts";
import { getPrepPaths } from "../lib/prep-lib.ts";
import {
  getRegistryPaths,
  readProject,
  readFeatures,
  readQuestions,
  readDecisions,
  readJournal,
  renderStatus,
  renderReport,
} from "../../registry/registry-io.ts";

const args = process.argv.slice(2);
const report = args.includes("--report");
const rootArg = args.find((a) => !a.startsWith("--"));
const projectRoot = resolve(rootArg ?? process.cwd());

const project = readProject(projectRoot);
if (!project) {
  console.error(
    `✗ ${getRegistryPaths(projectRoot).project} not found or unreadable — run /prep first.`
  );
  process.exit(1);
}

const features = readFeatures(projectRoot);
const journal = readJournal(projectRoot);

if (report) {
  console.log(renderReport(features, journal, project));
  process.exit(0);
}

const prep = getPrepPaths(projectRoot);
const specs = new Map<string, SpecPresence>();
if (existsSync(prep.specsDir)) {
  for (const file of readdirSync(prep.specsDir).filter((f) => f.endsWith(".json"))) {
    const id = file.replace(/\.json$/, "");
    let jsonValid = false;
    try {
      jsonValid = validateFeatureSpec(JSON.parse(readFileSync(join(prep.specsDir, file), "utf8"))).valid;
    } catch {}
    specs.set(id, { jsonValid, errors: [], mdExists: existsSync(join(prep.specsDir, `${id}.md`)) });
  }
}

console.log(
  renderStatus(features, project, journal, readQuestions(projectRoot), {
    missingSpecs: featuresMissingSpecs(features, specs),
    missingDecisionTargets: decisionTargetsMissing(journal, readDecisions(projectRoot)),
  })
);
```

- [ ] **Step 6: Verify against the Task 5 fixture**

```bash
node --experimental-strip-types prep/scripts/status.ts "$FIX"
```

Expected: the `SANDWICH STATUS — Fixture` dashboard; because Task 5 left a `D1` journal entry with no decision, `Awaiting you` includes `Journal records decision(s) D1 missing from decisions.json`. Also run `npm test` — all green.

- [ ] **Step 7: Commit**

```bash
git add registry/registry-io.ts registry/registry.selfcheck.ts prep/scripts/status.ts
git commit -m "feat: /status audits spec and decision completeness via status script"
```

---

### Task 8: Delete dead `writeSpec()` from `prep/lib/prep-lib.ts`

**Files:**
- Modify: `prep/lib/prep-lib.ts` (delete the `Spec` interface ~lines 547–555 and `writeSpec()` ~lines 557–604)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — pure deletion. `writeSpec` has had zero callers since `/recipe` was removed (commit `a9d6a7f`); this design replaces it with the schema/render/verify trio.

- [ ] **Step 1: Confirm zero callers**

Run: `grep -rn "writeSpec\|from \"./prep-lib\" .*Spec\b" --include="*.ts" order prep registry lib | grep -v "prep-lib.ts"`
Expected: no output (the `Spec` interface and `writeSpec` are referenced nowhere else). If anything shows up, stop and reassess before deleting.

- [ ] **Step 2: Delete the block**

In `prep/lib/prep-lib.ts`, delete from `export interface Spec {` down to the closing brace of `writeSpec` (the function returning `{ json: jsonPath, md: mdPath }`). Keep `writePlanContext` (directly below) and everything else.

- [ ] **Step 3: Verify and commit**

Run: `npm test`
Expected: all selfchecks pass.

```bash
git add prep/lib/prep-lib.ts
git commit -m "chore: remove dead writeSpec — replaced by spec-schema/render-specs"
```

---

### Task 9: SKILL.md updates (prep + status)

**Files:**
- Modify: `prep/skills/prep/SKILL.md`
- Modify: `prep/skills/status/SKILL.md`

**Interfaces:**
- Consumes: the CLI contracts from Tasks 4, 5, 7 (exact commands below).
- Produces: the instructions the LLM actually follows at runtime — this task is what makes the new artifacts exist in real runs.

- [ ] **Step 1: Update the pipeline steps in `prep/skills/prep/SKILL.md`**

In the numbered pipeline (currently steps 8–10), replace step 9 and renumber so the sequence becomes:

````markdown
8. **Write registry files** — write `features.json`, `project.json`, `questions.json`, `decisions.json`, and append to `journal.jsonl`. The pi-gate validates each write against the schema; if validation fails it prints the exact errors — fix the field and retry. For every feature that gets a spec in step 9, set its `specRef` to `"specs/F-XXX.json"` so drift detection can flag stale specs when the brief moves.

9. **Write per-feature specs** — for EVERY active feature (lifecycle not `done`/`rejected`), write `docs/sandwich/specs/F-XXX.json` following the spec schema below. Derive scope and acceptance criteria from the brief only — do NOT invent task breakdowns, estimates, or file lists (that is Superpowers brainstorming's job).

10. **Run the deterministic renderers** — after all registry and spec files are written, run both:
    ```bash
    node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/render.ts
    node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/render-specs.ts
    ```
    `SANDWICH_ROOT` is injected into your context at session start. The scripts read the registry and spec JSONs, render `docs/sandwich/feature-queue.md` and `docs/sandwich/specs/F-XXX.md`, and exit 1 with exact errors if anything is invalid. Fix and re-run.

11. **Verify completeness** — run:
    ```bash
    node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/verify-complete.ts
    ```
    Exit 1 lists every missing or invalid artifact (a feature without a spec, a journal decision missing from decisions.json, a missing rendered file). Fix each listed item and re-run until it prints `✓ /prep output is complete`. /prep is NOT done until this passes.

12. **Present recommendation** — top 3 candidates with validation status, and point the human at the top feature's spec file: "buka `docs/sandwich/specs/F-XXX.md` untuk mulai".
````

- [ ] **Step 2: Add the spec schema to the "Registry file schemas" section**

Append to the schemas section of `prep/skills/prep/SKILL.md` (after the existing registry schemas, following the same "exact schema, do not invent fields" convention):

````markdown
### docs/sandwich/specs/F-XXX.json — one file per active feature

> Validated by `render-specs.ts` and `verify-complete.ts`. Content only —
> never include priority, lifecycle, estimates, task lists, or file paths.

```json
{
  "featureId": "F-001",
  "title": "OTP Verification Flow",
  "module": "auth",
  "description": "Email verification dengan OTP (valid 15 menit) saat registrasi",
  "scope": {
    "inScope": ["Kirim OTP via email saat registrasi", "Validasi OTP 15 menit"],
    "outOfScope": ["OTP via SMS"]
  },
  "acceptanceCriteria": [
    { "id": "AC1", "text": "User menerima email OTP dalam 60 detik setelah registrasi", "done": false }
  ],
  "dependsOn": [],
  "source": { "file": "prd.md", "lines": "31-33" }
}
```

| Field | Rule |
|-------|------|
| `featureId` | must match `F-\d{3}` and equal the filename |
| `scope.inScope` | ≥ 1 item |
| `scope.outOfScope` | may be empty, never omitted |
| `acceptanceCriteria` | ≥ 1; ids `AC1`, `AC2`, …; `done` starts `false`; each criterion concrete and testable |
| `dependsOn` | feature ids, consistent with the registry |
| `source` | brief file (+ optional `lines`) the feature came from |
````

- [ ] **Step 3: Update the "What it produces" section**

In the same file's **Committed views** table, add a row:

```markdown
| `specs/F-XXX.md` + `specs/F-XXX.json` | Per-feature spec: scope + acceptance-criteria checklist — the dev's starting point for Superpowers brainstorming |
```

- [ ] **Step 4: Update `prep/skills/status/SKILL.md`**

Replace the `## Output` section's opening (`/status` prints: …) with instructions to run the deterministic script:

````markdown
## Output

Run the deterministic dashboard and print its output verbatim:

```bash
node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/status.ts
```

For `/status --report`:

```bash
node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/status.ts --report
```

The dashboard covers: gates, lifecycle counts, flags, **Awaiting you** (open
questions, changed features, stale specs, orphans, missing spec files,
decisions recorded in the journal but absent from decisions.json, queue
approval), and recent activity. Do not hand-assemble these — the script is
the single source of the numbers.
````

Keep the "When to invoke", "Commands", and "Key principle" sections; update the Key principle's last sentence to mention opening the top feature's `docs/sandwich/specs/F-XXX.md`.

- [ ] **Step 5: Commit**

```bash
git add prep/skills/prep/SKILL.md prep/skills/status/SKILL.md
git commit -m "docs: /prep writes per-feature specs + verify gate; /status runs status script"
```

---

### Task 10: README + end-to-end fixture run

**Files:**
- Modify: `README.md` (pipeline section)

**Interfaces:**
- Consumes: everything above.
- Produces: shipped, verified branch ready for review.

- [ ] **Step 1: Update README pipeline section**

Find the pipeline description (the `/order → /prep → Superpowers` diagram area) and update it to include the spec hand-off, e.g.:

```markdown
/order → /prep → docs/sandwich/specs/F-XXX.md → superpowers:brainstorming → build
                 └─ feature-queue.md (priorities + links)
```

and a sentence: after `/prep`, every active feature has `docs/sandwich/specs/F-XXX.md` with scope + an acceptance-criteria checklist; pick the top one and hand it to Superpowers brainstorming; check off ACs (`done: true` in the JSON, re-run render-specs) as implementation proves them.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all four selfchecks pass.

- [ ] **Step 3: End-to-end fixture sweep**

Re-run the whole chain on a fresh fixture (repeat Task 4 Step 2 fixture setup, then):

```bash
node --experimental-strip-types prep/scripts/render-specs.ts "$FIX"        # ✓ F-001.md
node --experimental-strip-types prep/scripts/verify-complete.ts "$FIX"     # exit 1: project/questions/queue missing
# add project.json, questions.json, feature-queue.md as in Task 5 Step 2
node --experimental-strip-types prep/scripts/verify-complete.ts "$FIX"     # ✓ complete
node --experimental-strip-types prep/scripts/status.ts "$FIX"              # dashboard, clean Awaiting you
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README pipeline shows per-feature spec hand-off"
```

- [ ] **Step 5: Real-world smoke test (manual, optional but recommended)**

In `/Users/riaenriala/Documents/wsu/digitalhub-3` (has a populated registry, no specs yet):

```bash
node --experimental-strip-types <sandwich-repo>/prep/scripts/verify-complete.ts .
```

Expected: exit 1 listing all 12 active features as missing specs — which is exactly what `/prep` will be told to fix on its next run. Do not write anything to that project in this task.
