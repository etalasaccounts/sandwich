---
name: craft
description: Turn /order's needsUI user flows into a real Next.js + shadcn app, composed from the live shadcn registry (never a fixed/narrow component set) and tracked in a manifest that flags staleness instead of silently overwriting hand-tuned screens. Use ONLY when the user explicitly runs /craft (or its namespaced form, e.g. /sandwich:craft), after /order has run and before /prep. Do NOT invoke on topical similarity — discussing design, UI, or screens in general conversation is NOT an invocation unless the literal command is typed.
---

# /craft

You are crafting UI. Your job: produce a Next.js + shadcn app in `design/`
from the `needsUI` flows in `docs/sandwich/user-flows.json`, composed from
the live shadcn component registry — not a fixed baseline, not hand-drawn
markup — and tracked by a manifest that never lets a re-run silently
overwrite a screen a human may have hand-tuned.

This supersedes the old `/wireframe` skill (removed — its output quality
didn't meet the bar). Read `## Why this is different from /wireframe` below
before generating anything; it explains what changed and why, so you don't
quietly regress back to the old failure mode.

## When to invoke

- User explicitly runs `/craft` (or the namespaced `/sandwich:craft`)

**Do NOT invoke because:**
- the user asks to "design this" / "craft this" / "buatkan desain" without typing `/craft`
- a brief looks ready for this step — that's not your call to make unprompted
- the user is discussing UI, screens, or design in general conversation
- any other topical or keyword similarity to what this skill does
- (separately, even given the literal command) `/order` hasn't yet produced `docs/sandwich/user-flows.json` — see the prerequisite check below
- it's being invoked as a sub-step of `/order` or `/prep` — it is a standalone command, triggered only by its own explicit invocation, never chained automatically

Wait for the literal command. If the user's intent seems to call for `/craft`, say so and let them decide — don't invoke it yourself.

## Prerequisite check (hard stop)

If `docs/sandwich/user-flows.json` does not exist, stop immediately and tell
the user to run `/order` first. Do not attempt to infer screens or flows
from raw conversation — that is `/order`'s job, not this skill's.

## Readiness gate (stricter than /wireframe — do not skip)

Before generating anything, check whether the brief is actually solid enough
to design from:

1. **Read the brief's own confidence.** Load `docs/sandwich/{prd,user-flows,technical-notes,client-questions}.json` and run the same readiness check `/order` itself uses (`validateOrderForPlanning` in `order/lib/validation.ts`, re-exported from `craft/lib/craft-lib.ts` — read it, don't reimplement it). If it reports `ready: false`, **stop** and surface its `reason` and `actions` to the user exactly as given — don't design around a brief the system itself doesn't trust yet.
2. **Check for open, design-relevant questions.** Read `docs/sandwich/client-questions.json`. Any question at `"priority": "high"` is, by definition, still open (a resolved question is removed or downgraded by `/order`'s own answer-mode, not flagged some other way). For each `needsUI: true` flow you're about to design a screen for, check whether any high-priority question's `blocks` array plausibly names that flow's module/feature. If it does — or if the flow's own `confidence` is `"assumed"` — **do not silently proceed**. Use `AskUserQuestion` (or, if unavailable, ask directly and wait for a reply) along these lines:
   > "N open question(s) could affect how I design [screen/flow]: [list them]. Proceed with a stated assumption (I'll note it in the screen), or hold off until these are answered?"
3. Only continue past this gate once the user has explicitly said to proceed (with or without assumptions) or there was nothing to flag. This is the one place this skill is allowed to stop and wait — every other step should keep moving.

## Why this is different from /wireframe

`/wireframe` (removed) already produced a real Next.js + shadcn app, not
static HTML — the engineering was sound. It was scrapped because the
**output quality** didn't hold up, for reasons visible in its own source:

| What `/wireframe` did | What `/craft` does instead |
|---|---|
| Fixed 12-primitive baseline (Button, Card, Input, Label, Select, Textarea, Dialog, Table, Badge, Separator, Avatar, DropdownMenu), installed once, never expanded | Full live registry — ~60 base components, ~250 examples, 27 real page-level blocks (16 sidebar variants, a full dashboard, 5 login + 5 signup pages) plus a secondary marketing registry. Pull whatever a screen actually needs, every run. |
| Bottom-up only — every screen hand-assembled from atoms | **Blocks-first.** If a real block fits (a login screen, a dashboard, a sidebar shell), reuse it wholesale before hand-composing from smaller pieces. See `docs/design-exemplars/patterns.md`. |
| Explicitly framed as low-fidelity: *"prioritize showing structure... placeholder text is fine"* | Framed as crafted, shippable-looking UI. Empty/loading/error states and responsive behavior are a forced checklist per screen (see below), not left to discretion. |
| Generic gray placeholder theme | The real house theme, `docs/design-exemplars/themes/default-theme.css`, applied via `cssVariables: true`. |
| Unswapped `lucide-react` icons | Every icon swapped to Solar per `docs/design-exemplars/icons.md`. No exceptions, no emoji. |
| Checked only that `user-flows.json` existed | Checks the brief's actual confidence and open high-priority questions before generating (see the readiness gate above). |

If you find yourself about to hand-assemble a login page from `Input` +
`Label` + `Button` instead of pulling `login-04`, stop — that's the exact
mistake this rewrite exists to fix.

## Artifacts

All written to `design/` (a standalone Next.js app, sibling to `docs/` and
`.sandwich/` — not nested under `docs/`, since it has its own toolchain):

| File | Purpose |
|------|---------|
| `manifest.json` | Screen registry — source of truth for the screen↔flow mapping, navigation, registry usage, and stale/orphaned flags |
| `app/page.tsx` | Nav hub, a pure projection of `manifest.json`, regenerated every run |
| `app/<route>/page.tsx` | One route per screen, written once and never overwritten |
| `components.json` | shadcn config — `style: "new-york"`, `cssVariables: true`, plus the `@shadcnblocks` secondary registry alias |
| `components/ui/*` | shadcn components/blocks, added live per screen via `npx shadcn add`, never pre-vendored |
| `components/craft/{PageShell,PageHeader}.tsx` | The *only* fixed shared structure — consistent width/padding and a heading pattern. Nav chrome is NOT in here; it comes from whichever real sidebar/nav block was chosen at scaffold time. |
| `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js` | App scaffold, written once on the first run |
| `.snapshot.json` | Git-ignored, last-seen content hash per flow id — the diff baseline for the next run |

## Mode detection (automatic)

- **Fresh** — no `design/manifest.json` yet. Scaffold the app, pick a nav
  shell, group every `needsUI: true` flow into a sensible screen list, and
  write all screens.
- **Incremental** — `manifest.json` already exists. The app scaffold and
  `components/craft/*` are never re-touched. Only new/changed/removed flows
  are acted on; existing screen files are never rewritten.

## Pipeline

1. **Prerequisite check** — per above.
2. **Readiness gate** — per above. Do not proceed past an unresolved stop.
3. **Read & filter** — load `docs/sandwich/user-flows.json`, keep only flows where `needsUI` is `true`.
4. **Scaffold (fresh mode only)**:
   a. Copy the Next.js skeleton from `craft/template/**` into `design/` (skip-if-exists; see `craft/lib/craft-lib.ts`'s `scaffoldCraftApp`).
   b. Seed `design/app/globals.css` from `docs/design-exemplars/themes/default-theme.css` (also skip-if-exists — this only happens once).
   c. Run `cd design && npm install` for real, via Bash. This can take a minute; that's expected — `npx shadcn add` needs a real `node_modules` to work against.
   d. Pick **one nav shell for the whole project** (not per screen) from `docs/design-exemplars/patterns.md`'s block table, matched to the brief's actual IA depth (flat top-level sections → a simpler sidebar; nested/grouped sections expected to grow → `sidebar-02`/`-05`; want it collapsible → `sidebar-07`). Install it: `npx shadcn add sidebar-XX` (or the matching block name). Every screen composes into this same shell.
   Never re-run step 4 on an incremental run.
5. **Load prior state** — read `design/manifest.json` (if present) and `design/.snapshot.json` (if present).
6. **Diff** — for each `needsUI` flow, compare its `{ trigger, steps, outcome }` against the snapshot:
   - Not in the snapshot at all → **new flow**, needs a screen.
   - In the snapshot but content differs → **changed flow**.
   - In the snapshot but no longer present (or flipped to `needsUI: false`) → **removed flow**.
7. **Apply flags to existing screens** — for every screen already in the manifest:
   - If any of its flows is a *changed flow*, set `flags.stale = true` and append a reason like `"UF-004 content changed"` to `staleReasons`. **Do not touch that screen's `page.tsx`.**
   - If every one of its flows is a *removed flow*, set `flags.orphaned = true`.
   - Otherwise, clear `stale`/`orphaned` and `staleReasons` back to their defaults.
8. **Group new flows into screens** — for *new flows* only, decide whether each fits an existing screen or needs a brand-new screen (assign the next `SCR-XXX` id, a short `name`, and a `route`). Infer `navigatesTo` from each flow's `outcome`. Flows and screens are not 1:1.
9. **Pull registry items per new screen — blocks first**:
   a. Check `docs/design-exemplars/patterns.md`'s block table. If a real block matches the screen wholesale (login, signup, a dashboard), install and use it: `npx shadcn add <block-name>`.
   b. If it's a marketing/landing section (hero, pricing, testimonial, footer) — none of which exist in the official registry — use the secondary registry: `npx shadcn add @shadcnblocks/<name>`.
   c. Otherwise, compose from base components, installing exactly what's used: `npx shadcn add card table combobox ...` etc. Never install something "just in case."
   d. Record every registry item actually used in that screen's `registryUses` array — this is what makes coverage auditable instead of a black box.
10. **Icon pass** — after adding any component/block, check it for `lucide-react` or `@tabler-icons-react` imports. Replace every one with the matching Solar icon per `docs/design-exemplars/icons.md`'s swap table (search Iconify for anything not listed). No lucide, no tabler, no emoji survives into a screen file.
11. **Write TSX for new screens only** — one `page.tsx` per brand-new screen under `design/app/<route>/`, composed from the registry items just pulled plus `components/craft/{PageShell,PageHeader}`. For each screen, work through this checklist explicitly — don't skip any of it:
    - Cover every flow's `steps` as visible elements/states; render real fields (per `fields`, using the matching input component) instead of placeholder copy where the flow specifies them.
    - **Empty state** — what does this screen look like with zero data? Use the `empty` component, don't leave it unconsidered.
    - **Loading state** — is there an obvious async boundary (a table, a fetched list)? Note it with `skeleton` or leave a clear `// TODO: loading state` if it depends on real data-fetching wiring you don't have yet — never silently omit the thought.
    - **Error state** — same question, using `alert`.
    - **Responsive behavior** — does this layout hold up narrower? Don't design desktop-only by default.
    - Any action in `navigatesTo` uses `next/link`'s `<Link>` to the target's `route`.
    - Use the client's own terminology from `title`/`actor`/`steps`/`outcome` — don't translate or rename.
12. **Flag gaps (report only)** — propose commonly-expected supporting screens not covered by any current flow (login, 404, empty states, settings), judged from the PRD's actors/modules. Report these; never generate them.
13. **Write `manifest.json`** — matching the schema below exactly. Validate it:
    ```bash
    node --experimental-strip-types $SANDWICH_ROOT/craft/scripts/render.ts
    ```
    `SANDWICH_ROOT` is injected into your context at session start as plain
    text (e.g. `SANDWICH_ROOT=/path/to/plugin`) — it is NOT a live shell
    environment variable. Read the path from your context and substitute it
    literally in place of `$SANDWICH_ROOT` above before running.
    If validation fails, the script prints the exact errors — fix the JSON and re-run.
14. **Report** — screens created / flagged stale (with reasons) / orphaned / unchanged / gaps to consider / registry items pulled.

The load-bearing invariant: the only files this pipeline ever writes are
`manifest.json`, `.snapshot.json`, `app/page.tsx`, and brand-new screen
route files — plus the one-time app scaffold and nav-shell install on the
very first run. Every code path that detects a change on an *existing*
screen sets a flag — it never edits that screen's `page.tsx`.

## Viewing the result

```bash
cd design && npm run dev
```

`npm install` already ran during scaffold. Deploying (e.g. to Vercel) is a
manual follow-up step outside this skill's scope.

## Output

```
✓ design/manifest.json
✓ design/app/page.tsx
✓ design/app/<new-screen-1>/page.tsx
✓ design/app/<new-screen-2>/page.tsx

Registry items pulled: sidebar-07, login-04, card, table, @shadcnblocks/hero1
[one sentence: N screens created, N flagged stale, N orphaned, N unchanged]
[if any: Gaps to consider (not generated): Login, 404/Not found, Settings]
```

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
      "registryUses": ["sidebar-07", "card", "table"],
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
| `registryUses` | string[] | Every shadcn block/component name actually used, e.g. `"sidebar-07"`, `"card"`, `"@shadcnblocks/hero1"` |
| `flags.stale` | boolean | Set when an underlying flow's content changed since this screen was generated |
| `flags.orphaned` | boolean | Set when none of this screen's flows still need UI |
| `staleReasons` | string[] | Human-readable reasons, e.g. `"UF-004 content changed"` |

**On `stale` and re-runs:** `stale` means "changed since the *last* `/craft`
run," not "still needs attention forever." `.snapshot.json` is overwritten
with the current flow content on every run, so act on and report `stale`
screens promptly; don't assume the flag will still be there next time you
look.

## Style rules

- Keep the client's terminology from `user-flows.md` — do not rename flows or actors.
- Never overwrite an existing screen `page.tsx`. A flow-content change on an existing screen is a flagged `stale` entry for a human to act on, not something this skill does automatically.
- **Never invent a primitive.** Everything a screen uses must correspond to a real, pullable registry item (official or `@shadcnblocks`), recorded in that screen's `registryUses`. If nothing in either registry fits, say so in the report rather than hand-rolling markup.
- Blocks first, atoms second — always check `docs/design-exemplars/patterns.md` before hand-composing.
- Every icon is Solar, per `docs/design-exemplars/icons.md`. No lucide, no tabler, no emoji.
- The per-screen empty/loading/error/responsive checklist in step 11 is mandatory, not optional polish.
- Report `stale`/`orphaned` counts, gaps, and registry items pulled prominently — they are the signal a human needs to act on.
- Do not skip the readiness gate. Silently designing over an unresolved high-priority question is exactly the kind of "guessing" this skill exists to avoid.
