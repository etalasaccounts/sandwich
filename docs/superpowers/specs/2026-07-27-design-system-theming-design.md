# Design-System Theming: Brand Packs + Semantic Tokens

**Date:** 2026-07-27
**Status:** Approved (brainstormed with Ria)

## Problem

The `/design` skill's identity is fused into literal Tailwind classes
(`bg-zinc-950`, `text-green-400`, Inter, fixed radii) copied verbatim from
exemplars — ~99 palette references in `components.md` plus six pattern
files. Two new requirements break on that fusion:

1. **Multi-brand:** client projects must be able to use the skill with
   their own brand identity (colors, fonts, radii) instead of the house
   look.
2. **Runtime theming:** end users of a generated app must be able to
   switch themes dynamically, without regeneration or rebuild.
   (Dark/light mode is explicitly out of scope for now.)

## Decision

Tokenize the design system; keep the skill's exemplar-copying mechanic.
Identity moves into a closed set of CSS-variable slots; the house identity
becomes the default slot values; a client brand is a small CSS "brand
pack" that fills the same slots; runtime switching flips a `data-theme`
attribute. Structure, spacing, component recipes, and accent-usage rules
stay rigid and brand-independent.

Rejected alternatives:

- **Brand-ingestion redesign** (skill generates a bespoke design system
  per project): kills the single source of truth, cannot do runtime
  switching (identity baked at generation time).
- **Override/overlay skill** on top of literal utilities: fighting the
  cascade; requires tokenization anyway to work.

## Token vocabulary

Two buckets, split by migration mechanics:

**Bucket 1 — colors (require markup renames).** A closed set of **27
semantic slots** in three groups. The set was derived from a full class
inventory of `components.md` + `patterns/*.html` (not just the
`foundations.md` tables, which under-document actual exemplar usage —
e.g. `text-zinc-700` ×25, `text-zinc-600` ×36). House values in parens:

| Group | Slot | House value |
|---|---|---|
| Base (light content) | `page` | zinc-100 |
| | `panel` | white |
| | `panel-2` | zinc-50 |
| | `control` | zinc-200 (often with `/50` opacity for fills) |
| | `line` | zinc-100 |
| | `line-2` | zinc-300 (stronger borders, toggle tracks) |
| | `ink` | zinc-950 |
| | `ink-mid` | zinc-700 (emphasized secondary text) |
| | `ink-2` | zinc-500 |
| | `ink-3` | zinc-400 |
| | `ink-faint` | zinc-300 (disabled/faintest text) |
| Inverse (dark sidebar / stat bands) | `inverse` | zinc-950 |
| | `inverse-2` | zinc-900 |
| | `inverse-3` | zinc-800 |
| | `inverse-4` | zinc-700 (hover on dark controls) |
| | `inverse-ink` | zinc-50 |
| | `inverse-ink-mid` | zinc-300 (bright secondary on dark) |
| | `inverse-ink-2` | zinc-400 |
| | `inverse-ink-3` | zinc-500 |
| | `inverse-label` | zinc-600 |
| Accents | `accent` | green-400 |
| | `accent-hover` | green-300 (exists only for the marketing-CTA exception) |
| | `on-accent` | zinc-950 |
| | `info` | cyan-400 |
| | `on-info` | zinc-950 |
| | `warn` | orange-500 |
| | `on-warn` | white |

**Deliberate normalizations** (exemplar drift collapsed into slots; these
are intentional, near-invisible value changes): `text-zinc-900` → `ink`;
light-context `text-zinc-600` → `ink-2`; dark-context `text-zinc-100` and
dark-context decorative `text-white` → `inverse-ink`; `border-zinc-950`
→ `border-ink` (no separate slot); the modal overlay `bg-zinc-950/50` →
`bg-inverse/50` (no separate slot).

Markup uses semantic utilities: `bg-panel`, `text-ink-2`, `bg-inverse-2`,
`text-accent`. Opacity modifiers keep working (`bg-panel-2/80`,
`hover:bg-inverse-2/50`) via Tailwind v4 color-mix.

**Bucket 2 — font, weights, radii (no markup change).** Exemplar classes
(`font-extralight`, `rounded-2xl`) already name roles, and Tailwind v4
compiles them to `var(--font-weight-extralight)` / `var(--radius-2xl)`.
Brand packs override the variables directly: `--font-sans`,
`--font-weight-extralight/light/normal/medium`, `--radius-3xl/2xl/xl`.
Example: a brand font lacking weight 200 sets
`--font-weight-extralight: 300` and display type degrades gracefully.

**Fixed structure invariant:** every brand has exactly 27 color roles,
4 weights, 3 radius levels. Brands fill slots; they cannot add slots
(no fourth accent, no gradients, no heavier shadows). Usage rules —
"accents only as dots/badges/avatar fills/icon tints," "inverse surfaces
separate by shade, never borders," "one accent dominates per view" —
carry over verbatim, rephrased in token names.

## Brand packs

**Format:** one plain-CSS file per theme containing exactly one
`[data-theme="<name>"]` block that sets only known slot variables.
No JSON, no codegen. A pack changing `--font-sans` carries its own
`@import url(https://fonts.googleapis.com/…)` at the top of the file —
packs are self-contained drop-ins.

**Partial packs are valid by construction:** the cascade falls back to
house `:root` values for unset slots. A pack is "brand deltas from house."

**Location:** `design/themes/<name>.css` in the consuming project.
Multiple files = multiple runtime themes.

**Resolution (skill step 0):**

1. No `design/themes/` or empty → house identity, `data-theme` never set.
2. Exactly one pack → project default; skill sets its theme name on
   `<html data-theme="…">`.
3. Multiple packs → default comes from the `/design` invocation
   (`--theme <name>`) or the skill asks; the others remain switch targets.

**Validation:** the skill reads each pack at step 0 and rejects unknown
variable names or non-slot declarations (e.g. `--shadow-lg`), reporting
to the user rather than silently dropping. No validator script for now
(LLM reads a ~20-line file against a closed list); add one only if packs
ever come from untrusted/automated sources.

**Invariant:** generated markup only ever uses semantic utilities. The
skill never inlines a brand hex into markup, so every screen generated
honors any pack added later.

**Runtime switching:** ship the pack files, flip `data-theme` on `<html>`.
No rebuild, no regeneration. A theme-switcher component recipe in
`components.md` is out of scope for now; apps implement their own toggle.

## Tailwind mechanism

**Engine:** Tailwind v4 browser build (`@tailwindcss/browser@4`) replaces
the v3 `cdn.tailwindcss.com` script in the shared head. v4 emits `var()`
references, which is what makes runtime overrides work.

**Canonical token block** (shared head for plain HTML; `globals.css` for
build-step stacks) — two-layer pattern:

```css
@theme inline {
  --color-*: initial;          /* wipe default palette FIRST */
  --color-page: var(--page);
  --color-panel: var(--panel);
  /* … all 27 slots … */
}
:root {
  --page: #f4f4f5;             /* house = zinc-100 */
  --accent: #4ade80;           /* house = green-400 */
  /* … house defaults for every slot … */
}
```

Deliberate choices:

1. **Layer split:** packs write plain slot variables (`--accent`) under
   `[data-theme]`, never Tailwind internals. Bucket-2 variables
   (`--radius-2xl`, `--font-weight-medium`, `--font-sans`) are native v4
   theme variables and are overridden directly — no mapping layer.
2. **Palette wipe (`--color-*: initial`):** after migration,
   `bg-zinc-900` does not exist. Off-token classes render unstyled and
   fail loudly instead of silently shipping un-themeable UI. The "only
   palette colors" self-check becomes structurally enforced.

**Implementation-time verification (not assumptions):** confirm v4
`font-weight-*` utilities emit `var()` (radius and colors are certain).
If they inline instead, add weight slots to the `@theme inline` mapping
layer as fallback. Confirm opacity modifiers on `var()`-backed colors
render via color-mix in the browser build.

**Scrollbar CSS** in the shared head currently hardcodes zinc hexes
(`#E4E4E7`, `#D4D4D8`); tokenize thumb colors to slot variables.

## File migration (one-time, mechanical)

| File | Change |
|---|---|
| `docs/design-system/foundations.md` | Color tables rewritten role → semantic class (`bg-zinc-950` → `bg-inverse`); new shared head (v4 + token block); usage rules unchanged in substance |
| `docs/design-system/components.md` | Rename ~99 color references to semantic classes; recipes otherwise untouched |
| `docs/design-system/patterns/*.html` (6 files) | Same rename + new head |
| `docs/design-system/README.md` | Hard rules rephrased in token terms ("exactly three accents" → "only accent/info/warn slots") |
| `docs/design-system/theming.md` | **New:** slot list, pack authoring guide, resolution rules — the page you hand a client's designer |
| `design/skills/design/SKILL.md` | See below |

Specific known renames: landing CTA exception becomes
`bg-accent text-on-accent hover:bg-accent-hover`; dots become
`bg-accent`; dark hover `hover:bg-zinc-900/50` → `hover:bg-inverse-2/50`.

**Acceptance test:** with no pack present, every migrated pattern file
renders visually identical to today — pixel-identical except where a
documented normalization applies (see Token vocabulary). The house
identity is the regression baseline — if anything else shifts, the
tokenization is wrong. House slot values use the Tailwind **v3 hex
palette** (what `cdn.tailwindcss.com` renders today), not v4's oklch
equivalents, precisely to hold this baseline.

## SKILL.md changes

- **New step 0 — resolve theme:** glob `design/themes/*.css`, validate
  packs against the closed slot list, pick default per resolution rules,
  set `data-theme` when a pack is active.
- **Frontmatter description:** drop "fixed identity" for "house identity
  by default; project brand packs override colors/font/radii via tokens."
- **Stack detection (step 3):** plain-HTML head is the new v4 + token
  block; React/Next.js path moves the token block to `globals.css`,
  imports pack files after it.
- **Self-check (step 5) rewritten in token terms:** only semantic color
  utilities (structurally enforced by the palette wipe — check becomes
  "nothing renders unstyled"); no inline hex in markup; weight/radius/
  shadow/motion/icon rules unchanged.

## Error handling

- Invalid pack (unknown variables): report specifics to the user; do not
  apply; offer house fallback.
- Multiple packs, no default indicated: ask, don't guess.
- Missing brand font weights: pack remaps weight variables; document the
  pattern in `theming.md`.

## Testing

- Migration: open each migrated `patterns/*.html` with no pack — visual
  parity with pre-migration rendering.
- Theming: a fixture pack (`design/themes/test-brand.css` in a scratch
  project) exercising all three groups — colors, font remap, radii —
  applied to `patterns/dashboard.html`; verify switchover by toggling
  `data-theme`.
- Skill flow: dry-run `/design` in (a) a packless project, (b) one-pack,
  (c) two-pack project; verify resolution rules 1–3.

## Out of scope

- Dark/light mode (explicitly deferred by Ria).
- Theme-switcher UI component recipe.
- Pack validator script.
- Brand-ingestion tooling (generating packs from client brand guides) —
  a pack is authored by hand for now.
