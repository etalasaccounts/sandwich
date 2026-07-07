# Wireframe Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/wireframe` skill that runs after `/order` and before `/prep`, turning `needsUI` flows from `user-flows.json` into static HTML wireframe screens tracked in a manifest, without ever silently overwriting a screen a human has already tuned.

**Architecture:** A new top-level `wireframe/` directory mirrors `order/` and `prep/`'s three-layer shape — an interactive `SKILL.md`, a scriptable `*.workflow.ts` for the pi harness, and a `pi-extension/*.ts` registration adapter — backed by a small `lib/` (zod schema, path/IO helpers, deterministic `index.html` renderer) and a CLI `scripts/render.ts`. `order/lib/order-schemas.ts` gains one new required field (`needsUI`) on each user flow.

**Tech Stack:** TypeScript run directly via `node --experimental-strip-types` (no build step), zod for schema validation, plain `node:assert` for tests (no test framework), matching every existing file in `order/` and `prep/`.

## Global Constraints

- All ids follow the existing `XX-\d{3}` convention: `UF-XXX` (flows, already exists), `SCR-XXX` (screens, new).
- No test framework — tests are `*.selfcheck.ts` files using `node:assert`'s `strict` mode, run via `node --experimental-strip-types <file>`, following the exact style of `order/lib/validation.selfcheck.ts`.
- No build step — every new `.ts` file must run directly under `node --experimental-strip-types`.
- Screen HTML files, once written, are never overwritten by this skill. Only `manifest.json`, `.snapshot.json`, and `index.html` are ever rewritten on a re-run.
- No deploy/hosting step (v1 non-goal from the design spec).
- Output HTML uses the Tailwind CDN script tag (`<script src="https://cdn.tailwindcss.com">`), no build tooling, matching the proven `arneshdiveshop` reference.
- Full spec: `docs/superpowers/specs/2026-07-06-wireframe-skill-design.md`.

---

### Task 1: Add `needsUI` to `/order`'s user-flow schema

**Files:**
- Modify: `order/lib/order-schemas.ts:40-51` (`UserFlowsDocSchema`)
- Modify: `order/lib/order-render.ts:114-134` (`renderUserFlows`)
- Modify: `order/agents/03-write-user-flows.md`
- Modify: `order/lib/validation.selfcheck.ts:62-64,89` (existing fixtures)
- Test: `order/lib/validation.selfcheck.ts` (existing self-check file, extended)

**Interfaces:**
- Produces: `UserFlowsDocSchema`'s flow objects now require `needsUI: boolean`. Every downstream consumer of `UserFlowsDoc` (Task 3 onward) reads `flow.needsUI`.

- [ ] **Step 1: Write the failing assertions in `order/lib/validation.selfcheck.ts`**

Add these two checks right after the existing `"validateUserFlowsDoc requires UF-### ids and >=1 step"` check (currently ending at line 64):

```ts
check("validateUserFlowsDoc requires needsUI on every flow", () => {
  const withNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated", needsUI: true }] };
  assert.equal(validateUserFlowsDoc(withNeedsUI).valid, true);
  const withoutNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated" }] };
  assert.equal(validateUserFlowsDoc(withoutNeedsUI).valid, false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: throws/fails on the new check — `withNeedsUI` case fails because `needsUI` isn't in the schema yet, so extra keys are silently ignored by zod (non-strict) and the check still passes for `withNeedsUI`, but critically `withoutNeedsUI` also currently returns `valid: true` since the field doesn't exist to be missing. The assertion `assert.equal(validateUserFlowsDoc(withoutNeedsUI).valid, false)` fails.

- [ ] **Step 3: Add `needsUI` to the schema**

In `order/lib/order-schemas.ts`, replace:

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
  })).min(1, "At least one user flow required"),
});
```

with:

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
```

- [ ] **Step 4: Fix the two other existing fixtures broken by the new required field**

In `order/lib/validation.selfcheck.ts`, the pre-existing check at (originally) line 63 constructs a valid flow literal without `needsUI` — it must now include it or it flips to invalid and breaks an unrelated assertion. Update:

```ts
check("validateUserFlowsDoc requires UF-### ids and >=1 step", () => {
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: ["s"], outcome: "o", confidence: "stated", needsUI: true }] }).valid, true);
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "F1", title: "t", actor: "a", trigger: "x", steps: [], outcome: "o", confidence: "stated", needsUI: true }] }).valid, false);
});
```

And the `renderUserFlows` smoke-test fixture (originally line 89):

```ts
const md = renderUserFlows({ flows: [{ id: "UF-001", title: "Login", actor: "User", trigger: "click", steps: ["open", "submit"], outcome: "in", confidence: "stated", needsUI: true }] });
```

- [ ] **Step 5: Run tests again to verify they pass**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: `N order checks passed.` with no assertion errors.

- [ ] **Step 6: Render `needsUI` in `user-flows.md` for human legibility**

In `order/lib/order-render.ts`, `renderUserFlows` currently renders `Actor`/`Trigger`/`Confidence` but not `needsUI`. Update the per-flow block:

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

- [ ] **Step 7: Update the extraction prompt so `/order` actually sets the field**

In `order/agents/03-write-user-flows.md`, update the output schema block and add a rule. Replace:

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

with:

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

And add this rule after the existing `id` rule:

```
- `needsUI` is `true` when a human actor interacts with a screen for this flow (e.g. "End User", "Admin"); `false` when the actor is a system/cron/webhook/background process that never renders UI.
```

- [ ] **Step 8: Run the full order self-check one more time and commit**

Run: `node --experimental-strip-types order/lib/validation.selfcheck.ts`
Expected: passes.

```bash
git add order/lib/order-schemas.ts order/lib/order-render.ts order/agents/03-write-user-flows.md order/lib/validation.selfcheck.ts
git commit -m "feat(order): add needsUI to user-flow schema for the wireframe skill"
```

---

### Task 2: Wireframe zod schemas

**Files:**
- Create: `wireframe/lib/wireframe-schemas.ts`
- Test: `wireframe/lib/wireframe.selfcheck.ts` (new file, extended across Tasks 2-4)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `ScreenSchema`, `Screen` (type)
  - `WireframeManifestSchema`, `WireframeManifest` (type)
  - `validateWireframeManifest(o: unknown): { valid: boolean; data?: WireframeManifest; errors: string[] }`

- [ ] **Step 1: Write the failing tests**

Create `wireframe/lib/wireframe.selfcheck.ts`:

```ts
// Self-check for the wireframe consistency layer (schemas, diffing, rendering).
// Run: node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts
import { strict as assert } from "node:assert";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

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

console.log(`\n${n} wireframe checks passed.`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: FAIL — `wireframe-schemas.ts` doesn't exist yet, module not found.

- [ ] **Step 3: Implement the schema**

Create `wireframe/lib/wireframe-schemas.ts`:

```ts
import { z } from "zod";

export const ScreenSchema = z.object({
  id: z.string().regex(/^SCR-\d{3}$/, "Screen id must be SCR-XXX format"),
  name: z.string().min(1),
  file: z.string().min(1),
  flows: z.array(z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX")).min(1, "A screen needs at least one flow"),
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: `4 wireframe checks passed.`

- [ ] **Step 5: Commit**

```bash
git add wireframe/lib/wireframe-schemas.ts wireframe/lib/wireframe.selfcheck.ts
git commit -m "feat(wireframe): add manifest zod schema"
```

---

### Task 3: Wireframe path/IO helpers and staleness diffing

**Files:**
- Create: `wireframe/lib/wireframe-lib.ts`
- Modify: `wireframe/lib/wireframe.selfcheck.ts` (extend)

**Interfaces:**
- Consumes: `hashOutput`, `hasOutputChanged` from `lib/agent-wrapper.ts` (already exist — signatures: `hashOutput(data: unknown): string`, `hasOutputChanged(current: unknown, previousHash: string | null): boolean`); `WireframeManifest` type from Task 2.
- Produces:
  - `getWireframePaths(projectRoot: string): WireframePaths` (`{ root, manifest, snapshot, gitignore, indexHtml }`)
  - `ensureWireframeDir(projectRoot: string): void`
  - `type NeedsUIFlow = { id: string; title: string; actor: string; trigger: string; steps: string[]; outcome: string }`
  - `type FlowSnapshot = Record<string, string>`
  - `readSnapshot(projectRoot: string): FlowSnapshot`
  - `writeSnapshot(projectRoot: string, flows: NeedsUIFlow[]): void`
  - `type FlowDiff = { changedIds: Set<string>; newIds: Set<string>; removedIds: Set<string> }`
  - `diffFlows(currentFlows: NeedsUIFlow[], snapshot: FlowSnapshot): FlowDiff`
  - `readManifest(projectRoot: string): WireframeManifest | undefined`
  - `writeManifest(projectRoot: string, manifest: WireframeManifest): string`

- [ ] **Step 1: Write the failing tests**

Append to `wireframe/lib/wireframe.selfcheck.ts` (before the final `console.log` line):

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWireframePaths,
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: FAIL — `wireframe-lib.ts` doesn't exist yet.

- [ ] **Step 3: Implement `wireframe-lib.ts`**

Create `wireframe/lib/wireframe-lib.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasOutputChanged, hashOutput } from "../../lib/agent-wrapper.js";
import type { WireframeManifest } from "./wireframe-schemas.js";

export interface WireframePaths {
  root: string;
  manifest: string;
  snapshot: string;
  gitignore: string;
  indexHtml: string;
}

export function getWireframePaths(projectRoot: string): WireframePaths {
  const root = join(projectRoot, "docs", "wireframes");
  return {
    root,
    manifest: join(root, "manifest.json"),
    snapshot: join(root, ".snapshot.json"),
    gitignore: join(root, ".gitignore"),
    indexHtml: join(root, "index.html"),
  };
}

export function ensureWireframeDir(projectRoot: string): void {
  const paths = getWireframePaths(projectRoot);
  mkdirSync(paths.root, { recursive: true });
  if (!existsSync(paths.gitignore)) {
    writeFileSync(paths.gitignore, ".snapshot.json\n", "utf8");
  }
}

export interface NeedsUIFlow {
  id: string;
  title: string;
  actor: string;
  trigger: string;
  steps: string[];
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
    return JSON.parse(readFileSync(paths.manifest, "utf8"));
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: `9 wireframe checks passed.`

- [ ] **Step 5: Commit**

```bash
git add wireframe/lib/wireframe-lib.ts wireframe/lib/wireframe.selfcheck.ts
git commit -m "feat(wireframe): add path/IO helpers and hash-based staleness diffing"
```

---

### Task 4: Deterministic `index.html` renderer

**Files:**
- Create: `wireframe/lib/wireframe-render.ts`
- Modify: `wireframe/lib/wireframe.selfcheck.ts` (extend)

**Interfaces:**
- Consumes: `WireframeManifest` type from Task 2.
- Produces: `renderIndexHtml(manifest: WireframeManifest): string`

- [ ] **Step 1: Write the failing tests**

Append to `wireframe/lib/wireframe.selfcheck.ts` (before the final `console.log` line):

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: FAIL — `wireframe-render.ts` doesn't exist yet.

- [ ] **Step 3: Implement `wireframe-render.ts`**

Create `wireframe/lib/wireframe-render.ts`:

```ts
import type { WireframeManifest } from "./wireframe-schemas.js";

export function renderIndexHtml(manifest: WireframeManifest): string {
  const items = manifest.screens
    .map((s) => {
      const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
        .filter(Boolean)
        .join(" · ");
      const badge = flags ? `<span class="ml-2 text-xs uppercase text-red-600">${flags}</span>` : "";
      return `        <a href="${s.file}" class="block w-full p-4 border border-gray-200 hover:border-brand hover:bg-gray-50 transition">
          <p class="text-base font-semibold text-brand">${s.name}${badge}</p>
          <p class="text-xs text-gray-500 mt-1">${s.flows.join(", ")}</p>
        </a>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireframes</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { colors: { brand: '#333333' } } } }</script>
</head>
<body class="font-sans leading-relaxed bg-white min-h-screen">
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-2xl font-bold text-brand mb-6">Wireframes</h1>
    <div class="space-y-3">
${items}
    </div>
  </div>
</body>
</html>
`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`
Expected: `12 wireframe checks passed.`

- [ ] **Step 5: Commit**

```bash
git add wireframe/lib/wireframe-render.ts wireframe/lib/wireframe.selfcheck.ts
git commit -m "feat(wireframe): add deterministic index.html renderer"
```

---

### Task 5: CLI render script

**Files:**
- Create: `wireframe/scripts/render.ts`

**Interfaces:**
- Consumes: `validateWireframeManifest` (Task 2), `renderIndexHtml` (Task 4), `getWireframePaths`/`ensureWireframeDir` (Task 3).
- Produces: a runnable CLI at `wireframe/scripts/render.ts` — no new exports consumed by later tasks, but Task 6 (SKILL.md) and Task 8 (workflow.ts) both invoke it as documented behavior.

- [ ] **Step 1: Implement the script**

Create `wireframe/scripts/render.ts`:

```ts
#!/usr/bin/env node
// Deterministic renderer for wireframe artifacts.
// Usage: node --experimental-strip-types wireframe/scripts/render.ts [project-root]
//
// Reads manifest.json from docs/wireframes/, validates against the Zod
// schema, and renders index.html deterministically. Never touches screen
// HTML files. Exit 0 on success, exit 1 on validation failure (prints the
// exact errors).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateWireframeManifest } from "../lib/wireframe-schemas.ts";
import { renderIndexHtml } from "../lib/wireframe-render.ts";
import { ensureWireframeDir, getWireframePaths } from "../lib/wireframe-lib.ts";

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
  const screenPath = resolve(paths.root, screen.file);
  if (!existsSync(screenPath)) {
    console.error(`⚠ manifest references a missing screen file: ${screen.file} (${screen.id}) — the file was deleted from disk but is still listed in the manifest`);
  }
}

ensureWireframeDir(projectRoot);
writeFileSync(paths.indexHtml, renderIndexHtml(result.data!), "utf8");
console.log(`✓ ${paths.indexHtml}`);
```

- [ ] **Step 2: Verify it fails cleanly with no manifest present**

Run: `node --experimental-strip-types wireframe/scripts/render.ts /tmp/nonexistent-project`
Expected: prints `✗ .../docs/wireframes/manifest.json not found — write manifest.json first, then run this script.` and exits with status 1 (check with `echo $?`).

- [ ] **Step 3: Verify it succeeds against a hand-written fixture**

```bash
mkdir -p /tmp/wireframe-render-test/docs/wireframes
cat > /tmp/wireframe-render-test/docs/wireframes/manifest.json <<'EOF'
{
  "screens": [
    { "id": "SCR-001", "name": "Homepage", "file": "homepage.html", "flows": ["UF-001"], "flags": { "stale": false, "orphaned": false }, "staleReasons": [] }
  ]
}
EOF
touch /tmp/wireframe-render-test/docs/wireframes/homepage.html
node --experimental-strip-types wireframe/scripts/render.ts /tmp/wireframe-render-test
cat /tmp/wireframe-render-test/docs/wireframes/index.html
rm -rf /tmp/wireframe-render-test
```

Expected: `✓ /tmp/wireframe-render-test/docs/wireframes/index.html`, and the printed `index.html` contains `href="homepage.html"` and `Homepage`.

- [ ] **Step 4: Commit**

```bash
git add wireframe/scripts/render.ts
git commit -m "feat(wireframe): add CLI render script"
```

---

### Task 6: Interactive `SKILL.md`

**Files:**
- Create: `wireframe/skills/wireframe/SKILL.md`

**Interfaces:**
- Consumes: the `manifest.json` schema (Task 2) and `wireframe/scripts/render.ts` (Task 5) by reference (documented commands, not imported code).
- Produces: the `/wireframe` command surface for Claude Code and any harness that discovers skills via `skillPaths`.

- [ ] **Step 1: Write the skill file**

Create `wireframe/skills/wireframe/SKILL.md`:

```markdown
---
name: wireframe
description: Turn /order's needsUI user flows into static HTML wireframe screens, tracked in a manifest that flags staleness instead of silently overwriting hand-tuned screens. Use ONLY when explicitly invoked with /wireframe, after /order has run and before /prep.
---

# /wireframe

You are generating wireframes. Your job: produce static HTML screens in
`docs/wireframes/` from the `needsUI` flows in `docs/sandwich/user-flows.json`,
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

All written to `docs/wireframes/`:

| File | Purpose |
|------|---------|
| `manifest.json` | Screen registry — source of truth for the screen↔flow mapping and stale/orphaned flags |
| `index.html` | Nav hub, a pure projection of `manifest.json`, regenerated every run |
| `<screen>.html` | One static HTML file per screen, Tailwind CDN, written once and never overwritten |
| `.snapshot.json` | Git-ignored, last-seen content hash per flow id — the diff baseline for the next run |

## Mode detection (automatic)

- **Fresh** — no `docs/wireframes/manifest.json` yet. Group every `needsUI: true` flow into a sensible screen list and write all screens.
- **Incremental** — `manifest.json` already exists. Only new/changed/removed flows are acted on; existing screen files are never rewritten.

## Pipeline

1. **Prerequisite check** — per above.
2. **Read & filter** — load `docs/sandwich/user-flows.json`, keep only flows where `needsUI` is `true`.
3. **Load prior state** — read `docs/wireframes/manifest.json` (if present) and `docs/wireframes/.snapshot.json` (if present).
4. **Diff** — for each `needsUI` flow, compare its `{ trigger, steps, outcome }` against the snapshot:
   - Not in the snapshot at all → **new flow**, needs a screen.
   - In the snapshot but content differs → **changed flow**.
   - In the snapshot but no longer present (or flipped to `needsUI: false`) → **removed flow**.
5. **Apply flags to existing screens** — for every screen already in the manifest:
   - If any of its flows is a *changed flow*, set `flags.stale = true` and append a reason like `"UF-004 content changed"` to `staleReasons`. **Do not touch that screen's HTML file.**
   - If every one of its flows is a *removed flow*, set `flags.orphaned = true`.
   - Otherwise, clear `stale`/`orphaned` and `staleReasons` back to their defaults.
6. **Group new flows into screens** — for *new flows* only, decide whether each fits an existing screen (add its id to that screen's `flows` array) or needs a brand-new screen (assign the next `SCR-XXX` id, a short `name`, and a `file` — lowercase, hyphenated, `.html`). Flows and screens are not 1:1: several flows commonly share one screen (e.g. browse vs. filter both landing on a product listing page), and one flow may need a multi-step single screen.
7. **Write HTML for new screens only** — one file per brand-new screen under `docs/wireframes/`, Tailwind CDN (`<script src="https://cdn.tailwindcss.com">`), grayscale/lo-fi or Tailwind-styled per the shared aesthetic below. Never write to a `file` that already exists on disk.
8. **Write `manifest.json`** — the full screen list (existing + new), matching the schema below exactly. Validate it:
   ```bash
   node --experimental-strip-types $SANDWICH_ROOT/wireframe/scripts/render.ts
   ```
   `SANDWICH_ROOT` is injected into your context at session start as plain
   text (e.g. `SANDWICH_ROOT=/path/to/plugin`) — it is NOT a live shell
   environment variable. Read the path from your context and substitute it
   literally in place of `$SANDWICH_ROOT` above before running.
   If validation fails, the script prints the exact errors — fix the JSON and re-run.
9. **Report** — screens created / flagged stale (with reasons) / orphaned / unchanged.

The load-bearing invariant: the only files this pipeline ever writes are
`manifest.json`, `.snapshot.json`, `index.html`, and brand-new screen files.
Every code path that detects a change on an *existing* screen sets a flag —
it never edits that screen's HTML.

## Output

```
✓ docs/wireframes/manifest.json
✓ docs/wireframes/index.html
✓ docs/wireframes/<new-screen-1>.html
✓ docs/wireframes/<new-screen-2>.html

[one sentence: N screens created, N flagged stale, N orphaned, N unchanged]
```

## Shared wireframe aesthetic

- Tailwind CDN, no build step: `<script src="https://cdn.tailwindcss.com">`
- Typography: system-ui font stack
- Grayscale-first palette; a single `brand` color for primary actions
- Container: max-width, centered, generous padding
- Every screen is a standalone `.html` file — no shared layout file, no imports

## Output schema (MANDATORY)

**Exact schema. Do not invent field names. Do not add extra wrappers.**
`manifest.json` must start with `{` — no markdown fences, no preamble.

```json
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "Homepage",
      "file": "homepage.html",
      "flows": ["UF-001", "UF-002"],
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
| `file` | string | Filename only, relative to `docs/wireframes/`, e.g. `"plp.html"` |
| `flows` | string[] | One or more `UF-XXX` ids this screen serves |
| `flags.stale` | boolean | Set when an underlying flow's content changed since this screen was generated |
| `flags.orphaned` | boolean | Set when none of this screen's flows still need UI |
| `staleReasons` | string[] | Human-readable reasons, e.g. `"UF-004 content changed"` |

## Style rules

- Keep the client's terminology from `user-flows.md` — do not rename flows or actors.
- Never overwrite an existing screen `.html` file. If a screen needs a real content update because its flow changed, that's a flagged `stale` entry for a human to act on, not something this skill does automatically.
- Report `stale`/`orphaned` counts prominently — they are the signal a human needs to act on.
```

- [ ] **Step 2: Verify the referenced command actually runs**

Run: `node --experimental-strip-types wireframe/scripts/render.ts --help 2>&1; echo done` (sanity — the script itself was verified in Task 5; this step just confirms the path referenced in the SKILL.md matches the real file).

Run: `test -f wireframe/scripts/render.ts && echo "path OK"`
Expected: `path OK`

- [ ] **Step 3: Commit**

```bash
git add wireframe/skills/wireframe/SKILL.md
git commit -m "feat(wireframe): add interactive SKILL.md"
```

---

### Task 7: Agent prompts for the pi workflow

**Files:**
- Create: `wireframe/agents/01-group-flows-into-screens.md`
- Create: `wireframe/agents/02-write-screen-html.md`

**Interfaces:**
- Consumes: nothing (prompt text files).
- Produces: prompts read by `wireframe.workflow.ts` (Task 8) via `readAgent(name)`.

- [ ] **Step 1: Write the grouping prompt**

Create `wireframe/agents/01-group-flows-into-screens.md`:

```markdown
# Group Flows Into Screens

You receive `{ "newFlows": [...], "existingScreens": [{ "id": "SCR-XXX", "name": "...", "flows": ["UF-XXX"] }] }`.

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
    { "id": "SCR-004", "name": "Product Listing Page", "file": "plp.html", "flows": ["UF-004", "UF-005"] }
  ]
}
```

## Rules

- `id` MUST be `SCR-` followed by three digits, continuing the sequence
  after the highest id in `existingScreens` (start at `SCR-001` if none exist).
- `file` is lowercase, hyphenated, ends in `.html`, and must be unique
  across both `existingScreens` and your new proposals.
- Every id in `newFlows` must appear in exactly one screen's `flows` array —
  either an existing screen (which you don't need to repeat in your output)
  or one of your new screens.
- Prefer fewer, well-organized screens over one screen per flow. A
  multi-step process (e.g. a 2-step checkout) is still one screen.
- Output ONLY the JSON object.
```

- [ ] **Step 2: Write the screen-HTML prompt**

Create `wireframe/agents/02-write-screen-html.md`:

```markdown
# Write Screen HTML

You receive `{ "screen": { "id": "SCR-XXX", "name": "...", "file": "...", "flows": [...] }, "flowDetails": [{ "id": "UF-XXX", "title": "...", "actor": "...", "trigger": "...", "steps": [...], "outcome": "..." }] }`.

Write a single, complete, standalone HTML file for this screen that a
human can open directly in a browser with zero build step.

## Rules

- Start with `<!DOCTYPE html>`. Output ONLY the HTML — no markdown fences,
  no explanation, no preamble or trailing commentary.
- Use the Tailwind CDN script tag for styling:
  `<script src="https://cdn.tailwindcss.com"></script>`
- System-ui font stack, grayscale-first palette, one `brand` accent color
  for primary actions/buttons.
- Cover every flow in `flowDetails` — each flow's `steps` should be
  visibly represented as elements or states on the screen (e.g. a form
  field per step, a button for the trigger, a confirmation for the outcome).
- Use the client's own terminology from `title`/`actor`/`steps`/`outcome` —
  do not translate or rename them.
- This is a wireframe, not a final design: prioritize showing structure
  and content over pixel-perfect visuals. Placeholder text is fine where
  the flow doesn't specify exact copy.
```

- [ ] **Step 3: Commit**

```bash
git add wireframe/agents/01-group-flows-into-screens.md wireframe/agents/02-write-screen-html.md
git commit -m "feat(wireframe): add pi-workflow agent prompts"
```

---

### Task 8: Pi-harness workflow script

**Files:**
- Create: `wireframe/workflow/wireframe.workflow.ts`

**Interfaces:**
- Consumes: `readOrderDocs` from `order/lib/order-lib.ts` (existing, returns `{ userFlows?: UserFlowsDoc, ... }`); everything from Tasks 2-4 and 7.
- Produces: the `wireframe` entry point for pi's workflow engine (registered in Task 10).

- [ ] **Step 1: Implement the workflow**

Create `wireframe/workflow/wireframe.workflow.ts`:

```ts
export const meta = {
  name: "wireframe",
  description: "Generate static HTML wireframe screens from /order's needsUI user flows, grouped by UF-XXX flow ids, without ever overwriting an existing screen",
  phases: [
    { title: "Detect", detail: "check prerequisites and load needsUI flows" },
    { title: "Diff", detail: "compare against the last snapshot to find new/changed/removed flows" },
    { title: "Group", detail: "propose a flow-to-screen grouping for any new flows" },
    { title: "Generate", detail: "write HTML for new screens only" },
    { title: "Write", detail: "write manifest.json, .snapshot.json, and render index.html" },
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
  type NeedsUIFlow,
} from "../lib/wireframe-lib.js";
import { validateWireframeManifest, type Screen } from "../lib/wireframe-schemas.js";
import { renderIndexHtml } from "../lib/wireframe-render.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

interface ScreenDraft {
  id: string;
  name: string;
  file: string;
  flows: string[];
}

const projectRoot = process.cwd();

// Phase 1: Detect
phase("Detect");
const { userFlows } = readOrderDocs(projectRoot);
if (!userFlows) {
  throw new Error("docs/sandwich/user-flows.json not found — run /order first.");
}
const needsUIFlows: NeedsUIFlow[] = userFlows.flows
  .filter((f) => f.needsUI)
  .map((f) => ({ id: f.id, title: f.title, actor: f.actor, trigger: f.trigger, steps: f.steps, outcome: f.outcome }));
log(`${needsUIFlows.length} of ${userFlows.flows.length} flows need a screen`);

// Phase 2: Diff
phase("Diff");
const existingManifest = readManifest(projectRoot);
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

// Phase 3: Group — only brand-new flows need a screen proposed
phase("Group");
const newFlows = needsUIFlows.filter((f) => diff.newIds.has(f.id));
let newScreens: ScreenDraft[] = [];
if (newFlows.length > 0) {
  const existingScreenSummaries = screens.map((s) => ({ id: s.id, name: s.name, flows: s.flows }));
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

// Phase 4: Generate — one HTML file per new screen, in parallel
phase("Generate");
const flowById = new Map(needsUIFlows.map((f) => [f.id, f]));
const htmlByFile = new Map<string, string>();
if (newScreens.length > 0) {
  const htmls = await parallel(
    newScreens.map((screen) => async () => {
      const flowDetails = screen.flows.map((id) => flowById.get(id)).filter(Boolean);
      const html = await agent(
        `${readAgent("02-write-screen-html.md")}\n\nContext:\n${JSON.stringify(
          { screen, flowDetails },
          null,
          2
        )}`,
        { label: `write-${screen.file}`, phase: "Generate" }
      );
      return { file: screen.file, html: html ?? "" };
    })
  );
  for (const { file, html } of htmls) htmlByFile.set(file, html);
}

// Phase 5: Write — manifest, snapshot, screen files (new only), index.html
phase("Write");
ensureWireframeDir(projectRoot);
const paths = getWireframePaths(projectRoot);

for (const [file, html] of htmlByFile) {
  writeFileSync(join(paths.root, file), html, "utf8");
  log(`✓ ${join(paths.root, file)}`);
}

const finalManifestDraft = { screens: [...screens, ...newScreens] };
const validation = validateWireframeManifest(finalManifestDraft);
if (!validation.valid) {
  throw new Error(`manifest.json validation failed: ${validation.errors.join("; ")}`);
}

writeManifest(projectRoot, validation.data!);
writeSnapshot(projectRoot, needsUIFlows);
writeFileSync(paths.indexHtml, renderIndexHtml(validation.data!), "utf8");

log(`✓ ${paths.manifest}`);
log(`✓ ${paths.indexHtml}`);

const staleCount = screens.filter((s) => s.flags.stale).length;
const orphanedCount = screens.filter((s) => s.flags.orphaned).length;
log(
  `\nScreens created: ${newScreens.length} | stale: ${staleCount} | orphaned: ${orphanedCount} | unchanged: ${
    screens.length - staleCount - orphanedCount
  }`
);

return { manifest: validation.data, screensCreated: newScreens.length, stale: staleCount, orphaned: orphanedCount };
```

- [ ] **Step 2: Sanity-check the file has no obvious syntax errors**

Run: `node --experimental-strip-types --check wireframe/workflow/wireframe.workflow.ts`
Expected: no output, exit code 0. (This only checks syntax — `phase`/`agent`/`parallel`/`log` are pi-runtime globals not available outside pi, so this file cannot be executed standalone; that matches `order.workflow.ts`/`prep.workflow.ts`, which also only run inside the pi harness.)

- [ ] **Step 3: Commit**

```bash
git add wireframe/workflow/wireframe.workflow.ts
git commit -m "feat(wireframe): add pi-harness workflow script"
```

---

### Task 9: Pi-extension registration adapter

**Files:**
- Create: `wireframe/pi-extension/wireframe.ts`

**Interfaces:**
- Consumes: `ExtensionAPI` type from `@earendil-works/pi-coding-agent` (existing dependency, already used by `order/pi-extension/order.ts` and `prep/pi-extension/prep.ts`).
- Produces: default-exported `wireframePiExtension(pi: ExtensionAPI)`, registered in Task 10.

- [ ] **Step 1: Implement the adapter**

Create `wireframe/pi-extension/wireframe.ts`:

```ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const skillsDir = resolve(packageRoot, "wireframe/skills/wireframe");

export default function wireframePiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => ({
    skillPaths: [skillsDir],
  }));
}
```

- [ ] **Step 2: Sanity-check syntax**

Run: `node --experimental-strip-types --check wireframe/pi-extension/wireframe.ts`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add wireframe/pi-extension/wireframe.ts
git commit -m "feat(wireframe): add pi-extension registration adapter"
```

---

### Task 10: Register the skill in both manifests

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: file paths created in Tasks 6, 8, 9.
- Produces: `/wireframe` discoverable by Claude Code (via `plugin.json`) and by the pi harness (via `package.json`'s `"pi"` field); `wireframe/lib/wireframe.selfcheck.ts` runs as part of `npm test`.

- [ ] **Step 1: Update `.claude-plugin/plugin.json`**

Replace:

```json
{
  "name": "sandwich",
  "version": "0.1.0",
  "description": "Composable agent stack for software agencies",
  "author": {
    "name": "Etalas"
  },
  "skills": ["./order/skills/order", "./prep/skills/prep", "./prep/skills/status"],
  "workflows": [
    "./order/workflow/order.workflow.ts",
    "./prep/workflow/prep.workflow.ts",
    "./prep/workflow/status.workflow.ts"
  ]
}
```

with:

```json
{
  "name": "sandwich",
  "version": "0.1.0",
  "description": "Composable agent stack for software agencies",
  "author": {
    "name": "Etalas"
  },
  "skills": ["./order/skills/order", "./prep/skills/prep", "./prep/skills/status", "./wireframe/skills/wireframe"],
  "workflows": [
    "./order/workflow/order.workflow.ts",
    "./prep/workflow/prep.workflow.ts",
    "./prep/workflow/status.workflow.ts",
    "./wireframe/workflow/wireframe.workflow.ts"
  ]
}
```

- [ ] **Step 2: Update `package.json`'s `"pi"` field and `test` script**

Replace:

```json
  "scripts": {
    "test": "node --experimental-strip-types prep/lib/validation.selfcheck.ts && node --experimental-strip-types prep/lib/spec.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types order/lib/validation.selfcheck.ts"
  },
```

with:

```json
  "scripts": {
    "test": "node --experimental-strip-types prep/lib/validation.selfcheck.ts && node --experimental-strip-types prep/lib/spec.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types order/lib/validation.selfcheck.ts && node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts"
  },
```

And replace:

```json
  "pi": {
    "extensions": [
      "./order/pi-extension/order.ts",
      "./prep/pi-extension/prep.ts"
    ],
    "skills": [
      "./order/skills",
      "./prep/skills/prep",
      "./prep/skills/status"
    ]
  },
```

with:

```json
  "pi": {
    "extensions": [
      "./order/pi-extension/order.ts",
      "./prep/pi-extension/prep.ts",
      "./wireframe/pi-extension/wireframe.ts"
    ],
    "skills": [
      "./order/skills",
      "./prep/skills/prep",
      "./prep/skills/status",
      "./wireframe/skills/wireframe"
    ]
  },
```

- [ ] **Step 3: Verify both files are still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('both valid')"`
Expected: `both valid`

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all five self-check files pass, including `wireframe/lib/wireframe.selfcheck.ts`'s `12 wireframe checks passed.`

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json package.json
git commit -m "feat(wireframe): register skill in plugin.json and package.json"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered design section (schema addition, directory layout, manifest schema, pipeline, error handling, testing, pi-parity) maps to a task above (1: schema; 2-4: lib; 5: script; 6: SKILL.md; 7-9: pi-parity; 10: registration).
- **Never-overwrite invariant:** enforced structurally in both the `SKILL.md` pipeline (step 7, "never write to a `file` that already exists") and `wireframe.workflow.ts` (only `htmlByFile` entries — which only ever come from `newScreens` — get written; existing screens only have their `flags` object replaced, never their file).
- **Type consistency check:** `NeedsUIFlow`, `FlowSnapshot`, `FlowDiff`, `Screen`, `WireframeManifest` are defined once (Tasks 2-3) and referenced identically by name in every later task (5, 6, 8) — no renamed duplicates.
