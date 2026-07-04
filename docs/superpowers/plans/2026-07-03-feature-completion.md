# Feature Completion Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a human close out a feature (`/prep --done F-XXX`) and let `/status` tell a PM when a feature looks finished but hasn't been marked done yet.

**Architecture:** A pure `markFeatureDone()` helper in `registry-lib.ts` sets `lifecycle: "done"` and records commit SHAs (mirrors the existing `passGate`/`resetGate` pattern). A pure `featuresReadyToMarkDone()` helper in `completeness.ts` compares each active feature's spec (all acceptance criteria checked) against its registry lifecycle. Both get wired into the deterministic scripts that already do this class of work: `prep.workflow.ts` (the `--done` flag, alongside the existing `--approve` flag) and `prep/scripts/status.ts` (the audit passed into `renderStatus()`). The regenerated spec footer (`spec-render.ts`) gets one more line telling whoever implements the feature to close the loop.

**Tech Stack:** TypeScript (Node `--experimental-strip-types`, no build step), Zod for schema validation, plain-assert selfcheck files (no test framework) run via `npm test`.

## Global Constraints

- No test framework — selfchecks use `node:assert` + a local `check(name, fn)` helper, run via `node --experimental-strip-types <file>.selfcheck.ts`. Follow the existing style in `registry/registry.selfcheck.ts` and `prep/lib/spec.selfcheck.ts` exactly.
- Pure logic (anything that decides *what* changes) lives in `registry-lib.ts` or `prep/lib/*.ts` and takes no I/O — this is what selfchecks cover. I/O (reading/writing files, `git config`, journaling) lives in `*.workflow.ts` or `prep/scripts/*.ts` and is covered by manual smoke tests, matching the existing split (`passGate` is pure; the `--approve` branch in `prep.workflow.ts` does the I/O).
- Every registry write is followed by a re-render of the affected view (`renderFeatureQueue`, `renderStatus`) — views are disposable projections, never read back as state.
- Match existing code style: no comments except where a subtle invariant needs explaining (see the file headers already in `registry-lib.ts` / `completeness.ts` for the house style).

---

### Task 1: `markFeatureDone()` pure helper

**Files:**
- Modify: `registry/registry-lib.ts:357` (insert after `resetGate`, before the `// --- Questions ---` section comment)
- Test: `registry/registry.selfcheck.ts`

**Interfaces:**
- Produces: `markFeatureDone(feature: Feature, commits: string[], at: string): Feature` — sets `lifecycle: "done"`, merges `commits` into the feature's existing `commits` array with de-duplication (order preserved, existing entries first), bumps `updatedAt` to `at`. Does not touch `flags`, `overrides`, or any other field.

- [ ] **Step 1: Write the failing test**

Add to `registry/registry.selfcheck.ts` right after the `resetGate` check (currently ends at line 206, just before `// --- status projection ---`):

```ts
check("markFeatureDone sets lifecycle done and merges commits without duplicates", () => {
  const before: Feature = { ...speced[0], commits: ["abc111"] };
  const after = markFeatureDone(before, ["abc111", "def222"], "2026-07-03T00:00:00.000Z");
  assert.equal(after.lifecycle, "done");
  assert.deepEqual(after.commits, ["abc111", "def222"]);
  assert.equal(after.updatedAt, "2026-07-03T00:00:00.000Z");
  assert.equal(before.lifecycle, "speced", "input feature must not be mutated");
});
check("markFeatureDone with no commits leaves commits array untouched", () => {
  const before: Feature = { ...speced[0], commits: ["abc111"], lifecycle: "queued" };
  const after = markFeatureDone(before, [], "2026-07-03T00:00:00.000Z");
  assert.deepEqual(after.commits, ["abc111"]);
  assert.equal(after.lifecycle, "done");
});
```

Add `markFeatureDone` to the existing import from `./registry-lib.ts` at the top of the file (currently lines 8-22):

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
  parseClientQuestions,
  type Feature,
  type ExtractedFeature,
} from "./registry-lib.ts";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL — `markFeatureDone is not a function` (or a TypeScript-stripped equivalent `TypeError: markFeatureDone is not a function`), since the import resolves to `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `registry/registry-lib.ts`, insert immediately after the closing brace of `resetGate` (line 357) and before the `// ---------------------------------------------------------------------------\n// Questions —` comment block (line 359):

```ts

/** Mark a feature done and record what shipped it. Sets lifecycle directly —
 *  nothing computes "done", so there is no machine value to override. */
export function markFeatureDone(
  feature: Feature,
  commits: string[],
  at: string
): Feature {
  return {
    ...feature,
    lifecycle: "done",
    commits: Array.from(new Set([...feature.commits, ...commits])),
    updatedAt: at,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: All checks print `✓`, ending in `NN checks passed.` (two more than before this task).

- [ ] **Step 5: Commit**

```bash
git add registry/registry-lib.ts registry/registry.selfcheck.ts
git commit -m "feat: add markFeatureDone pure helper for closing out shipped features"
```

---

### Task 2: `featuresReadyToMarkDone()` + `allCriteriaDone` on `SpecPresence`

**Files:**
- Modify: `prep/lib/completeness.ts:13-17` (add field to `SpecPresence`), `:54-63` (add new function after `featuresMissingSpecs`)
- Test: `prep/lib/spec.selfcheck.ts`

**Interfaces:**
- Consumes: `Feature`, `isActive()` (local to `completeness.ts`), `SpecPresence` (extended, see below).
- Produces:
  - `SpecPresence` gains a required field: `allCriteriaDone: boolean`.
  - `featuresReadyToMarkDone(features: Feature[], specs: Map<string, SpecPresence>): string[]` — ids of active features whose spec has `allCriteriaDone === true`.

- [ ] **Step 1: Write the failing test**

Add to `prep/lib/spec.selfcheck.ts`, after the existing `check("featuresMissingSpecs lists active features lacking a valid spec", ...)` block (currently ends at line 187) and before the `check("overridden lifecycle ...")` block:

```ts
check("featuresReadyToMarkDone includes an active feature whose spec has every AC checked", () => {
  const specs = new Map([
    ["F-001", { jsonValid: true, errors: [], mdExists: true, allCriteriaDone: true }],
    ["F-002", { jsonValid: true, errors: [], mdExists: true, allCriteriaDone: false }],
  ]);
  assert.deepEqual(
    featuresReadyToMarkDone([feature("F-001"), feature("F-002")], specs),
    ["F-001"]
  );
});
check("featuresReadyToMarkDone excludes a feature already done, even with all ACs checked", () => {
  const specs = new Map([["F-001", { jsonValid: true, errors: [], mdExists: true, allCriteriaDone: true }]]);
  assert.deepEqual(featuresReadyToMarkDone([feature("F-001", "done")], specs), []);
});
check("featuresReadyToMarkDone excludes a feature with no spec on record", () => {
  assert.deepEqual(featuresReadyToMarkDone([feature("F-001")], new Map()), []);
});
```

Update the `completeness.ts` import at the top of `prep/lib/spec.selfcheck.ts` (currently lines 101-106):

```ts
import {
  auditCompleteness,
  decisionTargetsMissing,
  featuresMissingSpecs,
  featuresReadyToMarkDone,
  type CompletenessInput,
} from "./completeness.ts";
```

Also update every existing `Map<string, SpecPresence>` fixture built inline in this file so it satisfies the now-required `allCriteriaDone` field. Concretely:
- Line 135 (`completeInput()`): `["F-001", { jsonValid: true, errors: [], mdExists: true, allCriteriaDone: false }]`
- Line 157: `{ jsonValid: false, errors: ["title: Required"], mdExists: false, allCriteriaDone: false }`
- Line 164: `{ jsonValid: true, errors: [], mdExists: true, allCriteriaDone: false }`
- Line 185: `["F-001", { jsonValid: false, errors: ["x"], mdExists: true, allCriteriaDone: false }]`
- Line 195 (`overridden lifecycle` test): change the empty-map type annotation from
  `new Map<string, { jsonValid: boolean; errors: string[]; mdExists: boolean }>()`
  to `new Map<string, { jsonValid: boolean; errors: string[]; mdExists: boolean; allCriteriaDone: boolean }>()`
- Line 202 (`rejected features` test): same type-annotation change as line 195

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: FAIL — `featuresReadyToMarkDone is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `prep/lib/completeness.ts`, change the `SpecPresence` interface (lines 13-17):

```ts
export interface SpecPresence {
  jsonValid: boolean;
  errors: string[];
  mdExists: boolean;
  allCriteriaDone: boolean;
}
```

Then add a new exported function immediately after `featuresMissingSpecs` (which currently ends at line 63, right before `export function auditCompleteness`):

```ts

/** Active features whose spec shows every acceptance criterion checked, but
 *  whose registry lifecycle isn't "done" yet — the signal /status surfaces
 *  so a human can confirm and run /prep --done. */
export function featuresReadyToMarkDone(
  features: Feature[],
  specs: Map<string, SpecPresence>
): string[] {
  return features
    .filter(isActive)
    .filter((f) => specs.get(f.id)?.allCriteriaDone === true)
    .map((f) => f.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: All checks print `✓`, ending in `NN checks passed.` (three more than before this task).

- [ ] **Step 5: Commit**

```bash
git add prep/lib/completeness.ts prep/lib/spec.selfcheck.ts
git commit -m "feat: add featuresReadyToMarkDone completeness signal"
```

---

### Task 3: Wire `readyToMarkDone` into `renderStatus()`

**Files:**
- Modify: `registry/registry-io.ts:733` (audit param type), `:769-770` (new todo line)
- Test: `registry/registry.selfcheck.ts`

**Interfaces:**
- Consumes: `featuresReadyToMarkDone` output shape (`string[]` of feature ids) — passed in by the caller (Task 4 wires the real caller; this task only changes `renderStatus`'s signature and rendering).
- Produces: `renderStatus`'s `audit` param becomes `{ missingSpecs: string[]; missingDecisionTargets: string[]; readyToMarkDone: string[] }` (all three now required together — still an optional param overall).

- [ ] **Step 1: Write the failing test**

In `registry/registry.selfcheck.ts`, modify the existing `check("renderStatus surfaces completeness audit findings", ...)` block (currently lines 223-233) to include the new field and assert on it:

```ts
check("renderStatus surfaces completeness audit findings", () => {
  const txt = renderStatus(
    speced,
    initProject("X", now),
    [],
    [],
    { missingSpecs: ["F-004", "F-007"], missingDecisionTargets: ["D2"], readyToMarkDone: ["F-009"] }
  );
  assert.ok(txt.includes("F-004, F-007"), "should list features missing specs");
  assert.ok(txt.includes("D2"), "should list unrecorded decisions");
  assert.ok(txt.includes("F-009"), "should list features ready to mark done");
  assert.ok(txt.includes("/prep --done"), "should prompt the command to close it out");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL — assertion `txt.includes("F-009")` is falsy (the field is accepted by the object literal at runtime since types are stripped, but `renderStatus` doesn't read or render it yet).

- [ ] **Step 3: Write minimal implementation**

In `registry/registry-io.ts`, change the `renderStatus` signature (line 728-734):

```ts
export function renderStatus(
  features: Feature[],
  project: Project,
  journal: JournalEvent[],
  questions: Question[],
  audit?: { missingSpecs: string[]; missingDecisionTargets: string[]; readyToMarkDone: string[] }
): string {
```

Then insert a new todo line right after the `orphaned` block and before the `queueApproved` gate check (currently lines 769-772):

```ts
  if (orphaned.length)
    todos.push(`Confirm removal of ${orphaned.length} orphaned feature(s): ${orphaned.map((f) => f.id).join(", ")}`);
  if (audit?.readyToMarkDone.length)
    todos.push(
      `Confirm & mark done — every AC checked: ${audit.readyToMarkDone.join(", ")} → /prep --done <id>`
    );
  if (!project.gates.queueApproved.passed && features.length)
    todos.push("Approve the queue once you're happy with priorities: /prep --approve");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: All checks print `✓`, ending in `NN checks passed.`.

- [ ] **Step 5: Commit**

```bash
git add registry/registry-io.ts registry/registry.selfcheck.ts
git commit -m "feat: renderStatus surfaces features ready to mark done"
```

---

### Task 4: Compute the signal in `prep/scripts/status.ts`

**Files:**
- Modify: `prep/scripts/status.ts:7-24` (imports), `:69-79` (spec loop), `:81-86` (renderStatus call)

**Interfaces:**
- Consumes: `featuresReadyToMarkDone` (Task 2), `renderStatus`'s new `audit.readyToMarkDone` (Task 3), `validateFeatureSpec` (existing, returns `{ valid, data, errors }` where `data.acceptanceCriteria` is `{ id, text, done }[]`).
- Produces: nothing new for other tasks to consume — this is the terminal wiring point (a script, not a library).

- [ ] **Step 1: Update imports**

In `prep/scripts/status.ts`, change the `completeness.ts` import (currently lines 8-12):

```ts
import {
  featuresMissingSpecs,
  decisionTargetsMissing,
  featuresReadyToMarkDone,
  type SpecPresence,
} from "../lib/completeness.ts";
```

- [ ] **Step 2: Compute `allCriteriaDone` while building the specs map**

Replace the spec-loading loop (currently lines 69-79):

```ts
const prep = getPrepPaths(projectRoot);
const specs = new Map<string, SpecPresence>();
if (existsSync(prep.specsDir)) {
  for (const file of readdirSync(prep.specsDir).filter((f) => f.endsWith(".json"))) {
    const id = file.replace(/\.json$/, "");
    let jsonValid = false;
    let allCriteriaDone = false;
    try {
      const r = validateFeatureSpec(JSON.parse(readFileSync(join(prep.specsDir, file), "utf8")));
      jsonValid = r.valid;
      allCriteriaDone = r.valid && (r.data?.acceptanceCriteria.length ?? 0) > 0 && (r.data?.acceptanceCriteria.every((ac) => ac.done) ?? false);
    } catch {}
    specs.set(id, { jsonValid, errors: [], mdExists: existsSync(join(prep.specsDir, `${id}.md`)), allCriteriaDone });
  }
}
```

- [ ] **Step 3: Pass the signal to `renderStatus`**

Replace the final `renderStatus` call (currently lines 81-86):

```ts
console.log(
  renderStatus(features, project, journal, questions, {
    missingSpecs: featuresMissingSpecs(features, specs),
    missingDecisionTargets: decisionTargetsMissing(journal, decisions),
    readyToMarkDone: featuresReadyToMarkDone(features, specs),
  })
);
```

- [ ] **Step 4: Manual smoke test**

There's no existing selfcheck harness for the scripts under `prep/scripts/` (they're thin I/O wrappers around the tested library functions) — verify by hand with a scratch fixture tree:

```bash
mkdir -p /tmp/status-smoke/.sandwich/registry /tmp/status-smoke/docs/sandwich/specs
cd /tmp/status-smoke
cat > .sandwich/registry/project.json <<'EOF'
{"schemaVersion":1,"name":"Smoke","briefHashes":{"prd":null,"userFlows":null,"technicalNotes":null,"clientQuestions":null},"gates":{"briefApproved":{"passed":true},"queueApproved":{"passed":true}},"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}
EOF
cat > .sandwich/registry/features.json <<'EOF'
[{"id":"F-001","fingerprint":"x|core","title":"Test feature","type":"feature","module":"Core","confidence":"stated","lifecycle":"speced","flags":{"needsReanalysis":false,"stale":false,"orphaned":false},"provenance":{"file":"prd.md","briefHash":"abc"},"dependsOn":[],"blocks":[],"blockedBy":[],"overrides":{},"commits":[],"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}]
EOF
echo '[]' > .sandwich/registry/questions.json
echo '[]' > .sandwich/registry/decisions.json
touch .sandwich/registry/journal.jsonl
cat > docs/sandwich/specs/F-001.json <<'EOF'
{"featureId":"F-001","title":"Test feature","module":"Core","description":"d","scope":{"inScope":["a"],"outOfScope":[]},"acceptanceCriteria":[{"id":"AC1","text":"works","done":true}],"dependsOn":[],"source":{"file":"prd.md"}}
EOF
node --experimental-strip-types /Users/riaenriala/Documents/etalas/sandwich/prep/scripts/status.ts . | grep -A2 "Awaiting you"
cd / && rm -rf /tmp/status-smoke
```

Expected output includes a line like:
```
  • Confirm & mark done — every AC checked: F-001 → /prep --done F-001
```
(the `<id>` placeholder in the template string is replaced by the real feature id list, not literal `<id>` — only the trailing `/prep --done <id>` suffix is generic usage text).

- [ ] **Step 5: Commit**

```bash
git add prep/scripts/status.ts
git commit -m "feat: /status computes and surfaces the ready-to-mark-done signal"
```

---

### Task 5: Keep `verify-complete.ts` type-consistent with the new `SpecPresence` field

**Files:**
- Modify: `prep/scripts/verify-complete.ts:41-45`

**Interfaces:**
- Consumes: `SpecPresence` (now requires `allCriteriaDone`).
- Produces: nothing new — this task only keeps an existing consumer consistent with Task 2's interface change.

- [ ] **Step 1: Add the field**

In `prep/scripts/verify-complete.ts`, the specs loop currently builds (lines 41-45):

```ts
    specs.set(id, {
      jsonValid,
      errors,
      mdExists: existsSync(join(prep.specsDir, `${id}.md`)),
    });
```

Change to:

```ts
    specs.set(id, {
      jsonValid,
      errors,
      mdExists: existsSync(join(prep.specsDir, `${id}.md`)),
      allCriteriaDone: false,
    });
```

`verify-complete.ts` checks artifact *existence and validity*, not AC completion — it never reads this field, so a constant `false` is correct and intentional, not a stub to fill in later.

- [ ] **Step 2: Regression-test the completeness suite**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: unchanged pass count from Task 2 — this task doesn't add or change any assertions, only keeps a second consumer of the interface honest.

- [ ] **Step 3: Manual smoke test**

```bash
mkdir -p /tmp/verify-smoke/.sandwich/registry /tmp/verify-smoke/docs/sandwich/specs
cd /tmp/verify-smoke
cat > .sandwich/registry/project.json <<'EOF'
{"schemaVersion":1,"name":"Smoke","briefHashes":{"prd":null,"userFlows":null,"technicalNotes":null,"clientQuestions":null},"gates":{"briefApproved":{"passed":false},"queueApproved":{"passed":false}},"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}
EOF
echo '[]' > .sandwich/registry/features.json
echo '[]' > .sandwich/registry/questions.json
echo '[]' > .sandwich/registry/decisions.json
touch .sandwich/registry/journal.jsonl
touch docs/sandwich/feature-queue.md
node --experimental-strip-types /Users/riaenriala/Documents/etalas/sandwich/prep/scripts/verify-complete.ts .
cd / && rm -rf /tmp/verify-smoke
```

Expected: `✓ /prep output is complete` (exit 0) — confirms the added field didn't break the existing pass path.

- [ ] **Step 4: Commit**

```bash
git add prep/scripts/verify-complete.ts
git commit -m "chore: keep verify-complete.ts consistent with SpecPresence.allCriteriaDone"
```

---

### Task 6: `/prep --done F-XXX [commit-sha...]`

**Files:**
- Modify: `prep/workflow/prep.workflow.ts:39-50` (import), `:97-101` (arg parsing), `:121-147` (insert new branch after the existing `--approve` branch)

**Interfaces:**
- Consumes: `markFeatureDone` (Task 1), `writeFeatures`, `appendJournal`, `renderFeatureQueue`, `tryExec` (all already imported/defined in this file).
- Produces: nothing new for other tasks — terminal wiring.

- [ ] **Step 1: Add the import**

In `prep/workflow/prep.workflow.ts`, add `markFeatureDone` to the existing `registry-lib.ts` import (currently lines 39-50):

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
  type Feature as RegistryFeature,
  type ExtractedFeature,
  type RippleReport,
} from "../../registry/registry-lib.ts";
```

- [ ] **Step 2: Parse the new flag and its arguments**

Add after the existing `const approveQueue = argv.includes("--approve");` line (currently line 101):

```ts
const doneFlagIdx = argv.indexOf("--done");
const markDone = doneFlagIdx !== -1;
const doneCommits = markDone
  ? argv.slice(doneFlagIdx + 1).filter((a) => a !== featureIdArg && !a.startsWith("--"))
  : [];
```

- [ ] **Step 3: Add the branch**

Insert immediately after the existing `--approve` branch's closing brace (currently line 147, right before the `// Per-artifact hashes` comment):

```ts

// Special case: mark a feature done — no extraction, just closes out one
// feature once implementation is verified. Mirrors the --approve branch.
if (markDone) {
  if (!featureIdArg) {
    throw new Error("Usage: /prep --done F-XXX [commit-sha...]");
  }
  const target = existingFeatures.find((f) => f.id === featureIdArg);
  if (!target) {
    throw new Error(`${featureIdArg} not found in the registry. Run /prep first.`);
  }
  if (target.lifecycle === "done") {
    log(`${featureIdArg} is already marked done.`);
    throw new Error("SKIP");
  }
  const actor = tryExec("git config user.name", projectRoot).trim() || "human";
  const updated = markFeatureDone(target, doneCommits, now);
  const nextFeatures = existingFeatures.map((f) => (f.id === featureIdArg ? updated : f));
  writeFeatures(projectRoot, nextFeatures);
  appendJournal(projectRoot, {
    ts: now,
    actor,
    type: "lifecycle-changed",
    target: featureIdArg,
    summary: `${featureIdArg} marked done by ${actor}`,
    data: { from: target.lifecycle, to: "done", commits: updated.commits },
  });
  renderFeatureQueue(projectRoot, nextFeatures, project);
  log(`✓ ${featureIdArg} marked done${doneCommits.length ? ` (${doneCommits.join(", ")})` : ""}`);
  log("✓ docs/sandwich/feature-queue.md");
  throw new Error("SKIP");
}
```

- [ ] **Step 4: Manual smoke test**

Workflow files run through the harness's `agent`/`log`/`phase`/`args` globals, not plain `node` — verify the underlying sequence directly (same approach used to verify `--approve` earlier), simulating exactly what the new branch does:

```bash
mkdir -p /tmp/done-smoke/.sandwich/registry
cd /tmp/done-smoke
cat > .sandwich/registry/project.json <<'EOF'
{"schemaVersion":1,"name":"Smoke","briefHashes":{"prd":null,"userFlows":null,"technicalNotes":null,"clientQuestions":null},"gates":{"briefApproved":{"passed":false},"queueApproved":{"passed":true}},"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}
EOF
cat > .sandwich/registry/features.json <<'EOF'
[{"id":"F-001","fingerprint":"x|core","title":"Test feature","type":"feature","module":"Core","confidence":"stated","lifecycle":"speced","flags":{"needsReanalysis":false,"stale":false,"orphaned":false},"provenance":{"file":"prd.md","briefHash":"abc"},"dependsOn":[],"blocks":[],"blockedBy":[],"overrides":{},"commits":[],"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}]
EOF
echo '[]' > .sandwich/registry/questions.json
touch .sandwich/registry/journal.jsonl
node --experimental-strip-types -e "
const projectRoot = process.cwd();
const { readFeatures, writeFeatures, appendJournal, renderFeatureQueue, readProject } = await import('/Users/riaenriala/Documents/etalas/sandwich/registry/registry-io.ts');
const { markFeatureDone } = await import('/Users/riaenriala/Documents/etalas/sandwich/registry/registry-lib.ts');
const project = readProject(projectRoot);
const features = readFeatures(projectRoot);
const target = features.find(f => f.id === 'F-001');
const updated = markFeatureDone(target, ['abc1234'], new Date().toISOString());
const next = features.map(f => f.id === 'F-001' ? updated : f);
writeFeatures(projectRoot, next);
appendJournal(projectRoot, { ts: new Date().toISOString(), actor: 'Ria', type: 'lifecycle-changed', target: 'F-001', summary: 'F-001 marked done by Ria', data: { from: 'speced', to: 'done', commits: updated.commits } });
renderFeatureQueue(projectRoot, next, project);
const after = readFeatures(projectRoot);
console.log('lifecycle:', after[0].lifecycle, 'commits:', after[0].commits);
"
echo "--- feature-queue.md active list should NOT contain F-001 ---"
grep -c "F-001" docs/sandwich/feature-queue.md || echo "0 (correctly dropped)"
cat .sandwich/registry/journal.jsonl
cd / && rm -rf /tmp/done-smoke
```

Expected: `lifecycle: done commits: [ 'abc1234' ]`, the grep shows F-001 is not in the active queue table, and the journal line shows `"type":"lifecycle-changed"` with `"to":"done"`.

- [ ] **Step 5: Commit**

```bash
git add prep/workflow/prep.workflow.ts
git commit -m "feat: /prep --done F-XXX marks a feature complete and records commits"
```

---

### Task 7: Spec footer closing instruction

**Files:**
- Modify: `prep/lib/spec-render.ts` (the `"## Mulai kerja"` block)
- Test: `prep/lib/spec.selfcheck.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a pure content change to an already-tested renderer.

- [ ] **Step 1: Write the failing test**

Add an assertion to the existing `check("renderSpecMd renders header, scope, checklist, and hand-off", ...)` block in `prep/lib/spec.selfcheck.ts` (currently lines 73-83), right after the existing `assert.ok(md.includes("superpowers:brainstorming"));` line:

```ts
  assert.ok(md.includes("/prep --done F-001"), "footer should tell the implementer how to close out the feature");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: FAIL — the new substring isn't in the rendered markdown yet.

- [ ] **Step 3: Write minimal implementation**

In `prep/lib/spec-render.ts`, the `"## Mulai kerja"` block currently reads:

```ts
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
```

Change to:

```ts
    "## Mulai kerja",
    "",
    "1. Jalankan `superpowers:brainstorming` dengan file ini sebagai starting point —",
    "   scope & AC di atas adalah requirement; task breakdown dan pilihan teknis",
    "   diputuskan di sesi brainstorming (dengan akses codebase).",
    "2. Setelah implementasi, centang tiap AC yang sudah terbukti jalan",
    `   (update \`done\` di \`${spec.featureId}.json\`, lalu jalankan ulang render-specs).`,
    "3. Setelah semua AC tercentang, tandai fitur selesai di registry:",
    `   \`/prep --done ${spec.featureId} [commit-sha ...]\` — ini yang menghapus`,
    "   fitur dari feature-queue aktif dan membuatnya muncul sebagai shipped di /status.",
    "",
    `_Generated by /prep — edit \`${spec.featureId}.json\`, bukan file ini (akan di-overwrite)._`,
    "",
  ];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: All checks print `✓`, ending in `NN checks passed.`.

- [ ] **Step 5: Commit**

```bash
git add prep/lib/spec-render.ts prep/lib/spec.selfcheck.ts
git commit -m "feat: spec footer instructs closing the loop with /prep --done"
```

---

### Task 8: Documentation

**Files:**
- Modify: `prep/skills/prep/SKILL.md` (commands table), `prep/skills/status/SKILL.md` (Output section), `README.md` (full command reference)

**Interfaces:** None — prose only.

- [ ] **Step 1: `prep/skills/prep/SKILL.md`**

The commands table currently reads (after the `--approve` row added in an earlier session):

```
| `/prep --impact-only [feature-id]` | Skip prioritization, just analyze impact |
| `/prep --queue-only` | Update queue without recommendation |
| `/prep --approve` | Pass the `queueApproved` gate — confirms scores/overrides/removals |
```

Add a row after it:

```
| `/prep --done F-XXX [commit-sha...]` | Mark a feature done, recording any commit SHAs |
```

- [ ] **Step 2: `prep/skills/status/SKILL.md`**

The "Output" section currently reads (in the paragraph describing what the dashboard covers):

```
The dashboard covers: gates, lifecycle counts, flags, **Awaiting you** (open
questions, changed features, stale specs, orphans, missing spec files,
decisions recorded in the journal but absent from decisions.json, queue
approval), and recent activity. Do not hand-assemble these — the script is
the single source of the numbers.
```

Change the parenthetical to add the new signal, right after "orphans":

```
The dashboard covers: gates, lifecycle counts, flags, **Awaiting you** (open
questions, changed features, stale specs, orphans, features whose spec shows
every acceptance criterion checked but aren't marked done yet, missing spec
files, decisions recorded in the journal but absent from decisions.json,
queue approval), and recent activity. Do not hand-assemble these — the
script is the single source of the numbers.
```

- [ ] **Step 3: `README.md`**

The full command reference table currently reads:

```
| `/prep --fresh` | Force re-extraction, ignore existing registry |
| `/prep --approve` | Approve the queue (passes the `queueApproved` gate) |
| `/prep F-001` | Deep impact analysis for a specific feature |
```

Add a row after `--approve`:

```
| `/prep --fresh` | Force re-extraction, ignore existing registry |
| `/prep --approve` | Approve the queue (passes the `queueApproved` gate) |
| `/prep --done F-001 [sha...]` | Mark a feature done and record its commits |
| `/prep F-001` | Deep impact analysis for a specific feature |
```

- [ ] **Step 4: Commit**

```bash
git add prep/skills/prep/SKILL.md prep/skills/status/SKILL.md README.md
git commit -m "docs: document /prep --done and the ready-to-mark-done status signal"
```

---

### Task 9: Full regression pass and end-to-end smoke test

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all three selfcheck files pass — `registry.selfcheck.ts`, `prep/lib/validation.selfcheck.ts` (unaffected, sanity check), `order/lib/validation.selfcheck.ts` (unaffected, sanity check) — and `prep/lib/spec.selfcheck.ts` (run it explicitly too, since it isn't wired into the `npm test` script — confirm this and, if missing, that's a pre-existing gap outside this plan's scope, not something to fix here):

```bash
node --experimental-strip-types prep/lib/spec.selfcheck.ts
```

Expected: all checks `✓`, final count line printed, exit code 0.

- [ ] **Step 2: End-to-end smoke test tying all three pieces together**

```bash
mkdir -p /tmp/e2e-smoke/.sandwich/registry /tmp/e2e-smoke/docs/sandwich/specs
cd /tmp/e2e-smoke
cat > .sandwich/registry/project.json <<'EOF'
{"schemaVersion":1,"name":"E2E","briefHashes":{"prd":null,"userFlows":null,"technicalNotes":null,"clientQuestions":null},"gates":{"briefApproved":{"passed":true},"queueApproved":{"passed":true}},"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}
EOF
cat > .sandwich/registry/features.json <<'EOF'
[{"id":"F-001","fingerprint":"x|core","title":"Test feature","type":"feature","module":"Core","confidence":"stated","lifecycle":"speced","flags":{"needsReanalysis":false,"stale":false,"orphaned":false},"provenance":{"file":"prd.md","briefHash":"abc"},"dependsOn":[],"blocks":[],"blockedBy":[],"overrides":{},"commits":[],"createdAt":"2026-07-03T00:00:00.000Z","updatedAt":"2026-07-03T00:00:00.000Z"}]
EOF
echo '[]' > .sandwich/registry/questions.json
echo '[]' > .sandwich/registry/decisions.json
touch .sandwich/registry/journal.jsonl
cat > docs/sandwich/specs/F-001.json <<'EOF'
{"featureId":"F-001","title":"Test feature","module":"Core","description":"d","scope":{"inScope":["a"],"outOfScope":[]},"acceptanceCriteria":[{"id":"AC1","text":"works","done":true}],"dependsOn":[],"source":{"file":"prd.md"}}
EOF

echo "=== 1. status shows F-001 as ready to mark done ==="
node --experimental-strip-types /Users/riaenriala/Documents/etalas/sandwich/prep/scripts/status.ts . | grep "mark done"

echo "=== 2. mark it done (simulating /prep --done F-001 abc1234) ==="
node --experimental-strip-types -e "
const projectRoot = process.cwd();
const { readFeatures, writeFeatures, appendJournal, renderFeatureQueue, readProject } = await import('/Users/riaenriala/Documents/etalas/sandwich/registry/registry-io.ts');
const { markFeatureDone } = await import('/Users/riaenriala/Documents/etalas/sandwich/registry/registry-lib.ts');
const project = readProject(projectRoot);
const features = readFeatures(projectRoot);
const updated = markFeatureDone(features.find(f => f.id === 'F-001'), ['abc1234'], new Date().toISOString());
const next = features.map(f => f.id === 'F-001' ? updated : f);
writeFeatures(projectRoot, next);
appendJournal(projectRoot, { ts: new Date().toISOString(), actor: 'Ria', type: 'lifecycle-changed', target: 'F-001', summary: 'F-001 marked done by Ria', data: { from: 'speced', to: 'done' } });
renderFeatureQueue(projectRoot, next, project);
"

echo "=== 3. status no longer flags it, lifecycle count shows done:1 ==="
node --experimental-strip-types /Users/riaenriala/Documents/etalas/sandwich/prep/scripts/status.ts . | grep -E "mark done|done 1|proposed"

cd / && rm -rf /tmp/e2e-smoke
```

Expected:
- Step 1 output: `  • Confirm & mark done — every AC checked: F-001 → /prep --done <id>`
- Step 3 output: the "mark done" grep returns nothing (feature is now done, filtered out by `isActive`), and the lifecycle counts line shows `done 1`.

- [ ] **Step 3: Confirm git status is clean and all task commits are present**

```bash
git log --oneline -9
git status --short
```

Expected: 8 commits from Tasks 1–8 (in order), working tree clean.

(No commit for this task — it's verification only.)
