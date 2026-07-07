---
name: wireframe
description: Turn /order's needsUI user flows into static HTML wireframe screens, tracked in a manifest that flags staleness instead of silently overwriting hand-tuned screens. Use ONLY when explicitly invoked with /wireframe, after /order has run and before /prep.
---

# /wireframe

You are generating wireframes. Your job: produce static HTML screens in
`docs/wireframes/` from the `needsUI` flows in `docs/sandwich/user-flows.json`,
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

All written to `docs/wireframes/`:

| File | Purpose |
|------|---------|
| `manifest.json` | Screen registry — source of truth for the screen↔flow mapping and stale/orphaned flags |
| `index.html` | Nav hub, a pure projection of `manifest.json`, regenerated every run |
| `<screen>.html` | One static HTML file per screen, Tailwind CDN, written once and never overwritten |
| `.snapshot.json` | Git-ignored, last-seen content hash per flow id — the diff baseline for the next run |

## Mode detection (automatic)

- **Fresh** — no `docs/wireframes/manifest.json` yet. Group every `needsUI: true` flow into a sensible screen list and write all screens.
- **Incremental** — `manifest.json` already exists. Only new/changed/removed flows are acted on; existing screen files are never rewritten.

## Pipeline

1. **Prerequisite check** — per above.
2. **Read & filter** — load `docs/sandwich/user-flows.json`, keep only flows where `needsUI` is `true`.
3. **Load prior state** — read `docs/wireframes/manifest.json` (if present) and `docs/wireframes/.snapshot.json` (if present).
4. **Diff** — for each `needsUI` flow, compare its `{ trigger, steps, outcome }` against the snapshot:
   - Not in the snapshot at all → **new flow**, needs a screen.
   - In the snapshot but content differs → **changed flow**.
   - In the snapshot but no longer present (or flipped to `needsUI: false`) → **removed flow**.
5. **Apply flags to existing screens** — for every screen already in the manifest:
   - If any of its flows is a *changed flow*, set `flags.stale = true` and append a reason like `"UF-004 content changed"` to `staleReasons`. **Do not touch that screen's HTML file.**
   - If every one of its flows is a *removed flow*, set `flags.orphaned = true`.
   - Otherwise, clear `stale`/`orphaned` and `staleReasons` back to their defaults.
6. **Group new flows into screens** — for *new flows* only, decide whether each fits an existing screen (add its id to that screen's `flows` array) or needs a brand-new screen (assign the next `SCR-XXX` id, a short `name`, and a `file` — lowercase, hyphenated, `.html`). Flows and screens are not 1:1: several flows commonly share one screen (e.g. browse vs. filter both landing on a product listing page), and one flow may need a multi-step single screen.
7. **Write HTML for new screens only** — one file per brand-new screen under `docs/wireframes/`, Tailwind CDN (`<script src="https://cdn.tailwindcss.com">`), grayscale/lo-fi or Tailwind-styled per the shared aesthetic below. Never write to a `file` that already exists on disk.
8. **Write `manifest.json`** — the full screen list (existing + new), matching the schema below exactly. Validate it:
   ```bash
   node --experimental-strip-types $SANDWICH_ROOT/wireframe/scripts/render.ts
   ```
   `SANDWICH_ROOT` is injected into your context at session start as plain
   text (e.g. `SANDWICH_ROOT=/path/to/plugin`) — it is NOT a live shell
   environment variable. Read the path from your context and substitute it
   literally in place of `$SANDWICH_ROOT` above before running.
   If validation fails, the script prints the exact errors — fix the JSON and re-run.
9. **Report** — screens created / flagged stale (with reasons) / orphaned / unchanged.

The load-bearing invariant: the only files this pipeline ever writes are
`manifest.json`, `.snapshot.json`, `index.html`, and brand-new screen files.
Every code path that detects a change on an *existing* screen sets a flag —
it never edits that screen's HTML.

## Output

```
✓ docs/wireframes/manifest.json
✓ docs/wireframes/index.html
✓ docs/wireframes/<new-screen-1>.html
✓ docs/wireframes/<new-screen-2>.html

[one sentence: N screens created, N flagged stale, N orphaned, N unchanged]
```

## Shared wireframe aesthetic

- Tailwind CDN, no build step: `<script src="https://cdn.tailwindcss.com">`
- Typography: system-ui font stack
- Grayscale-first palette; a single `brand` color for primary actions
- Container: max-width, centered, generous padding
- Every screen is a standalone `.html` file — no shared layout file, no imports

## Output schema (MANDATORY)

**Exact schema. Do not invent field names. Do not add extra wrappers.**
`manifest.json` must start with `{` — no markdown fences, no preamble.

```json
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "Homepage",
      "file": "homepage.html",
      "flows": ["UF-001", "UF-002"],
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
| `file` | string | Filename only, relative to `docs/wireframes/`, e.g. `"plp.html"` |
| `flows` | string[] | One or more `UF-XXX` ids this screen serves |
| `flags.stale` | boolean | Set when an underlying flow's content changed since this screen was generated |
| `flags.orphaned` | boolean | Set when none of this screen's flows still need UI |
| `staleReasons` | string[] | Human-readable reasons, e.g. `"UF-004 content changed"` |

**On `stale` and re-runs:** `stale` means "changed since the *last* `/wireframe`
run," not "still needs attention forever." `.snapshot.json` is overwritten
with the current flow content on every run, so if `/wireframe` runs again
later for an unrelated reason before a flagged screen's HTML is manually
fixed, the flag clears itself once the flow stops differing from the new
snapshot baseline — even though the screen was never actually updated. Act on
and report `stale` screens promptly; don't assume the flag will still be
there next time you look.

## Style rules

- Keep the client's terminology from `user-flows.md` — do not rename flows or actors.
- Never overwrite an existing screen `.html` file. If a screen needs a real content update because its flow changed, that's a flagged `stale` entry for a human to act on, not something this skill does automatically.
- Report `stale`/`orphaned` counts prominently — they are the signal a human needs to act on.
