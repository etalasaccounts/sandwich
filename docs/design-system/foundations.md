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
| De-emphasized row text | `text-sm font-light` (+ lighter zinc) |
| Body copy | `text-sm font-light leading-relaxed` |
| Meta/secondary | `text-xs font-light` |
| Section label | `text-xs uppercase tracking-widest font-normal` |
| Button label (primary) | `text-xs font-medium tracking-wide` |
| Button label (secondary) | `text-xs font-light` |

Never use `font-semibold`, `font-bold`, or any weight above 500.
Emphasis comes from weight 500 vs 300 and zinc-950 vs zinc-500 — not from
bolding.

## Color

Neutrals: **zinc only.**

### Dark surface stack (sidebar, stat bands, mobile bottom nav)

| Layer | Class |
|---|---|
| Panel background | `bg-zinc-950` |
| Card / input / active item | `bg-zinc-900` |
| Nested / hover / avatar | `bg-zinc-800` (hover often `hover:bg-zinc-900/50` on items) |
| Primary text | `text-zinc-50` |
| Secondary text | `text-zinc-400` |
| Muted text / placeholder | `text-zinc-500` |
| Section labels | `text-zinc-600` |

No borders on dark surfaces — separation is by shade.

### Light surface stack (content panels, pages)

| Layer | Class |
|---|---|
| Page background | `bg-zinc-100` |
| Shell / primary panel | `bg-white` |
| Secondary panel / card | `bg-zinc-50` (cards often `bg-zinc-50/80 border border-zinc-100`) |
| Control fill | `bg-zinc-200/50`, hover `bg-zinc-200` |
| Border | `border-zinc-200` (sometimes `/50`) |
| Primary text | `text-zinc-950` |
| Secondary text | `text-zinc-500` |
| Tertiary text | `text-zinc-400` |

### Accents — exactly three, fixed semantics

| Accent | Meaning | Text on top of it |
|---|---|---|
| `green-400` | primary accent: active nav, selected, success, live dots, primary avatars | `text-zinc-950` |
| `cyan-400` | secondary / informational | `text-zinc-950` |
| `orange-500` | warning / attention | `text-white` |

Accent application: 2×2 dots (`w-2 h-2 rounded-full bg-green-400`), count
badges, avatar fills, icon tints on active items. One accent (green)
dominates per view; cyan and orange are supporting. **Never**: large accent
surfaces, accent-colored body text, gradients, colors outside this palette.
Two narrow, enumerated carve-outs exist (one accent-filled CTA on a
marketing page's featured pricing tier; a smaller `w-1.5 h-1.5` inline dot)
— see [Documented exceptions](#documented-exceptions) below. Nothing outside
that list.

## Surfaces & layout

**App shell** (every app screen):

```html
<body class="bg-zinc-100 h-screen w-full flex items-center justify-center p-2 sm:p-4 text-sm antialiased text-zinc-900">
  <div class="bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden">
    <!-- rounded-2xl panel columns go here -->
  </div>
</body>
```

Panels inside the shell are `rounded-2xl` columns:

- Dark sidebar: `bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[320px] flex-shrink-0 hidden lg:flex overflow-y-auto`
- Optional list panel: `bg-zinc-50 rounded-2xl flex flex-col w-full md:w-[380px] flex-shrink-0 overflow-hidden`
- Main content: `bg-white rounded-2xl flex flex-col flex-1 overflow-hidden`

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

- **Page background is `bg-white`**, not `zinc-100` — there's no shell to
  contrast against, so the page itself is the surface.
- **Nav is a flat bar**: `border-b border-zinc-100`, no rounding, no
  shadow, no card wrapper. Sits at the top of the max-width container with
  padding only (e.g. `flex items-center justify-between py-4 border-b
  border-zinc-100`).
- **Sections themselves never get a card wrapper.** A section as a whole
  (hero, a feature-grid section, footer) never gets `rounded-*` or
  `shadow-*` around its outer edge. Vertical rhythm comes from padding
  (`py-16`–`py-24`) and, where a section needs to visually separate from
  the one above, a plain `border-t`/`border-b border-zinc-100` — never a
  boxed container around the section.
- **Items inside a section may be cards when the content benefits from a
  boundary** — three pricing tiers being compared, a testimonial that
  needs to read as one attributed quote, a feature that should feel like
  a complete unit: `border border-zinc-100 rounded-2xl p-6` per item,
  `grid` with a normal `gap` between them (see `patterns/landing.html`'s
  feature/testimonial/pricing sections). This is a per-item choice, not a
  section wrapper — the section around the grid stays flat.
- **A flat list (not a comparison) stays flat**, e.g. an FAQ: rows
  separated by `border-b border-zinc-100`, no card per row.
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
  `border-r border-zinc-100` instead of its own card background — see
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
<iconify-icon icon="solar:inbox-in-linear" class="text-zinc-400 text-base"></iconify-icon>
```

Size with text utilities (`text-sm` / `text-base` / `text-lg` / `text-xl`).
Default tint `text-zinc-400` or `text-zinc-500`; accent tint on active
(`text-green-400`). Common names: `solar:magnifer-linear` (search),
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
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<style type="text/tailwindcss">
  @theme {
    /* Accent colors for sandwich design system */
    --color-accent-primary: #4ade80;      /* green-400 */
    --color-accent-primary-hover: #86efac; /* green-300 */
    --color-accent-secondary: #22d3ee;    /* cyan-400 */
    --color-accent-warning: #f97316;      /* orange-500 */
    
    /* Font family */
    --font-sans: 'Inter', sans-serif;
  }
  
  body { font-family: var(--font-sans); }
  iconify-icon { stroke-width: 1.5; }
  
  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
</style>
</head>
```
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAGE TITLE HERE</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<style>
body { font-family: 'Inter', sans-serif; }
iconify-icon { stroke-width: 1.5; }
/* Custom Scrollbar for a cleaner look */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
</style></head>
```

On a build-step stack (Next.js etc.), the same four concerns move to your
own entry points: Tailwind via your config, Inter via `next/font/google`
weights `["200","300","400","500"]`, iconify via `@iconify/react` or the
script in the root layout, and the `<style>` block's rules into your global
stylesheet.

## Documented exceptions

Two places where the exemplars in `patterns/` legitimately go beyond the
rules above. These are the *complete* list — anything not listed here is a
violation, and none of these generalize past their stated scope.

**1. One accent-filled CTA per marketing page.** Exactly one accent-filled
CTA button is allowed per marketing/landing page: the featured pricing
tier's primary action, using
`bg-green-400 text-zinc-950 rounded-xl py-2.5 w-full text-xs font-medium tracking-wide hover:bg-green-300 transition-colors`
(see `patterns/landing.html`, the dark pricing card). This is the only
place a button may use a large accent fill, and `green-300` exists solely
as that button's hover state. Nowhere
else — not app-shell primaries, not secondary CTAs, not the non-featured
pricing tiers, not a second button on the same page. Everywhere else the
primary button is the zinc `button-primary` recipe.

**2. Second dot size for inline unread indicators.** The unread-indicator
dot has a second valid size, `w-1.5 h-1.5 rounded-full bg-green-400`, in
addition to the documented `w-2 h-2`. Use `w-1.5 h-1.5` when the dot sits
inline next to a name or title inside a list row (see `patterns/mailbox.html`,
`patterns/mobile.html`); use `w-2 h-2` for a standalone status dot (KPI
cards, stat bands, live indicators).

## Do / Don't

| Do | Don't |
|---|---|
| Zinc + the 3 accents | Any other color, gradients |
| Inter 200–500 | `font-semibold`/`font-bold`, other fonts |
| Solar linear icons | lucide, tabler, heroicons, emoji |
| Accent dots/badges/tints | Accent panels, accent headlines, accent buttons — except the single documented exception above |
| Shade separation on dark | Borders on dark surfaces |
| `rounded-xl`+ on controls | `rounded-md`/`rounded`/square corners |
| `shadow-sm` | `shadow-md` and up, colored shadows |
| `transition-colors` | Scale/slide/bounce animations |
| Copying `components.md` recipes | Inventing new component styles |
