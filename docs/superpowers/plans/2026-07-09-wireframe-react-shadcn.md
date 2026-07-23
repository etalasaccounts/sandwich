# Wireframe Skill v2 (Next.js + shadcn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/wireframe`'s static Tailwind-CDN HTML output with a real Next.js + shadcn app (shared components, real navigation), and add per-step field detail to `/order`'s flow schema so generated screens have real form fields instead of guessed placeholders.

**Architecture:** `/order`'s `UserFlowsDocSchema` gains structured `steps` (`{ text, fields? }`). `/wireframe` scaffolds a Next.js App Router + shadcn app once (`wireframes/` at repo root), then incrementally adds one route per screen, composed only from a fixed shadcn primitive set (`components/ui/*`) and a fixed composite starter kit (`components/wireframe/*`) — both vendored from a template shipped inside the sandwich plugin, never fetched over the network. The existing never-overwrite/stale-flagging invariant carries over unchanged, just keyed on `route` instead of `file`.

**Tech Stack:** TypeScript, Zod, Next.js (App Router) + shadcn/ui + Tailwind CSS + Radix UI (generated app only — not a dependency of the sandwich plugin itself), Node's `node:assert` for self-checks (no test framework).

## Global Constraints

- Every new/changed schema is validated with Zod; no hand-rolled type checks.
- Self-checks use the existing plain-`node:assert` convention (`*.selfcheck.ts`, run via `node --experimental-strip-types`), matching `order/lib/validation.selfcheck.ts` and `wireframe/lib/wireframe.selfcheck.ts` — no new test framework.
- This is a pre-1.0 alpha repo (see README: "APIs and file formats may change without notice"). No migration path for existing `docs/wireframes/*.html` projects is needed or in scope.
- The sandwich plugin's own `package.json` dependencies stay unchanged (`zod` only) — Next.js/React/shadcn/Radix are dependencies of the *generated* `wireframes/` app's `package.json`, never added to the plugin's own `node_modules`.
- Never overwrite an existing screen route file (`wireframes/app/<route>/page.tsx`) once it exists on disk — this invariant is load-bearing across every task that touches generation or the workflow.
- Full spec: `docs/superpowers/specs/2026-07-08-wireframe-react-shadcn-design.md`.

---

### Task 1: `/order` schema — structured per-step field detail

**Files:**
- Modify: `order/lib/order-schemas.ts:40-52` (`UserFlowsDocSchema`)
- Modify: `order/lib/validation.selfcheck.ts:62-71` (fixture + new field-validation checks)

**Interfaces:**
- Produces: `FlowFieldSchema` (zod), `FlowField` (type), `FlowStepSchema` (zod), `FlowStep` (type — `{ text: string; fields?: FlowField[] }`), updated `UserFlowsDocSchema`/`UserFlowsDoc` where `flows[].steps: FlowStep[]`.
- Consumed by: Task 2 (`order-render.ts`, `03-write-user-flows.md`), Task 4 (`wireframe-lib.ts`'s `NeedsUIFlow`).

- [ ] **Step 1: Write the failing checks**

In `order/lib/validation.selfcheck.ts`, replace the two `steps: ["s"]` fixtures at lines 62-71 with the new object shape, and add two new checks for field validation. Replace:

```ts
check("validateUserFlowsDoc requires UF-### ids and >=1 step", () => {
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated", needsUI: true }] }).valid, true);
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "F1", title: "t", actor: "a", trigger: "x", steps: [], outcome: "o", confidence: "stated", needsUI: true }] }).valid, false);
});
check("validateUserFlowsDoc requires needsUI on every flow", () => {
  const withNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated", needsUI: true }] };
  assert.equal(validateUserFlowsDoc(withNeedsUI).valid, true);
  const withoutNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated" }] };
  assert.equal(validateUserFlowsDoc(withoutNeedsUI).valid, false);
});
```

with:

```ts
check("validateUserFlowsDoc requires UF-### ids and >=1 step", () => {
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s" }], outcome: "o", confidence: "stated", needsUI: true }] }).valid, true);
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "F1", title: "t", actor: "a", trigger: "x", steps: [], outcome: "o", confidence: "stated", needsUI: true }] }).valid, false);
});
check("validateUserFlowsDoc requires needsUI on every flow", () => {
  const withNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s" }], outcome: "o", confidence: "stated", needsUI: true }] };
  assert.equal(validateUserFlowsDoc(withNeedsUI).valid, true);
  const withoutNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s" }], outcome: "o", confidence: "stated" }] };
  assert.equal(validateUserFlowsDoc(withoutNeedsUI).valid, false);
});
check("validateUserFlowsDoc accepts a step with a populated fields array", () => {
  const doc = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "enter shipping address", fields: [{ name: "city", type: "text", required: true }, { name: "country", type: "select", options: ["ID", "SG"] }] }], outcome: "o", confidence: "stated", needsUI: true }] };
  const r = validateUserFlowsDoc(doc);
  assert.equal(r.valid, true);
  assert.equal(r.data?.flows[0].steps[0].fields?.[0].name, "city");
});
check("validateUserFlowsDoc rejects a field with an invalid type enum", () => {
  const doc = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s", fields: [{ name: "x", type: "phone" }] }], outcome: "o", confidence: "stated", needsUI: true }] };
  assert.equal(validateUserFlowsDoc(doc).valid, false);
});
```

- [ ] **Step 2: Run to verify the new checks fail**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: throws/fails — `steps` is still `z.array(z.string())` in the schema, so passing step objects fails validation for the "accepts" checks (and the string-based ones now pass an object where a string was expected).

- [ ] **Step 3: Update the schema**

In `order/lib/order-schemas.ts`, replace lines 40-52:

```ts
export const UserFlowsDocSchema = z.object({
  flows: z.array(z.object({
    id: z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX"),
    title: z.string().min(1),
    actor: z.string().min(1),
    trigger: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1, "A flow needs at least one step"),
    outcome: z.string().min(1),
    confidence: ConfidenceSchema,
    needsUI: z.boolean(),
  })).min(1, "At least one user flow required"),
});
export type UserFlowsDoc = z.infer<typeof UserFlowsDocSchema>;
```

with:

```ts
export const FlowFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "email", "number", "date", "select", "textarea", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});
export type FlowField = z.infer<typeof FlowFieldSchema>;

export const FlowStepSchema = z.object({
  text: z.string().min(1),
  fields: z.array(FlowFieldSchema).optional(),
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const UserFlowsDocSchema = z.object({
  flows: z.array(z.object({
    id: z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX"),
    title: z.string().min(1),
    actor: z.string().min(1),
    trigger: z.string().min(1),
    steps: z.array(FlowStepSchema).min(1, "A flow needs at least one step"),
    outcome: z.string().min(1),
    confidence: ConfidenceSchema,
    needsUI: z.boolean(),
  })).min(1, "At least one user flow required"),
});
export type UserFlowsDoc = z.infer<typeof UserFlowsDocSchema>;
```

- [ ] **Step 4: Run to verify all checks pass**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: all checks print `✓` and the script ends with `N order checks passed.` (N includes the 2 new checks).

- [ ] **Step 5: Commit**

```bash
git add order/lib/order-schemas.ts order/lib/validation.selfcheck.ts
git commit -m "feat(order): add per-step field detail to user flow steps"
```

---

### Task 2: `/order` render + agent prompt for structured steps

**Files:**
- Modify: `order/lib/order-render.ts:114-135` (`renderUserFlows`)
- Modify: `order/lib/validation.selfcheck.ts:94-99` (render fixture)
- Modify: `order/agents/03-write-user-flows.md`

**Interfaces:**
- Consumes: `FlowStep` type from Task 1.
- Produces: `renderUserFlows(doc, prev?)` still returns a markdown string, now rendering `step.text` (plus a nested field list when present) instead of a bare string per step.

- [ ] **Step 1: Write the failing check**

In `order/lib/validation.selfcheck.ts`, replace the `renderUserFlows` check at lines 94-99:

```ts
check("renderUserFlows lists numbered steps", () => {
  const md = renderUserFlows({ flows: [{ id: "UF-001", title: "Login", actor: "User", trigger: "click", steps: ["open", "submit"], outcome: "in", confidence: "stated", needsUI: true }] });
  assert.ok(md.includes("### UF-001 — Login"));
  assert.ok(md.includes("1. open"));
  assert.ok(md.includes("2. submit"));
});
```

with:

```ts
check("renderUserFlows lists numbered steps", () => {
  const md = renderUserFlows({ flows: [{ id: "UF-001", title: "Login", actor: "User", trigger: "click", steps: [{ text: "open" }, { text: "submit" }], outcome: "in", confidence: "stated", needsUI: true }] });
  assert.ok(md.includes("### UF-001 — Login"));
  assert.ok(md.includes("1. open"));
  assert.ok(md.includes("2. submit"));
});
check("renderUserFlows lists a step's fields as a nested list", () => {
  const md = renderUserFlows({ flows: [{ id: "UF-001", title: "Checkout", actor: "User", trigger: "click", steps: [{ text: "enter shipping address", fields: [{ name: "city", type: "text", required: true }] }], outcome: "done", confidence: "stated", needsUI: true }] });
  assert.ok(md.includes("1. enter shipping address"));
  assert.ok(md.includes("city (text, required)"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: fails — `renderUserFlows` still does `f.steps.map((s, i) => \`${i + 1}. ${s}\`)`, and `s` is now an object, so it'd render `1. [object Object]` instead of `1. open`.

- [ ] **Step 3: Update the renderer**

In `order/lib/order-render.ts`, replace lines 114-135 (`renderUserFlows`):

```ts
export function renderUserFlows(doc: UserFlowsDoc, prev?: UserFlowsDoc): string {
  const lines: string[] = [
    `# User Flows`,
    "",
    `> Generated by sandwich/order · ${today()}`,
    "",
    ...doc.flows.flatMap((f) => [
      `### ${f.id} — ${f.title}`,
      `- **Actor:** ${f.actor}`,
      `- **Trigger:** ${f.trigger}`,
      `- **Needs UI:** ${f.needsUI ? "yes" : "no"}`,
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
```

with:

```ts
function renderStepFields(step: UserFlowsDoc["flows"][number]["steps"][number]): string[] {
  if (!step.fields || step.fields.length === 0) return [];
  return step.fields.map((f) => {
    const opts = f.options && f.options.length ? `: ${f.options.join(", ")}` : "";
    return `   - ${f.name} (${f.type}${f.required ? ", required" : ""})${opts}`;
  });
}

export function renderUserFlows(doc: UserFlowsDoc, prev?: UserFlowsDoc): string {
  const lines: string[] = [
    `# User Flows`,
    "",
    `> Generated by sandwich/order · ${today()}`,
    "",
    ...doc.flows.flatMap((f) => [
      `### ${f.id} — ${f.title}`,
      `- **Actor:** ${f.actor}`,
      `- **Trigger:** ${f.trigger}`,
      `- **Needs UI:** ${f.needsUI ? "yes" : "no"}`,
      `- **Confidence:** ${mark(f.confidence)}`,
      "",
      `**Steps:**`,
      ...f.steps.flatMap((s, i) => [`${i + 1}. ${s.text}`, ...renderStepFields(s)]),
      "",
      `**Outcome:** ${f.outcome}`,
      "",
    ]),
  ];
  return withChangelog(lines.join("\n"), doc, prev);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: all checks pass, ends with `N order checks passed.`

- [ ] **Step 5: Update the agent prompt**

In `order/agents/03-write-user-flows.md`, replace the JSON shape block and the steps rule. Replace:

```json
{
  "flows": [{
    "id": "UF-001",
    "title": "string",
    "actor": "string",
    "trigger": "what starts the flow",
    "steps": ["step 1", "step 2"],
    "outcome": "end state",
    "confidence": "stated | discussed | inferred | assumed",
    "needsUI": true
  }]
}
```

with:

```json
{
  "flows": [{
    "id": "UF-001",
    "title": "string",
    "actor": "string",
    "trigger": "what starts the flow",
    "steps": [
      { "text": "step 1" },
      { "text": "enter shipping address", "fields": [
        { "name": "city", "type": "text", "required": true },
        { "name": "country", "type": "select", "required": true, "options": ["Indonesia", "Singapore"] }
      ] }
    ],
    "outcome": "end state",
    "confidence": "stated | discussed | inferred | assumed",
    "needsUI": true
  }]
}
```

and replace the rule `- Each flow needs at least one step; steps are short imperative phrases.` with:

```
- Each flow needs at least one step; `text` is a short imperative phrase.
- When a step involves entering or selecting data (a form field, a search box, a filter), add a `fields` array: one entry per field with `name`, `type` (`text`|`email`|`number`|`date`|`select`|`textarea`|`checkbox`), `required`, and `options` (only for `type: "select"`). Omit `fields` entirely for purely navigational/action steps (e.g. "click checkout").
```

- [ ] **Step 6: Commit**

```bash
git add order/lib/order-render.ts order/lib/validation.selfcheck.ts order/agents/03-write-user-flows.md
git commit -m "feat(order): render and prompt for per-step field detail"
```

---

### Task 3: Wireframe manifest schema v2 — `route` + `navigatesTo`

**Files:**
- Modify: `wireframe/lib/wireframe-schemas.ts` (whole file)
- Modify: `wireframe/lib/wireframe.selfcheck.ts:14-39` (schema fixture + checks)

**Interfaces:**
- Produces: `ScreenSchema`/`Screen` with `route: string` (replaces `file`) and `navigatesTo: string[]` (new, defaults `[]`); `WireframeManifestSchema`/`WireframeManifest` unchanged in shape.
- Consumed by: Task 4 (`wireframe-lib.ts`), Task 9 (`wireframe-render.ts`), Task 12 (agent prompts), Task 13 (`wireframe.workflow.ts`), Task 11 (`scripts/render.ts`).

- [ ] **Step 1: Write the failing checks**

In `wireframe/lib/wireframe.selfcheck.ts`, replace lines 14-39:

```ts
import { validateWireframeManifest } from "./wireframe-schemas.ts";

const VALID_SCREEN = {
  id: "SCR-001",
  name: "Homepage",
  file: "homepage.html",
  flows: ["UF-001"],
};

check("validateWireframeManifest accepts a minimal valid manifest and fills flag defaults", () => {
  const r = validateWireframeManifest({ screens: [VALID_SCREEN] });
  assert.equal(r.valid, true);
  assert.equal(r.data!.screens[0].flags.stale, false);
  assert.equal(r.data!.screens[0].flags.orphaned, false);
  assert.deepEqual(r.data!.screens[0].staleReasons, []);
});
check("validateWireframeManifest rejects a malformed screen id", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, id: "S1" }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects an empty flows array", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, flows: [] }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects a malformed flow id inside flows", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, flows: ["F1"] }] });
  assert.equal(r.valid, false);
});
```

with:

```ts
import { validateWireframeManifest } from "./wireframe-schemas.ts";

const VALID_SCREEN = {
  id: "SCR-001",
  name: "Homepage",
  route: "/homepage",
  flows: ["UF-001"],
};

check("validateWireframeManifest accepts a minimal valid manifest and fills flag/navigatesTo defaults", () => {
  const r = validateWireframeManifest({ screens: [VALID_SCREEN] });
  assert.equal(r.valid, true);
  assert.equal(r.data!.screens[0].flags.stale, false);
  assert.equal(r.data!.screens[0].flags.orphaned, false);
  assert.deepEqual(r.data!.screens[0].staleReasons, []);
  assert.deepEqual(r.data!.screens[0].navigatesTo, []);
});
check("validateWireframeManifest rejects a malformed screen id", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, id: "S1" }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects an empty flows array", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, flows: [] }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects a malformed flow id inside flows", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, flows: ["F1"] }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects a route without a leading slash", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, route: "homepage" }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest accepts an explicit navigatesTo list", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, navigatesTo: ["SCR-002"] }] });
  assert.equal(r.valid, true);
  assert.deepEqual(r.data!.screens[0].navigatesTo, ["SCR-002"]);
});
check("validateWireframeManifest rejects a malformed screen id inside navigatesTo", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, navigatesTo: ["not-a-screen-id"] }] });
  assert.equal(r.valid, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: fails — `ScreenSchema` still requires `file` (not present in `VALID_SCREEN` anymore) and has no `route`/`navigatesTo` fields, so the "accepts" checks fail and the file no longer parses as intended (the object shape mismatch causes validation failures where the test expects `true`).

- [ ] **Step 3: Update the schema**

Replace the entire contents of `wireframe/lib/wireframe-schemas.ts`:

```ts
import { z } from "zod";

export const ScreenSchema = z.object({
  id: z.string().regex(/^SCR-\d{3}$/, "Screen id must be SCR-XXX format"),
  name: z.string().min(1),
  route: z.string().regex(/^\/[a-z0-9-]*$/, "Route must be a lowercase-hyphenated path starting with /, e.g. /plp"),
  flows: z.array(z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX")).min(1, "A screen needs at least one flow"),
  navigatesTo: z.array(z.string().regex(/^SCR-\d{3}$/, "Screen id must be SCR-XXX")).default([]),
  flags: z.object({
    stale: z.boolean().default(false),
    orphaned: z.boolean().default(false),
  }).default({ stale: false, orphaned: false }),
  staleReasons: z.array(z.string()).default([]),
});
export type Screen = z.infer<typeof ScreenSchema>;

export const WireframeManifestSchema = z.object({
  screens: z.array(ScreenSchema).min(1, "At least one screen required"),
});
export type WireframeManifest = z.infer<typeof WireframeManifestSchema>;

export function validateWireframeManifest(
  o: unknown
): { valid: boolean; data?: WireframeManifest; errors: string[] } {
  const r = WireframeManifestSchema.safeParse(o);
  if (r.success) return { valid: true, data: r.data, errors: [] };
  return { valid: false, errors: r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: fails at this point on the *other* checks further down the file (they still use `file:` fixtures) — that's expected, Task 4 and Task 9 fix those. Confirm specifically that the 7 schema checks just written now print `✓` before the failure.

- [ ] **Step 5: Commit**

```bash
git add wireframe/lib/wireframe-schemas.ts wireframe/lib/wireframe.selfcheck.ts
git commit -m "feat(wireframe): manifest schema v2 — route + navigatesTo replace file"
```

---

### Task 4: Wireframe lib v2 — `wireframes/` root, `routeToFilePath`, structured steps

**Files:**
- Modify: `wireframe/lib/wireframe-lib.ts` (whole file)
- Modify: `wireframe/lib/wireframe.selfcheck.ts:41-129` (paths/diff/manifest-roundtrip checks)

**Interfaces:**
- Consumes: `Screen`/`WireframeManifest` from Task 3.
- Produces: `WireframePaths` (`root`, `manifest`, `snapshot`, `gitignore`, `appDir`, `navHubPage` — `indexHtml` removed), `getWireframePaths(projectRoot)`, `ensureWireframeDir(projectRoot)`, `routeToFilePath(route: string): string`, `NeedsUIFlow` (now `steps: NeedsUIFlowStep[]`), `NeedsUIFlowStep` (`{ text: string; fields?: NeedsUIFlowField[] }`), `NeedsUIFlowField`, `readSnapshot`/`writeSnapshot`/`diffFlows`/`readManifest`/`writeManifest` — signatures unchanged.
- Consumed by: Task 9 (scaffold test uses `getWireframePaths`), Task 10 (`wireframe-render.ts` uses `Screen` shape only), Task 11 (`scripts/render.ts` uses `routeToFilePath`), Task 13 (`wireframe.workflow.ts` uses all of the above).

- [ ] **Step 1: Write the failing checks**

In `wireframe/lib/wireframe.selfcheck.ts`, replace lines 41-129 (from the `readSnapshot`/`writeSnapshot` import block through the `readManifest returns undefined...` check):

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWireframePaths,
  ensureWireframeDir,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  readManifest,
  writeManifest,
} from "./wireframe-lib.ts";

const FLOW_A = { id: "UF-001", title: "Browse", actor: "User", trigger: "opens site", steps: ["view products"], outcome: "sees grid" };
const FLOW_B = { id: "UF-002", title: "Checkout", actor: "User", trigger: "clicks buy", steps: ["pay"], outcome: "order placed" };

check("getWireframePaths returns paths rooted under docs/wireframes", () => {
  const paths = getWireframePaths("/tmp/proj");
  assert.ok(paths.manifest.endsWith("docs/wireframes/manifest.json"));
  assert.ok(paths.snapshot.endsWith("docs/wireframes/.snapshot.json"));
  assert.ok(paths.indexHtml.endsWith("docs/wireframes/index.html"));
});

check("writeSnapshot + readSnapshot round-trip flow content hashes", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A, FLOW_B]);
    const snapshot = readSnapshot(dir);
    assert.equal(typeof snapshot["UF-001"], "string");
    assert.equal(typeof snapshot["UF-002"], "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("diffFlows flags a changed flow and leaves an untouched one alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A, FLOW_B]);
    const snapshot = readSnapshot(dir);
    const changedB = { ...FLOW_B, steps: ["pay", "confirm"] };
    const diff = diffFlows([FLOW_A, changedB], snapshot);
    assert.equal(diff.changedIds.has("UF-002"), true);
    assert.equal(diff.changedIds.has("UF-001"), false);
    assert.equal(diff.newIds.size, 0);
    assert.equal(diff.removedIds.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("diffFlows detects new and removed flow ids", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A]);
    const snapshot = readSnapshot(dir);
    const diff = diffFlows([FLOW_B], snapshot);
    assert.equal(diff.newIds.has("UF-002"), true);
    assert.equal(diff.removedIds.has("UF-001"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("writeManifest + readManifest round-trip a valid manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    const manifest = { screens: [{ id: "SCR-001", name: "Homepage", file: "homepage.html", flows: ["UF-001"], flags: { stale: false, orphaned: false }, staleReasons: [] }] };
    const path = writeManifest(dir, manifest);
    assert.ok(path.endsWith("manifest.json"));
    const back = readManifest(dir);
    assert.equal(back?.screens[0].id, "SCR-001");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("readManifest returns undefined for structurally invalid manifest JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    ensureWireframeDir(dir);
    const paths = getWireframePaths(dir);
    writeFileSync(paths.manifest, JSON.stringify({ screens: [] }), "utf8");
    const back = readManifest(dir);
    assert.equal(back, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

with:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWireframePaths,
  ensureWireframeDir,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  readManifest,
  writeManifest,
  routeToFilePath,
} from "./wireframe-lib.ts";

const FLOW_A = { id: "UF-001", title: "Browse", actor: "User", trigger: "opens site", steps: [{ text: "view products" }], outcome: "sees grid" };
const FLOW_B = { id: "UF-002", title: "Checkout", actor: "User", trigger: "clicks buy", steps: [{ text: "pay" }], outcome: "order placed" };

check("getWireframePaths returns paths rooted under wireframes/", () => {
  const paths = getWireframePaths("/tmp/proj");
  assert.ok(paths.manifest.endsWith("wireframes/manifest.json"));
  assert.ok(paths.snapshot.endsWith("wireframes/.snapshot.json"));
  assert.ok(paths.navHubPage.endsWith("wireframes/app/page.tsx"));
  assert.ok(paths.appDir.endsWith("wireframes/app"));
});

check("routeToFilePath maps a screen route to its page.tsx location", () => {
  assert.equal(routeToFilePath("/plp"), join("app", "plp", "page.tsx"));
  assert.equal(routeToFilePath("/"), join("app", "page.tsx"));
});

check("routeToFilePath rejects a route without a leading slash", () => {
  assert.throws(() => routeToFilePath("plp"));
});

check("writeSnapshot + readSnapshot round-trip flow content hashes", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A, FLOW_B]);
    const snapshot = readSnapshot(dir);
    assert.equal(typeof snapshot["UF-001"], "string");
    assert.equal(typeof snapshot["UF-002"], "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("diffFlows flags a changed flow and leaves an untouched one alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A, FLOW_B]);
    const snapshot = readSnapshot(dir);
    const changedB = { ...FLOW_B, steps: [{ text: "pay" }, { text: "confirm" }] };
    const diff = diffFlows([FLOW_A, changedB], snapshot);
    assert.equal(diff.changedIds.has("UF-002"), true);
    assert.equal(diff.changedIds.has("UF-001"), false);
    assert.equal(diff.newIds.size, 0);
    assert.equal(diff.removedIds.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("diffFlows detects new and removed flow ids", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A]);
    const snapshot = readSnapshot(dir);
    const diff = diffFlows([FLOW_B], snapshot);
    assert.equal(diff.newIds.has("UF-002"), true);
    assert.equal(diff.removedIds.has("UF-001"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("writeManifest + readManifest round-trip a valid manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    const manifest = { screens: [{ id: "SCR-001", name: "Homepage", route: "/homepage", flows: ["UF-001"], navigatesTo: [], flags: { stale: false, orphaned: false }, staleReasons: [] }] };
    const path = writeManifest(dir, manifest);
    assert.ok(path.endsWith("manifest.json"));
    const back = readManifest(dir);
    assert.equal(back?.screens[0].id, "SCR-001");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("readManifest returns undefined for structurally invalid manifest JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    ensureWireframeDir(dir);
    const paths = getWireframePaths(dir);
    writeFileSync(paths.manifest, JSON.stringify({ screens: [] }), "utf8");
    const back = readManifest(dir);
    assert.equal(back, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("ensureWireframeDir writes a gitignore covering node_modules, .next, and the snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    ensureWireframeDir(dir);
    const paths = getWireframePaths(dir);
    const gitignore = require("node:fs").readFileSync(paths.gitignore, "utf8");
    assert.ok(gitignore.includes("node_modules"));
    assert.ok(gitignore.includes(".next"));
    assert.ok(gitignore.includes(".snapshot.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: fails — `getWireframePaths` still returns `docs/wireframes/*` paths and no `indexHtml`/`routeToFilePath` export exists yet.

- [ ] **Step 3: Update the lib**

Replace the entire contents of `wireframe/lib/wireframe-lib.ts`:

```ts
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hasOutputChanged, hashOutput } from "../../lib/agent-wrapper.ts";
import { validateWireframeManifest } from "./wireframe-schemas.ts";
import type { WireframeManifest } from "./wireframe-schemas.ts";

export interface WireframePaths {
  root: string;
  manifest: string;
  snapshot: string;
  gitignore: string;
  appDir: string;
  navHubPage: string;
}

export function getWireframePaths(projectRoot: string): WireframePaths {
  const root = join(projectRoot, "wireframes");
  return {
    root,
    manifest: join(root, "manifest.json"),
    snapshot: join(root, ".snapshot.json"),
    gitignore: join(root, ".gitignore"),
    appDir: join(root, "app"),
    navHubPage: join(root, "app", "page.tsx"),
  };
}

export function ensureWireframeDir(projectRoot: string): void {
  const paths = getWireframePaths(projectRoot);
  mkdirSync(paths.root, { recursive: true });
  if (!existsSync(paths.gitignore)) {
    writeFileSync(
      paths.gitignore,
      "node_modules\n.next\n*.tsbuildinfo\nnext-env.d.ts\n.snapshot.json\n",
      "utf8"
    );
  }
}

// Maps a screen's manifest route to the Next.js App Router file it owns.
// "/" is the nav hub itself; every other route gets its own segment dir.
export function routeToFilePath(route: string): string {
  if (!route.startsWith("/")) {
    throw new Error(`Route must start with "/": got "${route}"`);
  }
  const segment = route.slice(1);
  return segment === "" ? join("app", "page.tsx") : join("app", segment, "page.tsx");
}

// Recursively copies every file under templateDir into the project's
// wireframes/ root, skipping any file that already exists on disk. Used
// once, on the very first /wireframe run, to scaffold the Next.js + shadcn
// app — never re-run against an existing wireframes/ directory.
export function scaffoldWireframeApp(templateDir: string, projectRoot: string): string[] {
  const destRoot = getWireframePaths(projectRoot).root;
  const created: string[] = [];

  function copyDir(srcDir: string, relPath: string): void {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      const rel = relPath ? join(relPath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        copyDir(srcPath, rel);
        continue;
      }
      const destPath = join(destRoot, rel);
      if (existsSync(destPath)) continue;
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      created.push(rel);
    }
  }

  copyDir(templateDir, "");
  return created;
}

export interface NeedsUIFlowField {
  name: string;
  type: "text" | "email" | "number" | "date" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: string[];
}

export interface NeedsUIFlowStep {
  text: string;
  fields?: NeedsUIFlowField[];
}

export interface NeedsUIFlow {
  id: string;
  title: string;
  actor: string;
  trigger: string;
  steps: NeedsUIFlowStep[];
  outcome: string;
}

export type FlowSnapshot = Record<string, string>;

function flowContent(f: NeedsUIFlow): unknown {
  return { trigger: f.trigger, steps: f.steps, outcome: f.outcome };
}

export function readSnapshot(projectRoot: string): FlowSnapshot {
  const paths = getWireframePaths(projectRoot);
  if (!existsSync(paths.snapshot)) return {};
  try {
    return JSON.parse(readFileSync(paths.snapshot, "utf8"));
  } catch {
    return {};
  }
}

export function writeSnapshot(projectRoot: string, flows: NeedsUIFlow[]): void {
  ensureWireframeDir(projectRoot);
  const paths = getWireframePaths(projectRoot);
  const snapshot: FlowSnapshot = {};
  for (const f of flows) snapshot[f.id] = hashOutput(flowContent(f));
  writeFileSync(paths.snapshot, JSON.stringify(snapshot, null, 2), "utf8");
}

export interface FlowDiff {
  changedIds: Set<string>;
  newIds: Set<string>;
  removedIds: Set<string>;
}

export function diffFlows(currentFlows: NeedsUIFlow[], snapshot: FlowSnapshot): FlowDiff {
  const changedIds = new Set<string>();
  const newIds = new Set<string>();
  const currentIds = new Set(currentFlows.map((f) => f.id));

  for (const f of currentFlows) {
    const prevHash = snapshot[f.id];
    if (prevHash === undefined) {
      newIds.add(f.id);
    } else if (hasOutputChanged(flowContent(f), prevHash)) {
      changedIds.add(f.id);
    }
  }

  const removedIds = new Set(Object.keys(snapshot).filter((id) => !currentIds.has(id)));
  return { changedIds, newIds, removedIds };
}

export function readManifest(projectRoot: string): WireframeManifest | undefined {
  const paths = getWireframePaths(projectRoot);
  if (!existsSync(paths.manifest)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(paths.manifest, "utf8"));
    const result = validateWireframeManifest(parsed);
    return result.valid ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function writeManifest(projectRoot: string, manifest: WireframeManifest): string {
  ensureWireframeDir(projectRoot);
  const paths = getWireframePaths(projectRoot);
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2), "utf8");
  return paths.manifest;
}
```

- [ ] **Step 4: Fix the `require` used in the new gitignore check**

`wireframe.selfcheck.ts` is an ES module (loaded via `node --experimental-strip-types`, `import`-only) — `require` isn't available. In the check added in Step 1, replace:

```ts
    const gitignore = require("node:fs").readFileSync(paths.gitignore, "utf8");
```

with a real import instead. At the top of `wireframe/lib/wireframe.selfcheck.ts`, find the existing `import { mkdtempSync, rmSync, writeFileSync } from "node:fs";` line (now part of the block replaced in Step 1) and change it to also import `readFileSync`:

```ts
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
```

then in the check body use:

```ts
    const gitignore = readFileSync(paths.gitignore, "utf8");
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: fails only on the remaining render checks further down the file (lines ~131-149, still referencing `file`/`renderIndexHtml`) — Task 9 fixes those. Confirm every check up to and including "ensureWireframeDir writes a gitignore..." prints `✓`.

- [ ] **Step 6: Commit**

```bash
git add wireframe/lib/wireframe-lib.ts wireframe/lib/wireframe.selfcheck.ts
git commit -m "feat(wireframe): lib v2 — wireframes/ root, routeToFilePath, scaffold copy, structured steps"
```

---

### Task 5: Next.js app template — config skeleton

**Files:**
- Create: `wireframe/template/package.json`
- Create: `wireframe/template/tsconfig.json`
- Create: `wireframe/template/next.config.ts`
- Create: `wireframe/template/tailwind.config.ts`
- Create: `wireframe/template/postcss.config.js`
- Create: `wireframe/template/components.json`
- Create: `wireframe/template/lib/utils.ts`
- Create: `wireframe/template/app/layout.tsx`
- Create: `wireframe/template/app/globals.css`

This is the static, version-controlled source the plugin ships — copied verbatim into a client project's `wireframes/` on the first `/wireframe` run (Task 4's `scaffoldWireframeApp`, tested in Task 8). Nothing here is generated at runtime.

- [ ] **Step 1: Create `wireframe/template/package.json`**

```json
{
  "name": "wireframes",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.460.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-dropdown-menu": "^2.1.2"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Create `wireframe/template/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `wireframe/template/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `wireframe/template/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#111827",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create `wireframe/template/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `wireframe/template/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": false
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 7: Create `wireframe/template/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Create `wireframe/template/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Create `wireframe/template/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wireframes",
  description: "Generated by sandwich/wireframe",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Verify every JSON file parses**

Run: `for f in wireframe/template/package.json wireframe/template/tsconfig.json wireframe/template/components.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('$f OK')"; done`
Expected: three lines each ending in `OK`.

- [ ] **Step 11: Commit**

```bash
git add wireframe/template/package.json wireframe/template/tsconfig.json wireframe/template/next.config.ts wireframe/template/tailwind.config.ts wireframe/template/postcss.config.js wireframe/template/components.json wireframe/template/lib/utils.ts wireframe/template/app/layout.tsx wireframe/template/app/globals.css
git commit -m "feat(wireframe): Next.js app template skeleton"
```

---

### Task 6: shadcn primitives — no Radix dependency

**Files:**
- Create: `wireframe/template/components/ui/button.tsx`
- Create: `wireframe/template/components/ui/input.tsx`
- Create: `wireframe/template/components/ui/label.tsx`
- Create: `wireframe/template/components/ui/textarea.tsx`
- Create: `wireframe/template/components/ui/card.tsx`
- Create: `wireframe/template/components/ui/badge.tsx`
- Create: `wireframe/template/components/ui/separator.tsx`
- Create: `wireframe/template/components/ui/table.tsx`

These compose only against `@/lib/utils` (Task 5) — no Radix packages needed for this set. Consumed later by the composite starter kit (Task 8) and by every agent-generated screen (Task 12/13).

- [ ] **Step 1: Create `wireframe/template/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand/90",
        outline: "border border-gray-300 bg-white hover:bg-gray-50",
        ghost: "hover:bg-gray-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";
```

Note for later tasks: to style a `next/link` as a button (e.g. an action that navigates to another screen), import `buttonVariants` and apply it to the `<Link>`'s `className` directly — don't wrap `<Button>` around `<Link>`.

- [ ] **Step 2: Create `wireframe/template/components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

- [ ] **Step 3: Create `wireframe/template/components/ui/label.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
  )
);
Label.displayName = "Label";
```

- [ ] **Step 4: Create `wireframe/template/components/ui/textarea.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
```

- [ ] **Step 5: Create `wireframe/template/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-gray-200 bg-white shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-gray-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
```

- [ ] **Step 6: Create `wireframe/template/components/ui/badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-white",
        outline: "border-gray-300 text-gray-700",
        secondary: "border-transparent bg-gray-100 text-gray-900",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
```

- [ ] **Step 7: Create `wireframe/template/components/ui/separator.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={cn(
        "shrink-0 bg-gray-200",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 8: Create `wireframe/template/components/ui/table.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-gray-200 transition-colors hover:bg-gray-50", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-10 px-2 text-left align-middle font-medium text-gray-500", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-2 align-middle", className)} {...props} />;
}
```

- [ ] **Step 9: Verify each file exports what later tasks expect**

Run: `grep -l "^export" wireframe/template/components/ui/{button,input,label,textarea,card,badge,separator,table}.tsx | wc -l`
Expected: `8`

- [ ] **Step 10: Commit**

```bash
git add wireframe/template/components/ui/button.tsx wireframe/template/components/ui/input.tsx wireframe/template/components/ui/label.tsx wireframe/template/components/ui/textarea.tsx wireframe/template/components/ui/card.tsx wireframe/template/components/ui/badge.tsx wireframe/template/components/ui/separator.tsx wireframe/template/components/ui/table.tsx
git commit -m "feat(wireframe): shadcn primitives (button, input, label, textarea, card, badge, separator, table)"
```

---

### Task 7: shadcn primitives — Radix-based (select, dialog, avatar, dropdown-menu)

**Files:**
- Create: `wireframe/template/components/ui/select.tsx`
- Create: `wireframe/template/components/ui/dialog.tsx`
- Create: `wireframe/template/components/ui/avatar.tsx`
- Create: `wireframe/template/components/ui/dropdown-menu.tsx`

**Interfaces:**
- Consumes: `@radix-ui/react-select`, `@radix-ui/react-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`, `lucide-react` (all already declared in `wireframe/template/package.json` from Task 5).

- [ ] **Step 1: Create `wireframe/template/components/ui/select.tsx`**

```tsx
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
```

- [ ] **Step 2: Create `wireframe/template/components/ui/dialog.tsx`**

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-gray-500", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
```

- [ ] **Step 3: Create `wireframe/template/components/ui/avatar.tsx`**

```tsx
"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-sm font-medium", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;
```

- [ ] **Step 4: Create `wireframe/template/components/ui/dropdown-menu.tsx`**

```tsx
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-md",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-gray-100",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-gray-200", className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
```

- [ ] **Step 5: Verify each file exports what later tasks expect**

Run: `grep -l "^export" wireframe/template/components/ui/{select,dialog,avatar,dropdown-menu}.tsx | wc -l`
Expected: `4`

- [ ] **Step 6: Commit**

```bash
git add wireframe/template/components/ui/select.tsx wireframe/template/components/ui/dialog.tsx wireframe/template/components/ui/avatar.tsx wireframe/template/components/ui/dropdown-menu.tsx
git commit -m "feat(wireframe): shadcn Radix-based primitives (select, dialog, avatar, dropdown-menu)"
```

---

### Task 8: Composite starter kit (`components/wireframe/*`)

**Files:**
- Create: `wireframe/template/components/wireframe/Navbar.tsx`
- Create: `wireframe/template/components/wireframe/PageShell.tsx`
- Create: `wireframe/template/components/wireframe/PageHeader.tsx`
- Create: `wireframe/template/components/wireframe/EmptyState.tsx`

**Interfaces:**
- Produces: `Navbar({ title?, links? })`, `PageShell({ children })`, `PageHeader({ title, description? })`, `EmptyState({ title, description? })` — the fixed, never-regenerated composite layer every generated screen composes from.
- Consumed by: Task 9 (renderNavHubPage imports `PageShell`/`PageHeader`), Task 12 (write-screen-tsx agent prompt instructs using these), Task 13 (workflow).

- [ ] **Step 1: Create `wireframe/template/components/wireframe/Navbar.tsx`**

```tsx
import Link from "next/link";

export interface NavbarProps {
  title?: string;
  links?: { href: string; label: string }[];
}

export function Navbar({ title = "Wireframes", links = [] }: NavbarProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-base font-semibold text-gray-900">
          {title}
        </Link>
        <nav className="flex gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-gray-600 hover:text-gray-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `wireframe/template/components/wireframe/PageShell.tsx`**

```tsx
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>;
}
```

- [ ] **Step 3: Create `wireframe/template/components/wireframe/PageHeader.tsx`**

```tsx
export interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Create `wireframe/template/components/wireframe/EmptyState.tsx`**

```tsx
export interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-6 py-16 text-center">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Verify each file exports what later tasks expect**

Run: `grep -l "^export function" wireframe/template/components/wireframe/{Navbar,PageShell,PageHeader,EmptyState}.tsx | wc -l`
Expected: `4`

- [ ] **Step 6: Commit**

```bash
git add wireframe/template/components/wireframe/Navbar.tsx wireframe/template/components/wireframe/PageShell.tsx wireframe/template/components/wireframe/PageHeader.tsx wireframe/template/components/wireframe/EmptyState.tsx
git commit -m "feat(wireframe): fixed composite starter kit (Navbar, PageShell, PageHeader, EmptyState)"
```

---

### Task 9: Scaffold-copy integration test

**Files:**
- Modify: `wireframe/lib/wireframe.selfcheck.ts` (append after the Task 4 checks, before the render-check block)

**Interfaces:**
- Consumes: `scaffoldWireframeApp` (Task 4), `getWireframePaths` (Task 4), the real `wireframe/template/` directory (Tasks 5-8).

- [ ] **Step 1: Write the failing check**

In `wireframe/lib/wireframe.selfcheck.ts`, add this block immediately after the `ensureWireframeDir writes a gitignore...` check added in Task 4 (and before the `import { renderIndexHtml } from "./wireframe-render.ts";` line):

```ts
import { fileURLToPath } from "node:url";
import { dirname, join as pj2 } from "node:path";
import { scaffoldWireframeApp } from "./wireframe-lib.ts";

const REAL_TEMPLATE_DIR = pj2(dirname(fileURLToPath(import.meta.url)), "..", "template");

check("scaffoldWireframeApp copies the real template into a fresh project and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-scaffold-"));
  try {
    const created = scaffoldWireframeApp(REAL_TEMPLATE_DIR, dir);
    assert.ok(created.length > 10, "expected the full template tree to be copied");

    const paths = getWireframePaths(dir);
    assert.ok(existsSyncCheck(pj2(paths.root, "package.json")));
    assert.ok(existsSyncCheck(pj2(paths.root, "components", "ui", "button.tsx")));
    assert.ok(existsSyncCheck(pj2(paths.root, "components", "wireframe", "Navbar.tsx")));
    assert.ok(existsSyncCheck(pj2(paths.root, "app", "layout.tsx")));

    const buttonSrc = readFileSync(pj2(paths.root, "components", "ui", "button.tsx"), "utf8");
    assert.ok(buttonSrc.includes("export const Button"));

    // Simulate a human hand-editing a scaffolded file, then re-run — must not be clobbered.
    writeFileSync(pj2(paths.root, "components", "wireframe", "Navbar.tsx"), "// hand-edited\n", "utf8");
    scaffoldWireframeApp(REAL_TEMPLATE_DIR, dir);
    const navbarAfterRescaffold = readFileSync(pj2(paths.root, "components", "wireframe", "Navbar.tsx"), "utf8");
    assert.equal(navbarAfterRescaffold, "// hand-edited\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function existsSyncCheck(p: string): boolean {
  return require("node:fs").existsSync(p);
}
```

- [ ] **Step 2: Fix the `require` and duplicate-import issues before running**

`wireframe.selfcheck.ts` only `import`s — no `require`. Replace the `existsSyncCheck` helper's body to use an imported `existsSync` instead. At the top of the file, the very first `check`'s imports already bring in `mkdtempSync, rmSync, writeFileSync, readFileSync` from `node:fs` (per Task 4, Step 4) — extend that same import statement to add `existsSync`:

```ts
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
```

then delete the `existsSyncCheck` helper entirely and replace its call sites with `existsSync` directly:

```ts
    assert.ok(existsSync(pj2(paths.root, "package.json")));
    assert.ok(existsSync(pj2(paths.root, "components", "ui", "button.tsx")));
    assert.ok(existsSync(pj2(paths.root, "components", "wireframe", "Navbar.tsx")));
    assert.ok(existsSync(pj2(paths.root, "app", "layout.tsx")));
```

- [ ] **Step 3: Run to verify it passes**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: the new scaffold check prints `✓`; the script still fails afterward on the old render checks (`file`/`renderIndexHtml`) — expected, Task 10 fixes those next.

- [ ] **Step 4: Commit**

```bash
git add wireframe/lib/wireframe.selfcheck.ts
git commit -m "test(wireframe): cover scaffoldWireframeApp against the real template dir"
```

---

### Task 10: Wireframe render v2 — `renderNavHubPage`

**Files:**
- Modify: `wireframe/lib/wireframe-render.ts` (whole file)
- Modify: `wireframe/lib/wireframe.selfcheck.ts:131-149` (render checks, final block)

**Interfaces:**
- Consumes: `Screen`/`WireframeManifest` from Task 3.
- Produces: `renderNavHubPage(manifest: WireframeManifest): string` (replaces `renderIndexHtml`) — returns the full TSX source of `app/page.tsx`, importing `Link` from `next/link` and `PageShell`/`PageHeader` from `@/components/wireframe/*` (Task 8).
- Consumed by: Task 11 (`scripts/render.ts`), Task 13 (`wireframe.workflow.ts`).

- [ ] **Step 1: Write the failing checks**

In `wireframe/lib/wireframe.selfcheck.ts`, replace the final block (originally lines 131-149, now shifted later in the file after Tasks 4 and 9's additions — find it by the `import { renderIndexHtml } from "./wireframe-render.ts";` line through the end of the file before `console.log`):

```ts
import { renderIndexHtml } from "./wireframe-render.ts";

const RENDERED_SCREEN = { id: "SCR-001", name: "Homepage", file: "homepage.html", flows: ["UF-001"], flags: { stale: false, orphaned: false }, staleReasons: [] };

check("renderIndexHtml emits a link and name for every screen in the manifest", () => {
  const html = renderIndexHtml({ screens: [RENDERED_SCREEN] });
  assert.ok(html.includes('href="homepage.html"'));
  assert.ok(html.includes("Homepage"));
});
check("renderIndexHtml surfaces the stale flag as a visible badge", () => {
  const html = renderIndexHtml({ screens: [{ ...RENDERED_SCREEN, flags: { stale: true, orphaned: false }, staleReasons: ["UF-001 content changed"] }] });
  assert.ok(html.includes("STALE"));
});
check("renderIndexHtml surfaces the orphaned flag as a visible badge", () => {
  const html = renderIndexHtml({ screens: [{ ...RENDERED_SCREEN, flags: { stale: false, orphaned: true }, staleReasons: [] }] });
  assert.ok(html.includes("ORPHANED"));
});

console.log(`\n${n} wireframe checks passed.`);
```

with:

```ts
import { renderNavHubPage } from "./wireframe-render.ts";

const RENDERED_SCREEN = { id: "SCR-001", name: "Homepage", route: "/homepage", flows: ["UF-001"], navigatesTo: [], flags: { stale: false, orphaned: false }, staleReasons: [] };

check("renderNavHubPage emits a Link and name for every screen in the manifest", () => {
  const tsx = renderNavHubPage({ screens: [RENDERED_SCREEN] });
  assert.ok(tsx.includes('href={"/homepage"}'));
  assert.ok(tsx.includes('"Homepage"'));
  assert.ok(tsx.includes('import Link from "next/link"'));
});
check("renderNavHubPage surfaces the stale flag inline with the name", () => {
  const tsx = renderNavHubPage({ screens: [{ ...RENDERED_SCREEN, flags: { stale: true, orphaned: false }, staleReasons: ["UF-001 content changed"] }] });
  assert.ok(tsx.includes("STALE"));
});
check("renderNavHubPage surfaces the orphaned flag inline with the name", () => {
  const tsx = renderNavHubPage({ screens: [{ ...RENDERED_SCREEN, flags: { stale: false, orphaned: true }, staleReasons: [] }] });
  assert.ok(tsx.includes("ORPHANED"));
});

console.log(`\n${n} wireframe checks passed.`);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: fails — `wireframe-render.ts` still exports `renderIndexHtml`, not `renderNavHubPage`, so the import itself resolves to `undefined` and calling it throws.

- [ ] **Step 3: Update the renderer**

Replace the entire contents of `wireframe/lib/wireframe-render.ts`:

```ts
import type { WireframeManifest } from "./wireframe-schemas.js";

type ManifestScreen = WireframeManifest["screens"][number];

function screenLink(s: ManifestScreen): string {
  const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
    .filter(Boolean)
    .join(" · ");
  const label = flags ? `${s.name} (${flags})` : s.name;
  return `        <Link href={${JSON.stringify(s.route)}} className="block w-full p-4 border border-gray-200 hover:border-brand hover:bg-gray-50 transition rounded-md">
          <p className="text-base font-semibold text-brand">{${JSON.stringify(label)}}</p>
          <p className="text-xs text-gray-500 mt-1">{${JSON.stringify(s.flows.join(", "))}}</p>
        </Link>`;
}

export function renderNavHubPage(manifest: WireframeManifest): string {
  const items = manifest.screens.map(screenLink).join("\n");

  return `import Link from "next/link";
import { PageShell } from "@/components/wireframe/PageShell";
import { PageHeader } from "@/components/wireframe/PageHeader";

export default function Home() {
  return (
    <PageShell>
      <PageHeader title="Wireframes" />
      <div className="space-y-3">
${items}
      </div>
    </PageShell>
  );
}
`;
}
```

Note: screen `name`/`flows` are embedded via `JSON.stringify(...)` inside a JSX expression (`{...}`) rather than as raw text, so any quotes/braces in agent-generated names can't break the generated TSX's syntax.

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: all checks pass, ends with `N wireframe checks passed.`

- [ ] **Step 5: Commit**

```bash
git add wireframe/lib/wireframe-render.ts wireframe/lib/wireframe.selfcheck.ts
git commit -m "feat(wireframe): renderNavHubPage replaces renderIndexHtml"
```

---

### Task 11: `wireframe/scripts/render.ts` v2

**Files:**
- Modify: `wireframe/scripts/render.ts` (whole file)

**Interfaces:**
- Consumes: `validateWireframeManifest` (Task 3), `renderNavHubPage` (Task 10), `ensureWireframeDir`/`getWireframePaths`/`routeToFilePath` (Task 4).

- [ ] **Step 1: Update the script**

Replace the entire contents of `wireframe/scripts/render.ts`:

```ts
#!/usr/bin/env node
// Deterministic renderer for wireframe artifacts.
// Usage: node --experimental-strip-types wireframe/scripts/render.ts [project-root]
//
// Reads manifest.json from wireframes/, validates against the Zod schema,
// and renders app/page.tsx (the nav hub) deterministically. Never touches
// screen route files. Exit 0 on success, exit 1 on validation failure
// (prints the exact errors).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateWireframeManifest } from "../lib/wireframe-schemas.ts";
import { renderNavHubPage } from "../lib/wireframe-render.ts";
import { ensureWireframeDir, getWireframePaths, routeToFilePath } from "../lib/wireframe-lib.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const paths = getWireframePaths(projectRoot);

if (!existsSync(paths.manifest)) {
  console.error(`✗ ${paths.manifest} not found — write manifest.json first, then run this script.`);
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(paths.manifest, "utf8"));
} catch (e) {
  console.error(`✗ ${paths.manifest} is not valid JSON: ${e}`);
  process.exit(1);
}

const result = validateWireframeManifest(parsed);
if (!result.valid) {
  console.error(`✗ manifest.json validation failed:\n${result.errors.join("\n")}`);
  process.exit(1);
}

for (const screen of result.data!.screens) {
  const screenPath = resolve(paths.root, routeToFilePath(screen.route));
  if (!existsSync(screenPath)) {
    console.error(`⚠ manifest references a missing screen file for route ${screen.route} (${screen.id}) — the file was deleted from disk but is still listed in the manifest`);
  }
}

ensureWireframeDir(projectRoot);
writeFileSync(paths.navHubPage, renderNavHubPage(result.data!), "utf8");
console.log(`✓ ${paths.navHubPage}`);
```

- [ ] **Step 2: Manually verify against a fixture project**

Run:
```bash
mkdir -p /tmp/wireframe-render-check/wireframes
cat > /tmp/wireframe-render-check/wireframes/manifest.json <<'EOF'
{ "screens": [{ "id": "SCR-001", "name": "Homepage", "route": "/homepage", "flows": ["UF-001"], "navigatesTo": [], "flags": { "stale": false, "orphaned": false }, "staleReasons": [] }] }
EOF
node --experimental-strip-types wireframe/scripts/render.ts /tmp/wireframe-render-check
cat /tmp/wireframe-render-check/wireframes/app/page.tsx
rm -rf /tmp/wireframe-render-check
```
Expected: `✓ /tmp/wireframe-render-check/wireframes/app/page.tsx`, and the printed file contains `import Link from "next/link";` and `href={"/homepage"}`. No `⚠` warning line (the manifest's only screen route has no backing file, so the warning IS expected here — confirm it prints exactly one `⚠` line referencing `SCR-001` before the `✓` line).

- [ ] **Step 3: Commit**

```bash
git add wireframe/scripts/render.ts
git commit -m "feat(wireframe): render.ts targets wireframes/ and route-derived paths"
```

---

### Task 12: Agent prompts — grouping, screen generation, gap flagging

**Files:**
- Modify: `wireframe/agents/01-group-flows-into-screens.md`
- Delete: `wireframe/agents/02-write-screen-html.md`
- Create: `wireframe/agents/02-write-screen-tsx.md`
- Create: `wireframe/agents/03-flag-screen-gaps.md`

These are LLM prompt files, not executable code — there's no automated test for them (matching the existing convention: `order/agents/*.md` and the original `wireframe/agents/*.md` were never covered by `*.selfcheck.ts` either). Verification is a manual content review against the JSON contract Task 13's workflow sends/expects.

- [ ] **Step 1: Rewrite `wireframe/agents/01-group-flows-into-screens.md`**

Replace its entire contents:

```md
# Group Flows Into Screens

You receive `{ "newFlows": [...], "existingScreens": [{ "id": "SCR-XXX", "name": "...", "route": "/...", "flows": ["UF-XXX"] }] }`.

`newFlows` are user flows that need a screen and are not yet covered by any
existing screen. Decide, for each one, whether it fits naturally onto an
`existingScreens` entry (e.g. a new "filter products" flow probably belongs
on the same screen as an existing "browse products" flow) or needs a
brand-new screen.

Do NOT ask questions. Your response must START with `{` — no preamble, no
markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape — **only include
brand-new screens you are proposing**, not the existing ones:

```json
{
  "screens": [
    { "id": "SCR-004", "name": "Product Listing Page", "route": "/plp", "flows": ["UF-004", "UF-005"], "navigatesTo": ["SCR-002"] }
  ]
}
```

## Rules

- `id` MUST be `SCR-` followed by three digits, continuing the sequence
  after the highest id in `existingScreens` (start at `SCR-001` if none exist).
- `route` is a lowercase-hyphenated URL path starting with `/` (e.g. `/plp`,
  `/checkout`), and must be unique across both `existingScreens` and your
  new proposals. The homepage/nav-hub always owns `/` — never propose that
  route for a screen.
- Every id in `newFlows` must appear in exactly one screen's `flows` array —
  either an existing screen (which you don't need to repeat in your output)
  or one of your new screens.
- `navigatesTo` lists the ids of other screens (existing or among your new
  proposals) that this screen's primary action should link to, inferred
  from the flow's `outcome` (e.g. an "item added to cart" outcome implies a
  link to whichever screen serves the cart flow). Leave it `[]` if no
  screen a user would navigate to next exists yet.
- Prefer fewer, well-organized screens over one screen per flow. A
  multi-step process (e.g. a 2-step checkout) is still one screen.
- Output ONLY the JSON object.
```

- [ ] **Step 2: Remove the old screen-writing prompt**

Run: `git rm wireframe/agents/02-write-screen-html.md`

- [ ] **Step 3: Create `wireframe/agents/02-write-screen-tsx.md`**

```md
# Write Screen TSX

You receive `{ "screen": { "id": "SCR-XXX", "name": "...", "route": "/...", "flows": [...], "navigatesTo": ["SCR-XXX"] }, "flowDetails": [{ "id": "UF-XXX", "title": "...", "actor": "...", "trigger": "...", "steps": [{ "text": "...", "fields": [{ "name": "...", "type": "...", "required": true, "options": [...] }] }], "outcome": "..." }], "navigationTargets": [{ "id": "SCR-XXX", "route": "/..." }] }`.

Write a single Next.js App Router page component for this screen, as a
`.tsx` file, importing only from the project's existing shared components —
never invent new primitives.

## Rules

- Output ONLY the TSX source — no markdown fences, no explanation, no
  preamble or trailing commentary. The file must start with an `import`
  statement.
- Default-export a single component: `export default function Page() { ... }`.
- Import shared UI only from `@/components/ui/*` (Button, Input, Label,
  Textarea, Card + subcomponents, Badge, Separator, Table, Select, Dialog,
  Avatar, DropdownMenu — use only components that exist; do not invent new
  ones) and `@/components/wireframe/*` (Navbar, PageShell, PageHeader,
  EmptyState). Wrap the screen body in `<PageShell>` and start with
  `<PageHeader title="..." />`.
- Cover every flow in `flowDetails` — each flow's `steps` should be visibly
  represented as elements or states on the screen. For any step with a
  `fields` array, render one labeled input per field using `Label` + the
  matching input component (`Input` for text/email/number/date, `Textarea`
  for textarea, `Select` for select using the step's `options`, a checkbox
  `Input type="checkbox"` for checkbox), marking `required` fields visually
  (e.g. a `*` after the label).
- For any action that should navigate to another screen, use `next/link`'s
  `<Link href="...">` with the target's `route` from `navigationTargets`
  (matched by the screen's `navigatesTo` ids), styled with `buttonVariants`
  from `@/components/ui/button` (e.g.
  `<Link href={targetRoute} className={buttonVariants({ variant: "default" })}>Add to cart</Link>`)
  rather than wrapping a `<Button>` around it.
- Use the client's own terminology from `title`/`actor`/`steps`/`outcome` —
  do not translate or rename them.
- This is a wireframe, not a final design: prioritize showing structure
  and content over pixel-perfect visuals. Placeholder text is fine where
  the flow doesn't specify exact copy.
```

- [ ] **Step 4: Create `wireframe/agents/03-flag-screen-gaps.md`**

```md
# Flag Screen Gaps

You receive `{ "projectType": "...", "actors": ["..."], "modules": [{ "name": "...", "description": "..." }], "existingScreens": [{ "id": "SCR-XXX", "name": "..." }] }`.

Identify commonly-expected supporting screens for a project of this kind
that are **not** covered by any `existingScreens` entry — e.g. login/auth,
404/not-found, an empty-state for a list screen, account/settings. Judge
from `actors` and `modules`, not from a fixed checklist — a project with no
`Admin` actor doesn't need an admin screen flagged.

Do NOT ask questions. Your response must START with `{` — no preamble, no
markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "gaps": ["Login", "404 / Not found", "Account settings"]
}
```

## Rules

- Each entry is a short human-readable screen name, not an id — these are
  suggestions for a human to consider, not screens this pipeline will
  generate.
- Output `{ "gaps": [] }` if you can't identify any reasonable gap — don't
  pad the list to seem thorough.
- Output ONLY the JSON object.
```

- [ ] **Step 5: Verify the JSON contracts line up with the schemas**

Run: `grep -c '"route"' wireframe/agents/01-group-flows-into-screens.md wireframe/agents/02-write-screen-tsx.md` and confirm both are non-zero; run `grep -c '"gaps"' wireframe/agents/03-flag-screen-gaps.md` and confirm it's non-zero.

- [ ] **Step 6: Commit**

```bash
git add wireframe/agents/01-group-flows-into-screens.md wireframe/agents/02-write-screen-html.md wireframe/agents/02-write-screen-tsx.md wireframe/agents/03-flag-screen-gaps.md
git commit -m "feat(wireframe): rewrite agent prompts for route/navigatesTo, TSX output, and gap flagging"
```

---

### Task 13: `wireframe.workflow.ts` rewrite

**Files:**
- Modify: `wireframe/workflow/wireframe.workflow.ts` (whole file)

**Interfaces:**
- Consumes: everything from Tasks 4, 10, 12 (`scaffoldWireframeApp`, `routeToFilePath`, `getWireframePaths`, `ensureWireframeDir`, `readManifest`, `writeManifest`, `readSnapshot`, `writeSnapshot`, `diffFlows`, `validateWireframeManifest`, `renderNavHubPage`, `readOrderDocs`), plus the pi-harness globals `phase()`, `agent()`, `parallel()`, `log()` (unchanged, injected at runtime — not unit-testable outside the pi harness, same as the pre-existing file).

- [ ] **Step 1: Rewrite the workflow**

Replace the entire contents of `wireframe/workflow/wireframe.workflow.ts`:

```ts
export const meta = {
  name: "wireframe",
  description: "Generate a Next.js + shadcn wireframe app from /order's needsUI user flows, grouped by UF-XXX flow ids, with real navigation between screens, without ever overwriting an existing screen",
  phases: [
    { title: "Detect", detail: "check prerequisites and load needsUI flows" },
    { title: "Scaffold", detail: "create the Next.js + shadcn app on first run only" },
    { title: "Diff", detail: "compare against the last snapshot to find new/changed/removed flows" },
    { title: "Group", detail: "propose a flow-to-screen grouping and navigation for any new flows" },
    { title: "Gaps", detail: "flag commonly-expected screens missing from the input (report only)" },
    { title: "Generate", detail: "write TSX for new screens only" },
    { title: "Write", detail: "write manifest.json, .snapshot.json, and the nav hub page" },
  ],
};

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { readOrderDocs } from "../../order/lib/order-lib.js";
import {
  getWireframePaths,
  ensureWireframeDir,
  readManifest,
  writeManifest,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  scaffoldWireframeApp,
  routeToFilePath,
  type NeedsUIFlow,
} from "../lib/wireframe-lib.js";
import { validateWireframeManifest, type Screen } from "../lib/wireframe-schemas.js";
import { renderNavHubPage } from "../lib/wireframe-render.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");
const templateDir = resolve(workflowDir, "../template");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

interface ScreenDraft {
  id: string;
  name: string;
  route: string;
  flows: string[];
  navigatesTo?: string[];
}

const projectRoot = process.cwd();

// Phase 1: Detect
phase("Detect");
const { userFlows, prd } = readOrderDocs(projectRoot);
if (!userFlows) {
  throw new Error("docs/sandwich/user-flows.json not found — run /order first.");
}
const needsUIFlows: NeedsUIFlow[] = userFlows.flows
  .filter((f) => f.needsUI)
  .map((f) => ({ id: f.id, title: f.title, actor: f.actor, trigger: f.trigger, steps: f.steps, outcome: f.outcome }));
log(`${needsUIFlows.length} of ${userFlows.flows.length} flows need a screen`);

const existingManifest = readManifest(projectRoot);
if (needsUIFlows.length === 0 && (existingManifest?.screens.length ?? 0) === 0) {
  log("No needsUI flows found and no existing manifest — nothing to wireframe yet.");
  return { manifest: null, screensCreated: 0, stale: 0, orphaned: 0 };
}

// Phase 2: Scaffold — only on the very first run
phase("Scaffold");
if (!existingManifest) {
  const created = scaffoldWireframeApp(templateDir, projectRoot);
  log(`Scaffolded Next.js + shadcn app: ${created.length} files`);
} else {
  log("App already scaffolded — skipping");
}

// Phase 3: Diff
phase("Diff");
const snapshot = readSnapshot(projectRoot);
const diff = diffFlows(needsUIFlows, snapshot);
log(`new: ${diff.newIds.size} | changed: ${diff.changedIds.size} | removed: ${diff.removedIds.size}`);

let screens: Screen[] = (existingManifest?.screens ?? []).map((s) => {
  const staleReasons = s.flows.filter((id) => diff.changedIds.has(id)).map((id) => `${id} content changed`);
  const stillLive = s.flows.some((id) => !diff.removedIds.has(id));
  return {
    ...s,
    flags: { stale: staleReasons.length > 0, orphaned: !stillLive },
    staleReasons,
  };
});

// Phase 4: Group — only brand-new flows need a screen proposed
phase("Group");
const newFlows = needsUIFlows.filter((f) => diff.newIds.has(f.id));
let newScreens: ScreenDraft[] = [];
if (newFlows.length > 0) {
  const existingScreenSummaries = screens.map((s) => ({ id: s.id, name: s.name, route: s.route, flows: s.flows }));
  const groupingRaw = await agent(
    `${readAgent("01-group-flows-into-screens.md")}\n\nContext:\n${JSON.stringify(
      { newFlows, existingScreens: existingScreenSummaries },
      null,
      2
    )}`,
    { label: "group-flows-into-screens", phase: "Group" }
  );
  const grouping = JSON.parse(groupingRaw ?? "{}");
  newScreens = (grouping.screens ?? []) as ScreenDraft[];
  log(`Proposed ${newScreens.length} new screen(s)`);
} else {
  log("No new flows — nothing to group");
}

// Guard: a proposed new screen must never claim a route an existing screen already owns —
// doing so would silently overwrite that screen's real page.tsx on write.
for (const newScreen of newScreens) {
  const collision = screens.find((s) => s.route === newScreen.route);
  if (collision) {
    throw new Error(
      `Route collision: proposed new screen "${newScreen.id}" wants route "${newScreen.route}", which is already used by existing screen "${collision.id}". Refusing to write.`
    );
  }
}

// Phase 5: Gaps — report-only, never written to disk
phase("Gaps");
const allScreensForGaps = [...screens, ...newScreens].map((s) => ({ id: s.id, name: s.name }));
let gaps: string[] = [];
if (prd) {
  const gapsRaw = await agent(
    `${readAgent("03-flag-screen-gaps.md")}\n\nContext:\n${JSON.stringify(
      {
        projectType: prd.overview,
        actors: prd.actors.map((a) => a.name),
        modules: prd.modules.map((m) => ({ name: m.name, description: m.description })),
        existingScreens: allScreensForGaps,
      },
      null,
      2
    )}`,
    { label: "flag-screen-gaps", phase: "Gaps" }
  );
  gaps = (JSON.parse(gapsRaw ?? "{}").gaps ?? []) as string[];
}

// Phase 6: Generate — one TSX file per new screen, in parallel
phase("Generate");
const flowById = new Map(needsUIFlows.map((f) => [f.id, f]));
const allScreensById = new Map([...screens, ...newScreens].map((s) => [s.id, s]));
const tsxByFilePath = new Map<string, string>();
if (newScreens.length > 0) {
  const files = await parallel(
    newScreens.map((screen) => async () => {
      const flowDetails = screen.flows.map((id) => flowById.get(id)).filter(Boolean);
      const navigationTargets = (screen.navigatesTo ?? [])
        .map((id) => allScreensById.get(id))
        .filter(Boolean)
        .map((s) => ({ id: s!.id, route: s!.route }));
      const tsx = await agent(
        `${readAgent("02-write-screen-tsx.md")}\n\nContext:\n${JSON.stringify(
          { screen, flowDetails, navigationTargets },
          null,
          2
        )}`,
        { label: `write-${screen.route}`, phase: "Generate" }
      );
      return { filePath: routeToFilePath(screen.route), tsx: tsx ?? "" };
    })
  );
  for (const { filePath, tsx } of files) tsxByFilePath.set(filePath, tsx);
}

// Phase 7: Write — manifest, snapshot, screen files (new only), nav hub page
phase("Write");
ensureWireframeDir(projectRoot);
const paths = getWireframePaths(projectRoot);

for (const [filePath, tsx] of tsxByFilePath) {
  const fullPath = join(paths.root, filePath);
  writeFileSync(fullPath, tsx, "utf8");
  log(`✓ ${fullPath}`);
}

const finalManifestDraft = {
  screens: [...screens, ...newScreens.map((s) => ({ ...s, navigatesTo: s.navigatesTo ?? [] }))],
};
const validation = validateWireframeManifest(finalManifestDraft);
if (!validation.valid) {
  throw new Error(`manifest.json validation failed: ${validation.errors.join("; ")}`);
}

writeManifest(projectRoot, validation.data!);
writeSnapshot(projectRoot, needsUIFlows);
writeFileSync(paths.navHubPage, renderNavHubPage(validation.data!), "utf8");

log(`✓ ${paths.manifest}`);
log(`✓ ${paths.navHubPage}`);
if (gaps.length > 0) {
  log(`\nGaps to consider (not generated): ${gaps.join(", ")}`);
}

const staleCount = screens.filter((s) => s.flags.stale).length;
const orphanedCount = screens.filter((s) => s.flags.orphaned).length;
log(
  `\nScreens created: ${newScreens.length} | stale: ${staleCount} | orphaned: ${orphanedCount} | unchanged: ${
    screens.length - staleCount - orphanedCount
  }`
);

return { manifest: validation.data, screensCreated: newScreens.length, stale: staleCount, orphaned: orphanedCount, gaps };
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --experimental-strip-types --check wireframe/workflow/wireframe.workflow.ts`
Expected: no output, exit code 0 (this only parses the file — `phase`/`agent`/`parallel`/`log` are pi-harness globals not available outside it, so the file can't be *executed* standalone; `--check` catches syntax errors without needing them defined).

- [ ] **Step 3: Commit**

```bash
git add wireframe/workflow/wireframe.workflow.ts
git commit -m "feat(wireframe): workflow v2 — scaffold, route/navigatesTo grouping, gap flagging, TSX generation"
```

---

### Task 14: `wireframe/skills/wireframe/SKILL.md` rewrite

**Files:**
- Modify: `wireframe/skills/wireframe/SKILL.md` (whole file)

- [ ] **Step 1: Rewrite the skill doc**

Replace the entire contents of `wireframe/skills/wireframe/SKILL.md`:

```md
---
name: wireframe
description: Turn /order's needsUI user flows into a real Next.js + shadcn wireframe app, tracked in a manifest that flags staleness instead of silently overwriting hand-tuned screens. Use ONLY when explicitly invoked with /wireframe, after /order has run and before /prep.
---

# /wireframe

You are generating a wireframe app. Your job: produce a Next.js + shadcn app
in `wireframes/` from the `needsUI` flows in `docs/sandwich/user-flows.json`,
tracked by a manifest that never lets a re-run silently overwrite a screen
a human may have hand-tuned.

## When to invoke

- User runs `/wireframe`
- User asks to "wireframe this" / "buatkan wireframe" after a brief exists
- Do NOT invoke before `/order` has produced `docs/sandwich/user-flows.json`
- Do NOT invoke as part of `/order` or `/prep` — it is a separate step between them

## Prerequisite check

If `docs/sandwich/user-flows.json` does not exist, stop immediately and tell
the user to run `/order` first. Do not attempt to infer screens from raw
conversation.

## Artifacts

All written to `wireframes/` (a standalone Next.js app, sibling to `docs/`
and `.sandwich/` — not nested under `docs/`, since it has its own toolchain):

| File | Purpose |
|------|---------|
| `manifest.json` | Screen registry — source of truth for the screen↔flow mapping, navigation, and stale/orphaned flags |
| `app/page.tsx` | Nav hub, a pure projection of `manifest.json`, regenerated every run |
| `app/<route>/page.tsx` | One route per screen, written once and never overwritten |
| `components/ui/*` | shadcn primitives (Button, Card, Input, ...), scaffolded once, never regenerated |
| `components/wireframe/*` | Fixed composite starter kit (Navbar, PageShell, PageHeader, EmptyState), scaffolded once, never regenerated |
| `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts` | App scaffold, written once on the first run |
| `.snapshot.json` | Git-ignored, last-seen content hash per flow id — the diff baseline for the next run |

## Mode detection (automatic)

- **Fresh** — no `wireframes/manifest.json` yet. Scaffold the Next.js +
  shadcn app, group every `needsUI: true` flow into a sensible screen list,
  and write all screens.
- **Incremental** — `manifest.json` already exists. The app scaffold,
  shadcn primitives, and starter-kit components are never re-touched. Only
  new/changed/removed flows are acted on; existing screen files are never
  rewritten.

## Pipeline

1. **Prerequisite check** — per above.
2. **Read & filter** — load `docs/sandwich/user-flows.json`, keep only flows where `needsUI` is `true`.
3. **Scaffold (fresh mode only)** — copy the Next.js + shadcn app skeleton
   (config files, `components/ui/*`, `components/wireframe/*`) into
   `wireframes/`. Never re-run this on an incremental run.
4. **Load prior state** — read `wireframes/manifest.json` (if present) and `wireframes/.snapshot.json` (if present).
5. **Diff** — for each `needsUI` flow, compare its `{ trigger, steps, outcome }` against the snapshot:
   - Not in the snapshot at all → **new flow**, needs a screen.
   - In the snapshot but content differs → **changed flow**.
   - In the snapshot but no longer present (or flipped to `needsUI: false`) → **removed flow**.
6. **Apply flags to existing screens** — for every screen already in the manifest:
   - If any of its flows is a *changed flow*, set `flags.stale = true` and append a reason like `"UF-004 content changed"` to `staleReasons`. **Do not touch that screen's `page.tsx`.**
   - If every one of its flows is a *removed flow*, set `flags.orphaned = true`.
   - Otherwise, clear `stale`/`orphaned` and `staleReasons` back to their defaults.
7. **Group new flows into screens** — for *new flows* only, decide whether each fits an existing screen (add its id to that screen's `flows` array) or needs a brand-new screen (assign the next `SCR-XXX` id, a short `name`, and a `route` — lowercase, hyphenated, leading `/`). Also infer `navigatesTo`: which other screens this screen's primary actions should link to, from each flow's `outcome`. Flows and screens are not 1:1: several flows commonly share one screen (e.g. browse vs. filter both landing on a product listing page), and one flow may need a multi-step single screen.
8. **Flag gaps (report only)** — propose commonly-expected supporting screens not covered by any current flow (login, 404, empty states, settings), judged from the PRD's actors/modules. Report these; never generate them.
9. **Write TSX for new screens only** — one `page.tsx` per brand-new screen under `wireframes/app/<route>/`, composed from `components/ui/*` + `components/wireframe/*`, with real `next/link` navigation for anything in `navigatesTo`. Never write to a `route` that already exists on disk.
10. **Write `manifest.json`** — the full screen list (existing + new), matching the schema below exactly. Validate it:
    ```bash
    node --experimental-strip-types $SANDWICH_ROOT/wireframe/scripts/render.ts
    ```
    `SANDWICH_ROOT` is injected into your context at session start as plain
    text (e.g. `SANDWICH_ROOT=/path/to/plugin`) — it is NOT a live shell
    environment variable. Read the path from your context and substitute it
    literally in place of `$SANDWICH_ROOT` above before running.
    If validation fails, the script prints the exact errors — fix the JSON and re-run.
11. **Report** — screens created / flagged stale (with reasons) / orphaned / unchanged / gaps to consider.

The load-bearing invariant: the only files this pipeline ever writes are
`manifest.json`, `.snapshot.json`, `app/page.tsx`, and brand-new screen
route files — plus the one-time app scaffold on the very first run. Every
code path that detects a change on an *existing* screen sets a flag — it
never edits that screen's `page.tsx`.

## Viewing the result

This pipeline only generates/updates the app source. To view it:

```bash
cd wireframes && npm install && npm run dev
```

Deploying it (e.g. to Vercel) is a manual follow-up step outside this
skill's scope.

## Output

```
✓ wireframes/manifest.json
✓ wireframes/app/page.tsx
✓ wireframes/app/<new-screen-1>/page.tsx
✓ wireframes/app/<new-screen-2>/page.tsx

[one sentence: N screens created, N flagged stale, N orphaned, N unchanged]
[if any: Gaps to consider (not generated): Login, 404/Not found, Settings]
```

## Shared wireframe aesthetic

- Next.js App Router + shadcn/ui components (`components/ui/*`), scaffolded once
- A small fixed composite starter kit (`components/wireframe/*`: Navbar, PageShell, PageHeader, EmptyState) — every screen composes from these plus shadcn primitives, never hand-rolled markup for things they already cover
- Typography: system-ui font stack via Tailwind defaults
- Grayscale-first palette; a single `brand` color for primary actions
- Real navigation: primary actions that logically lead to another screen use `next/link`, not dead links

## Output schema (MANDATORY)

**Exact schema. Do not invent field names. Do not add extra wrappers.**
`manifest.json` must start with `{` — no markdown fences, no preamble.

```json
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "Homepage",
      "route": "/homepage",
      "flows": ["UF-001", "UF-002"],
      "navigatesTo": ["SCR-002"],
      "flags": { "stale": false, "orphaned": false },
      "staleReasons": []
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `SCR-XXX`, sequential from `SCR-001` |
| `name` | string | Human-readable screen name |
| `route` | string | URL path, lowercase-hyphenated, leading `/`, e.g. `"/plp"` — never `/` (that's the nav hub) |
| `flows` | string[] | One or more `UF-XXX` ids this screen serves |
| `navigatesTo` | string[] | `SCR-XXX` ids of screens this screen's primary actions link to |
| `flags.stale` | boolean | Set when an underlying flow's content changed since this screen was generated |
| `flags.orphaned` | boolean | Set when none of this screen's flows still need UI |
| `staleReasons` | string[] | Human-readable reasons, e.g. `"UF-004 content changed"` |

**On `stale` and re-runs:** `stale` means "changed since the *last* `/wireframe`
run," not "still needs attention forever." `.snapshot.json` is overwritten
with the current flow content on every run, so if `/wireframe` runs again
later for an unrelated reason before a flagged screen's `page.tsx` is
manually fixed, the flag clears itself once the flow stops differing from
the new snapshot baseline — even though the screen was never actually
updated. Act on and report `stale` screens promptly; don't assume the flag
will still be there next time you look.

## Style rules

- Keep the client's terminology from `user-flows.md` — do not rename flows or actors.
- Never overwrite an existing screen `page.tsx`. If a screen needs a real content update because its flow changed, that's a flagged `stale` entry for a human to act on, not something this skill does automatically.
- Never invent new primitives — compose only from `components/ui/*` and `components/wireframe/*`. If a screen genuinely needs a shadcn primitive outside the installed set, flag it in the report rather than hand-rolling markup.
- Report `stale`/`orphaned` counts and any gaps prominently — they are the signal a human needs to act on.
```

- [ ] **Step 2: Commit**

```bash
git add wireframe/skills/wireframe/SKILL.md
git commit -m "docs(wireframe): rewrite SKILL.md for the Next.js + shadcn pipeline"
```

---

### Task 15: Full test suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full self-check chain**

Run: `npm test`
Expected: all five self-check scripts run in sequence (`prep/lib/validation.selfcheck.ts`, `prep/lib/spec.selfcheck.ts`, `registry/registry.selfcheck.ts`, `order/lib/validation.selfcheck.ts`, `wireframe/lib/wireframe.selfcheck.ts`), each printing its `✓` lines and a final count, with exit code 0. `order`'s and `wireframe`'s counts should be higher than before this plan (new field/route/scaffold checks added in Tasks 1-4, 9, 10).

- [ ] **Step 2: Confirm no other file in the repo still references the old `docs/wireframes` path or `.html` screen format**

Run: `grep -rn "docs/wireframes\|renderIndexHtml\|indexHtml" --include="*.ts" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers`
Expected: no output (empty) — everything under `wireframe/` now points at `wireframes/` and `renderNavHubPage`/`navHubPage`.

- [ ] **Step 3: Commit (only if Steps 1-2 needed a fix)**

If either check above required a follow-up edit, stage and commit it:

```bash
git add -A
git commit -m "fix(wireframe): clean up stray references to the v1 docs/wireframes format"
```

If both checks passed cleanly with no edits needed, skip this step — there's nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** Architecture/directory (§1) → Tasks 4-9. Screen schema/manifest/navigation (§B in design) → Task 3, 12, 13. `/order` field depth (§5/C) → Tasks 1-2. Gap flagging (§6/C) → Task 12 (agent), Task 13 (workflow report-only wiring, no persistence — matches the "console output only" decision). SKILL.md → Task 14. Non-goals (no deploy automation, no dynamic shadcn install, no auto-extraction, no auto-gap-generation, no migration) are respected throughout — nothing in this plan adds a deploy step, a network call for shadcn, dynamic component extraction, or a v1→v2 migration path.
- **Placeholder scan:** no TBD/TODO; every step has literal file content or an exact runnable command with expected output.
- **Type consistency:** `Screen`/`ScreenSchema` (`route`, `navigatesTo`) introduced in Task 3 is used identically in Tasks 9, 10, 12, 13 — no renamed fields across tasks. `NeedsUIFlow`/`NeedsUIFlowStep`/`NeedsUIFlowField` (Task 4) match the `FlowStep`/`FlowField` shape from Task 1 field-for-field. `routeToFilePath`/`scaffoldWireframeApp` signatures introduced in Task 4 are called with the same signature in Tasks 9, 11, 13.
- **Known deviation from the literal design doc wording:** the design doc's decision log says "shadcn init non-interactively, then add baseline primitives" (implying live CLI calls). This plan instead vendors the shadcn primitive source directly into `wireframe/template/components/ui/*` (Tasks 6-7), copied in by `scaffoldWireframeApp` alongside the composite starter kit. This produces the identical end state (the same primitives present in the generated app) without a network dependency or CLI-version drift during scaffold, and keeps the scaffold step fully deterministic and testable (Task 9). Worth a one-line mention to Ria after implementation, but does not change any user-facing behavior the design approved.

