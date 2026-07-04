# Dependency Eligibility — Design

**Date:** 2026-07-04
**Status:** Approved (design review with Ria)

## Problem

Reported via a Claude session running `/prep` by hand on a real project:

> The table's "Priority" column ranks by value density —
> `(impact × urgency × (10−risk)) ÷ effort` — which asks "if this were
> buildable today, how good a bet is it?" It does not ask "can I build this
> today?" F-003 scores highest because it's cheap, low-risk, and the stated
> differentiator — genuinely the best bet once it's reachable. But the table
> doesn't factor `dependsOn` into ordering or status at all — F-003 shows as
> "🟡 proposed" instead of "blocked," which is misleading.

Confirmed directly against the code:

1. `effectivePriority`/`computePriority` (`registry/registry-lib.ts`) compute
   a pure value-density score with no dependency awareness — correct as
   designed, not itself a bug.
2. `displayStatus()` (`registry/registry-io.ts:624`) only checks `blockedBy`
   (open *questions*, a separate concept) for its "blocked" badge. It never
   checks whether a feature's `dependsOn` entries are actually `done` — so a
   feature waiting on an unbuilt dependency renders identically to one that's
   genuinely ready to start.
3. `renderFeatureQueue()` sorts the entire active list by priority alone —
   no eligibility grouping, so the #1 row in the table might not be
   buildable today.
4. `topUnblocked` in `prep/workflow/prep.workflow.ts` (the "Recommended:
   start with..." pick at the end of `/prep`) filters only on
   `blockedBy.length === 0` — the same blind spot, so `/prep`'s own
   recommendation can suggest an infeasible-today feature.

A related discovery: the dependency-analysis LLM agent (`02-analyze-dependencies.md`)
already computes a `blockedFeatures` list and a `graph` (roots/chains), but
it's only ever logged as a count (`prep.workflow.ts:396`) — never stored on
a feature, never used for status, sort, or recommendation. Same
"computed but never wired up" shape as `passGate`/`resetGate` before
`/prep --approve` picked them up.

## Goal

`feature-queue.md` and `/prep`'s own recommendation should never present a
feature as ready when it isn't. Score ≠ build order: build order is
"eligible features, ranked by score" — score only breaks ties among what's
currently buildable.

## Design decision: deterministic, not LLM-derived

Eligibility is computed in code from each feature's own `dependsOn` array
plus the other features' `lifecycle` — not from the LLM's `blockedFeatures`/
`graph` output. This matches the project's existing philosophy everywhere
else (the model proposes dimension scores, code computes `priority`; the
model extracts features, code resolves identity by fingerprint). The
LLM-derived `blockedFeatures`/`graph` fields stay exactly as unused as they
are today — this design doesn't wire them in, and doesn't remove them
either (out of scope).

## Non-Goals (explicit)

- **No full topological "build order" computation.** A single-level
  eligibility check is sufficient: as dependencies get marked `done` (via
  `/prep --done`), previously-blocked features become eligible on the next
  `/prep` run automatically. Nothing needs to pre-compute multi-step chains.
- **No special handling for a dependency that's `rejected`/`deferred`.** It
  simply appears in the "Waiting on" list; a feature blocked on something
  that will never ship is visible to a human reading the table, without the
  tool needing to guess intent.
- **No `/status` changes.** Eligibility isn't an action item — unlike an
  open question or the "ready to mark done" signal, it resolves itself
  automatically once the blocking dependency ships. Surfacing it in
  `/status`'s "Awaiting you" list would misrepresent it as something a human
  needs to do. Scope stays on `feature-queue.md` and the `/prep`
  recommendation, which is where the confusion was actually reported.
- **No changes to `blockedBy`/open-question blocking.** That's an existing,
  separate concept (`displayStatus()`'s `🔴 blocked (Q...)` badge) and isn't
  touched by this design.

## Design

### 1. `isEligible()` — new pure helper (`registry/registry-lib.ts`)

Placed alongside `effectivePriority`/`effectiveLifecycle` (same file,
same "human pin wins" neighborhood — though eligibility has no override,
since nothing computes it that a human would need to override).

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

A feature with an empty `dependsOn` array is vacuously eligible
(`.every()` on `[]` is `true`) — correct here, unlike the AC-completion
check in the prior feature-completion design, because eligibility's
default (no dependencies) really does mean "nothing is blocking this."

### 2. `feature-queue.md` splits the queue into two sections

`renderFeatureQueue()` (`registry/registry-io.ts`), inside the existing
`active` array construction (`:657-660`): split `active` into two groups
using `isEligible`, built from a `byId` map of all `features` (not just
`active` — a dependency could be `done`/`rejected` and thus outside the
active set, and its lifecycle still needs to resolve correctly).

```ts
const byIdAll = new Map(features.map((f) => [f.id, f]));
const eligible = active
  .filter((f) => isEligible(f, byIdAll))
  .sort((a, b) => effectivePriority(b) - effectivePriority(a));
const blockedByDep = active.filter((f) => !isEligible(f, byIdAll));
```

Rendered as two tables under "## Queue":

```
## Queue

### Eligible now

| # | ID | Title | Module | Priority | Status | Spec |
|---|----|-------|--------|----------|--------|------|
| 1 | F-001 | ... | Auth | 85 | 🟡 queued | [specs/F-001.md](specs/F-001.md) |

### Blocked by dependency

| ID | Title | Waiting on | Spec |
|----|-------|------------|------|
| F-003 | ... | F-001, F-002 | [specs/F-003.md](specs/F-003.md) |
```

"Eligible now" keeps exactly today's columns and sort (priority
descending) — this table IS the build order. "Blocked by dependency" has
no priority/rank column (not buildable yet, so ranking it would repeat the
exact confusion this design fixes) and instead shows "Waiting on": the
`dependsOn` ids that aren't yet `done`, via the existing `label()` helper
(id + title). If `blockedByDep` is empty, omit that section header
entirely (no empty table) — the common case, and an empty "blocked"
section on every run would be noise. If `eligible` is empty (everything is
blocked), still render the "Eligible now" header with a single
`_(none — see below)_` line: an empty *buildable* queue is a meaningful,
notice-worthy state, unlike an empty blocked list.

`displayStatus()` itself is unchanged — it's still used for "Eligible
now" rows exactly as today (including the pre-existing `🔴 blocked (Q...)`
badge for open-question blocking, which is orthogonal to this split and
can still appear on an eligible-by-dependency row).

### 3. `topUnblocked` requires eligibility too (`prep/workflow/prep.workflow.ts`)

Current filter (`:456-460`) only checks `blockedBy`. Add the same
`isEligible` check, using a `byId` map built from the full
`registryFeatures` (not `currentFeatures()`) so a dependency that was
dropped from the brief but already shipped (or never shipped) still
resolves correctly:

```ts
const byId = new Map(registryFeatures.map((f) => [f.id, f]));
const topUnblocked = currentFeatures()
  .filter((f) => f.blockedBy.length === 0 && isEligible(f, byId))
  .sort((a, b) => effectivePriority(b) - effectivePriority(a))
  .slice(0, 3);
```

This is the exact bug reported: `/prep`'s own "Recommended: start with..."
line could previously suggest a feature that isn't actually buildable yet.

## Error handling

- Dangling `dependsOn` reference (id not present in the registry) →
  `isEligible` returns `false` (fail closed). The id still appears in
  "Waiting on" even though it can't be labeled with a title (the existing
  `label()` helper already falls back to `"?"` for an unknown id) — visible
  to a human as a data problem, not hidden.
- A feature depending on a `rejected`/`deferred` feature is permanently
  "blocked by dependency" until a human resolves that upstream feature one
  way or another — this is working as intended per the Non-Goals above, not
  a bug to fix here.

## Testing

- Selfcheck (pure, no LLM), `registry/registry.selfcheck.ts`:
  - `isEligible` returns `true` for a feature with empty `dependsOn`.
  - `isEligible` returns `true` when every `dependsOn` id is `done`.
  - `isEligible` returns `false` when any `dependsOn` id is not `done`
    (e.g. `queued`).
  - `isEligible` returns `false` for a dangling `dependsOn` id not present
    in the `byId` map.
  - `renderFeatureQueue` splits output into "Eligible now" and "Blocked by
    dependency" sections with the right features in each, and omits the
    blocked section header when nothing is blocked.
- Manual smoke test: scratch registry with three features (F-001 done,
  F-002 depends on F-001 — eligible, F-003 depends on F-002 — blocked),
  confirm `feature-queue.md` renders F-002 in "Eligible now" and F-003 in
  "Blocked by dependency" with "Waiting on: F-002 (...)"; separately
  confirm the `topUnblocked` filter change picks F-002, not F-003, as a
  recommendation candidate even if F-003 would score higher.

## Key decisions log

| Decision | Choice | Why |
|---|---|---|
| Eligibility source | Deterministic from `dependsOn` + `effectiveLifecycle`, not the LLM's `blockedFeatures`/`graph` | Matches existing project philosophy (model proposes, code computes); reproducible and testable |
| Dangling dependency reference | Fails closed (not eligible) | Surfaces a data problem instead of silently treating it as satisfied |
| Queue rendering | Two sections (Eligible now / Blocked by dependency), not a single re-ordered table with a new status badge | Directly answers "what can I build today, in what order" — a single table's #1 row could still be wrong even with a relabeled status |
| `/status` | Untouched | Eligibility resolves itself automatically; it isn't a human action item like an open question or a ready-to-mark-done feature |
| Full topological build order | Not built | A 1-level "is every dependency done" check is sufficient; chains resolve themselves run over run as dependencies ship |
