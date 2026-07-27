# Theming

Brand identity in this design system lives entirely in a closed set of CSS
variable "slots" — never in literal utility classes. The **house** look
(zinc neutrals, green accent, Inter, generous radii) is simply the default
value of every slot. A client brand is a small CSS **brand pack** that fills
the same slots with different values. Structure, spacing, component
recipes, and usage rules (which surfaces get an accent, how inverse panels
stack) never vary per brand — only the slot values do.

## 1. Slot reference

### Colors — 27 semantic slots

Markup never uses `bg-zinc-950` or `text-green-400` directly; it uses the
semantic utility for the slot (`bg-panel`, `text-ink-2`, `bg-inverse-2`,
`text-accent`, etc.). Opacity modifiers keep working on these
(`bg-panel-2/80`, `hover:bg-inverse-2/50`) via Tailwind v4 color-mix.

| Group | Slot | House hex | House role |
|---|---|---|---|
| Base | `page` | `#f4f4f5` | app background (zinc-100) |
| Base | `panel` | `#ffffff` | card/surface background (white) |
| Base | `panel-2` | `#fafafa` | secondary surface (zinc-50) |
| Base | `control` | `#e4e4e7` | input/control fill (zinc-200, often `/50`) |
| Base | `line` | `#f4f4f5` | hairline border (zinc-100) |
| Base | `line-2` | `#d4d4d8` | stronger border, toggle track (zinc-300) |
| Base | `ink` | `#09090b` | primary text (zinc-950) |
| Base | `ink-mid` | `#3f3f46` | emphasized secondary text (zinc-700) |
| Base | `ink-2` | `#71717a` | secondary text (zinc-500) |
| Base | `ink-3` | `#a1a1aa` | tertiary text (zinc-400) |
| Base | `ink-faint` | `#d4d4d8` | disabled/faintest text (zinc-300) |
| Inverse | `inverse` | `#09090b` | dark sidebar/stat-band background (zinc-950) |
| Inverse | `inverse-2` | `#18181b` | dark surface, one step up (zinc-900) |
| Inverse | `inverse-3` | `#27272a` | dark surface, two steps up (zinc-800) |
| Inverse | `inverse-4` | `#3f3f46` | hover on dark controls (zinc-700) |
| Inverse | `inverse-ink` | `#fafafa` | primary text on dark (zinc-50) |
| Inverse | `inverse-ink-mid` | `#d4d4d8` | bright secondary text on dark (zinc-300) |
| Inverse | `inverse-ink-2` | `#a1a1aa` | secondary text on dark (zinc-400) |
| Inverse | `inverse-ink-3` | `#71717a` | tertiary text on dark (zinc-500) |
| Inverse | `inverse-label` | `#52525b` | label/caption on dark (zinc-600) |
| Accent | `accent` | `#4ade80` | brand accent (green-400) |
| Accent | `accent-hover` | `#86efac` | accent hover, marketing-CTA exception (green-300) |
| Accent | `on-accent` | `#09090b` | text/icon on accent fill (zinc-950) |
| Accent | `info` | `#22d3ee` | informational chip/badge (cyan-400) |
| Accent | `on-info` | `#09090b` | text/icon on info fill (zinc-950) |
| Accent | `warn` | `#f97316` | warning chip/badge (orange-500) |
| Accent | `on-warn` | `#ffffff` | text/icon on warn fill (white) |

**Fixed structure invariant:** every brand has exactly these 27 color roles.
Brands fill slots; they never add slots — no fourth accent, no gradients,
no extra shadow scale. A brand pack that only sets 3 of the 27 is valid;
everything else falls back to the house value.

### Bucket 2 — font, weight, radius (no markup change)

These are native Tailwind v4 theme variables. The exemplar utility classes
(`font-extralight`, `rounded-2xl`, …) already exist in markup and compile to
`var(--font-weight-extralight)` / `var(--radius-2xl)` etc., so brand packs
override the variables directly — no semantic renaming, no mapping layer.

| Variable | House value |
|---|---|
| `--font-sans` | `'Inter', sans-serif` |
| `--font-weight-extralight` | `200` |
| `--font-weight-light` | `300` |
| `--font-weight-normal` | `400` |
| `--font-weight-medium` | `500` |
| `--radius-3xl` | `1.5rem` |
| `--radius-2xl` | `1rem` |
| `--radius-xl` | `0.75rem` |

If a brand font is missing a weight (e.g. no 200), remap the variable to
the nearest weight the font actually ships (e.g.
`--font-weight-extralight: 300`) — display type degrades gracefully instead
of falling back to a system font at the wrong weight.

## 2. Verified Tailwind v4 mechanics

Before this doc was written, both migration assumptions were empirically
verified with a throwaway test page rendered via
`@tailwindcss/browser@4` and screenshotted with Playwright:

- Overriding `--accent`, `--page`, etc. under a `[data-theme]` selector
  correctly re-themes every `bg-*`/`text-*` slot utility (expected — these
  go through the `@theme inline` remap below).
- Overriding `--radius-2xl` and `--font-weight-extralight` under a
  `[data-theme]` selector **also** took effect on `rounded-2xl` and
  `font-extralight` with no extra mapping layer required. Pixel measurement
  of the rendered corner curve showed the radius shrinking from a ~15px
  arc (house, 1rem) to a ~3px arc (probe, 0.25rem override), and the
  weight-200 text rendered visibly bold under a `600` override. This
  confirms `--radius-2xl` / `--font-weight-*` are native v4 theme variable
  names, not just conventions, so packs can override them directly as
  specified. **No fallback was needed** — the canonical head below is
  exactly what the design spec proposed, unchanged.

## 3. Canonical shared head

Every plain-HTML design-system file (`patterns/*.html` and any file the
`/design` skill generates for a static-HTML stack) starts with this exact
head. Only `<title>` varies per page.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAGE TITLE HERE</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<style type="text/tailwindcss">
@theme inline {
  --color-*: initial;
  --color-page: var(--page);
  --color-panel: var(--panel);
  --color-panel-2: var(--panel-2);
  --color-control: var(--control);
  --color-line: var(--line);
  --color-line-2: var(--line-2);
  --color-ink: var(--ink);
  --color-ink-mid: var(--ink-mid);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-ink-faint: var(--ink-faint);
  --color-inverse: var(--inverse);
  --color-inverse-2: var(--inverse-2);
  --color-inverse-3: var(--inverse-3);
  --color-inverse-4: var(--inverse-4);
  --color-inverse-ink: var(--inverse-ink);
  --color-inverse-ink-mid: var(--inverse-ink-mid);
  --color-inverse-ink-2: var(--inverse-ink-2);
  --color-inverse-ink-3: var(--inverse-ink-3);
  --color-inverse-label: var(--inverse-label);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-on-accent: var(--on-accent);
  --color-info: var(--info);
  --color-on-info: var(--on-info);
  --color-warn: var(--warn);
  --color-on-warn: var(--on-warn);
}
:root {
  --page: #f4f4f5;
  --panel: #ffffff;
  --panel-2: #fafafa;
  --control: #e4e4e7;
  --line: #f4f4f5;
  --line-2: #d4d4d8;
  --ink: #09090b;
  --ink-mid: #3f3f46;
  --ink-2: #71717a;
  --ink-3: #a1a1aa;
  --ink-faint: #d4d4d8;
  --inverse: #09090b;
  --inverse-2: #18181b;
  --inverse-3: #27272a;
  --inverse-4: #3f3f46;
  --inverse-ink: #fafafa;
  --inverse-ink-mid: #d4d4d8;
  --inverse-ink-2: #a1a1aa;
  --inverse-ink-3: #71717a;
  --inverse-label: #52525b;
  --accent: #4ade80;
  --accent-hover: #86efac;
  --on-accent: #09090b;
  --info: #22d3ee;
  --on-info: #09090b;
  --warn: #f97316;
  --on-warn: #ffffff;
  --font-sans: 'Inter', sans-serif;
}
body { font-family: var(--font-sans); }
iconify-icon { stroke-width: 1.5; }
/* Custom Scrollbar for a cleaner look */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--control); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--line-2); }
</style></head>
```

Note on the two-layer pattern: the `@theme inline` block first wipes
Tailwind's default palette (`--color-*: initial`) so off-token classes like
`bg-zinc-900` render unstyled instead of silently working — this makes
"only use semantic color utilities" a structural guarantee, not a
self-check. It then remaps every semantic color slot to a plain `:root`
variable of the same short name. Bucket-2 variables (`--radius-2xl`,
`--font-weight-medium`, `--font-sans`) need no such remap — they are native
v4 theme variable names, so brand packs override them directly (see §2).

## 4. Brand pack authoring guide

A brand pack is **one plain-CSS file**, no JSON, no codegen, no build step:

- **Location:** `design/themes/<name>.css` in the consuming project (not in
  this design-system doc tree). One file per runtime theme; multiple files
  = multiple switchable themes.
- **Shape:** exactly one `[data-theme="<name>"]` block, setting only known
  slot variables from §1 (the 27 color slots, plus `--font-sans`,
  `--font-weight-extralight/light/normal/medium`,
  `--radius-3xl/2xl/xl`). Any other variable name (`--shadow-lg`, a new
  accent, etc.) is invalid — brands fill slots, they don't add them.
- **Partial packs are valid by construction:** the cascade falls back to
  the house `:root` value for any slot the pack doesn't set. A pack is
  "brand deltas from house," not a full restatement.
- **Font changes carry their own `@import`:** if a pack sets `--font-sans`
  to a font not already loaded, the pack's first line is a Google Fonts
  (or equivalent) `@import url(...)` — packs are self-contained drop-ins,
  they don't depend on the host page having pre-loaded the right font.

Full example pack:

```css
/* design/themes/acme.css — Acme brand pack */
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');
[data-theme="acme"] {
  --accent: #6366f1;
  --on-accent: #ffffff;
  --inverse: #0a1628;
  --inverse-2: #12203a;
  --inverse-3: #1b2d4e;
  --font-sans: 'Sora', sans-serif;
  --font-weight-extralight: 300;
  --font-weight-medium: 600;
  --radius-3xl: 1rem;
  --radius-2xl: 0.75rem;
  --radius-xl: 0.5rem;
}
```

This pack changes the accent, three inverse shades, the font family (with
its own weight remap since Sora ships 300 as its lightest), and squares up
the radius scale slightly. Every other slot (page, panel, ink family, info,
warn, …) silently falls back to house.

## 5. Resolution rules and runtime switching

**Resolution** (used by the `/design` skill at step 1):

1. No `design/themes/` directory, or it's empty → house identity;
   `data-theme` is never set on the page.
2. Exactly one pack present → it becomes the project default; the skill
   sets `<html data-theme="<name>">`.
3. Multiple packs present → the default comes from the `/design`
   invocation (e.g. `--theme <name>`), or the skill asks which one; the
   others remain available as runtime switch targets.

**Runtime switching:** load the pack stylesheet(s) after the token block
(so the `[data-theme]` rule can override `:root`), then flip the
`data-theme` attribute on `<html>` at any time — in a settings toggle, a
theme switcher, whatever the app needs. No rebuild, no regeneration; the
same shipped HTML/CSS serves every theme.

```html
<link rel="stylesheet" href="/design/themes/acme.css">
<script>document.documentElement.dataset.theme = 'acme';</script>
```

## 6. Build-step stacks (React/Next.js, etc.)

The mechanics are identical outside the browser-CDN build:

- The `@theme inline` block and the `:root` slot defaults move into
  `globals.css` (compiled by the real Tailwind v4 CLI/PostCSS plugin, not
  the `@tailwindcss/browser` script tag).
- Brand pack files are plain CSS `@import`ed after the token block, in the
  same file or via the bundler's CSS entry point.
- `data-theme` is set on the document root element (`<html>` in Next.js's
  root layout, or via a small client-side effect for user-toggleable
  themes) — the selector logic is unchanged from the plain-HTML case.
