# Remove Approval Gates and Collapse proposed/queued — Design

**Date:** 2026-07-05
**Status:** Approved (design review with Ria)

## Problem

Three pieces of "human approval" ceremony exist in the registry, and none of
them are pulling their weight:

1. **`briefApproved` gate** — a schema field on `project.json` that always
   renders `⬜`. Nothing anywhere calls `passGate` on it; there is no
   `/order --approve` or any command that could ever flip it. Dead since it
   was introduced.
2. **`queueApproved` gate** — wired up recently via `/prep --approve`
   (`passGate`/`resetGate` in `registry-lib.ts`, the `--approve` branch in
   `prep.workflow.ts`). Functional, but judged not valuable for how this
   project is actually used day to day.
3. **`lifecycle: "proposed"` vs `"queued"`** — two distinct enum values that
   behave identically. Every feature is minted `"proposed"`
   (`mergeExtraction`'s "added" branch) and nothing — no command, no code
   path — ever transitions it to `"queued"`. `displayStatus()`'s
   `else base = "🟡 queued"` fallback never actually fires today.

Now that `isEligible`/"Eligible now" vs. "Blocked by dependency"
(shipped in the dependency-eligibility work) answers the question that
actually matters — "what can I build right now, in what order" — this
approval-gate layer is unused ceremony sitting on top of it.

## Goal

Delete all three. `eligible`/`blocked by dependency` becomes the only
status signal a human needs. Existing on-disk registries (e.g. the Heep
Phone project, which already has `"lifecycle": "proposed"` features and a
`"gates"` object in `project.json`) must keep working with zero manual
edits.

## Non-Goals (explicit)

- **No new approval mechanism to replace these.** This is a subtraction,
  not a redesign — nothing fills the gap the gates leave.
- **No change to `decisions.json`'s own `status: "proposed" | "accepted" |
  "superseded"` enum.** That's a separate, ADR-lite concept (ownership of a
  scope/architecture call) unrelated to feature lifecycle. Not touched.
- **No change to `blockedBy`/open-question blocking or `isEligible`.** Both
  already work and are out of scope for this cleanup.
- **`"gate-passed"` stays in `JournalEventSchema`'s `type` enum.** The
  journal is an append-only audit trail (billing/SLA evidence per its own
  doc comment) — old lines that recorded a gate being passed must remain
  parseable forever, even though nothing will ever write that type again.

## Design

### 1. Schema (`registry/registry-lib.ts`)

- `LifecycleSchema`: drop `"proposed"`. Remaining seven, unchanged order:
  `"queued" | "speced" | "building" | "review" | "done" | "deferred" |
  "rejected"`.
- Delete `GateSchema`, `GatesSchema`, `Gates` type, and the `gates` field on
  `ProjectSchema` (currently `registry-lib.ts:200-215` and `:232`
  respectively).
- Delete `passGate()` and `resetGate()` entirely (`registry-lib.ts:326-357`,
  including the section comment) — nothing will call them once the gates
  are gone.
- `mergeExtraction`'s "added" branch: `lifecycle: "proposed"` →
  `lifecycle: "queued"` (currently `registry-lib.ts:562`).

### 2. Read-time backward compatibility (`registry/registry-io.ts`)

Two independent things must keep working when reading data written before
this change:

- **Old `"proposed"` lifecycle values.** `normalizeFeature()`'s
  `validLifecycles` array drops `"proposed"`; every fallback default in that
  function changes from the string `"proposed"` to `"queued"`
  (`registry-io.ts:175-194`). This single change handles both cases at
  once: a literal `"proposed"` value is no longer in `validLifecycles`, so
  it falls through the exact same "invalid lifecycle → default" path that
  already exists for `"ready"`, `"blocked"`, or any other bogus string —
  and that path's default becomes `"queued"`. No special-cased migration
  code needed.
- **Old `"gates"` key in `project.json`.** `ProjectSchema` doesn't use
  `.strict()` (confirmed — only `OverridesSchema` does), so zod already
  silently drops unrecognized keys on parse. Once `gates` is removed from
  the schema, an old file's `"gates"` object is simply ignored, not
  rejected. The gates-defaulting block inside `normalizeProject()`
  (`registry-io.ts:154-164`, which currently manufactures a default gates
  object) becomes dead code operating on a field the schema no longer has
  — delete it rather than leave it orphaned.

### 3. Rendering (`registry/registry-io.ts`)

- `initProject()`: remove the `gates: { briefApproved: ..., queueApproved:
  ... }` block (`:499-502`).
- `displayStatus()`: remove the `else if (lc === "proposed") base = "🟡
  proposed";` branch (`:638`) — every non-matched case is now `"queued"`.
- `renderFeatureQueue()`: remove the `> Gates: brief ... · queue ...` line
  from the header (`:673`).
- `renderStatus()`:
  - remove the `Gates: brief ... queue ...` line (`:774`)
  - lifecycle counts line drops the `proposed` tally, starts at `queued`
    (`:779`)
  - remove the `"Approve the queue once you're happy..."` todo from
    "Awaiting you" (`:801-802`)

### 4. Command (`prep/workflow/prep.workflow.ts`)

- Remove `passGate` from the `registry-lib.ts` import.
- Remove `const approveQueue = argv.includes("--approve");` (`:103`).
- Delete the entire `if (approveQueue) { ... }` branch (`:130-154`).
- The neighboring `--done` branch's comment ("Mirrors the --approve
  branch") becomes stale once `--approve` is gone — reword it to describe
  the pattern without referencing a command that no longer exists (e.g.
  "same early-exit, guard-then-mutate-then-render shape used elsewhere in
  this file").

### 5. Docs

- `prep/skills/prep/SKILL.md`: remove the `/prep --approve` row from the
  commands table; remove `gates`/`"proposed"` from the embedded
  `project.json`/`features.json` schema examples; remove any prose
  describing the queue-approval step.
- `prep/skills/status/SKILL.md`: remove the queue-approval mention from the
  "Awaiting you" description; remove the Gates line from the dashboard
  description.
- `README.md`: remove the `/prep --approve` row from the full command
  reference.

## Testing

Every test touching gates or `"proposed"` needs one of: deletion, a literal
swap to `"queued"`, or repurposing into a backward-compat regression check.
Concretely, in `registry/registry.selfcheck.ts`:

- Remove the `passGate`/`resetGate` imports and the entire `--- gates ---`
  test block (two checks).
- `"a brand-new extraction mints F-001 as proposed"` → rename and assert
  `"queued"`.
- `"project round-trips through disk with validation"` → drop the
  `gates.queueApproved.passed` assertion.
- `"readFeatures unwraps { features: [...] } wrapper"` → **keep the
  fixture's `lifecycle: "proposed"` literal** and add an assertion that the
  read-back value is `"queued"` — this becomes the direct regression test
  for the backward-compat migration, using data shaped exactly like an
  old on-disk registry.
- `"readFeatures normalizes LLM-invented field names and fills defaults"` →
  its fallback-default assertion changes from `"proposed"` to `"queued"`.
- `"readFeatures skips items that cannot be salvaged"` → swap its
  `"proposed"` fixture literal to `"queued"` (lifecycle isn't what this
  test is checking).
- `"readProject normalizes snake_case LLM project and fills schema
  defaults"` → drop the two `gates.*.passed` assertions; add an assertion
  that the parsed result has no `gates` key at all, proving the legacy key
  in the raw fixture was silently dropped, not rejected.
- `"gate recomputes feature priority from dimensions..."` (pi-gate test) →
  its fallback-default assertion changes from `"proposed"` to `"queued"`.

In `prep/lib/spec.selfcheck.ts`:

- The local `feature()` fixture helper's default `lifecycle` parameter
  changes from `"proposed"` to `"queued"`.
- The one explicit `feature("F-001", "proposed")` call changes to
  `feature("F-001", "queued")`.

## Key decisions log

| Decision | Choice | Why |
|---|---|---|
| Scope | Remove all three (both gates + the proposed/queued split) | User explicitly confirmed after seeing that `briefApproved` was already fully dead and `proposed`/`queued` never actually differ in practice |
| Old `"proposed"` data on disk | Silently normalize to `"queued"` on read | Same place/pattern that already salvages malformed LLM output; existing real-world registries (Heep Phone) must keep working with zero manual edits |
| Old `"gates"` key on disk | Rely on zod's default unknown-key stripping (no `.strict()` on `ProjectSchema`) | Confirmed by inspection — no migration code needed, just delete the now-dead defaulting logic that operated on it |
| `"gate-passed"` journal event type | Keep in the schema, stop emitting it | journal.jsonl is an append-only audit/billing record; old lines must stay parseable forever |
| `decisions.json`'s `proposed/accepted/superseded` | Untouched | Unrelated ADR-lite concept, not feature lifecycle |
