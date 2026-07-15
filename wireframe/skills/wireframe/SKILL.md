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
