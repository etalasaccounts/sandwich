# Remove Approval Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the `briefApproved`/`queueApproved` approval gates and the `proposed`/`queued` lifecycle split, per the approved design at `docs/superpowers/specs/2026-07-05-remove-approval-gates-design.md`.

**Architecture:** This is a subtraction across the registry's pure schema/logic layer (`registry-lib.ts`), its filesystem/rendering layer (`registry-io.ts`), the `/prep` command (`prep.workflow.ts`), and their docs. Old on-disk registries (`lifecycle: "proposed"`, a `gates` object in `project.json`) must keep reading correctly with zero manual migration — read-path normalization handles both cases, write-path schemas simply no longer have the fields.

**Tech Stack:** TypeScript run via `node --experimental-strip-types` (no build step), Zod ^3.25.76 for schemas, plain-assert self-check test files (no test framework).

## Global Constraints

- No new approval mechanism replaces the gates — this is a pure subtraction (per design doc's Non-Goals).
- `decisions.json`'s own `status: "proposed" | "accepted" | "superseded"` enum is untouched — unrelated ADR-lite concept.
- `isEligible`/`blockedBy`/dependency logic is untouched — out of scope.
- `"gate-passed"` stays in `JournalEventSchema`'s `type` enum forever (old journal lines must stay parseable) — just stop emitting it.
- Old `lifecycle: "proposed"` on disk must silently normalize to `"queued"` on read (same fallback path already used for any invalid lifecycle string).
- Old `gates` key in `project.json` must be silently dropped on read, not rejected — `ProjectSchema` has no `.strict()`, so this requires no special code once the field is removed from the schema.
- Verify every task with `npm test` (runs all five `*.selfcheck.ts` files in sequence) — never claim a task done without it passing.
- Do not touch `.claude/worktrees/*` — those are separate, unrelated in-progress branches.

---

### Task 1: Collapse `proposed` → `queued` lifecycle

**Files:**
- Modify: `registry/registry-lib.ts:72-81` (LifecycleSchema), `:551-577` (mergeExtraction's "added" branch)
- Modify: `registry/registry-io.ts:168-196` (normalizeFeature)
- Test: `registry/registry.selfcheck.ts` (multiple checks, listed below)
- Test: `prep/lib/spec.selfcheck.ts:111,209` (fixture helper + one call site)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LifecycleSchema` now has 7 values (`"queued" | "speced" | "building" | "review" | "done" | "deferred" | "rejected"`), no `"proposed"`. `mergeExtraction` mints new features as `"queued"`. `normalizeFeature`'s every fallback default is `"queued"` instead of `"proposed"`.

- [ ] **Step 1: Update the selfcheck tests to expect `"queued"` (this makes them fail against current code)**

In `registry/registry.selfcheck.ts`, find:

```typescript
check("a brand-new extraction mints F-001 as proposed", () => {
  assert.equal(existing.length, 1);
  assert.equal(existing[0].id, "F-001");
  assert.equal(existing[0].lifecycle, "proposed");
});
```

Replace with:

```typescript
check("a brand-new extraction mints F-001 as queued", () => {
  assert.equal(existing.length, 1);
  assert.equal(existing[0].id, "F-001");
  assert.equal(existing[0].lifecycle, "queued");
});
```

Find the rogue-LLM normalization test:

```typescript
  check("readFeatures normalizes LLM-invented field names and fills defaults", () => {
    writeFileSync(join(rogueReg, "features.json"), JSON.stringify([
      {
        id: "F-002", title: "Add Sentry", confidence_marker: "[inferred]",
        lifecycle: { status: "blocked", blocked_by: ["Q2"] },
        source: { file: "technical-notes.md", line_range: [118, 125], context: "no crash reporting" },
        scores: { impact: 8, effort: 3, risk: 3, urgency: 7 },
      },
    ]));
    const result = readFeatures(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "F-002");
    assert.equal(result[0].lifecycle, "proposed");
```

Change the last assertion to:

```typescript
    assert.equal(result[0].lifecycle, "queued");
```

Find the unsalvageable-items test and swap its "Good" fixture's lifecycle literal so the test keeps checking what it's meant to check (survival of a valid item), not the now-changed default:

```typescript
  check("readFeatures skips items that cannot be salvaged", () => {
    writeFileSync(join(rogueReg, "features.json"), JSON.stringify({
      features: [
        { id: "F-001", title: "Good", type: "feature", module: "X", confidence: "stated",
          lifecycle: "proposed", fingerprint: "fp1", provenance: { file: "a.md", briefHash: "h" },
          createdAt: now, updatedAt: now },
        { garbage: true },
        42,
      ],
    }));
```

Change `lifecycle: "proposed",` to `lifecycle: "queued",` in that fixture.

Find the `readFeatures unwraps { features: [...] } wrapper` test and turn it into the direct backward-compat regression check — keep the on-disk literal as `"proposed"` (simulating an old registry file) but assert the read-back value migrated to `"queued"`:

```typescript
  check("readFeatures unwraps { features: [...] } wrapper", () => {
    writeFileSync(join(rogueReg, "features.json"), JSON.stringify({
      features: [
        {
          id: "F-001", fingerprint: "abc123", title: "Test Feature", type: "feature",
          module: "Core", confidence: "stated", lifecycle: "proposed",
          provenance: { file: "prd.md", briefHash: "hash1" },
          createdAt: now, updatedAt: now,
        },
      ],
    }));
    const result = readFeatures(roguedir);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "F-001");
  });
```

Add an assertion after the `id` check:

```typescript
    assert.equal(result[0].id, "F-001");
    assert.equal(result[0].lifecycle, "queued", "old on-disk \"proposed\" must migrate to \"queued\" on read");
  });
```

Find the pi-gate test and update its fallback-default assertion:

```typescript
check("gate recomputes feature priority from dimensions, ignoring the model's number", () => {
  const raw = JSON.stringify([
    {
      id: "F-001",
      title: "User auth flow",
      module: "Auth",
      confidence: "stated",
      status: "ready", // wrong: not a lifecycle value
      scores: { impact: 9, effort: 5, risk: 3, urgency: 1.5 }, // wrong: plural key, flat dims
      priorityScore: 999, // bogus number the model invented
    },
  ]);
  const res = canonicalizeRegistryContent("features.json", raw);
  assert.equal(res.ok, true);
  const parsed = JSON.parse((res as { content: string }).content);
  assert.equal(parsed[0].lifecycle, "proposed");
```

Change the last line to:

```typescript
  assert.equal(parsed[0].lifecycle, "queued");
```

In `prep/lib/spec.selfcheck.ts`, change the fixture helper's default parameter:

```typescript
const feature = (id: string, lifecycle: Feature["lifecycle"] = "proposed"): Feature => ({
```

to:

```typescript
const feature = (id: string, lifecycle: Feature["lifecycle"] = "queued"): Feature => ({
```

And change the one explicit call in the "overridden lifecycle" test:

```typescript
  const overridden: Feature = {
    ...feature("F-001", "proposed"),
```

to:

```typescript
  const overridden: Feature = {
    ...feature("F-001", "queued"),
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL — the "mints F-001 as queued" check (and others) throw `AssertionError` because `mergeExtraction` still produces `"proposed"` and `normalizeFeature` still defaults to `"proposed"`.

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: PASS (this file doesn't exercise the schema directly — the fixture change alone doesn't break anything yet, since `"proposed"` is still a valid enum value). This is fine; Step 4 will keep it passing.

- [ ] **Step 3: Update `registry/registry-lib.ts`**

Change the `LifecycleSchema`:

```typescript
export const LifecycleSchema = z.enum([
  "proposed", // freshly extracted, not yet triaged by a human
  "queued", // triaged, scored, waiting to be picked
  "speced", // a recipe (spec) has been generated
  "building", // execution in progress (via superpowers)
  "review", // built, awaiting human acceptance
  "done", // accepted and shipped
  "deferred", // consciously parked (still real, just not now)
  "rejected", // a human said no (out of scope, won't do)
]);
```

to:

```typescript
export const LifecycleSchema = z.enum([
  "queued", // freshly extracted or triaged, waiting to be picked
  "speced", // a recipe (spec) has been generated
  "building", // execution in progress (via superpowers)
  "review", // built, awaiting human acceptance
  "done", // accepted and shipped
  "deferred", // consciously parked (still real, just not now)
  "rejected", // a human said no (out of scope, won't do)
]);
```

In `mergeExtraction`'s "added" branch, change:

```typescript
      lifecycle: "proposed",
```

to:

```typescript
      lifecycle: "queued",
```

- [ ] **Step 4: Update `registry/registry-io.ts`'s `normalizeFeature`**

Change:

```typescript
  const validLifecycles = ["proposed", "queued", "speced", "building", "review", "done", "deferred", "rejected"];
  // LLMs often wrap lifecycle in an object: { status: "blocked", blocked_by: [...] }
  if (obj.lifecycle && typeof obj.lifecycle === "object") {
    const lc = obj.lifecycle as Record<string, unknown>;
    const status = lc.status as string | undefined;
    obj.lifecycle = validLifecycles.includes(status ?? "") ? status : "proposed";
  }
  // LLMs also use "status" instead of "lifecycle"
  if (!obj.lifecycle && obj.status && typeof obj.status === "string") {
    obj.lifecycle = validLifecycles.includes(obj.status) ? obj.status : "proposed";
  }
  if (!obj.lifecycle) obj.lifecycle = "proposed";
  // An invalid lifecycle string ("ready"/"blocked" etc.) is recovered from a
  // valid `status` sibling when present, else falls back to "proposed".
  // Blocked-ness is orthogonal (tracked in blockedBy), never a lifecycle value.
  if (typeof obj.lifecycle === "string" && !validLifecycles.includes(obj.lifecycle)) {
    obj.lifecycle =
      typeof obj.status === "string" && validLifecycles.includes(obj.status)
        ? obj.status
        : "proposed";
  }
```

to:

```typescript
  const validLifecycles = ["queued", "speced", "building", "review", "done", "deferred", "rejected"];
  // LLMs often wrap lifecycle in an object: { status: "blocked", blocked_by: [...] }
  if (obj.lifecycle && typeof obj.lifecycle === "object") {
    const lc = obj.lifecycle as Record<string, unknown>;
    const status = lc.status as string | undefined;
    obj.lifecycle = validLifecycles.includes(status ?? "") ? status : "queued";
  }
  // LLMs also use "status" instead of "lifecycle"
  if (!obj.lifecycle && obj.status && typeof obj.status === "string") {
    obj.lifecycle = validLifecycles.includes(obj.status) ? obj.status : "queued";
  }
  if (!obj.lifecycle) obj.lifecycle = "queued";
  // An invalid lifecycle string ("ready"/"blocked"/the old "proposed" etc.) is
  // recovered from a valid `status` sibling when present, else falls back to
  // "queued". Blocked-ness is orthogonal (tracked in blockedBy), never a
  // lifecycle value. This is also how old on-disk "proposed" data migrates:
  // it's simply not in validLifecycles anymore, so it falls through here.
  if (typeof obj.lifecycle === "string" && !validLifecycles.includes(obj.lifecycle)) {
    obj.lifecycle =
      typeof obj.status === "string" && validLifecycles.includes(obj.status)
        ? obj.status
        : "queued";
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: PASS (all checks, including the new backward-compat assertion for old `"proposed"` data).

Run: `node --experimental-strip-types prep/lib/spec.selfcheck.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add registry/registry-lib.ts registry/registry-io.ts registry/registry.selfcheck.ts prep/lib/spec.selfcheck.ts
git commit -m "refactor: collapse proposed/queued lifecycle into queued"
```

---

### Task 2: Remove `briefApproved`/`queueApproved` gates from the schema

**Files:**
- Modify: `registry/registry-lib.ts:200-215` (GateSchema/GatesSchema/Gates), `:232` (ProjectSchema.gates field), `:326-357` (passGate/resetGate + their section comment)
- Modify: `registry/registry-io.ts:137-166` (normalizeProject)
- Test: `registry/registry.selfcheck.ts` (multiple checks, listed below)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ProjectSchema` no longer has a `gates` field. `passGate`/`resetGate`/`GateSchema`/`GatesSchema`/`Gates` no longer exist — nothing later in this plan may reference them.

- [ ] **Step 1: Update the selfcheck tests first (this makes them fail against current code)**

In `registry/registry.selfcheck.ts`, delete the entire `--- gates ---` block:

```typescript
// --- gates ---
check("passGate marks a gate passed with attribution", () => {
  const p = passGate(initProject("X", now), "queueApproved", "ria", now);
  assert.equal(p.gates.queueApproved.passed, true);
  assert.equal(p.gates.queueApproved.by, "ria");
});
check("resetGate clears a passed gate and is a no-op when already open", () => {
  const passed = passGate(initProject("X", now), "queueApproved", "ria", now);
  assert.equal(resetGate(passed, "queueApproved", now).gates.queueApproved.passed, false);
  const open = initProject("X", now);
  assert.equal(resetGate(open, "queueApproved", now), open); // unchanged reference
});
```

Delete both checks entirely (no replacement — there is no new gate mechanism).

Remove `passGate` and `resetGate` from the import list at the top of the file:

```typescript
  passGate,
  resetGate,
```

(Leave every other imported name untouched.)

In the `"project round-trips through disk with validation"` check, remove the gates assertion:

```typescript
  check("project round-trips through disk with validation", () => {
    const p = initProject("SwissBelhotel", now);
    writeProject(dir, p);
    const back = readProject(dir);
    assert.equal(back?.name, "SwissBelhotel");
    assert.equal(back?.schemaVersion, 1);
    assert.equal(back?.gates.queueApproved.passed, false);
  });
```

to:

```typescript
  check("project round-trips through disk with validation", () => {
    const p = initProject("SwissBelhotel", now);
    writeProject(dir, p);
    const back = readProject(dir);
    assert.equal(back?.name, "SwissBelhotel");
    assert.equal(back?.schemaVersion, 1);
  });
```

In the `"readProject normalizes snake_case LLM project and fills schema defaults"` check, replace the two gate assertions with one asserting the legacy key was silently dropped:

```typescript
    const result = readProject(roguedir);
    assert.ok(result !== null);
    assert.equal(result!.name, "SwissBelhotel Maintenance");
    assert.equal(result!.schemaVersion, 1);
    assert.equal(result!.gates.briefApproved.passed, false);
    assert.equal(result!.gates.queueApproved.passed, false);
    assert.equal(result!.createdAt, "2026-06-29T00:00:00.000Z");
```

to:

```typescript
    const result = readProject(roguedir);
    assert.ok(result !== null);
    assert.equal(result!.name, "SwissBelhotel Maintenance");
    assert.equal(result!.schemaVersion, 1);
    assert.ok(!("gates" in (result as object)), "legacy gates key must be silently dropped, not surfaced");
    assert.equal(result!.createdAt, "2026-06-29T00:00:00.000Z");
```

(The raw fixture a few lines above this check already includes `gates: { brief_complete: true, questions_answered: false }` in the written JSON — leave that fixture as-is. It's exactly the kind of legacy-shaped input this test proves gets silently ignored.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: FAIL with a TypeScript/runtime error — `passGate`/`resetGate` are removed from the import list but the deleted checks are gone too, so the file should actually still run; the real failure is the new `assert.ok(!("gates" in result))` check, which fails because `readProject` still attaches a default `gates` object.

- [ ] **Step 3: Update `registry/registry-lib.ts`**

Delete the `GateSchema`/`GatesSchema`/`Gates` block:

```typescript
// ---------------------------------------------------------------------------
// Gates — the explicit human-in-the-loop checkpoints. Downstream commands read
// these and refuse (or warn) if the upstream gate hasn't been passed.
// ---------------------------------------------------------------------------

export const GateSchema = z.object({
  passed: z.boolean(),
  by: z.string().optional(),
  at: z.string().optional(),
});

export const GatesSchema = z.object({
  briefApproved: GateSchema, // client-questions reviewed before going out
  queueApproved: GateSchema, // scores/overrides/removals confirmed
});
export type Gates = z.infer<typeof GatesSchema>;

```

Delete it entirely (including the section-header comment).

In `ProjectSchema`, remove the `gates` field:

```typescript
export const ProjectSchema = z.object({
  schemaVersion: z.number(),
  name: z.string(),
  /** Per-artifact content hashes of the brief at last sync. */
  briefHashes: z.object({
    prd: z.string().nullable(),
    userFlows: z.string().nullable(),
    technicalNotes: z.string().nullable(),
    clientQuestions: z.string().nullable(),
  }),
  gates: GatesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

to:

```typescript
export const ProjectSchema = z.object({
  schemaVersion: z.number(),
  name: z.string(),
  /** Per-artifact content hashes of the brief at last sync. */
  briefHashes: z.object({
    prd: z.string().nullable(),
    userFlows: z.string().nullable(),
    technicalNotes: z.string().nullable(),
    clientQuestions: z.string().nullable(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

Delete `passGate` and `resetGate` and their section comment:

```typescript
// ---------------------------------------------------------------------------
// Gates — the explicit human-in-the-loop checkpoints. A gate is passed by a
// deliberate human action and is invalidated automatically when the thing it
// approved changes underneath it.
// ---------------------------------------------------------------------------

export function passGate(
  project: Project,
  gate: keyof Project["gates"],
  by: string,
  at: string
): Project {
  return {
    ...project,
    gates: { ...project.gates, [gate]: { passed: true, by, at } },
    updatedAt: at,
  };
}

/** Invalidate a previously-passed gate (e.g. the queue changed after approval). */
export function resetGate(
  project: Project,
  gate: keyof Project["gates"],
  at: string
): Project {
  if (!project.gates[gate].passed) return project;
  return {
    ...project,
    gates: { ...project.gates, [gate]: { passed: false } },
    updatedAt: at,
  };
}

```

Delete this whole block entirely (the `markFeatureDone` function that follows stays untouched).

- [ ] **Step 4: Update `registry/registry-io.ts`'s `normalizeProject`**

Change:

```typescript
  if (!obj.gates || typeof obj.gates !== "object") {
    obj.gates = { briefApproved: { passed: false }, queueApproved: { passed: false } };
  } else {
    const g = camelCaseKeys(obj.gates as Record<string, unknown>);
    const isGateObj = (v: unknown) => v && typeof v === "object" && "passed" in (v as Record<string, unknown>);
    if (!isGateObj(g.briefApproved))
      g.briefApproved = { passed: false };
    if (!isGateObj(g.queueApproved))
      g.queueApproved = { passed: false };
    obj.gates = g;
  }
  return obj;
```

to:

```typescript
  // Legacy on-disk "gates" key: ProjectSchema no longer has this field, and
  // it isn't .strict(), so zod silently drops it on parse — no code needed
  // here to strip it. (See registry.selfcheck.ts's "readProject normalizes
  // snake_case LLM project" test for the regression check.)
  return obj;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add registry/registry-lib.ts registry/registry-io.ts registry/registry.selfcheck.ts
git commit -m "refactor: remove briefApproved/queueApproved gates from the schema"
```

---

### Task 3: Clean up rendering (displayStatus, renderFeatureQueue, renderStatus, initProject)

**Files:**
- Modify: `registry/registry-io.ts:489-506` (initProject), `:625-643` (displayStatus), `:645-747` (renderFeatureQueue), `:754-822` (renderStatus)
- Test: `registry/registry.selfcheck.ts` (one check, listed below)

**Interfaces:**
- Consumes: `LifecycleSchema` without `"proposed"` (Task 1) and `ProjectSchema` without `gates` (Task 2) — both must be done first, since `initProject`/`renderFeatureQueue`/`renderStatus` currently construct or read `project.gates`, which no longer type-checks or exists once Tasks 1–2 land.
- Produces: `initProject()` returns a `Project` with no `gates` key. `displayStatus()` never returns `"🟡 proposed"`. `renderFeatureQueue()`'s header has no `Gates:` line. `renderStatus()` has no `Gates:` line, no `proposed` tally, and no "Approve the queue" todo.

- [ ] **Step 1: Update the selfcheck test first (this makes it fail against current code)**

In `registry/registry.selfcheck.ts`, find:

```typescript
check("renderStatus surfaces the actions awaiting a human", () => {
  const stale: Feature = { ...speced[0], flags: { ...speced[0].flags, stale: true } };
  const txt = renderStatus(
    [stale],
    initProject("SwissBelhotel", now),
    [{ ts: now, actor: "system", type: "drift-detected", target: "F-001", summary: "spec stale" }],
    [{ id: "Q1", text: "API docs?", priority: 1, status: "open", unblocks: ["F-008"] }]
  );
  assert.ok(txt.includes("Awaiting you"));
  assert.ok(txt.includes("F-001"), "should surface the stale spec feature id");
  assert.ok(txt.includes("/prep --approve"), "should prompt to approve the queue");
  assert.ok(txt.includes("open client question"), "should surface open questions");
});
```

Remove the `/prep --approve` assertion line (there is nothing to replace it with — the todo it checked no longer exists):

```typescript
check("renderStatus surfaces the actions awaiting a human", () => {
  const stale: Feature = { ...speced[0], flags: { ...speced[0].flags, stale: true } };
  const txt = renderStatus(
    [stale],
    initProject("SwissBelhotel", now),
    [{ ts: now, actor: "system", type: "drift-detected", target: "F-001", summary: "spec stale" }],
    [{ id: "Q1", text: "API docs?", priority: 1, status: "open", unblocks: ["F-008"] }]
  );
  assert.ok(txt.includes("Awaiting you"));
  assert.ok(txt.includes("F-001"), "should surface the stale spec feature id");
  assert.ok(txt.includes("open client question"), "should surface open questions");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: PASS, actually — removing an assertion can't make a test fail. This step instead verifies the *file still runs* after Tasks 1–2 (it does, since Task 2 already removed `project.gates` construction issues from `initProject`... except `initProject` in `registry-io.ts` still sets a `gates` field at this point, which is harmless extra data zod will strip on the next parse, so nothing crashes yet). Confirm: Expected: PASS. Proceed to Step 3 regardless — the real verification for this task is that `renderFeatureQueue`/`renderStatus` stop referencing gates without runtime errors, checked in Step 5.

- [ ] **Step 3: Update `registry/registry-io.ts`'s `initProject`**

Change:

```typescript
export function initProject(name: string, now: string): Project {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    name,
    briefHashes: {
      prd: null,
      userFlows: null,
      technicalNotes: null,
      clientQuestions: null,
    },
    gates: {
      briefApproved: { passed: false },
      queueApproved: { passed: false },
    },
    createdAt: now,
    updatedAt: now,
  };
}
```

to:

```typescript
export function initProject(name: string, now: string): Project {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    name,
    briefHashes: {
      prd: null,
      userFlows: null,
      technicalNotes: null,
      clientQuestions: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Update `displayStatus`, `renderFeatureQueue`, and `renderStatus`**

In `displayStatus`, change:

```typescript
  else if (f.flags.needsReanalysis) base = "⚠️ changed — re-review";
  else if (lc === "proposed") base = "🟡 proposed";
  else base = "🟡 queued";
```

to:

```typescript
  else if (f.flags.needsReanalysis) base = "⚠️ changed — re-review";
  else base = "🟡 queued";
```

In `renderFeatureQueue`, change:

```typescript
  const lines: string[] = [
    `# Feature Queue — ${project.name}`,
    "",
    `> Projection of \`.sandwich/registry/\` · ${features.length} features · generated ${new Date().toISOString().split("T")[0]}`,
    `> Gates: brief ${project.gates.briefApproved.passed ? "✅" : "⬜"} · queue ${project.gates.queueApproved.passed ? "✅" : "⬜"}`,
    "",
  ];
```

to:

```typescript
  const lines: string[] = [
    `# Feature Queue — ${project.name}`,
    "",
    `> Projection of \`.sandwich/registry/\` · ${features.length} features · generated ${new Date().toISOString().split("T")[0]}`,
    "",
  ];
```

In `renderStatus`, change:

```typescript
  const out: string[] = [];
  out.push(`SANDWICH STATUS — ${project.name}`);
  out.push("─".repeat(48));
  out.push(
    `Gates:  brief ${project.gates.briefApproved.passed ? "✅" : "⬜"}   queue ${project.gates.queueApproved.passed ? "✅" : "⬜"}`
  );
  out.push("");
  out.push("Lifecycle:");
  out.push(
    `  proposed ${count("proposed")} · queued ${count("queued")} · speced ${count("speced")} · building ${count("building")} · review ${count("review")} · done ${count("done")} · deferred ${count("deferred")} · rejected ${count("rejected")}`
  );
```

to:

```typescript
  const out: string[] = [];
  out.push(`SANDWICH STATUS — ${project.name}`);
  out.push("─".repeat(48));
  out.push("");
  out.push("Lifecycle:");
  out.push(
    `  queued ${count("queued")} · speced ${count("speced")} · building ${count("building")} · review ${count("review")} · done ${count("done")} · deferred ${count("deferred")} · rejected ${count("rejected")}`
  );
```

And change:

```typescript
  if (audit?.readyToMarkDone.length)
    todos.push(
      `Confirm & mark done — every AC checked: ${audit.readyToMarkDone.join(", ")} → /prep --done ${audit.readyToMarkDone[0]}`
    );
  if (!project.gates.queueApproved.passed && features.length)
    todos.push("Approve the queue once you're happy with priorities: /prep --approve");
  if (audit?.missingSpecs.length)
```

to:

```typescript
  if (audit?.readyToMarkDone.length)
    todos.push(
      `Confirm & mark done — every AC checked: ${audit.readyToMarkDone.join(", ")} → /prep --done ${audit.readyToMarkDone[0]}`
    );
  if (audit?.missingSpecs.length)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --experimental-strip-types registry/registry.selfcheck.ts`
Expected: PASS — including the queue-projection and status-projection checks, now running with no `project.gates` reference anywhere.

- [ ] **Step 6: Commit**

```bash
git add registry/registry-io.ts registry/registry.selfcheck.ts
git commit -m "refactor: drop gate/proposed display from feature-queue and status views"
```

---

### Task 4: Remove `/prep --approve` from `prep.workflow.ts`

**Files:**
- Modify: `prep/workflow/prep.workflow.ts:47` (import), `:103` (flag parse), `:130-154` (approve branch), `:157` (neighboring comment)

**Interfaces:**
- Consumes: `passGate` no longer exported from `registry-lib.ts` (Task 2) — this task's whole point is to stop importing it.
- Produces: `/prep --approve` is no longer a recognized flag; running it falls through to normal `/prep` behavior (extraction/reconciliation), matching every other unrecognized argument.

- [ ] **Step 1: Remove the `passGate` import**

In `prep/workflow/prep.workflow.ts`, change:

```typescript
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

to:

```typescript
import {
  matchByFingerprint,
  mergeExtraction,
  applyRipple,
  attachScores,
  effectivePriority,
  fingerprint,
  parseClientQuestions,
  markFeatureDone,
  isEligible,
  type Feature as RegistryFeature,
  type ExtractedFeature,
  type RippleReport,
} from "../../registry/registry-lib.ts";
```

- [ ] **Step 2: Remove the `--approve` flag and its branch**

Change:

```typescript
const featureIdArg = argv.find((a) => a.startsWith("F-"));
const impactOnly = argv.includes("--impact-only");
const queueOnly = argv.includes("--queue-only");
const forceFresh = argv.includes("--fresh");
const approveQueue = argv.includes("--approve");
const doneFlagIdx = argv.indexOf("--done");
```

to:

```typescript
const featureIdArg = argv.find((a) => a.startsWith("F-"));
const impactOnly = argv.includes("--impact-only");
const queueOnly = argv.includes("--queue-only");
const forceFresh = argv.includes("--fresh");
const doneFlagIdx = argv.indexOf("--done");
```

Delete the entire branch:

```typescript
// Special case: approve the queue gate — no extraction, just flips the gate
// a human has to pass before picking a feature off the queue.
if (approveQueue) {
  if (existingFeatures.length === 0) {
    throw new Error("No features in the registry yet. Run /prep first, then approve the queue.");
  }
  if (project.gates.queueApproved.passed) {
    log(`Queue already approved by ${project.gates.queueApproved.by} at ${project.gates.queueApproved.at}.`);
    throw new Error("SKIP");
  }
  const approver = tryExec("git config user.name", projectRoot).trim() || "human";
  project = passGate(project, "queueApproved", approver, now);
  writeProject(projectRoot, project);
  appendJournal(projectRoot, {
    ts: now,
    actor: approver,
    type: "gate-passed",
    target: "queueApproved",
    summary: `Queue approved by ${approver}`,
  });
  renderFeatureQueue(projectRoot, existingFeatures, project);
  log(`✓ Queue approved by ${approver}`);
  log("✓ docs/sandwich/feature-queue.md");
  throw new Error("SKIP");
}

```

Delete it entirely — nothing replaces it.

- [ ] **Step 3: Reword the neighboring `--done` branch's stale comment**

Change:

```typescript
// Special case: mark a feature done — no extraction, just closes out one
// feature once implementation is verified. Mirrors the --approve branch.
if (markDone) {
```

to:

```typescript
// Special case: mark a feature done — no extraction, just closes out one
// feature once implementation is verified. Same early-exit,
// guard-then-mutate-then-render shape used elsewhere in this file.
if (markDone) {
```

- [ ] **Step 4: Verify no dangling references**

Run: `grep -n "approveQueue\|passGate" prep/workflow/prep.workflow.ts`
Expected: no output (empty match).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all five self-check files print their check counts and exit 0 (this workflow file has no dedicated self-check — the full suite is the closest available regression signal, confirming Tasks 1–4 compose correctly).

- [ ] **Step 6: Commit**

```bash
git add prep/workflow/prep.workflow.ts
git commit -m "refactor: remove /prep --approve command"
```

---

### Task 5: Update docs (SKILL.md ×2, README.md)

**Files:**
- Modify: `prep/skills/prep/SKILL.md:157` (commands table), `:230` (features.json example), `:257` (lifecycle enum row), `:279-282,292` (project.json example + field table), `:369` (common-mistakes table)
- Modify: `prep/skills/status/SKILL.md:44,60-62` (dashboard description, key principle)
- Modify: `README.md:132` (full command reference)

**Interfaces:**
- Consumes: nothing (docs only, no runtime behavior).
- Produces: no doc references `/prep --approve`, `gates`, `briefApproved`, `queueApproved`, or `lifecycle: "proposed"` as a live concept.

- [ ] **Step 1: Update `prep/skills/prep/SKILL.md`**

Remove the `/prep --approve` row from the commands table:

```markdown
| `/prep --queue-only` | Update queue without recommendation |
| `/prep --approve` | Pass the `queueApproved` gate — confirms scores/overrides/removals |
| `/prep --done F-XXX [commit-sha...]` | Mark a feature done, recording any commit SHAs |
```

to:

```markdown
| `/prep --queue-only` | Update queue without recommendation |
| `/prep --done F-XXX [commit-sha...]` | Mark a feature done, recording any commit SHAs |
```

In the `features.json` example, change:

```json
    "confidence": "stated",
    "lifecycle": "proposed",
    "flags": { "needsReanalysis": false, "stale": false, "orphaned": false },
```

to:

```json
    "confidence": "stated",
    "lifecycle": "queued",
    "flags": { "needsReanalysis": false, "stale": false, "orphaned": false },
```

In the field table, change:

```markdown
| `lifecycle` | enum | `proposed`, `queued`, `speced`, `building`, `review`, `done`, `deferred`, `rejected` |
```

to:

```markdown
| `lifecycle` | enum | `queued`, `speced`, `building`, `review`, `done`, `deferred`, `rejected` |
```

In the `project.json` example, remove the `gates` key:

```json
{
  "schemaVersion": 1,
  "name": "Project Name",
  "briefHashes": {
    "prd": "a3f2c1d8e9b4f7a6",
    "userFlows": "b4g3d2e9f0a5b8c7",
    "technicalNotes": null,
    "clientQuestions": "d6i5f4a1b2c7d0e9"
  },
  "gates": {
    "briefApproved": { "passed": false },
    "queueApproved": { "passed": false }
  },
  "createdAt": "2026-06-29T12:00:00.000Z",
  "updatedAt": "2026-06-29T12:00:00.000Z"
}
```

to:

```json
{
  "schemaVersion": 1,
  "name": "Project Name",
  "briefHashes": {
    "prd": "a3f2c1d8e9b4f7a6",
    "userFlows": "b4g3d2e9f0a5b8c7",
    "technicalNotes": null,
    "clientQuestions": "d6i5f4a1b2c7d0e9"
  },
  "createdAt": "2026-06-29T12:00:00.000Z",
  "updatedAt": "2026-06-29T12:00:00.000Z"
}
```

In the field table below it, remove the `gates.*` row:

```markdown
| `schemaVersion` | number | Always `1` |
| `briefHashes.*` | string or null | SHA-256 prefix (16 chars) of each brief artifact |
| `gates.*` | object | `{ "passed": boolean, "by"?: string, "at"?: string }` |
```

to:

```markdown
| `schemaVersion` | number | Always `1` |
| `briefHashes.*` | string or null | SHA-256 prefix (16 chars) of each brief artifact |
```

In the "Common mistakes" table, change:

```markdown
| `"lifecycle": "ready"` | `"lifecycle": "proposed"` |
```

to:

```markdown
| `"lifecycle": "ready"` | `"lifecycle": "queued"` |
```

- [ ] **Step 2: Update `prep/skills/status/SKILL.md`**

Change:

```markdown
The dashboard covers: gates, lifecycle counts, flags, **Awaiting you** (open
questions, changed features, stale specs, orphans, features whose spec shows
every acceptance criterion checked but aren't marked done yet, missing spec
files, decisions recorded in the journal but absent from decisions.json, queue
approval), and recent activity. Do not hand-assemble these — the script is
the single source of the numbers.
```

to:

```markdown
The dashboard covers: lifecycle counts, flags, **Awaiting you** (open
questions, changed features, stale specs, orphans, features whose spec shows
every acceptance criterion checked but aren't marked done yet, missing spec
files, decisions recorded in the journal but absent from decisions.json), and
recent activity. Do not hand-assemble these — the script is the single source
of the numbers.
```

Change:

```markdown
This is the morning-check command. If `Awaiting you` is empty, the queue is
approved and current, and you can pick a feature and open its
`docs/sandwich/specs/F-XXX.md` and hand it off to Superpowers brainstorming.
```

to:

```markdown
This is the morning-check command. If `Awaiting you` is empty, the queue is
current, and you can pick a feature and open its
`docs/sandwich/specs/F-XXX.md` and hand it off to Superpowers brainstorming.
```

- [ ] **Step 3: Update `README.md`**

Remove the `/prep --approve` row:

```markdown
| `/prep --fresh` | Force re-extraction, ignore existing registry |
| `/prep --approve` | Approve the queue (passes the `queueApproved` gate) |
| `/prep --done F-001 [sha...]` | Mark a feature done and record its commits |
```

to:

```markdown
| `/prep --fresh` | Force re-extraction, ignore existing registry |
| `/prep --done F-001 [sha...]` | Mark a feature done and record its commits |
```

- [ ] **Step 4: Verify no dangling references anywhere in the live tree**

Run: `grep -rn "queueApproved\|briefApproved\|passGate\|resetGate\|GateSchema\|GatesSchema\|/prep --approve" --include="*.ts" --include="*.md" registry/ prep/ order/ wireframe/ lib/ README.md`
Expected: no output (empty match). If anything remains, fix it before proceeding — do not leave a stale reference.

- [ ] **Step 5: Run the full test suite one final time**

Run: `npm test`
Expected: all five self-check files pass.

- [ ] **Step 6: Commit**

```bash
git add prep/skills/prep/SKILL.md prep/skills/status/SKILL.md README.md
git commit -m "docs: remove approval-gate references from SKILL.md and README"
```
