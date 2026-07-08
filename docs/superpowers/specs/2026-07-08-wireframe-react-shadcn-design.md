# Wireframe Skill v2 — React/Next + shadcn Rewrite — Design

**Date:** 2026-07-08
**Status:** Approved (design review with Ria)

## Problem

The `/wireframe` skill (designed 2026-07-06, since shipped) generates one
standalone Tailwind-CDN HTML file per screen, with no shared layout or
components by explicit design ("no shared layout file, no imports"). In
practice this has caused four related complaints:

1. **`/order`'s flow data is too thin.** `steps` are short imperative
   strings with no data-shape detail, so the wireframe agent guesses at
   form fields and content, producing screens that feel unfinished.
2. **No component reuse across screens.** Because every screen is a fully
   independent HTML file, headers/buttons/cards are re-invented per screen
   with no shared source of truth — the set of screens doesn't feel like
   one coherent app, which makes it hard for a client/PM to actually
   walk through it as a prototype.
3. **No design-system consistency.** Related to #2 — there's no shared
   component library (e.g. shadcn) enforcing consistent primitives.
4. **Coverage is limited to explicitly-described flows.** Nothing surfaces
   the commonly-expected screens (login, 404, empty states, settings) a
   designer would expect to at least have a placeholder for.

This design replaces the static-HTML output architecture with a real
Next.js + shadcn app, and extends `/order`'s flow schema with per-step
field detail — while preserving the core invariant that made v1 safe: an
existing screen is **never** silently overwritten.

## Goal

- `/wireframe` scaffolds and incrementally grows a real Next.js (App
  Router, TypeScript) + shadcn app in the client's repo, with working
  in-app navigation between screens.
- Screens are built from a small, fixed, shared component layer (shadcn
  primitives + a fixed composite starter kit) instead of one-off markup —
  addressing reuse/consistency directly.
- `/order`'s flows carry enough per-step field detail to render real form
  fields instead of placeholder content.
- `/wireframe` reports (but does not auto-generate) commonly-expected
  screens missing from the input, giving a designer a checklist without
  inventing unrequested screens.
- The v1 invariant carries over unchanged: once a screen file exists, the
  pipeline never overwrites it. Changed underlying flows flag `stale` for
  a human to act on.

## Non-Goals (explicit)

- **No deploy automation.** The pipeline scaffolds/updates the Next.js app
  in the repo; deploying it (e.g. to Vercel) stays a manual step the user
  does themselves — same "no deploy step" boundary as v1, just now the
  artifact is a deployable app instead of static files.
- **No dynamic shadcn component installation mid-run.** The baseline
  primitive set is installed once at scaffold time. If a screen needs a
  primitive outside that set, the pipeline flags it for a human to add
  (`npx shadcn add X`) rather than shelling out to the network during
  generation.
- **No automatic extraction of new shared components from repeated
  patterns.** The composite starter kit is a small, fixed, pre-authored
  set shipped with the sandwich plugin. The pipeline does not attempt to
  detect repetition across generated screens and factor out new
  components on its own.
- **No auto-generation of inferred/gap screens.** Commonly-expected
  screens not present in the input (login, 404, empty states, settings)
  are reported as a checklist, never written to disk automatically.
- **No persistence of the gap-flagging list.** It's computed fresh from
  current flows/screens every run and printed in the report; nothing new
  is written to track it between runs.
- **No migration path for existing v1 (`docs/wireframes/*.html`)
  projects.** Pre-1.0 alpha; the file format may change without notice
  (already stated in the README). Projects already on v1 stay on v1 until
  someone manually re-runs fresh against the new pipeline.
- **No new confidence/scoring model.** Per-step `fields` detail rides
  under the flow's existing `confidence` marker; no new confidence axis.

## Design

### 1. Directory layout

New top-level directory in the client's repo, **`wireframes/`** — sibling
to `docs/` and `.sandwich/`, not nested under `docs/`. Rationale: it's a
real deployable app with its own `package.json`/`node_modules`/Next
config, not a markdown/JSON artifact, and sitting at the repo root makes
it a natural standalone Vercel project root for a manual deploy.

```
wireframes/
├── package.json, tsconfig.json, next.config.ts, tailwind.config.ts
├── components.json                     # shadcn config
├── app/
│   ├── layout.tsx, globals.css
│   ├── page.tsx                         # nav hub — pure projection of manifest.json, regenerated every run
│   ├── plp/page.tsx                     # one route per screen, written once, never overwritten
│   └── ...
├── components/
│   ├── ui/                              # shadcn primitives (baseline set, installed once)
│   └── wireframe/                       # fixed composite starter kit, copied in once
│       ├── Navbar.tsx
│       ├── PageShell.tsx
│       ├── PageHeader.tsx
│       └── EmptyState.tsx
├── manifest.json                        # screen registry — source of truth
└── .snapshot.json                       # git-ignored, last-seen flow content hash per flow id
```

### 2. Scaffold step (fresh mode)

On the first `/wireframe` run (no `wireframes/manifest.json` yet):

1. Scaffold the Next.js skeleton (App Router, TypeScript, Tailwind)
   directly — no external `create-next-app` prompt flow, files written
   deterministically by the pipeline the same way `index.html` is today.
2. Run `shadcn` init non-interactively, then add a **fixed baseline set**
   of primitives in one pass: `button`, `card`, `input`, `label`,
   `select`, `textarea`, `dialog`, `table`, `badge`, `separator`,
   `avatar`, `dropdown-menu`.
3. Copy the composite starter kit (`Navbar.tsx`, `PageShell.tsx`,
   `PageHeader.tsx`, `EmptyState.tsx`) from a template shipped inside the
   sandwich plugin itself (`wireframe/template/components/wireframe/`)
   into `wireframes/components/wireframe/`.
4. Proceed to normal screen generation (below).

Incremental mode never re-scaffolds and never touches
`components/wireframe/*`, the shadcn baseline, `layout.tsx`, or config
files — they're treated exactly like an "existing screen" under the
never-overwrite invariant.

### 3. Screen schema & manifest (`wireframe/lib/wireframe-schemas.ts`)

```ts
export const ScreenSchema = z.object({
  id: z.string().regex(/^SCR-\d{3}$/),
  name: z.string().min(1),
  route: z.string().regex(/^\/[a-z0-9-]*$/, "route must be a lowercase-hyphenated path, e.g. /plp"),
  flows: z.array(z.string().regex(/^UF-\d{3}$/)).min(1),
  navigatesTo: z.array(z.string().regex(/^SCR-\d{3}$/)).default([]),
  flags: z.object({
    stale: z.boolean().default(false),
    orphaned: z.boolean().default(false),
  }).default({ stale: false, orphaned: false }),
  staleReasons: z.array(z.string()).default([]),
});
```

- `route` replaces `file`. The file location is derived deterministically:
  `/plp` → `app/plp/page.tsx`, `/` → `app/page.tsx`.
- `navigatesTo` is new: the ids of other screens this screen's primary
  actions should link to. Inferred by the Group agent
  (`01-group-flows-into-screens.md`) from flow outcomes at grouping time
  (e.g. an "add to cart" outcome implies a link to the cart screen),
  alongside the existing screen-assignment decision.
- Staleness/orphan semantics are unchanged: keyed on `UF-XXX` content
  hash (via the existing `hashOutput`/`hasOutputChanged` mechanism),
  flag-only on existing screens, never rewrite an existing `page.tsx`.

### 4. Screen generation (`wireframe/agents/02-write-screen-html.md` → rewritten as a TSX-writing prompt)

The screen-writing agent now:
- Writes a real `app/<route>/page.tsx`, composing from
  `components/wireframe/*` + `components/ui/*` (shadcn) — no raw
  hand-rolled markup for things the starter kit already covers.
- Uses `next/link`'s `<Link>` for any action corresponding to an entry in
  `navigatesTo`, pointing at the target screen's `route`.
- Renders real form fields from each step's `fields` array (see §5)
  instead of placeholder text, where present.
- Still covers every flow in `flowDetails`, still uses the client's own
  terminology, still a wireframe (structure over pixel-perfect visuals).

`app/page.tsx` (the nav hub) replaces `index.html`: a pure projection of
`manifest.json`, regenerated every run, listing every screen with a
working `<Link>` to its route.

### 5. `/order` schema change — per-step field detail (`order/lib/order-schemas.ts`)

`UserFlowsDocSchema`'s `steps: string[]` becomes:

```ts
steps: z.array(z.object({
  text: z.string().min(1),
  fields: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(["text", "email", "number", "date", "select", "textarea", "checkbox"]),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(), // for type: "select"
  })).optional(),
})).min(1, "A flow needs at least one step"),
```

`order/agents/03-write-user-flows.md` is updated: when a step describes
entering or selecting data, the agent infers the concrete field list
(name + type); purely navigational/action steps (e.g. "click checkout")
omit `fields` entirely. This is a breaking shape change to
`user-flows.json` — acceptable pre-1.0 per the README's existing
"APIs and file formats may change without notice" caveat. No migration
path is provided.

`wireframe/lib/wireframe-lib.ts`'s `NeedsUIFlow`/`flowContent` (the
staleness-hash input) picks up the richer `steps` shape automatically
since it just hashes whatever `steps` contains.

### 6. Gap flagging (complaint #4)

A new step in `/wireframe`'s Group phase, after grouping actual flows
into screens: the agent additionally proposes commonly-expected
supporting screens *not* covered by any current flow (login, 404,
empty/error states, settings, etc. — judged per project type from the
PRD's modules/actors, same way the agent already reasons about grouping).
This is:
- **Reported only**, in the existing run output, e.g.
  `Gaps to consider (not generated): Login, 404/Not found, Settings`
- **Never written to disk** — no new manifest field, no new tracked file.
- **Computed fresh every run** — if a later `/order` update adds a login
  flow, "Login" simply stops appearing in the gap list next run; nothing
  needs to be dismissed or reconciled.

## Key decisions log

| Decision | Choice | Why |
|---|---|---|
| Output stack | Next.js (App Router, TS) + shadcn, replacing static Tailwind-CDN HTML | Static HTML's "no shared layout/components" was the direct cause of complaint #2; a real component system requires a real toolchain |
| Viewing/deploy model | Local dev server (`npm run dev`); manual `vercel deploy` stays the user's own step | Confirmed with Ria — "as simple as deploy it in Vercel, I'll do myself." Keeps the pipeline's scope at generation, not hosting, same boundary as v1's "no deploy step" |
| Directory location | `wireframes/` at repo root, not under `docs/` | It's a deployable app with its own toolchain, not a markdown/JSON artifact; sitting at root makes it a clean standalone Vercel project root |
| Component reuse strategy | Small fixed starter kit (`Navbar`, `PageShell`, `PageHeader`, `EmptyState`) + shadcn primitives, no dynamic extraction | Confirmed with Ria — predictable and simple over agent-driven extraction, which risks thrashing/inconsistency across runs |
| shadcn primitive installation | Fixed baseline set installed once at scaffold; missing primitives are a flagged manual follow-up | Keeps every run after the initial scaffold deterministic and network-call-free; avoids the pipeline making ad hoc CLI/network calls mid-generation |
| Navigation | Real Next.js routes + `navigatesTo` inferred at grouping time, wired with `<Link>` | Confirmed with Ria — directly addresses "not testable by client/PM": a genuinely clickable prototype instead of disconnected pages |
| Flow data depth | Add per-step `fields` (name/type/required/options), not alternate error/empty/loading outcomes | Confirmed with Ria as the narrower, higher-leverage fix for "screens feel unfinished" — real form fields instead of guessed placeholder content |
| Screen/flow coverage breadth | Report gaps (missing common screens) for a human to confirm, never auto-generate | Confirmed with Ria — keeps generated output strictly traceable to input while still giving a designer the checklist requested in complaint #4 |
| Gap list persistence | Console/report output only, not written to any file | Confirmed with Ria — avoids inventing new state to reconcile; consistent with how `stale`/`orphaned` counts are already just recomputed and reported each run |
| `file` → `route` | Manifest stores a URL path (`/plp`), file location derived deterministically (`app/plp/page.tsx`) | A route is the more natural unit once navigation is real; avoids storing two things (route + file path) that could drift out of sync |
| Migration from v1 | None — alpha, format may change without notice | Matches the README's existing pre-1.0 stance; no existing production users depend on the HTML format surviving unchanged |
