# Feature Completion Visibility — Design

**Date:** 2026-07-03
**Status:** Approved (design review with Ria)

## Problem

The `lifecycle` enum (`proposed → queued → speced → building → review → done →
deferred/rejected`) is fully specified in `registry-lib.ts`, but nothing except
the initial extraction ever sets it — a feature is minted `"proposed"` and
never moves again by any code path. There is no way to record that a feature
has actually shipped.

This has a visibility cost. The per-feature spec files (added
2026-07-02) carry an acceptance-criteria checklist that gets checked off
during implementation — but that checklist is disconnected from the registry.
A spec can show every AC checked while the feature still sits in the active
queue forever, and nothing notices. `/status`, which is meant to be the
PM-facing "what's the state of the project" view, has no way to reflect real
completion. The per-feature-specs design explicitly deferred this
("No checklist→lifecycle sync ... out of scope now") — this design picks it
back up, scoped to what PM visibility actually needs.

Separately, the spec file's "Mulai kerja" footer (`spec-render.ts`) tells
whoever picks up the spec (typically Superpowers brainstorming) to run
brainstorming and check off ACs — but stops there. Nothing tells them to
close the loop in the registry once implementation is verified.

## Goal

A PM can look at `/status` and trust that "done" means done, with the
smallest possible process addition. This is a visibility feature, not a
workflow-enforcement feature.

## Non-Goals (explicit)

- **No `building`/`review` transition commands.** Nothing reads or acts on
  those lifecycle states today. Adding setters for them is surface area with
  no payoff against the stated goal.
- **No automatic lifecycle mutation from checked-off ACs.** `/status` surfaces
  the mismatch as an actionable item; a human still runs `/prep --done`
  explicitly. Auto-flipping registry state from unattended JSON edits is the
  same silent-mutation failure mode the per-feature-specs design already
  rejected (that's *why* `verify-complete.ts` exists for decisions.json).
- **No changes to `queueApproved`/`briefApproved` gates.**

## Design

### 1. `markFeatureDone()` — pure helper (`registry/registry-lib.ts`)

Mirrors the existing `passGate`/`resetGate` pattern: pure, no I/O, fully
testable in isolation.

```ts
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

Sets `lifecycle` directly (not via `overrides.lifecycle`) — consistent with
how the initial `"proposed"` value is set directly at mint time. `overrides`
stays reserved for pins that must survive reconciliation against a machine
computed value; nothing computes "done", a human asserts it.

### 2. `/prep --done F-XXX [commit-sha...]` (`prep/workflow/prep.workflow.ts`)

Mirrors the `--approve` branch added earlier:

- Guard: `F-XXX` must exist in the registry (error if not); if already
  `lifecycle === "done"`, log and no-op (same idempotent pattern as
  `--approve`).
- Resolve actor via `git config user.name` (fallback `"human"`) — same as
  `--approve`.
- Call `markFeatureDone`, `writeFeatures`, append a `lifecycle-changed` journal
  event (`target: F-XXX`, `data: { from, to: "done", commits }`).
- Re-render `feature-queue.md` — the existing active-feature filter already
  excludes `done`/`rejected`, so the feature drops out with no renderer
  changes needed.

### 3. `/status` gains a "ready to mark done" signal

New pure helper in `prep/lib/completeness.ts`, same shape as
`featuresMissingSpecs`/`decisionTargetsMissing`:

```ts
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

`SpecPresence` gains one required field: `allCriteriaDone: boolean` — true
when the spec JSON is valid, has at least one acceptance criterion, and every
criterion's `done` is `true`. It's computed where `prep/scripts/status.ts`
already builds each `SpecPresence`. `verify-complete.ts` also constructs
`SpecPresence` objects (for a different check) and must set this field too —
it passes `false` there since completeness-checking has no use for the value,
never derives it from parsed content.

`renderStatus()` (`registry/registry-io.ts`) gains a `readyToMarkDone: string[]`
field on its optional `audit` param, and one new "Awaiting you" line:

> `Confirm & mark done — every AC checked: F-001 → /prep --done F-001`

Placed after the blocked/changed/stale todos, before the missing-spec /
missing-decision integrity errors (those are pipeline-integrity problems;
this is a positive "ready to close out" signal, a different kind of item).

`prep/scripts/status.ts` is updated to compute `allCriteriaDone` while it
already reads each spec JSON, and pass `readyToMarkDone` through to
`renderStatus`.

### 4. Spec footer gets a closing instruction (`prep/lib/spec-render.ts`)

The existing "Mulai kerja" section gains a third step:

```
3. Setelah semua AC tercentang, tandai fitur selesai di registry:
   `/prep --done F-001 [commit-sha ...]` — ini yang menghapus fitur dari
   feature-queue aktif dan membuatnya muncul sebagai shipped di /status.
```

Since this file is regenerated deterministically on every `render-specs.ts`
run and never hand-edited, every spec Superpowers ever opens carries this
instruction automatically.

### 5. Docs

- `prep/skills/prep/SKILL.md` — add `/prep --done F-XXX [commit-sha...]` to
  the commands table.
- `prep/skills/status/SKILL.md` — mention the new "ready to mark done" line
  in the `Awaiting you` description.
- `README.md` — add the same command row to the full command reference.

## Error handling

- `/prep --done` with an unknown feature id → error, no writes.
- `/prep --done` on an already-done feature → idempotent no-op with a status
  message (matches `--approve`'s behavior for an already-passed gate).
- `allCriteriaDone` is `false` (not an error) for any spec that fails to parse
  or has zero acceptance criteria — never throws, just doesn't surface the
  signal.

## Testing

- Selfcheck (pure, no LLM): `markFeatureDone` sets lifecycle and merges
  commits without duplicates; `featuresReadyToMarkDone` includes a feature
  with all ACs checked and excludes one already `done`, one with an unchecked
  AC, and one with no spec on record.
- Manual smoke test: scratch registry + spec fixture, run the same
  read → mutate → write → render sequence used to verify `/prep --approve`,
  confirm the gate flips, the journal records it, and `feature-queue.md`
  drops the feature from the active list.

## Key decisions log

| Decision | Choice | Why |
|---|---|---|
| Where lifecycle gets set | Directly on `feature.lifecycle` | Nothing computes "done"; matches how "proposed" is set at mint, not via `overrides` |
| AC→lifecycle sync | Signal only, human confirms via `--done` | Auto-mutation from unattended JSON is the failure mode `verify-complete.ts` exists to catch elsewhere |
| `building`/`review` states | Left unused | No reader depends on them; no payoff against the PM-visibility goal |
| Completion instruction | Baked into regenerated spec footer | Same file every time, no separate doc to drift out of sync |
