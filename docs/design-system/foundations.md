# Foundations

Normative reference. Every class string here is canonical — copy it, don't
approximate it.

## Typography

Font: **Inter** 200/300/400/500. Body gets `antialiased`. Base size `text-sm`.

| Role | Classes |
|---|---|
| Display number (KPI) | `text-3xl font-extralight tracking-tight` |
| Hero display (landing) | `text-5xl sm:text-6xl font-extralight tracking-tight` |
| Page/panel title | `text-lg font-medium tracking-tight` |
| Detail-pane title | `text-xl font-medium tracking-tight` |
| Emphasized row text | `text-sm font-medium` |
| De-emphasized row text | `text-sm font-light` (+ lighter ink shade) |
| Body copy | `text-sm font-light leading-relaxed` |
| Meta/secondary | `text-xs font-light` |
| Section label | `text-xs uppercase tracking-widest font-normal` |
| Button label (primary) | `text-xs font-medium tracking-wide` |
| Button label (secondary) | `text-xs font-light` |

Never use `font-semibold`, `font-bold`, or any weight above 500.
Emphasis comes from weight 500 vs 300 and `ink` vs `ink-2` — not from
bolding.

## Color

Neutrals: a single tonal scale (house default: zinc).

### Inverse stack (sidebar, stat bands, mobile bottom nav)

| Layer | Class |
|---|---|
| Panel background | `bg-inverse` |
| Card / input / active item | `bg-inverse-2` |
| Nested / hover / avatar | `bg-inverse-3` (hover often `hover:bg-inverse-2/50` on items) |
| Hover on dark controls | `bg-inverse-4` |
| Primary text | `text-inverse-ink` |
| Bright secondary text | `text-inverse-ink-mid` |
| Secondary text | `text-inverse-ink-2` |
| Muted text / placeholder | `text-inverse-ink-3` |
| Section labels | `text-inverse-label` |

No borders on dark surfaces — separation is by shade.

### Base stack (content panels, pages)

| Layer | Class |
|---|---|
| Page background | `bg-page` |
| Shell / primary panel | `bg-panel` |
| Secondary panel / card | `bg-panel-2` (cards often `bg-panel-2/80 border border-line`) |
| Control fill | `bg-control/50`, hover `bg-control` |
| Border | `border-line` (sometimes `/50`) |
| Stronger border / toggle track | `border-line-2` |
| Primary text | `text-ink` |
| Emphasized secondary text | `text-ink-mid` |
| Secondary text | `text-ink-2` |
| Tertiary text | `text-ink-3` |
| Faintest / disabled text | `text-ink-faint` |

### Accents — exactly three, fixed semantics

| Accent | Meaning | Text on top of it |
|---|---|---|
| `accent` | primary accent: active nav, selected, success, live dots, primary avatars | `text-on-accent` |
| `info` | secondary / informational | `text-on-info` |
| `warn` | warning / attention | `text-on-warn` |

Slot house values and brand overrides: see [`theming.md`](./theming.md).

Accent application: 2×2 dots (`w-2 h-2 rounded-full bg-accent`), count
badges, avatar fills, icon tints on active items. One accent (house
default: green) dominates per view; the other two accent slots are
supporting. **Never**: large accent
surfaces, accent-colored body text, gradients, colors outside this palette.
Two narrow, enumerated carve-outs exist (one accent-filled CTA on a
marketing page's featured pricing tier; a smaller `w-1.5 h-1.5` inline dot)
— see [Documented exceptions](#documented-exceptions) below. Nothing outside
that list.

## Surfaces & layout

**App shell** (every app screen):

```html
<body class="bg-page h-screen w-full flex items-center justify-center p-2 sm:p-4 text-sm antialiased text-ink">
  <div class="bg-panel rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden">
    <!-- rounded-2xl panel columns go here -->
  </div>
</body>
```

Panels inside the shell are `rounded-2xl` columns:

- Dark sidebar: `bg-inverse rounded-2xl p-4 gap-5 flex-col w-[320px] flex-shrink-0 hidden lg:flex overflow-y-auto`
- Optional list panel: `bg-panel-2 rounded-2xl flex flex-col w-full md:w-[380px] flex-shrink-0 overflow-hidden`
- Main content: `bg-panel rounded-2xl flex flex-col flex-1 overflow-hidden`

Responsive defaults: sidebar hidden below `lg`; when a list panel exists the
main pane is `hidden md:flex`. Mobile screens drop side panels entirely and
use a bottom nav (see `patterns/mobile.html`).

## Surfaces & layout — public-facing (flat)

The app shell above is for workspaces — screens someone works inside all
day. Public-facing pages (marketing/landing, storefronts/marketplaces, job
boards, docs) are not workspaces and must not look like one: no page-level
shell, no floating white card wrapping *the whole page or a whole section*,
no `zinc-100` backdrop under everything. See `patterns/landing.html` and
`patterns/marketplace-grid.html`. This is "flat," not "no cards ever" — a
card is still the right call for a self-contained item that benefits from
a boundary (a pricing tier, a testimonial, a feature summary); it's the
wrong call for a structural wrapper around a whole section.

- **Page background is `bg-panel`**, not `page` — there's no shell to
  contrast against, so the page itself is the surface.
- **Nav is a flat bar**: `border-b border-line`, no rounding, no
  shadow, no card wrapper. Sits at the top of the max-width container with
  padding only (e.g. `flex items-center justify-between py-4 border-b
  border-line`).
- **Sections themselves never get a card wrapper.** A section as a whole
  (hero, a feature-grid section, footer) never gets `rounded-*` or
  `shadow-*` around its outer edge. Vertical rhythm comes from padding
  (`py-16`–`py-24`) and, where a section needs to visually separate from
  the one above, a plain `border-t`/`border-b border-line` — never a
  boxed container around the section.
- **Items inside a section may be cards when the content benefits from a
  boundary** — three pricing tiers being compared, a testimonial that
  needs to read as one attributed quote, a feature that should feel like
  a complete unit: `border border-line rounded-2xl p-6` per item,
  `grid` with a normal `gap` between them (see `patterns/landing.html`'s
  feature/testimonial/pricing sections). This is a per-item choice, not a
  section wrapper — the section around the grid stays flat.
- **A flat list (not a comparison) stays flat**, e.g. an FAQ: rows
  separated by `border-b border-line`, no card per row.
- **A full-width color band is still allowed** (e.g. a dark stats section
  or a closing CTA band) — that's a background-color change across an
  entire section, not a card. It has **no rounded corners and no shadow**;
  content inside still respects the page's max-width via its own inner
  wrapper.
- **The one featured item in a card comparison** may get a background
  change of its own (e.g. the dark featured pricing card) — see
  [Documented exceptions](#documented-exceptions) for the accent-CTA rule
  that comes with it.
- **A product-preview/screenshot frame** (a mockup of the app inside a
  bordered window) is legitimate to border+shadow even on a flat page —
  it represents an image, not a section wrapper.
- **Grid items that are pure imagery + text with no inherent boundary**
  (e.g. a product-browsing grid where the photo itself is the boundary)
  can skip the card: the image tile is the only bounded shape (`rounded-xl`,
  no border, no shadow), text sits directly on the page background, and the
  grid's `gap` separates items — see `patterns/marketplace-grid.html`.
- A **secondary rail** (filters, sub-nav) next to flat content uses a
  `border-r border-line` instead of its own card background — see
  `components.md#secondary-rail`'s variants.

## Radius / shadow / motion

- `rounded-3xl` app shell → `rounded-2xl` panels & cards → `rounded-xl`
  controls (nav items, inputs, rect buttons, chips, image tiles) →
  `rounded-full` pills, icon buttons, avatars, badges, dots. `rounded-lg`
  only for tiny nested thumbnails. This scale applies inside an app shell;
  public-facing flat pages don't use card/panel radii at all — see below.
- Shadows: `shadow-sm`; selected list rows may use
  `shadow-[0_1px_3px_rgba(0,0,0,0.02)]`. Nothing heavier.
- Motion: `transition-colors` on interactive elements. `animate-pulse` for
  skeletons. Nothing else.

## Icons

Solar linear only, via the iconify web component:

```html
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<iconify-icon icon="solar:inbox-in-linear" class="text-ink-3 text-base"></iconify-icon>
```

Size with text utilities (`text-sm` / `text-base` / `text-lg` / `text-xl`).
Default tint `text-ink-3` or `text-ink-2`; accent tint on active
(`text-accent`). Common names: `solar:magnifer-linear` (search),
`solar:pen-new-square-linear` (compose/new), `solar:settings-linear`,
`solar:user-circle-linear`, `solar:inbox-in-linear`, `solar:plain-linear`
(send), `solar:document-linear`, `solar:trash-bin-trash-linear`,
`solar:star-linear`, `solar:menu-dots-linear`, `solar:bell-linear`,
`solar:home-2-linear`, `solar:chart-2-linear`, `solar:wallet-linear`,
`solar:alt-arrow-left-linear` / `-right-` (pagination),
`solar:sort-vertical-linear`, `solar:tuning-square-2-linear` (filters),
`solar:close-circle-linear`, `solar:danger-triangle-linear`,
`solar:check-circle-linear`, `solar:info-circle-linear`,
`solar:shield-keyhole-linear`, `solar:letter-linear`. For anything else
search https://icon-sets.iconify.design/solar/ — always the `-linear`
variant.

## Shared HTML head

Canonical for every plain-HTML page. All six `patterns/*.html` files carry
this exact block — only the `<title>` differs. Copy it verbatim (including
the scrollbar CSS and the `iconify-icon` stroke rule) and substitute the
title:

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

On a build-step stack (Next.js etc.), see
[`theming.md` §6](./theming.md#6-build-step-stacks-reactnextjs-etc) for how
the same concerns — the token block, Inter, iconify, and Tailwind itself —
move to your own entry points instead of a CDN `<head>`.

## Documented exceptions

Two places where the exemplars in `patterns/` legitimately go beyond the
rules above. These are the *complete* list — anything not listed here is a
violation, and none of these generalize past their stated scope.

**1. One accent-filled CTA per marketing page.** Exactly one accent-filled
CTA button is allowed per marketing/landing page: the featured pricing
tier's primary action, using
`bg-accent text-on-accent rounded-xl py-2.5 w-full text-xs font-medium tracking-wide hover:bg-accent-hover transition-colors`
(see `patterns/landing.html`, the dark pricing card). This is the only place
a button may use a large accent fill, and `accent-hover` exists solely as
that button's hover state. Nowhere else — not app-shell primaries, not secondary
CTAs, not the non-featured pricing tiers, not a second button on the same
page. Everywhere else the primary button is the inverse `button-primary`
recipe.

**2. Second dot size for inline unread indicators.** The unread-indicator
dot has a second valid size, `w-1.5 h-1.5 rounded-full bg-accent`, in
addition to the documented `w-2 h-2`. Use `w-1.5 h-1.5` when the dot sits
inline next to a name or title inside a list row (see `patterns/mailbox.html`,
`patterns/mobile.html`); use `w-2 h-2` for a standalone status dot (KPI
cards, stat bands, live indicators).

## Do / Don't

| Do | Don't |
|---|---|
| Slot colors only (`theming.md`) | Any other color, gradients |
| Inter 200–500 | `font-semibold`/`font-bold`, other fonts |
| Solar linear icons | lucide, tabler, heroicons, emoji |
| Accent dots/badges/tints | Accent panels, accent headlines, accent buttons — except the single documented exception above |
| Shade separation on dark | Borders on dark surfaces |
| `rounded-xl`+ on controls | `rounded-md`/`rounded`/square corners |
| `shadow-sm` | `shadow-md` and up, colored shadows |
| `transition-colors` | Scale/slide/bounce animations |
| Copying `components.md` recipes | Inventing new component styles |
