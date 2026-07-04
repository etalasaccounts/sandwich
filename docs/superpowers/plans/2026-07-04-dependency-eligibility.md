# Dependency Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `feature-queue.md` and `/prep`'s own recommendation must never present a feature as buildable when a `dependsOn` entry it needs isn't `done` yet.

**Architecture:** A pure `isEligible(feature, byId)` helper in `registry-lib.ts` (mirrors `effectivePriority`/`effectiveLifecycle`) becomes the single source of truth for "can this be built today?". It's wired into two consumers: `renderFeatureQueue()` (splits the queue table into "Eligible now" and "Blocked by dependency" sections) and `prep.workflow.ts`'s `topUnblocked` (the `/prep` recommendation), so both agree with each other and with the underlying registry data.

**Tech Stack:** TypeScript (Node `--experimental-strip-types`, no build step), Zod for schema validation, plain-assert selfcheck files (no test framework) run via `npm test`.

## Global Constraints

- No test framework — selfchecks use `node:assert` + a local `check(name, fn)` helper, run via `node --experimental-strip-types <file>.selfcheck.ts`. Follow the existing style in `registry/registry.selfcheck.ts` exactly.
- Pure logic (anything that decides *what* the answer is) lives in `registry-lib.ts` and takes no I/O. I/O and rendering live in `registry-io.ts` / `prep.workflow.ts`.
- Eligibility is computed deterministically from `dependsOn` + `effectiveLifecycle` — never from the LLM's `blockedFeatures`/`graph` output (that stays exactly as unused as it is today; this plan does not touch it).
- A dangling `dependsOn` reference (id not present in the registry) must fail closed — `isEligible` returns `false`, not `true`.
- No changes to `blockedBy` (open-question blocking) or to `/status` — both are explicit non-goals of the design.
- No comments except where a subtle invariant needs explaining, matching the existing house style in the files this plan touches.

---

### Task 1: `isEligible()` pure helper

**Files:**
- Modify: `registry/registry-lib.ts` (append after `effectiveLifecycle`, currently the last function in the file, ending at line 693)
- Test: `registry/registry.selfcheck.ts`

**Interfaces:**
- Produces: `isEligible(feature: Feature, byId: Map<string, Feature>): boolean` — `true` iff every id in `feature.dependsOn` resolves to a feature in `byId` whose `effectiveLifecycle()` is `"done"`. An empty `dependsOn` is vacuously eligible. A dangling id (not in `byId`) makes it `false`.

- [ ] **Step 1: Write the failing tests**

Add to `registry/registry.selfcheck.ts`, right after the existing `check("resetGate clears a passed gate and is a no-op when already open", ...)` block and before the `// --- status projection ---` comment:

```ts
// --- dependency eligibility ---
check("isEligible is true for a feature with no dependencies", () => {
  const f: Feature = { ...speced[0], id: "F-010", dependsOn: [] };
  assert.equal(isEligible(f, new Map([[f.id, f]])), true);
});
check("isEligible is true when every dependency is done", () => {
  const dep: Feature = { ...speced[0], id: "F-011", lifecycle: "done" };
  const f: Feature = { ...speced[0], id: "F-012", dependsOn: ["F-011"] };
  const byId = new Map([[dep.id, dep], [f.id, f]]);
  assert.equal(isEligible(f, byId), true);
});
check("isEligible is false when a dependency isn't done", () => {
  const dep: Feature = { ...speced[0], id: "F-013", lifecycle: "queued" };
  const f: Feature = { ...speced[0], id: "F-014", dependsOn: ["F-013"] };
  const byId = new Map([[dep.id, dep], [f.id, f]]);
  assert.equal(isEligible(f, byId), false);
});
check("isEligible is false for a dangling dependency reference", () => {
  const f: Feature = { ...speced[0], id: "F-015", dependsOn: ["F-999"] };
  const byId = new Map([[f.id, f]]);
  assert.equal(isEligible(f, byId), false);
});
check("isEligible respects an overridden lifecycle on the dependency", () => {
  const dep: Feature = {
    ...speced[0],
    id: "F-016",
    lifecycle: "queued",
    overrides: { lifecycle: { value: "done", by: "ria", reason: "shipped out of band", at: now } },
  };
  const f: Feature = { ...speced[0], id: "F-017", dependsOn: ["F-016"] };
  const byId = new Map([[dep.id, dep], [f.id, f]]);
  assert.equal(isEligible(f, byId), true);
});
```

Add `isEligible` to the existing `registry-lib.ts` import at the top of `registry/registry.selfcheck.ts` (currently lines 8-22):

```ts
import {
  fingerprint,
  nextFeatureId,
  matchByFingerprint,
  mergeExtraction,
  applyRipple,
  attachScores,
  effectivePriority,
  computePriority,
  passGate,
  resetGate,
  markFeatureDone,
  isEligible,
  parseClientQuestions,
  type Feature,
  type ExtractedFeature,
} from "./registry-lib.ts";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL — `isEligible is not a function` (the import resolves to `undefined`).

- [ ] **Step 3: Write minimal implementation**

In `registry/registry-lib.ts`, append after the closing brace of `effectiveLifecycle` (the last line of the file, line 693):

```ts

/** Can this feature be built today? Every dependsOn id must resolve to a
 *  feature whose effective lifecycle is "done". A dangling reference (id
 *  not in the registry) fails closed — treated as not eligible, so a data
 *  problem surfaces as "blocked" rather than silently passing. */
export function isEligible(feature: Feature, byId: Map<string, Feature>): boolean {
  return feature.dependsOn.every((id) => {
    const dep = byId.get(id);
    return dep !== undefined && effectiveLifecycle(dep) === "done";
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: All checks print `✓`, ending in `NN checks passed.` (five more than before this task).

- [ ] **Step 5: Commit**

```bash
git add registry/registry-lib.ts registry/registry.selfcheck.ts
git commit -m "feat: add isEligible pure helper for dependency-aware build readiness"
```

---

### Task 2: `feature-queue.md` splits into Eligible now / Blocked by dependency

**Files:**
- Modify: `registry/registry-io.ts` (import, `renderFeatureQueue`'s active-features section, and its `## Queue` rendering block)
- Test: `registry/registry.selfcheck.ts`

**Interfaces:**
- Consumes: `isEligible(feature, byId)` from Task 1.
- Produces: nothing new for other tasks — `renderFeatureQueue`'s exported signature is unchanged, only its rendered output changes.

- [ ] **Step 1: Write the failing tests**

Add to `registry/registry.selfcheck.ts`, right after the existing `check("renderFeatureQueue links specs and drops the Details section", ...)` block, before the final `console.log`:

```ts
check("renderFeatureQueue splits Eligible now vs Blocked by dependency", () => {
  const dir = mkdtempSync(join(tmpdir(), "sandwich-queue-elig-"));
  const done: Feature = { ...speced[0], id: "F-020", title: "Done dep", lifecycle: "done" };
  const eligibleFeature: Feature = { ...speced[0], id: "F-021", title: "Ready to build", dependsOn: ["F-020"] };
  const blockedFeature: Feature = { ...speced[0], id: "F-022", title: "Waiting", dependsOn: ["F-021"] };
  renderFeatureQueue(dir, [done, eligibleFeature, blockedFeature], initProject("X", now));
  const md = readFileSync(join(dir, "docs", "sandwich", "feature-queue.md"), "utf8");
  assert.ok(md.includes("### Eligible now"), "should have an Eligible now section");
  assert.ok(md.includes("### Blocked by dependency"), "should have a Blocked by dependency section");
  const eligibleSection = md.split("### Blocked by dependency")[0];
  assert.ok(eligibleSection.includes("F-021"), "F-021 should be listed as eligible");
  assert.ok(!eligibleSection.includes("F-022"), "F-022 should not appear in the eligible section");
  const blockedSection = md.split("### Blocked by dependency")[1];
  assert.ok(blockedSection.includes("F-022"), "F-022 should be listed as blocked");
  assert.ok(blockedSection.includes("F-021"), "blocked row should say what it's waiting on (F-021)");
});
check("renderFeatureQueue omits the Blocked by dependency section when nothing is blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "sandwich-queue-noblock-"));
  renderFeatureQueue(dir, speced, initProject("X", now));
  const md = readFileSync(join(dir, "docs", "sandwich", "feature-queue.md"), "utf8");
  assert.ok(!md.includes("### Blocked by dependency"), "no blocked section when nothing is blocked");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL — `md.includes("### Eligible now")` is falsy (the queue still renders as one flat table under `## Queue`, no `### Eligible now` heading exists yet).

- [ ] **Step 3: Write minimal implementation**

In `registry/registry-io.ts`, add `isEligible` to the existing `registry-lib.ts` import (currently lines 23-41, `effectivePriority`/`effectiveLifecycle` are at lines 33-34):

```ts
  effectivePriority,
  effectiveLifecycle,
  isEligible,
```

Then in `renderFeatureQueue`, replace the `active` construction (currently):

```ts
  // Active features sorted by effective priority (human pins win).
  const active = features
    .filter((f) => !["done", "rejected"].includes(effectiveLifecycle(f)))
    .sort((a, b) => effectivePriority(b) - effectivePriority(a));
```

with:

```ts
  // Active features split into what's buildable today vs. waiting on a
  // dependency — score alone doesn't answer "can I build this now?".
  const active = features.filter((f) => !["done", "rejected"].includes(effectiveLifecycle(f)));
  const eligible = active
    .filter((f) => isEligible(f, byId))
    .sort((a, b) => effectivePriority(b) - effectivePriority(a));
  const blockedByDep = active.filter((f) => !isEligible(f, byId));
```

(`byId` here is the map already built two lines above this block — `const byId = new Map(features.map((f) => [f.id, f]));` — do not create a second map.)

Then replace the `## Queue` rendering block (currently):

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

with:

```ts
  lines.push("## Queue", "");
  lines.push("### Eligible now", "");
  if (eligible.length === 0) {
    lines.push("_(none — see below)_", "");
  } else {
    lines.push("| # | ID | Title | Module | Priority | Status | Spec |");
    lines.push("|---|----|-------|--------|----------|--------|------|");
    eligible.forEach((f, i) => {
      const pin = f.overrides.priority ? "📌" : "";
      lines.push(
        `| ${i + 1} | ${f.id} | ${f.title} | ${f.module} | ${pin}${effectivePriority(f)} | ${displayStatus(f)} | [specs/${f.id}.md](specs/${f.id}.md) |`
      );
    });
    lines.push("");
  }
  if (blockedByDep.length > 0) {
    lines.push("### Blocked by dependency", "");
    lines.push("| ID | Title | Waiting on | Spec |");
    lines.push("|----|-------|------------|------|");
    blockedByDep.forEach((f) => {
      const waitingOn = f.dependsOn
        .filter((id) => !byId.has(id) || effectiveLifecycle(byId.get(id)!) !== "done")
        .map((id) => label(id))
        .join(", ");
      lines.push(`| ${f.id} | ${f.title} | ${waitingOn} | [specs/${f.id}.md](specs/${f.id}.md) |`);
    });
    lines.push("");
  }
  lines.push("---", "");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: All checks print `✓`, ending in `NN checks passed.` (two more than after Task 1).

- [ ] **Step 5: Commit**

```bash
git add registry/registry-io.ts registry/registry.selfcheck.ts
git commit -m "feat: feature-queue.md splits into Eligible now / Blocked by dependency"
```

---

### Task 3: `/prep`'s recommendation requires eligibility too

**Files:**
- Modify: `prep/workflow/prep.workflow.ts` (import, and the `topUnblocked` block)

**Interfaces:**
- Consumes: `isEligible(feature, byId)` from Task 1.
- Produces: nothing new — terminal wiring.

- [ ] **Step 1: Add the import**

In `prep/workflow/prep.workflow.ts`, add `isEligible` to the existing `registry-lib.ts` import (currently lines 39-52):

```ts
import {
  matchByFingerprint,
  mergeExtraction,
  applyRipple,
  attachScores,
  effectivePriority,
  fingerprint,
  parseClientQuestions,
  passGate,
  markFeatureDone,
  isEligible,
  type Feature as RegistryFeature,
  type ExtractedFeature,
  type RippleReport,
} from "../../registry/registry-lib.ts";
```

- [ ] **Step 2: Fix the filter**

Replace the `topUnblocked` block (currently lines 456-460):

```ts
// Top unblocked candidates, drawn from features still in the brief.
const topUnblocked = currentFeatures()
  .filter((f) => f.blockedBy.length === 0)
  .sort((a, b) => effectivePriority(b) - effectivePriority(a))
  .slice(0, 3);
```

with:

```ts
// Top unblocked candidates, drawn from features still in the brief.
// Uses the full registryFeatures set (not currentFeatures()) to resolve
// dependency lifecycle, so a dependency dropped from the brief but already
// shipped (or not) still resolves correctly.
const byId = new Map(registryFeatures.map((f) => [f.id, f]));
const topUnblocked = currentFeatures()
  .filter((f) => f.blockedBy.length === 0 && isEligible(f, byId))
  .sort((a, b) => effectivePriority(b) - effectivePriority(a))
  .slice(0, 3);
```

- [ ] **Step 3: Manual smoke test**

`prep.workflow.ts` is a "workflow" file with injected globals (`agent`, `log`, `phase`, `args`) that cannot run directly via plain `node`. Verify the exact logic change with a focused scratch-directory test, simulating what the new filter does using the same registry functions it calls:

```bash
mkdir -p /tmp/topunblocked-smoke
cd /tmp/topunblocked-smoke
node --experimental-strip-types -e "
const { isEligible, effectivePriority } = await import('/Users/riaenriala/Documents/etalas/sandwich/registry/registry-lib.ts');

const base = {
  fingerprint: 'x', description: '', type: 'feature', module: 'Core', confidence: 'stated',
  flags: { needsReanalysis: false, stale: false, orphaned: false },
  provenance: { file: 'prd.md', briefHash: 'abc' }, blocks: [], blockedBy: [],
  overrides: {}, commits: [], createdAt: '2026-07-04T00:00:00.000Z', updatedAt: '2026-07-04T00:00:00.000Z',
};
const done = { ...base, id: 'F-001', title: 'Done dep', lifecycle: 'done', dependsOn: [], score: { priority: 10 } };
const eligible = { ...base, id: 'F-002', title: 'Ready, low score', lifecycle: 'queued', dependsOn: ['F-001'], score: { priority: 40 } };
const blocked = { ...base, id: 'F-003', title: 'Blocked, high score', lifecycle: 'queued', dependsOn: ['F-002'], score: { priority: 90 } };
const registryFeatures = [done, eligible, blocked];
const byId = new Map(registryFeatures.map((f) => [f.id, f]));

const topUnblocked = registryFeatures
  .filter((f) => f.blockedBy.length === 0 && isEligible(f, byId))
  .sort((a, b) => effectivePriority(b) - effectivePriority(a))
  .slice(0, 3);

console.log('topUnblocked:', topUnblocked.map((f) => f.id));
"
cd / && rm -rf /tmp/topunblocked-smoke
```

Expected output: `topUnblocked: [ 'F-002', 'F-001' ]` — trace through the filter by hand first: F-001 (`dependsOn: []`) is vacuously eligible, F-002 (`dependsOn: ["F-001"]`) is eligible because F-001 is `done`, F-003 (`dependsOn: ["F-002"]`, the highest score at 90) is **not** eligible because F-002 isn't `done` yet — so it's the only one excluded. The remaining two sort by `effectivePriority` descending: F-002 (40) before F-001 (10). The point of this smoke test is exactly that: F-003 has the highest score in the set but is correctly excluded from the recommendation because its dependency chain isn't finished. (Whether an already-`done` feature like F-001 should itself be excluded from `topUnblocked` is a separate, pre-existing question this plan doesn't address — `currentFeatures()` never filtered on lifecycle before this change either, so this plan introduces no regression there.)

- [ ] **Step 4: Commit**

```bash
git add prep/workflow/prep.workflow.ts
git commit -m "fix: /prep recommendation requires dependency eligibility, not just open-question clearance"
```

---

### Task 4: Full regression pass and end-to-end smoke test

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all four selfcheck suites pass (`prep/lib/validation.selfcheck.ts`, `prep/lib/spec.selfcheck.ts`, `registry/registry.selfcheck.ts`, `order/lib/validation.selfcheck.ts`), with `registry.selfcheck.ts`'s count now 7 checks higher than before this plan (5 from Task 1, 2 from Task 2).

- [ ] **Step 2: End-to-end smoke test tying isEligible into the real renderer**

```bash
mkdir -p /tmp/eligibility-e2e/.sandwich/registry /tmp/eligibility-e2e/docs/sandwich/specs
cd /tmp/eligibility-e2e
cat > .sandwich/registry/project.json <<'EOF'
{"schemaVersion":1,"name":"E2E","briefHashes":{"prd":null,"userFlows":null,"technicalNotes":null,"clientQuestions":null},"gates":{"briefApproved":{"passed":true},"queueApproved":{"passed":true}},"createdAt":"2026-07-04T00:00:00.000Z","updatedAt":"2026-07-04T00:00:00.000Z"}
EOF
cat > .sandwich/registry/features.json <<'EOF'
[
  {"id":"F-001","fingerprint":"a|core","title":"Auth core","type":"feature","module":"Core","confidence":"stated","lifecycle":"done","flags":{"needsReanalysis":false,"stale":false,"orphaned":false},"provenance":{"file":"prd.md","briefHash":"abc"},"dependsOn":[],"blocks":["F-002"],"blockedBy":[],"score":{"impact":{"score":9,"factors":["x"]},"effort":{"score":5,"factors":["x"]},"risk":{"score":3,"factors":["x"]},"urgency":{"factor":1.0,"reason":"x"},"priority":50,"formulaVersion":1},"overrides":{},"commits":[],"createdAt":"2026-07-04T00:00:00.000Z","updatedAt":"2026-07-04T00:00:00.000Z"},
  {"id":"F-002","fingerprint":"b|core","title":"Profile edit","type":"feature","module":"Core","confidence":"stated","lifecycle":"queued","flags":{"needsReanalysis":false,"stale":false,"orphaned":false},"provenance":{"file":"prd.md","briefHash":"abc"},"dependsOn":["F-001"],"blocks":[],"blockedBy":[],"score":{"impact":{"score":6,"factors":["x"]},"effort":{"score":4,"factors":["x"]},"risk":{"score":2,"factors":["x"]},"urgency":{"factor":1.0,"reason":"x"},"priority":40,"formulaVersion":1},"overrides":{},"commits":[],"createdAt":"2026-07-04T00:00:00.000Z","updatedAt":"2026-07-04T00:00:00.000Z"},
  {"id":"F-003","fingerprint":"c|core","title":"Billing export","type":"feature","module":"Core","confidence":"stated","lifecycle":"queued","flags":{"needsReanalysis":false,"stale":false,"orphaned":false},"provenance":{"file":"prd.md","briefHash":"abc"},"dependsOn":["F-002"],"blocks":[],"blockedBy":[],"score":{"impact":{"score":9,"factors":["x"]},"effort":{"score":2,"factors":["x"]},"risk":{"score":1,"factors":["x"]},"urgency":{"factor":1.5,"reason":"x"},"priority":90,"formulaVersion":1},"overrides":{},"commits":[],"createdAt":"2026-07-04T00:00:00.000Z","updatedAt":"2026-07-04T00:00:00.000Z"}
]
EOF
echo '[]' > .sandwich/registry/questions.json
echo '[]' > .sandwich/registry/decisions.json
touch .sandwich/registry/journal.jsonl

node --experimental-strip-types -e "
const { readFeatures, readProject, renderFeatureQueue } = await import('/Users/riaenriala/Documents/etalas/sandwich/registry/registry-io.ts');
const project = readProject(process.cwd());
const features = readFeatures(process.cwd());
renderFeatureQueue(process.cwd(), features, project);
"
echo "=== feature-queue.md ==="
cat docs/sandwich/feature-queue.md
cd / && rm -rf /tmp/eligibility-e2e
```

Expected: `F-002` (priority 40) appears under `### Eligible now` as row `#1` (its only dependency, F-001, is `done`). `F-003` (priority 90 — the highest score in the whole set) appears under `### Blocked by dependency` with `Waiting on: F-002 (Profile edit)` — confirming the exact bug report: the highest-scoring feature is correctly excluded from the ranked, buildable list because its dependency chain isn't finished.

- [ ] **Step 3: Confirm git status is clean and all task commits are present**

```bash
git log --oneline -4
git status --short
```

Expected: 3 commits from Tasks 1-3 (in order), working tree clean.

(No commit for this task — it's verification only.)
