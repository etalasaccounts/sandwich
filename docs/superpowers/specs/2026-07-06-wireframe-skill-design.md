# Wireframe Skill — Design

**Date:** 2026-07-06
**Status:** Approved (design review with Ria)

## Problem

`/order` produces structured requirements (`prd.md`, `user-flows.md`,
`technical-notes.md`, `client-questions.md`) and `/prep` turns those into a
scored, dependency-aware feature queue. Neither artifact says anything about
what the UI actually looks like. In practice (see the `arneshdiveshop`
project), wireframing has already proven valuable done by hand: static
Tailwind-CDN HTML files per screen, an `index.html` nav hub, deployed
standalone so a client can click through it. Once those wireframes existed,
`/order` cited them as `stated`-confidence evidence and `/prep`'s specs
referenced them for layout requirements — but the whole thing was manual
(a hand-written `SPEC.md`, hand-prompted screens, no registry, no staleness
tracking).

This design formalizes that pattern as a `/wireframe` skill, so the same
result — dev-adjacent visual references the brief and the queue can both
point to — comes from a repeatable pipeline instead of ad hoc prompting.

## Goal

A new `wireframe` skill that:
- Runs after `/order`, before `/prep` (validated ordering — see log below)
- Consumes `docs/sandwich/user-flows.json`, keyed by the existing `UF-XXX` flow ids
- Produces static HTML wireframe screens + a manifest mapping screens to flows
- Can be re-run safely as the brief evolves, without silently clobbering
  hand-tuned wireframes
- Stays out of scope for anything `/order`, `/prep`, or a human already owns

## Non-Goals (explicit)

- **No deploy step in v1.** No Vercel/hosting integration. The skill writes
  local files; publishing them stays a manual follow-up, same as it was in
  `arneshdiveshop`.
- **No auto-regeneration of existing screen HTML.** Once a screen file
  exists, the pipeline never overwrites it. Changes to the flows behind it
  are surfaced as a `stale` flag for a human to act on, not applied
  automatically.
- **No feature-level (`F-XXX`) integration.** Wireframes are keyed to
  `UF-XXX` flows, which exist right after `/order`. They do not read from or
  write to `.sandwich/registry/` — that registry doesn't exist until
  `/prep` runs. A feature's spec (`specs/F-XXX.md`) may reference a wireframe
  file in prose (as `arneshdiveshop`'s `F-019.md` already does), but that's
  a `/prep`-side concern, not this skill's.
- **No new confidence/scoring model.** Screens don't get impact/effort/risk
  scores. That's `/prep`'s job, informed by the wireframes existing, not
  duplicated here.

## Design

### 1. Schema addition (`order/lib/order-schemas.ts`)

`UserFlowsDocSchema`'s flow object gains one field:

```ts
flows: z.array(z.object({
  id: z.string().regex(/^UF-\d{3}$/),
  title: z.string().min(1),
  actor: z.string().min(1),
  trigger: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  outcome: z.string().min(1),
  confidence: ConfidenceSchema,
  needsUI: z.boolean(),   // NEW
}))
```

`/order` sets `needsUI` at extraction time: a human-named actor (e.g. "End
User", "Admin") defaults `true`; a system/cron/webhook-style actor defaults
`false`. This is an explicit, auditable field — not something the wireframe
skill re-infers from the actor string on its own.

### 2. New directory (`wireframe/`)

Mirrors `order/` and `prep/`'s existing shape exactly:

```
wireframe/
├── skills/wireframe/SKILL.md
├── agents/                     # prompt files for workflow.ts's agent() calls, mirrors order/agents/
├── lib/
│   ├── wireframe-schemas.ts   # ManifestSchema (zod)
│   ├── wireframe-render.ts    # deterministic index.html generator
│   └── wireframe.selfcheck.ts # plain-assert tests, no framework
├── scripts/render.ts           # CLI entry: node --experimental-strip-types wireframe/scripts/render.ts
├── workflow/wireframe.workflow.ts   # pi-harness scriptable workflow (phase/agent/parallel DSL)
└── pi-extension/wireframe.ts        # pi registration adapter, mirrors prep/pi-extension/prep.ts
```

Registered in **two** manifests, same as `order`/`prep`:
- `.claude-plugin/plugin.json` — add to the `skills` and `workflows` arrays
  (Claude Code plugin format)
- `package.json`'s `"pi"` field — add `./wireframe/pi-extension/wireframe.ts`
  to `extensions` and `./wireframe/skills/wireframe` to `skills` (pi package
  format); also add `wireframe/lib/wireframe.selfcheck.ts` to the root
  `"scripts".test` command alongside the other `*.selfcheck.ts` files

### 3. Artifacts (`docs/wireframes/`)

```
docs/wireframes/
├── manifest.json     # screen registry — source of truth
├── .snapshot.json     # git-ignored, last-seen needsUI flows (diff baseline)
├── .gitignore          # ignores .snapshot.json
├── index.html          # nav hub, pure projection of manifest.json, regenerated every run
├── homepage.html
├── plp.html
├── pdp.html
└── ...                  # one static HTML file per screen, agent-authored, Tailwind CDN
```

`manifest.json` schema (`wireframe/lib/wireframe-schemas.ts`), modeled on
`FeatureSchema`'s orthogonal `flags` object in `registry/registry-lib.ts`:

```ts
export const ScreenSchema = z.object({
  id: z.string().regex(/^SCR-\d{3}$/),
  name: z.string().min(1),                 // "Product Listing Page"
  file: z.string().min(1),                 // "plp.html"
  flows: z.array(z.string().regex(/^UF-\d{3}$/)).min(1),
  flags: z.object({
    stale: z.boolean().default(false),     // an underlying flow's content changed
    orphaned: z.boolean().default(false),  // no live needsUI flow maps here anymore
  }).default({ stale: false, orphaned: false }),
  staleReasons: z.array(z.string()).default([]),
});
export const WireframeManifestSchema = z.object({
  screens: z.array(ScreenSchema).min(1),
});
```

Screens and flows are not 1:1. One flow may need multiple screens (a
multi-step checkout could become one screen with steps or several); several
flows commonly share one screen (browse vs. filter both land on the PLP).
The agent groups flows into a sensible screen list holistically, the same
way `arneshdiveshop` went from a handful of flows to ~20 screens, and
records the grouping explicitly in `manifest.json` rather than leaving it
implicit in file names.

### 4. Pipeline (`wireframe/skills/wireframe/SKILL.md`)

1. **Prerequisite check** — if `docs/sandwich/user-flows.json` doesn't
   exist, stop and tell the user to run `/order` first.
2. **Read & filter** — load `user-flows.json`, keep only `needsUI: true`
   flows.
3. **Mode detection** (automatic, same pattern as `/order`'s mode
   detection):
   - **Fresh** (no `manifest.json` yet) — group all `needsUI` flows into
     screens, write one HTML file per screen, write `manifest.json`.
   - **Incremental** (`manifest.json` exists) — for each `needsUI` flow,
     compare its current content hash against the one recorded in
     `.snapshot.json`, reusing `hashOutput`/`hasOutputChanged` from
     `lib/agent-wrapper.ts` (the same sha256-based change-detection helper
     the rest of the codebase already uses) — keyed by flow id, so
     reordering or inserting flows doesn't produce false positives:
     - *changed* → every screen listing that flow gets `flags.stale = true`
       plus an appended reason. HTML is never touched.
     - *new flow id* → fits an existing screen, or needs a new one; only
       new screens get new HTML files.
     - *flow removed or flipped to `needsUI: false`* → screens whose only
       flow was that one get `flags.orphaned = true`.
4. **Write `manifest.json`** — validated by `WireframeManifestSchema`; on
   failure the script prints the exact field/message, the agent fixes and
   retries (same loop as `/order`/`/prep`).
5. **Overwrite `.snapshot.json`** with the current `needsUI` flows — this
   becomes the next run's diff baseline.
6. **Run the deterministic renderer**:
   ```bash
   node --experimental-strip-types $SANDWICH_ROOT/wireframe/scripts/render.ts
   ```
   Regenerates `index.html` from `manifest.json` only — it never touches
   screen HTML files.
7. **Report** — screens created / flagged stale (with reasons + paths) /
   orphaned / unchanged.

The load-bearing invariant: the only files this pipeline ever *writes* are
`manifest.json`, `.snapshot.json`, `index.html`, and brand-new screen files.
Every code path that detects a change on an *existing* screen sets a flag
instead of touching the file.

### 5. Error handling

- `manifest.json` writes go through the zod schema; validation failures
  print the exact field/message rather than writing partial data.
- If `manifest.json` references a `file` that no longer exists on disk
  (deleted by hand), the renderer flags a data-integrity warning instead of
  crashing or silently dropping it from `index.html` — mirrors `/prep`'s
  existing drift detection for stale specs.
- Missing prerequisite (`user-flows.json` absent) exits early with a direct
  instruction, rather than guessing screen structure from raw conversation.

### 6. Testing

Follows the existing `*.selfcheck.ts` convention (plain `node:assert`, no
test framework, matching `order/lib/validation.selfcheck.ts`):
`wireframe/lib/wireframe.selfcheck.ts` checks:
- `ScreenSchema`/`WireframeManifestSchema` accept valid input and reject
  malformed ids and empty `flows` arrays.
- `hasOutputChanged` correctly flags a changed flow's screen(s) as stale and
  leaves an unrelated screen untouched.
- The `index.html` renderer emits a link for every entry in the manifest.

Run via `node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts`,
and add that invocation to `package.json`'s `scripts.test` chain.

### 7. Pi-harness parity

`order/` and `prep/` each ship three layers, not just the interactive skill:
the `SKILL.md` (what Sections 1-6 describe, used when an agent like Claude
Code invokes the skill interactively), a `*.workflow.ts` using a separate
scriptable DSL (`phase()`, `agent()`, `parallel()`, `log()` globals, an
injected `args` string, and a top-level `return`) for headless/programmatic
execution under the **pi** coding-agent harness, and a thin
`pi-extension/*.ts` adapter (implementing `@earendil-works/pi-coding-agent`'s
`ExtensionAPI`) that registers the skill path with pi.

`wireframe.workflow.ts` mirrors `order.workflow.ts`'s shape: a `Detect`
phase (prerequisite + mode check), a `Group` phase (one `agent()` call that
proposes the flow-to-screen grouping for fresh mode, or nothing new to
group in incremental mode), a `Generate` phase (one `agent()` call per new
screen to produce its HTML, matching the parallel `Promise.all` pattern
`order.workflow.ts` uses for its four artifacts), and a final write of
`manifest.json` + `.snapshot.json` + the rendered `index.html`. Prompts for
the `agent()` calls live in `wireframe/agents/*.md`, mirroring
`order/agents/*.md`.

`pi-extension/wireframe.ts` follows `prep/pi-extension/prep.ts`'s minimal
form exactly (register `skillPaths`, no gate — the manifest-drift check
from Section 5 covers integrity, and `registerRegistryGate`-style live-write
interception is a `/prep`-registry-specific concept that doesn't apply here
since `wireframe` never touches `.sandwich/registry/`).

## Key decisions log

| Decision | Choice | Why |
|---|---|---|
| Pipeline position | After `/order`, before `/prep` | `/order` supplies the structured flow/module data wireframing needs as input (instead of re-deriving it from raw text); `/prep`'s effort/risk scoring benefits from screens already existing. Confirmed by re-reading the `arneshdiveshop` history: wireframes only became a useful `/order` input once bundled into one manually-written document — a repeatable pipeline gets that same benefit for free by running `/order` first. |
| Architecture | New standalone `wireframe` skill/workflow, mirroring `order`/`prep`'s directory shape | Folding into `/order` conflicts with the never-auto-overwrite rule (`/order` fully regenerates on refine); folding into `/prep` doesn't fit since wireframes are keyed to `UF-XXX` (exists post-`/order`) not `F-XXX` (exists only after `/prep` creates the registry) |
| Scope selection (which flows get wireframed) | Explicit `needsUI: boolean` added to `UserFlowsDocSchema`, set by `/order` at extraction time | More auditable than downstream inference from the `actor` field, and avoids wasting generation effort on flows nothing will ever prune (system/cron actors) |
| Flow-to-screen mapping | Agent groups flows into screens holistically per project, recorded explicitly in `manifest.json` | Flows and screens are rarely 1:1 in practice (arneshdiveshop's checkout was one flow rendered as one 2-step screen; PLP serves multiple flows) — forcing strict 1:1 produces awkward duplicates |
| Staleness handling | Flag `stale` in the manifest, never auto-overwrite existing screen HTML | Wireframes are hand-tuned by humans after generation (unlike `prd.md`/`user-flows.md`, which are fully disposable/regeneratable); silently rewriting would destroy that work |
| Staleness detection mechanism | Reuse `hashOutput`/`hasOutputChanged` (existing sha256 change-detection in `lib/agent-wrapper.ts`) against a git-ignored `.snapshot.json`, keyed by flow id | Avoids inventing a new fingerprint mechanism when a working one already exists and is already used elsewhere in the codebase; id-keyed avoids false positives from reordering. (Corrected during plan-writing from an earlier draft that named `diffOrderDoc` — that utility diffs two known JSON shapes path-by-path, which is a good fit for `/order`'s own changelog, but `hashOutput` is the simpler, already-established tool for a yes/no "did this content change" check.) |
| Deploy/hosting | Out of scope for v1 | Keeps the skill's surface area small (YAGNI); `arneshdiveshop`'s Vercel deploy of `docs/wireframes/` was a manual follow-up step, not part of wireframe generation itself |
| Output format | Static HTML per screen, Tailwind CDN (`<script src="https://cdn.tailwindcss.com">`), no build step, `index.html` nav hub | Matches the proven `arneshdiveshop` pattern directly; viewable in a browser with zero setup, unlike the rest of the pipeline's markdown/JSON which is diffable but not visual |
| Pi-harness parity | Build `wireframe.workflow.ts` + `pi-extension/wireframe.ts` now, matching `order`/`prep` exactly, rather than deferring | Explicitly requested — discovered during plan-writing that `order`/`prep` both ship this layer and the original design (correctly) hadn't scoped it since brainstorming only examined the interactive `SKILL.md` path |
