# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-contained house design system in `docs/design-system/`, expose it via a new `/design` skill, and rewrite `/craft` to compose from it instead of the shadcn registry.

**Architecture:** Pure reference material (markdown + standalone HTML exemplars) lives in `docs/design-system/`. Two consumers: the new `/design` skill (any project, any stack) and the rewritten `/craft` (Next.js pipeline, engine kept, design source swapped). The old `docs/design-exemplars/` and everything shadcn is deleted.

**Tech Stack:** Markdown, static HTML + Tailwind CDN + iconify (Solar icons), Next.js template (Tailwind v3), zod schemas validated with `node --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-07-27-design-system-design.md` — read it first. The source exemplar is `docs/superpowers/specs/assets/2026-07-27-email-dashboard-source.html`.

## Global Constraints

- Repo: `/Users/riaenriala/Documents/etalas/sandwich`, branch `feat/design-system` (already exists, already has the spec commit).
- All git commits end with: `Co-Authored-By: Claude <noreply@anthropic.com>` (repo convention; check `git log` and follow it).
- **The DNA (applies to every HTML/TSX artifact in this plan):**
  - Font Inter, weights 200/300/400/500 ONLY. Never `font-semibold`/`font-bold`.
  - Neutrals: zinc scale only. Accents: `green-400` (primary/active/success), `cyan-400` (info), `orange-500` (warning) — only as small elements (dots, badges, avatar fills, icon tints). Never large accent fills, never gradients, never accent body text.
  - Radius: `rounded-3xl` shell / `rounded-2xl` panels+cards / `rounded-xl` controls / `rounded-full` pills, icon buttons, avatars, dots. Nothing squarer than `rounded-lg` (thumbnails only).
  - Shadow: `shadow-sm` max. Motion: `transition-colors` only (exception: `animate-pulse` for skeletons).
  - Icons: Solar linear via iconify, names `solar:*-linear`. No lucide, no tabler, no emoji.
  - Dark surfaces (`zinc-950` panels) separate by shade (`zinc-900`, `zinc-800`), never borders. Light surfaces may use `border-zinc-100`.
- **Shared HTML head** — every `docs/design-system/patterns/*.html` file starts with exactly this (only `<title>` differs):

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
<style>
body { font-family: 'Inter', sans-serif; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
</style>
</head>
```

- **Content rule for exemplars:** realistic copy in English (product: a fictional SaaS called "Nordbyte" / mail app called "Mail"), never lorem ipsum, never `TODO`. No analytics/tracking scripts of any kind.
- Where a task below says "per `components.md` recipe `X`", the exact snippet is defined in Task 2 of this plan — copy the classes from there, do not restyle.
- HTML review checklist (used by several tasks): open the file in a browser (`open <file>` on macOS) and verify — Inter loads (thin look), icons render (not empty squares), only zinc + the 3 accents, accents only on small elements, radius scale respected, no horizontal scrollbar at 1440×900 and at 375px width.

---

### Task 1: `docs/design-system/README.md` + `foundations.md`

**Files:**
- Create: `docs/design-system/README.md`
- Create: `docs/design-system/foundations.md`

**Interfaces:**
- Produces: the two entry documents every later task and both skills (`/design`, `/craft`) reference by path. Component ids and file names referenced here are delivered by Tasks 2–5 — the names are fixed now.

- [ ] **Step 1: Create `docs/design-system/README.md`** with exactly this content:

````markdown
# Design System

The single source of visual truth for all UI we generate — any project, any
stack. This is a **reference for AI**, not a component library: read the
rules, copy the recipes, produce UI that is indistinguishable from the
exemplars.

## Hard rules

1. Font is **Inter**, weights 200/300/400/500 only. Never semibold or bold.
2. Neutrals are the **zinc** scale only. Exactly three accents:
   `green-400` (primary/active/success), `cyan-400` (info),
   `orange-500` (warning).
3. Accents appear only as **small elements** — dots, count badges, avatar
   fills, icon tints. Never large fills, never gradients, never accent
   body text.
4. Icons are **Solar linear** (`solar:*-linear`) via iconify. No lucide,
   no tabler, no emoji.
5. Radius scale is fixed: `rounded-3xl` app shell / `rounded-2xl` panels
   and cards / `rounded-xl` controls / `rounded-full` pills, icon buttons,
   avatars, dots.
6. `shadow-sm` is the heaviest shadow. `transition-colors` is the only
   motion (plus `animate-pulse` for skeletons).
7. Dark surfaces separate by background shade, never borders. Light
   surfaces may use `border-zinc-100`.
8. When in doubt, **copy a snippet from `components.md` or a section from
   `patterns/`** — never invent a new style.

## How to use this

| Task | Read |
|---|---|
| Any styling question (color, type, spacing, radius) | [`foundations.md`](./foundations.md) |
| Building one component (button, table, modal, …) | [`components.md`](./components.md) — find it by id, copy the snippet |
| Building a full screen | [`patterns/patterns.md`](./patterns/patterns.md) — pick the closest pattern, open its HTML, adapt |

Always read `foundations.md` before generating anything. Then pull only the
component sections / pattern files you actually need.

## Adapting to a stack

The exemplars are plain HTML + Tailwind CDN. The classes and markup
structure are the design system — keep them identical everywhere:

- **Plain HTML:** copy the shared head from any pattern file (Tailwind CDN,
  Inter, iconify script, scrollbar CSS).
- **React/Next.js:** same markup, `class` → `className`. Icons: keep the
  `<iconify-icon>` custom element (load the iconify script in the root
  layout) or use `@iconify/react`'s `<Icon icon="solar:…-linear" />` —
  same icon names. Load Inter via `next/font/google` with weights
  `["200","300","400","500"]`.
- Tailwind with a build step needs no config beyond the font family — the
  system uses stock zinc/green/cyan/orange utilities on purpose.
````

- [ ] **Step 2: Create `docs/design-system/foundations.md`** with exactly this content:

````markdown
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
| Border | `border-zinc-100` (sometimes `/50`) |
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

## Radius / shadow / motion

- `rounded-3xl` shell → `rounded-2xl` panels & cards → `rounded-xl`
  controls (nav items, inputs, rect buttons, chips) → `rounded-full`
  pills, icon buttons, avatars, badges, dots. `rounded-lg` only for tiny
  nested thumbnails.
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

## Scrollbar

```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
```

## Do / Don't

| Do | Don't |
|---|---|
| Zinc + the 3 accents | Any other color, gradients |
| Inter 200–500 | `font-semibold`/`font-bold`, other fonts |
| Solar linear icons | lucide, tabler, heroicons, emoji |
| Accent dots/badges/tints | Accent panels, accent buttons, accent headlines |
| Shade separation on dark | Borders on dark surfaces |
| `rounded-xl`+ on controls | `rounded-md`/`rounded`/square corners |
| `shadow-sm` | `shadow-md` and up, colored shadows |
| `transition-colors` | Scale/slide/bounce animations |
| Copying `components.md` recipes | Inventing new component styles |
````

- [ ] **Step 3: Review both files** against the source exemplar `docs/superpowers/specs/assets/2026-07-27-email-dashboard-source.html` — every class string in foundations.md must literally occur in (or compose directly from) the source file's classes. Fix discrepancies in foundations.md, not by editing the source.

- [ ] **Step 4: Commit**

```bash
git add docs/design-system/README.md docs/design-system/foundations.md
git commit -m "feat(design-system): add README and foundations"
```

---

### Task 2: `docs/design-system/components.md`

**Files:**
- Create: `docs/design-system/components.md`

**Interfaces:**
- Produces: component ids `button-primary`, `button-compact`, `filter-pill`, `icon-button`, `input-search`, `input-field`, `textarea`, `nav-item`, `kpi-card`, `list-row`, `avatar`, `badge`, `label-dot`, `section-label`, `account-card`, `file-chip`, `empty-state`, `modal`, `data-table`, `toggle`, `alert`, `skeleton-row`. These ids are referenced by `/craft`'s `componentsUsed` manifest field (Task 6) and by patterns (Tasks 3–5).

- [ ] **Step 1: Create the file.** Format per component: `## <id>` heading, one line *use when*, then snippet(s). Use exactly these snippets (sourced from the dashboard exemplar; items `empty-state` through `skeleton-row` are new compositions from the DNA):

`## button-primary` — the one solid button per view. Dark fill on any surface:

```html
<button class="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 transition-colors rounded-xl py-2 px-4 shadow-sm text-white">
  <iconify-icon icon="solar:plain-linear" class="text-sm"></iconify-icon>
  <span class="text-xs font-medium tracking-wide">Send Reply</span>
</button>
```

Full-width form variant: add `w-full justify-center` and use `py-2.5`.

`## button-compact` — small labeled action on a dark surface (e.g. Compose):

```html
<button class="flex items-center gap-1.5 bg-zinc-900 rounded-full py-1.5 px-3 hover:bg-zinc-800 transition-colors">
  <iconify-icon icon="solar:pen-new-square-linear" class="text-green-400 text-sm"></iconify-icon>
  <span class="text-xs text-zinc-400 font-light">Compose</span>
</button>
```

Light-surface secondary button (e.g. SSO, Cancel-adjacent actions):

```html
<button class="flex items-center justify-center gap-2 bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-4 hover:bg-zinc-100 transition-colors">
  <iconify-icon icon="solar:shield-keyhole-linear" class="text-zinc-500 text-base"></iconify-icon>
  <span class="text-xs font-normal text-zinc-700">Continue with SSO</span>
</button>
```

`## filter-pill` — segmented filters/tabs. Active + inactive:

```html
<div class="flex items-center gap-1">
  <button class="rounded-full py-1.5 px-4 text-xs bg-zinc-950 text-white font-normal transition-colors tracking-wide">All</button>
  <button class="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-200/50 font-light transition-colors tracking-wide">Unread</button>
</div>
```

`## icon-button` — `w-8 h-8 rounded-full flex items-center justify-center` + a fill per surface. Three fills:

```html
<!-- on light, filled -->
<button class="w-8 h-8 rounded-full bg-zinc-200/50 flex items-center justify-center hover:bg-zinc-200 transition-colors text-zinc-600">
  <iconify-icon icon="solar:sort-vertical-linear" class="text-sm"></iconify-icon>
</button>
<!-- on light, transparent -->
<button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
  <iconify-icon icon="solar:star-linear" class="text-base"></iconify-icon>
</button>
<!-- on dark -->
<button class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors">
  <iconify-icon icon="solar:settings-linear" class="text-zinc-400 text-sm"></iconify-icon>
</button>
```

`## input-search` — dark and light:

```html
<!-- dark -->
<div class="flex items-center gap-2 bg-zinc-900 rounded-xl py-2.5 px-3.5 w-full">
  <iconify-icon icon="solar:magnifer-linear" class="text-zinc-500 text-sm"></iconify-icon>
  <input type="text" placeholder="Search mail..." class="bg-transparent border-none outline-none text-xs text-zinc-300 w-full placeholder-zinc-500 font-light" />
</div>
<!-- light -->
<div class="flex items-center gap-2 bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-3.5 w-full">
  <iconify-icon icon="solar:magnifer-linear" class="text-zinc-400 text-sm"></iconify-icon>
  <input type="text" placeholder="Search..." class="bg-transparent border-none outline-none text-xs text-zinc-700 w-full placeholder-zinc-400 font-light" />
</div>
```

`## input-field` — labeled form field on light:

```html
<label class="flex flex-col gap-1.5 w-full">
  <span class="text-xs font-light text-zinc-500">Email</span>
  <input type="email" placeholder="you@company.com" class="bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-3.5 text-sm font-light text-zinc-900 outline-none placeholder-zinc-400 w-full focus:border-zinc-300 transition-colors" />
</label>
```

`## textarea` — borderless inside a card (see the reply box in `patterns/dashboard.html`), or standalone using the `input-field` shell with `resize-none min-h-[100px]`.

`## nav-item` — sidebar navigation row (dark surface). Active / inactive / with badge:

```html
<!-- active -->
<div class="flex items-center justify-between rounded-xl py-2 px-3 bg-zinc-900 cursor-pointer">
  <div class="flex items-center gap-3">
    <iconify-icon icon="solar:inbox-in-linear" class="text-green-400 text-base"></iconify-icon>
    <span class="text-sm font-normal text-zinc-50 tracking-tight">Inbox</span>
  </div>
  <span class="rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950">12</span>
</div>
<!-- inactive (badge optional, neutral) -->
<div class="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
  <div class="flex items-center gap-3">
    <iconify-icon icon="solar:document-text-linear" class="text-base"></iconify-icon>
    <span class="text-sm font-light text-zinc-400">Drafts</span>
  </div>
  <span class="rounded-full py-0.5 px-2.5 text-xs font-light bg-zinc-800 text-zinc-400">3</span>
</div>
```

`## kpi-card` — stat card. Dark and light:

```html
<!-- dark -->
<div class="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
  <div class="flex items-center justify-between w-full">
    <span class="text-xs text-zinc-400 font-light">Unreads</span>
    <div class="w-2 h-2 rounded-full bg-green-400"></div>
  </div>
  <span class="text-3xl font-extralight text-zinc-100 tracking-tight">6</span>
</div>
<!-- light -->
<div class="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-4 flex flex-col gap-2 flex-1">
  <div class="flex items-center justify-between w-full">
    <span class="text-xs text-zinc-500 font-light">Active customers</span>
    <div class="w-2 h-2 rounded-full bg-green-400"></div>
  </div>
  <span class="text-3xl font-extralight text-zinc-950 tracking-tight">1,284</span>
</div>
```

`## list-row` — list/inbox item on a `bg-zinc-50` panel. Three states:

```html
<!-- selected: white bg + left accent border -->
<div class="flex gap-3.5 p-4 bg-white border-l-2 border-zinc-950 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
  <div class="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-950 tracking-tight">MR</div>
  <div class="flex flex-col gap-1.5 flex-1 min-w-0 py-0.5">
    <div class="flex items-center justify-between w-full">
      <span class="text-sm font-medium text-zinc-950">Marcus Reid</span>
      <span class="text-xs text-zinc-500 font-light">10:42 AM</span>
    </div>
    <span class="text-sm font-medium text-zinc-950 truncate tracking-tight">Q3 Proposal — Final Review</span>
    <span class="text-xs text-zinc-500 font-light truncate">Preview text goes here…</span>
  </div>
</div>
<!-- unread (not selected): medium weight + green dot next to the name; wrapper: -->
<div class="flex gap-3.5 p-4 border-b border-zinc-100 cursor-pointer hover:bg-zinc-100/50 transition-colors border-l-2 border-transparent">…</div>
<!-- read: same wrapper, but name/title drop to font-light text-zinc-600/text-zinc-700, meta to text-zinc-400 -->
```

`## avatar` — initials on an accent or zinc fill:

```html
<div class="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-950 tracking-tight">MR</div>
```

Sizes: `w-4 h-4 text-[10px]` (chip), `w-9 h-9`, `w-10 h-10`, `w-11 h-11 text-sm`. Fill rotation: `bg-green-400`/`bg-cyan-400` (text-zinc-950), `bg-orange-500` (text-white), `bg-zinc-800` (text-zinc-300). Icon variant: `bg-zinc-800` + `solar:user-circle-linear` in `text-zinc-400`.

`## badge` — count badge accent `rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950`; count badge neutral `… font-light bg-zinc-800 text-zinc-400` (dark) / `bg-zinc-100 text-zinc-600` (light); label pill `bg-zinc-100 rounded-full py-0.5 px-3 text-xs font-light text-zinc-600`; recipient chip:

```html
<div class="flex items-center gap-1.5 bg-zinc-200/50 rounded-full py-1 px-2.5">
  <div class="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center text-[10px] font-medium text-zinc-950">M</div>
  <span class="text-xs font-normal text-zinc-900">Marcus Reid</span>
</div>
```

`## label-dot` — status dot + label: `<div class="w-2 h-2 rounded-full bg-green-400"></div>` next to `<span class="text-sm font-light text-zinc-400">Work</span>` (dark) or `text-zinc-600` (light). Semantics: green active/success, cyan info, orange warning, `bg-zinc-300` neutral/inactive.

`## section-label` — `<span class="text-xs uppercase tracking-widest text-zinc-600 font-normal">Labels</span>` (dark) / `text-zinc-400` (light).

`## account-card` — user footer (dark):

```html
<div class="flex items-center gap-3 bg-zinc-900 rounded-2xl p-3 w-full">
  <div class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
    <iconify-icon icon="solar:user-circle-linear" class="text-zinc-400 text-lg"></iconify-icon>
  </div>
  <div class="flex flex-col flex-1 min-w-0">
    <span class="text-sm font-normal text-zinc-50 truncate">Avery Nolan</span>
    <span class="text-xs font-light text-zinc-500 truncate">avery@nordbyte.com</span>
  </div>
  <button class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 hover:bg-zinc-700 transition-colors">
    <iconify-icon icon="solar:settings-linear" class="text-zinc-400 text-sm"></iconify-icon>
  </button>
</div>
```

`## file-chip` — attachment/file:

```html
<div class="flex items-center gap-3 bg-zinc-50/80 border border-zinc-100 rounded-xl p-3 cursor-pointer hover:bg-zinc-100 transition-colors min-w-[200px]">
  <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-zinc-500">
    <iconify-icon icon="solar:document-linear" class="text-lg"></iconify-icon>
  </div>
  <div class="flex flex-col">
    <span class="text-xs font-medium text-zinc-900 truncate">Q3_Proposal_Final.pdf</span>
    <span class="text-xs font-light text-zinc-500">2.4 MB</span>
  </div>
</div>
```

`## empty-state` — zero-data view of any panel/list:

```html
<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <div class="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
    <iconify-icon icon="solar:inbox-in-linear" class="text-zinc-400 text-xl"></iconify-icon>
  </div>
  <span class="text-sm font-medium text-zinc-950 tracking-tight">No messages yet</span>
  <span class="text-xs font-light text-zinc-500 max-w-[240px]">When you receive a message it will show up here.</span>
  <button class="mt-2 flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 transition-colors rounded-xl py-2 px-4 shadow-sm text-white">
    <iconify-icon icon="solar:pen-new-square-linear" class="text-sm"></iconify-icon>
    <span class="text-xs font-medium tracking-wide">Compose</span>
  </button>
</div>
```

`## modal` — dialog on a scrim:

```html
<div class="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-5 shadow-sm">
    <div class="flex items-center justify-between">
      <span class="text-lg font-medium text-zinc-950 tracking-tight">Delete message</span>
      <button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
        <iconify-icon icon="solar:close-circle-linear" class="text-base"></iconify-icon>
      </button>
    </div>
    <p class="text-sm font-light text-zinc-700 leading-relaxed">This will move the message to Trash. You can restore it within 30 days.</p>
    <div class="flex items-center justify-end gap-2 pt-2">
      <button class="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-100 font-light transition-colors">Cancel</button>
      <button class="bg-zinc-950 hover:bg-zinc-800 transition-colors rounded-xl py-2 px-4 shadow-sm text-white text-xs font-medium tracking-wide">Delete</button>
    </div>
  </div>
</div>
```

`## data-table` — header uses the section-label style; rows are light and hoverable:

```html
<table class="w-full text-left">
  <thead>
    <tr class="border-b border-zinc-100">
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Customer</th>
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Status</th>
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal text-right">MRR</th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">AC</div>
          <div class="flex flex-col">
            <span class="text-sm font-normal text-zinc-950">Acme Corp</span>
            <span class="text-xs font-light text-zinc-500">billing@acme.com</span>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-green-400"></div>
          <span class="text-sm font-light text-zinc-600">Active</span>
        </div>
      </td>
      <td class="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$2,400</td>
    </tr>
  </tbody>
</table>
```

`## toggle` — switch:

```html
<!-- on -->
<button class="w-10 h-6 rounded-full bg-green-400 p-0.5 flex items-center transition-colors" aria-pressed="true">
  <span class="w-5 h-5 rounded-full bg-white shadow-sm ml-auto"></span>
</button>
<!-- off (light surface; on dark use bg-zinc-800) -->
<button class="w-10 h-6 rounded-full bg-zinc-200 p-0.5 flex items-center transition-colors" aria-pressed="false">
  <span class="w-5 h-5 rounded-full bg-white shadow-sm"></span>
</button>
```

`## alert` — inline notice; neutral surface + accent icon only (never accent fills):

```html
<div class="flex items-start gap-3 bg-zinc-50/80 border border-zinc-100 rounded-xl p-4">
  <iconify-icon icon="solar:danger-triangle-linear" class="text-orange-500 text-base mt-0.5"></iconify-icon>
  <div class="flex flex-col gap-1">
    <span class="text-sm font-medium text-zinc-950">Payment overdue</span>
    <span class="text-xs font-light text-zinc-500">Invoice #2024-089 was due on March 8th.</span>
  </div>
</div>
```

Variants swap icon+tint: success `solar:check-circle-linear text-green-400`, info `solar:info-circle-linear text-cyan-400`.

`## skeleton-row` — loading state (the one allowed animation besides transition-colors):

```html
<div class="flex gap-3.5 p-4 animate-pulse">
  <div class="w-10 h-10 rounded-full bg-zinc-100 flex-shrink-0"></div>
  <div class="flex flex-col gap-2 flex-1 py-1">
    <div class="h-3 bg-zinc-100 rounded-full w-1/3"></div>
    <div class="h-3 bg-zinc-100 rounded-full w-2/3"></div>
  </div>
</div>
```

On dark surfaces use `bg-zinc-900` blocks.

End the file with:

```markdown
## Adding a component

A recurring need with no recipe here is a gap: compose it from the DNA
(foundations.md), verify it against the Do/Don't table, and add it to this
file with a stable kebab-case id — don't solve it ad hoc per project.
```

- [ ] **Step 2: Verify** — render-check the new compositions by pasting them into a scratch HTML file using the shared head (Global Constraints) and opening it in a browser; run the HTML review checklist. Delete the scratch file after.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/components.md
git commit -m "feat(design-system): add component catalog"
```

---

### Task 3: `patterns/dashboard.html` + `patterns/patterns.md`

**Files:**
- Create: `docs/design-system/patterns/dashboard.html` (from `docs/superpowers/specs/assets/2026-07-27-email-dashboard-source.html`)
- Create: `docs/design-system/patterns/patterns.md`

- [ ] **Step 1: Create `dashboard.html`** — copy the asset file, then make exactly these edits and nothing else:
  1. Delete the entire first `<script>…</script>` block (the `promotekit_referral` one, lines 3–5 of the asset).
  2. Delete everything from `<!-- aura-ga4-start -->` through `<!-- aura-ga4-end -->` inclusive.
  3. Change `<title>Email Inbox</title>` to `<title>Dashboard — app shell, sidebar, list + detail</title>`.
  All markup, classes, and copy stay byte-identical.

- [ ] **Step 2: Create `patterns.md`** with exactly this content:

````markdown
# Patterns

Full-screen exemplars. Each is a standalone HTML file (Tailwind CDN + Inter
+ iconify) that renders as-is in a browser. To build a screen: pick the
closest pattern, open it, keep its shell and section structure, swap the
content, pull anything extra from [`../components.md`](../components.md).

| File | Screen type | Use when | Demonstrates |
|---|---|---|---|
| [`dashboard.html`](./dashboard.html) | App shell, 3-pane | Any app screen: inbox, CRM, admin, tools | App shell, dark sidebar (nav, KPIs, labels, account), list panel with row states, detail pane, reply composer, attachments |
| [`auth.html`](./auth.html) | Auth | Login, register, forgot password | Split brand/form layout, form fields, SSO button, divider |
| [`landing.html`](./landing.html) | Marketing | Public/landing pages | Top nav, hero display type, feature cards, dark stats band, pricing, footer |
| [`settings.html`](./settings.html) | Settings/forms | Settings, profile, preferences, any form-heavy screen | Card groups, field rows, toggles, plan card, danger zone |
| [`data-table.html`](./data-table.html) | Data table | Lists of records: customers, invoices, orders | Toolbar (search/filters/actions), table recipe, status dots, pagination |
| [`mobile.html`](./mobile.html) | Mobile | Small-screen apps / mobile web | Phone frame, stacked cards, list, dark bottom nav |

## No pattern fits?

Start from the closest shell anyway — `dashboard.html` for anything app-like,
`landing.html` for anything public — and compose the rest from
`components.md`. A screen type you keep rebuilding deserves a new pattern
file here (same shared head, realistic content) and a row in this table.
Never invent outside the DNA: if it isn't in `foundations.md` or
`components.md`, it doesn't ship.
````

- [ ] **Step 3: Verify** — `open docs/design-system/patterns/dashboard.html`, run the HTML review checklist; confirm with `grep -c promotekit\|gtag docs/design-system/patterns/dashboard.html` → 0 matches.

- [ ] **Step 4: Commit**

```bash
git add docs/design-system/patterns/dashboard.html docs/design-system/patterns/patterns.md
git commit -m "feat(design-system): add dashboard pattern and pattern index"
```

---

### Task 4: `patterns/auth.html`

**Files:**
- Create: `docs/design-system/patterns/auth.html`

- [ ] **Step 1: Create the file.** Shared head (Global Constraints), `<title>Auth — login</title>`. Body structure — follow this skeleton exactly; where a recipe id is named, copy the snippet from `components.md`:

```html
<body class="bg-zinc-100 h-screen w-full flex items-center justify-center p-2 sm:p-4 text-sm antialiased text-zinc-900">
  <div class="bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1100px] h-full max-h-[720px] shadow-sm overflow-hidden">

    <!-- BRAND PANEL (dark) -->
    <aside class="bg-zinc-950 rounded-2xl p-8 flex-col justify-between w-[440px] flex-shrink-0 hidden md:flex overflow-y-auto">
      <!-- brand row -->
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
          <iconify-icon icon="solar:letter-linear" class="text-zinc-950 text-base"></iconify-icon>
        </div>
        <span class="text-lg font-medium text-zinc-50 tracking-tight">Mail</span>
      </div>
      <!-- middle: tagline + proof -->
      <div class="flex flex-col gap-6">
        <span class="text-3xl font-extralight text-zinc-100 tracking-tight leading-snug">Every conversation, one calm inbox.</span>
        <div class="flex gap-3 w-full">
          <!-- two dark kpi-card recipes: e.g. "Teams on Mail" 4,200 (green dot) and "Avg. reply time" 12m (cyan dot) -->
        </div>
        <div class="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-3">
          <p class="text-sm font-light text-zinc-400 leading-relaxed">“We moved the whole studio over in an afternoon. Nobody asked a single question — it just made sense.”</p>
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">SL</div>
            <div class="flex flex-col">
              <span class="text-sm font-normal text-zinc-50">Sarah Lin</span>
              <span class="text-xs font-light text-zinc-500">Ops lead, Nordbyte</span>
            </div>
          </div>
        </div>
      </div>
      <span class="text-xs font-light text-zinc-600">© 2026 Nordbyte</span>
    </aside>

    <!-- FORM PANEL -->
    <main class="bg-white rounded-2xl flex flex-col items-center justify-center flex-1 overflow-y-auto p-8">
      <div class="w-full max-w-[360px] flex flex-col gap-6">
        <div class="flex flex-col gap-1.5">
          <span class="text-xl font-medium text-zinc-950 tracking-tight">Welcome back</span>
          <span class="text-xs font-light text-zinc-500">Sign in to continue to your inbox.</span>
        </div>
        <!-- button-compact light-surface variant: "Continue with SSO" -->
        <!-- divider -->
        <div class="flex items-center gap-3">
          <div class="h-px bg-zinc-100 flex-1"></div>
          <span class="text-xs font-light text-zinc-400">or</span>
          <div class="h-px bg-zinc-100 flex-1"></div>
        </div>
        <div class="flex flex-col gap-4">
          <!-- input-field recipe: Email -->
          <!-- input-field recipe: Password (type="password"), with the label row as:
               <div class="flex items-center justify-between">
                 <span class="text-xs font-light text-zinc-500">Password</span>
                 <a href="#" class="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Forgot password?</a>
               </div> -->
        </div>
        <!-- button-primary full-width variant, icon solar:login-2-linear, label "Sign In" -->
        <span class="text-xs font-light text-zinc-500 text-center">Don’t have an account? <a href="#" class="font-normal text-zinc-950 hover:underline">Create one</a></span>
      </div>
    </main>

  </div>
</body>
```

Fill every `<!-- … -->` placeholder with the named recipe, keeping the noted content.

- [ ] **Step 2: Verify** — `open docs/design-system/patterns/auth.html`, HTML review checklist. Extra check: at 375px width the brand panel disappears and the form stays centered.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/patterns/auth.html
git commit -m "feat(design-system): add auth pattern"
```

---

### Task 5: `patterns/landing.html`, `patterns/settings.html`, `patterns/data-table.html`, `patterns/mobile.html`

**Files:**
- Create: `docs/design-system/patterns/landing.html`
- Create: `docs/design-system/patterns/settings.html`
- Create: `docs/design-system/patterns/data-table.html`
- Create: `docs/design-system/patterns/mobile.html`

- [ ] **Step 1: Create `landing.html`.** Shared head, `<title>Landing — marketing page</title>`. This page **scrolls** (no `h-screen` shell): `<body class="bg-zinc-100 text-sm antialiased text-zinc-900">`, all sections inside `<div class="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col gap-4 py-4">`. Sections in order:
  1. **Nav**: `bg-white rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm` — brand row (green `w-8 h-8 rounded-full` icon disc + `text-lg font-medium tracking-tight`), center links `hidden md:flex items-center gap-6` each `text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors` (Product, Pricing, Changelog, Docs), right: `button-primary` with label "Get Started".
  2. **Hero**: `bg-white rounded-2xl px-6 py-20 flex flex-col items-center text-center gap-6` — label pill (`badge` recipe) reading "New — Mail 2.0", `<h1 class="text-5xl sm:text-6xl font-extralight tracking-tight text-zinc-950 max-w-2xl leading-tight">`, sub `text-sm font-light text-zinc-500 leading-relaxed max-w-xl`, CTA row: `button-primary` + light secondary `button-compact` variant ("View demo").
  3. **Social proof**: `flex flex-col items-center gap-4 py-8` — light `section-label` ("Trusted by teams at"), row `flex flex-wrap justify-center gap-x-10 gap-y-3` of 5 company names as `text-sm font-light text-zinc-400`.
  4. **Features**: `grid md:grid-cols-3 gap-4` of 3 cards `bg-white rounded-2xl p-6 flex flex-col gap-4`: icon disc `w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center` + Solar icon `text-zinc-500 text-lg`, title `text-sm font-medium text-zinc-950 tracking-tight`, copy `text-xs font-light text-zinc-500 leading-relaxed`.
  5. **Stats band**: `bg-zinc-950 rounded-3xl p-8 grid grid-cols-2 md:grid-cols-4 gap-3` of 4 dark `kpi-card` recipes (rotate dot colors green/cyan/green/orange).
  6. **Pricing**: heading block (centered `text-3xl font-extralight tracking-tight` + sub) then `grid md:grid-cols-3 gap-4`. Outer cards `bg-white rounded-2xl p-6 flex flex-col gap-5`; middle card `bg-zinc-950 rounded-2xl p-6 flex flex-col gap-5` with a "Popular" badge (`rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950 self-start`). Price: `text-3xl font-extralight tracking-tight` (+`text-zinc-100` on dark) with `/mo` as `text-xs font-light text-zinc-500`. Feature list rows: `flex items-center gap-2.5` + `solar:check-circle-linear` `text-green-400 text-sm` + `text-xs font-light text-zinc-500` (`text-zinc-400` on dark). CTA: light cards get the light secondary button full-width; dark card gets `bg-green-400 text-zinc-950 rounded-xl py-2.5 w-full text-xs font-medium tracking-wide hover:bg-green-300 transition-colors` — this is the ONE allowed accent button, only on the dark pricing card.
  7. **Footer**: `bg-white rounded-2xl p-8 flex flex-col gap-8` — top `grid grid-cols-2 md:grid-cols-4 gap-8`: brand column (brand row + `text-xs font-light text-zinc-500` blurb) and 3 link columns (light `section-label` + links `text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors`); bottom row `flex items-center justify-between pt-6 border-t border-zinc-100` — `text-xs font-light text-zinc-400` copyright + 3 transparent `icon-button`s.

- [ ] **Step 2: Create `settings.html`.** Shared head, `<title>Settings — forms & preferences</title>`. App-shell body (foundations recipe). Two panels:
  - Dark sidebar (foundations recipe): brand row "Mail"; `nav-item` list: Profile (active, icon `solar:user-circle-linear`), Notifications (`solar:bell-linear`), Billing (`solar:wallet-linear`), Security (`solar:shield-keyhole-linear`); `<div class="flex-1"></div>`; `account-card`.
  - Main panel `bg-white rounded-2xl flex flex-col flex-1 overflow-hidden`: header `flex flex-col gap-0.5 p-7 border-b border-zinc-100` with `text-xl font-medium tracking-tight` "Profile" + `text-xs font-light text-zinc-500` subtitle. Content `flex flex-col gap-4 p-7 overflow-y-auto max-w-3xl`:
    1. Profile card `bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-5`: avatar row (`w-11 h-11` green avatar "AN" + name/email stack + light secondary button "Change photo"), then `grid sm:grid-cols-2 gap-4` of `input-field` recipes (Full name, Email), full-width `textarea`-style Bio field.
    2. Notifications card (same card shell): 3 rows `flex items-center justify-between py-1` — left stack (`text-sm font-normal text-zinc-950` + `text-xs font-light text-zinc-500`), right `toggle` (two on, one off).
    3. Plan card: `flex items-center justify-between` — left: label pill "Pro", `text-3xl font-extralight tracking-tight` "$24" with `/mo` in `text-xs font-light text-zinc-500`, caption; right: `button-primary` "Upgrade".
    4. Danger zone: `alert` recipe (orange, "Delete account", caption) with an added right-aligned button `bg-white border border-zinc-100 rounded-xl py-2 px-4 text-xs font-medium text-orange-500 hover:bg-zinc-50 transition-colors` "Delete".

- [ ] **Step 3: Create `data-table.html`.** Shared head, `<title>Data table — records & toolbar</title>`. App-shell body. Two panels:
  - Dark sidebar: brand "Nordbyte"; dark `input-search`; KPI grid (two dark `kpi-card`s: "Active" 1,284 green / "Churn" 2.1% orange); nav: Overview (`solar:home-2-linear`), Customers (**active**, `solar:users-group-rounded-linear`), Invoices (`solar:document-text-linear`), Reports (`solar:chart-2-linear`); spacer; `account-card`.
  - Main panel: header `flex items-center justify-between p-7 border-b border-zinc-100` — `text-xl font-medium tracking-tight` "Customers" + `button-primary` ("Add Customer", icon `solar:user-plus-linear`). Toolbar `flex items-center justify-between gap-3 px-7 py-4 border-b border-zinc-100`: light `input-search` in `max-w-[280px]`, `filter-pill` group (All active / Active / Churned), light filled `icon-button` (`solar:sort-vertical-linear`). Then the `data-table` recipe with columns Customer / Status / Plan / MRR (right-aligned) / Joined / one trailing transparent `icon-button` (`solar:menu-dots-linear`) per row — 7 rows, varied realistic data, status dots rotating green (Active) / orange (Past due) / `bg-zinc-300` (Churned), avatar fills rotating per the `avatar` recipe. Footer `flex items-center justify-between px-7 py-4 border-t border-zinc-100 mt-auto`: `text-xs font-light text-zinc-500` "Showing 1–7 of 42" + two light filled `icon-button`s (`solar:alt-arrow-left-linear`, `solar:alt-arrow-right-linear`).

- [ ] **Step 4: Create `mobile.html`.** Shared head, `<title>Mobile — bottom nav app</title>`. Body `bg-zinc-100 min-h-screen w-full flex items-center justify-center p-4 text-sm antialiased text-zinc-900`. One phone frame: `bg-white rounded-3xl p-2 w-full max-w-[390px] h-[780px] shadow-sm overflow-hidden flex flex-col gap-2`. Inside:
  1. Content panel `bg-zinc-50 rounded-2xl flex flex-col flex-1 overflow-y-auto`:
     - Header `flex items-center justify-between p-5`: left — `w-10 h-10` green avatar "AN" + stack (`text-xs font-light text-zinc-500` "Good morning" / `text-sm font-medium text-zinc-950 tracking-tight` "Avery Nolan"); right — transparent `icon-button` (`solar:bell-linear`) with an absolute `w-2 h-2 rounded-full bg-green-400` dot (wrap the button in `relative`, dot `absolute top-1.5 right-1.5`).
     - KPI row `flex gap-3 px-5`: two **light** `kpi-card`s ("Unreads" 6 green / "Updates" 22 cyan), cards `bg-white border border-zinc-100`.
     - Section header `flex items-center justify-between px-5 pt-6 pb-2`: light `section-label` "Recent" + `text-xs font-light text-zinc-500` "View all".
     - 5 `list-row`s (mix of unread/read states; wrapper stays on the zinc-50 panel so unread rows use `bg-white rounded-2xl mx-3 mb-2 border-l-0` — keep the inner structure of the recipe, drop the left border, add `rounded-2xl`).
  2. Bottom nav `bg-zinc-950 rounded-2xl p-2 flex items-center justify-around flex-shrink-0`: 5 items `w-11 h-11 rounded-full flex items-center justify-center` — active: `bg-zinc-900` + icon `text-green-400 text-xl`; inactive: icon `text-zinc-500 text-xl hover:text-zinc-300 transition-colors`. Icons: `solar:home-2-linear` (active), `solar:magnifer-linear`, `solar:pen-new-square-linear`, `solar:bell-linear`, `solar:user-circle-linear`.

- [ ] **Step 5: Verify all four** — `open` each file, run the HTML review checklist per file. landing.html additionally: check it reads correctly while scrolling and the only accent button on the whole page is the dark pricing card's green CTA. mobile.html additionally: everything stays inside the phone frame, no page scroll.

- [ ] **Step 6: Commit**

```bash
git add docs/design-system/patterns/
git commit -m "feat(design-system): add landing, settings, data-table, mobile patterns"
```

---

### Task 6: Craft schema — `registryUses` → `componentsUsed`

**Files:**
- Modify: `craft/lib/craft-schemas.ts:9-14`
- Modify: `craft/lib/craft.selfcheck.ts` (all `registryUses` occurrences: lines 28, 30–34, 141, 146, 232)

**Interfaces:**
- Produces: `ScreenSchema` field `componentsUsed: z.array(z.string().min(1)).default([])`. Consumed by Task 7 (render fixtures), Task 8 (SKILL.md manifest docs), Task 10 (verification fixture).

- [ ] **Step 1: Update the selfcheck first (failing test).** In `craft/lib/craft.selfcheck.ts`, replace every `registryUses` with `componentsUsed`; in the check named "validateCraftManifest accepts an explicit registryUses list" rename it to "…componentsUsed list" and change its fixture values to `["kpi-card", "data-table"]` (assert them back). In the round-trip check change `["card"]` to `["list-row"]`.

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/riaenriala/Documents/etalas/sandwich && node --experimental-strip-types craft/lib/craft.selfcheck.ts
```

Expected: assertion failure on the `componentsUsed` check (schema still emits `registryUses`).

- [ ] **Step 3: Update the schema.** In `craft/lib/craft-schemas.ts` replace lines 9–14 with:

```ts
  // Which design-system pieces this screen was actually built from —
  // component ids from docs/design-system/components.md (e.g. "kpi-card",
  // "list-row") and/or pattern files from docs/design-system/patterns/
  // (e.g. "dashboard.html"). This is what makes coverage auditable instead
  // of a black box: /status-style tooling (or a human) can see exactly
  // what a screen leans on.
  componentsUsed: z.array(z.string().min(1)).default([]),
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/riaenriala/Documents/etalas/sandwich && node --experimental-strip-types craft/lib/craft.selfcheck.ts
```

Expected: all checks pass. (The scaffold check still passes at this point because `docs/design-exemplars/` still exists — it is deleted in Task 7.)

- [ ] **Step 5: Commit**

```bash
git add craft/lib/craft-schemas.ts craft/lib/craft.selfcheck.ts
git commit -m "feat(craft): rename registryUses to componentsUsed"
```

---

### Task 7: Craft template + scaffold + nav hub → design system; delete `docs/design-exemplars/`

**Files:**
- Modify: `craft/template/package.json`
- Delete: `craft/template/components.json`
- Modify: `craft/template/tailwind.config.ts`
- Create: `craft/template/app/globals.css`
- Modify: `craft/template/app/layout.tsx`
- Modify: `craft/template/components/craft/PageShell.tsx`
- Modify: `craft/template/components/craft/PageHeader.tsx`
- Modify: `craft/lib/craft-lib.ts` (`CraftPaths`, `scaffoldCraftApp`, comments)
- Modify: `craft/lib/craft-render.ts`
- Modify: `craft/lib/craft.selfcheck.ts` (scaffold + render checks)
- Delete: `docs/design-exemplars/` (entire directory)

**Interfaces:**
- Consumes: `componentsUsed` (Task 6).
- Produces: `scaffoldCraftApp(templateDir: string, projectRoot: string): string[]` (theme path parameter REMOVED — globals.css now ships in the template); `CraftPaths` without `componentsJson`; `PageShell({ sidebar?, children, className? })`; `PageHeader({ title, description?, actions? })`. Task 8's SKILL.md documents these.

- [ ] **Step 1: Update the selfcheck first (failing).** In `craft/lib/craft.selfcheck.ts`:
  - In the `getCraftPaths` check, delete the `componentsJson` assertion line.
  - Replace the whole scaffold check (`"scaffoldCraftApp copies the real template …"`) with:

```ts
const REAL_TEMPLATE_DIR = pj2(dirname(fileURLToPath(import.meta.url)), "..", "template");

check("scaffoldCraftApp copies the real template into a fresh project and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "craft-scaffold-"));
  try {
    const created = scaffoldCraftApp(REAL_TEMPLATE_DIR, dir);
    assert.ok(created.length > 5, "expected the template tree to be copied");

    const paths = getCraftPaths(dir);
    assert.ok(existsSync(pj2(paths.root, "package.json")));
    assert.ok(!existsSync(pj2(paths.root, "components.json")), "no shadcn config may be scaffolded");
    assert.ok(existsSync(pj2(paths.root, "components", "craft", "PageShell.tsx")));
    assert.ok(existsSync(pj2(paths.root, "components", "craft", "PageHeader.tsx")));
    assert.ok(existsSync(pj2(paths.root, "app", "layout.tsx")));
    assert.ok(existsSync(paths.globalsCss));

    const globals = readFileSync(paths.globalsCss, "utf8");
    assert.ok(globals.includes("@tailwind base"), "globals.css ships in the template");

    const pkg = JSON.parse(readFileSync(pj2(paths.root, "package.json"), "utf8"));
    assert.equal(pkg.devDependencies?.shadcn, undefined, "shadcn must not be a dependency");

    // Simulate a human hand-editing a scaffolded file, then re-run — must not be clobbered.
    writeFileSync(pj2(paths.root, "components", "craft", "PageHeader.tsx"), "// hand-edited\n", "utf8");
    scaffoldCraftApp(REAL_TEMPLATE_DIR, dir);
    const afterRescaffold = readFileSync(pj2(paths.root, "components", "craft", "PageHeader.tsx"), "utf8");
    assert.equal(afterRescaffold, "// hand-edited\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

  (Delete the old `REAL_THEME_CSS` constant.) In the nav-hub render checks, keep assertions on `Link`/name/flags but change the fixture's `registryUses: []` remnant if any (Task 6 already renamed it — just confirm).

- [ ] **Step 2: Run — expect failures** (scaffoldCraftApp still takes 3 args; components.json still in template):

```bash
cd /Users/riaenriala/Documents/etalas/sandwich && node --experimental-strip-types craft/lib/craft.selfcheck.ts
```

- [ ] **Step 3: Rewrite the template files.**

`craft/template/package.json` — full new content:

```json
{
  "name": "design",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "@iconify/react": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

Delete `craft/template/components.json`.

`craft/template/tailwind.config.ts` — full new content:

```ts
import type { Config } from "tailwindcss";

// The design system uses stock zinc/green-400/cyan-400/orange-500 Tailwind
// utilities on purpose — no CSS-variable token layer. See
// docs/design-system/foundations.md; never add custom colors here.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

`craft/template/app/globals.css` — new file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
```

`craft/template/app/layout.tsx` — full new content:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Design",
  description: "Generated by sandwich/craft",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="h-screen w-full bg-zinc-100 font-sans text-sm text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

`craft/template/components/craft/PageShell.tsx` — full new content:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The floating app shell from docs/design-system/patterns/dashboard.html:
// zinc-100 page, white rounded-3xl shell, rounded-2xl panel columns.
// `sidebar` renders as the dark zinc-950 panel. Each child must style
// itself as a rounded-2xl panel (bg-white or bg-zinc-50) — see
// foundations.md "Surfaces & layout".
export function PageShell({
  sidebar,
  children,
  className,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="h-screen w-full flex items-center justify-center p-2 sm:p-4">
      <div
        className={cn(
          "bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden",
          className
        )}
      >
        {sidebar ? (
          <aside className="bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[320px] flex-shrink-0 hidden lg:flex overflow-y-auto">
            {sidebar}
          </aside>
        ) : null}
        {children}
      </div>
    </div>
  );
}
```

`craft/template/components/craft/PageHeader.tsx` — full new content:

```tsx
import type { ReactNode } from "react";

// Panel header per docs/design-system/foundations.md typography roles.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5 border-b border-zinc-100">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-medium text-zinc-950 tracking-tight">{title}</h1>
        {description ? (
          <p className="text-xs font-light text-zinc-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Update `craft/lib/craft-lib.ts`.**
  - `CraftPaths`: remove the `componentsJson` field (interface + the object in `getCraftPaths`).
  - `scaffoldCraftApp`: new signature `(templateDir: string, projectRoot: string): string[]` — delete the `themeCssPath` parameter and the whole globals-seeding block (globals.css now arrives via the template copy). Replace the function's comment block with:

```ts
// Scaffolds the Next.js skeleton (package.json, tsconfig, tailwind config,
// globals.css, layout, the two structural PageShell/PageHeader helpers)
// from craft/template/**. Screens are composed by the agent following
// docs/design-system/ (foundations + components.md recipes + patterns) —
// nothing is pulled from any external registry. Every file this function
// writes is skip-if-exists, so re-running it (e.g. on an incremental
// /craft run) never clobbers a hand-edit.
```

  - Update the file-top comment on `getCraftPaths` if it mentions shadcn (it doesn't) and delete the stale reference to `docs/design-exemplars` in the old scaffold comment.

- [ ] **Step 5: Restyle the nav hub in `craft/lib/craft-render.ts`.** Full new content:

```ts
import type { CraftManifest } from "./craft-schemas.ts";

type ManifestScreen = CraftManifest["screens"][number];

function screenLink(s: ManifestScreen): string {
  const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
    .filter(Boolean)
    .join(" · ");
  const label = flags ? `${s.name} (${flags})` : s.name;
  return `          <Link href={${JSON.stringify(s.route)}} className="block w-full p-4 bg-zinc-50/80 border border-zinc-100 hover:bg-zinc-100 transition-colors rounded-xl">
            <p className="text-sm font-medium text-zinc-950 tracking-tight">{${JSON.stringify(label)}}</p>
            <p className="text-xs font-light text-zinc-500 mt-1">{${JSON.stringify(s.flows.join(", "))}}</p>
          </Link>`;
}

// Deterministic — this is the only screen file this pipeline ever
// (re)writes on every run. Individual screen route files are agent-authored
// TSX, written once, and never touched again (see the never-overwrite
// invariant in craft/skills/craft/SKILL.md).
export function renderNavHubPage(manifest: CraftManifest): string {
  const items = manifest.screens.map(screenLink).join("\n");

  return `import Link from "next/link";
import { PageShell } from "@/components/craft/PageShell";
import { PageHeader } from "@/components/craft/PageHeader";

export default function Home() {
  return (
    <PageShell>
      <main className="bg-white rounded-2xl flex flex-col flex-1 overflow-hidden">
        <PageHeader title="Design" description="Generated screens" />
        <div className="flex flex-col gap-2 p-5 overflow-y-auto">
${items}
        </div>
      </main>
    </PageShell>
  );
}
`;
}
```

- [ ] **Step 6: Delete the old exemplars**

```bash
cd /Users/riaenriala/Documents/etalas/sandwich && git rm -r docs/design-exemplars
```

- [ ] **Step 7: Run selfcheck — expect all green**

```bash
cd /Users/riaenriala/Documents/etalas/sandwich && node --experimental-strip-types craft/lib/craft.selfcheck.ts
```

- [ ] **Step 8: Commit**

```bash
git add -A craft/template craft/lib docs/design-exemplars
git commit -m "feat(craft): design-system template and scaffold; drop shadcn and old exemplars"
```

---

### Task 8: Rewrite `craft/skills/craft/SKILL.md`

**Files:**
- Modify: `craft/skills/craft/SKILL.md` (full rewrite)

**Interfaces:**
- Consumes: `componentsUsed` schema (Task 6), `scaffoldCraftApp(templateDir, projectRoot)` + `PageShell({sidebar, children})` (Task 7), design-system docs (Tasks 1–5).

- [ ] **Step 1: Rewrite the file.** Keep the existing document skeleton and these sections **verbatim except where noted**: frontmatter name; "When to invoke"; "Prerequisite check"; "Readiness gate"; "Mode detection"; the stale/diff semantics; "Style rules" tail; the never-overwrite invariant. Make exactly these changes:

  1. **Frontmatter description** (one line, double-quoted):
     `"Turn /order's needsUI user flows into a real Next.js app styled by the house design system (docs/design-system/ — foundations, component recipes, pattern exemplars; never an external component registry), tracked in a manifest that flags staleness instead of silently overwriting hand-tuned screens. Use ONLY when the user explicitly runs /craft (or its namespaced form, e.g. /sandwich:craft), after /order has run and before /prep. Do NOT invoke on topical similarity — discussing design, UI, or screens in general conversation is NOT an invocation unless the literal command is typed."`

  2. **Intro paragraph**: job is now "produce a Next.js app in `design/` from the `needsUI` flows …, composed by following the house design system at `$SANDWICH_ROOT/docs/design-system/` — not any external component registry — and tracked by a manifest …".

  3. **Replace the section "Why this is different from /wireframe"** with:

````markdown
## History — why the design source is the house system (do not regress)

This skill is on its third design source. Know the two failure modes so you
don't reproduce them:

| Generation | Design source | Why it was replaced |
|---|---|---|
| `/wireframe` (removed) | Fixed 12-primitive baseline, grayscale lo-fi | Output looked like wireframes, not product |
| `/craft` v1 | Live shadcn/ui registry + @shadcnblocks (blocks-first) | Sound engineering, rejected output quality — screens looked like generic shadcn, not like ours |
| `/craft` v2 (this) | House design system: `docs/design-system/` (foundations + components.md recipes + patterns/) | — |

The failure both prior generations share: outsourcing the visual identity.
If you find yourself wanting to install a component library, pull a block,
or invent a style that isn't in `foundations.md`/`components.md` — stop;
that's the exact mistake this rewrite exists to fix. The design system is
self-contained and sufficient; genuinely missing pieces are reported as
gaps, not improvised.
````

  4. **Artifacts table**: drop the `components.json` and `components/ui/*` rows; `components/craft/{PageShell,PageHeader}.tsx` row becomes "The app shell (dark sidebar + rounded-2xl panels, from `patterns/dashboard.html`) and the panel-header pattern — the shared structure every screen composes into."

  5. **Pipeline step 4 (scaffold)** becomes:
     a. Read `$SANDWICH_ROOT/docs/design-system/README.md` and `foundations.md` in full. (`SANDWICH_ROOT` is injected into your context at session start as plain text — it is NOT a live shell environment variable; substitute the path literally.)
     b. Copy the skeleton from `craft/template/**` into `design/` (skip-if-exists; `scaffoldCraftApp` in `craft/lib/craft-lib.ts`).
     c. `cd design && npm install` for real, via Bash.
     d. Sidebar content (brand, nav items, KPI cards, account card) is composed per screen-group from `components.md` recipes inside `PageShell`'s `sidebar` slot — one consistent sidebar for the whole project, defined once in a shared component `components/craft/AppSidebar.tsx` that screens pass to `PageShell`.

  6. **Pipeline steps 9–11** (registry pulls + icon pass + TSX writing) collapse into two steps:
     - **Compose per new screen**: check `$SANDWICH_ROOT/docs/design-system/patterns/patterns.md`, open the closest pattern HTML, keep its shell/section structure; build the screen as TSX from `components.md` recipes (markup identical, `class`→`className`; icons via `@iconify/react`'s `<Icon icon="solar:…-linear" />`). Record every recipe id and pattern file used in the screen's `componentsUsed`.
     - **Write TSX for new screens only** — keep the existing per-screen checklist verbatim (steps/fields/empty/loading/error/responsive/links/terminology), but reference the design-system recipes: empty state → `empty-state`, loading → `skeleton-row`, error → `alert`.

  7. **Manifest schema block**: rename `registryUses` → `componentsUsed` in the JSON example (use `["dashboard.html", "kpi-card", "list-row"]`) and in the field table ("Every components.md recipe id and patterns/ file actually used").

  8. **Validation command** stays `node --experimental-strip-types $SANDWICH_ROOT/craft/scripts/render.ts` with the same SANDWICH_ROOT note.

  9. **Report/Output section**: replace `Registry items pulled: …` with `Design-system pieces used: dashboard.html, kpi-card, list-row, data-table`.

  10. **Style rules**: replace the "Never invent a primitive" bullet with: "**Never invent a style.** Every element must trace to a `components.md` recipe or a `patterns/` section, recorded in `componentsUsed`. If nothing fits, report it as a gap (a candidate to add to `components.md`) rather than hand-rolling off-DNA markup." Replace the icons bullet with: "Every icon is Solar linear (`solar:*-linear`) via `@iconify/react`. No lucide, no tabler, no emoji." Drop the "Blocks first" bullet.

- [ ] **Step 2: Verify** — read the final file top to bottom once; confirm no occurrence of `shadcn` outside the History table, no `registryUses`, no `npx shadcn`, no `@shadcnblocks`, no `design-exemplars`:

```bash
grep -n 'registryUses\|npx shadcn\|@shadcnblocks\|design-exemplars' craft/skills/craft/SKILL.md
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add craft/skills/craft/SKILL.md
git commit -m "feat(craft): compose screens from the house design system"
```

---

### Task 9: `/design` skill + plugin registration + README + external cleanup

**Files:**
- Create: `design/skills/design/SKILL.md`
- Modify: `.claude-plugin/plugin.json`
- Modify: `README.md:51,105,257` (and the command table)
- Delete: `/Users/riaenriala/Documents/nightshift/design-system/` (empty dir, outside the repo)

- [ ] **Step 1: Create `design/skills/design/SKILL.md`** with exactly this content:

````markdown
---
name: design
description: "Generate UI in any project following the house design system (fixed identity: Inter 200–500, zinc neutrals + green/cyan/orange accents, Solar icons, rounded-2xl panels, dark sidebar + light content). Use ONLY when the user explicitly runs /design (or /sandwich:design). Do NOT invoke on topical similarity — discussing design or UI in general conversation is NOT an invocation unless the literal command is typed."
---

# /design

You are generating UI that must be indistinguishable from the house design
system's exemplars. The system is the single source of visual truth — you
follow it, you don't reinterpret it.

## When to invoke

- User explicitly runs `/design` (or the namespaced `/sandwich:design`),
  typically with a request: `/design a booking screen for this app`.

**Do NOT invoke because** the user is discussing design, UI, or screens in
general conversation, or any other topical similarity. Wait for the literal
command. If the user's intent seems to call for `/design`, say so and let
them decide.

Unlike `/craft`, this skill has **no prerequisites** — no brief, no
manifest, no pipeline. It works in any project, on any stack, for anything
from one component to a full screen.

## Where the design system lives

`$SANDWICH_ROOT/docs/design-system/`. `SANDWICH_ROOT` is injected into your
context at session start as plain text (e.g. `SANDWICH_ROOT=/path/to/plugin`)
— it is NOT a live shell environment variable. Read the path from your
context and substitute it literally.

## Pipeline

1. **Read the rules** — `$SANDWICH_ROOT/docs/design-system/README.md` and
   `foundations.md`, in full, every invocation. Do not work from memory of
   a previous session.
2. **Pick references** — open `patterns/patterns.md`, pick the closest
   pattern file(s) for what's being built and read them; pull the
   `components.md` sections you actually need. Full screens start from a
   pattern's shell; single components come straight from `components.md`.
3. **Detect the target stack** — look at the project you're in:
   - Plain HTML: copy the shared head from any pattern file (Tailwind CDN,
     Inter link, iconify script, scrollbar CSS).
   - React/Next.js + Tailwind: same markup with `className`; Inter via
     `next/font/google` weights `["200","300","400","500"]`; icons via
     `@iconify/react` (`<Icon icon="solar:…-linear" />`) or the
     `iconify-icon` script in the root layout.
   - Follow the project's existing conventions for file placement and
     componentization — the design system fixes *how things look*, not
     your framework choices.
4. **Generate** — markup structure and class strings come from the
   reference files. Adapt content, not style.
5. **Self-check before finishing** — verify against the hard rules:
   - Only zinc + `green-400`/`cyan-400`/`orange-500`; accents only as
     dots, badges, avatar fills, icon tints.
   - Inter 200–500 only; no `font-semibold`/`font-bold`.
   - Only `solar:*-linear` icons; no lucide/tabler/emoji.
   - Radius scale: 3xl shell / 2xl panels / xl controls / full pills.
   - `shadow-sm` max; `transition-colors` only (plus `animate-pulse`
     skeletons).
   Anything that fails the check gets fixed before you report done.

## Forbidden

Component libraries (shadcn, MUI, Chakra, daisyUI, …), other icon sets,
colors outside the palette, other fonts, gradients, heavy shadows,
scale/slide animations. If the design system genuinely lacks something you
need, say so in your report and propose it as an addition to
`components.md` — don't improvise off-DNA.
````

- [ ] **Step 2: Register the skill.** In `.claude-plugin/plugin.json`, change the `skills` array to:

```json
"skills": ["./order/skills/order", "./prep/skills/prep", "./prep/skills/status", "./craft/skills/craft", "./design/skills/design"]
```

Validate: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); console.log('ok')"`

- [ ] **Step 3: Update `README.md`.**
  - Command table (~line 51): change the `/craft` row description to "Design the UI — a real Next.js app styled by the house design system" and add a new row: `| /design | Generate UI in any project following the house design system (no brief required) |`
  - ~Line 105 (`/craft` section): replace the paragraph with: "Reads `needsUI` flows from the brief and produces a real Next.js app in `design/`, styled by the house design system (`docs/design-system/` — foundations, component recipes, full-page patterns; never an external component registry). Requires `/order` to have run first, and will stop and ask before designing over an unresolved high-priority open question rather than guess. Re-running is safe: changed flows flag existing screens `stale` for you to act on, they're never silently rewritten."
  - ~Line 257 (`design/` row): "The `/craft`-generated Next.js app styled by the house design system — a real, deployable design/prototype, not markdown".
  - Search the README for any other `shadcn`/`design-exemplars` mentions and update them the same way: `grep -n 'shadcn\|design-exemplars' README.md`.

- [ ] **Step 4: Delete the superseded empty folder**

```bash
rmdir /Users/riaenriala/Documents/nightshift/design-system
```

(`rmdir` only removes it if empty — if it errors because files appeared there, stop and ask the user.)

- [ ] **Step 5: Commit**

```bash
git add design/skills/design/SKILL.md .claude-plugin/plugin.json README.md
git commit -m "feat: add /design skill and register it; update README"
```

---

### Task 10: Final verification sweep

**Files:** none created — checks only. Fix-forward anything that fails, amend into a `fix:` commit.

- [ ] **Step 1: Reference sweep** — expect matches ONLY under `docs/superpowers/` (specs/plans history) and the single History table in `craft/skills/craft/SKILL.md`:

```bash
cd /Users/riaenriala/Documents/etalas/sandwich && grep -rn 'design-exemplars\|@shadcnblocks\|registryUses\|lucide\|npx shadcn' \
  --include='*.md' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.yaml' --include='*.py' . \
  | grep -v node_modules | grep -v '\.git/' | grep -v 'docs/superpowers/'
```

Expected output: only lines from `craft/skills/craft/SKILL.md`'s History section (the word `shadcn` in the generation table). Anything else = fix it.

- [ ] **Step 2: Selfchecks green**

```bash
node --experimental-strip-types craft/lib/craft.selfcheck.ts
node --experimental-strip-types lib/agent-wrapper.selfcheck.ts 2>/dev/null || true
```

Expected: all craft checks pass.

- [ ] **Step 3: Render script end-to-end** — scaffold + manifest fixture in a temp dir:

```bash
cd /Users/riaenriala/Documents/etalas/sandwich
export TMP=$(mktemp -d)
node --experimental-strip-types -e "
import('./craft/lib/craft-lib.ts').then(m => {
  m.scaffoldCraftApp('craft/template', process.env.TMP);
  m.writeManifest(process.env.TMP, { screens: [{ id: 'SCR-001', name: 'Customers', route: '/customers', flows: ['UF-001'], navigatesTo: [], componentsUsed: ['dashboard.html', 'data-table'], flags: { stale: false, orphaned: false }, staleReasons: [] }] });
});" 
mkdir -p "$TMP/design/app/customers" && echo "export default function Page(){return null}" > "$TMP/design/app/customers/page.tsx"
node --experimental-strip-types craft/scripts/render.ts "$TMP"
cat "$TMP/design/app/page.tsx"
rm -rf "$TMP"
```

Expected: `✓ …/design/app/page.tsx`, and the printed page contains `bg-zinc-50/80` (new nav-hub styling) and no `border-border`.

- [ ] **Step 4: Template compiles** — in the same scaffold (re-run scaffold into a fresh temp dir), `cd $TMP/design && npm install && npx tsc --noEmit`. Expected: exit 0. (This takes a minute or two; that's expected.)

- [ ] **Step 5: Visual pass** — `open` all six `docs/design-system/patterns/*.html`, run the HTML review checklist once more across them; they must read as one product family.

- [ ] **Step 6: Commit any fixes; push the branch**

```bash
git push -u origin feat/design-system
```

- [ ] **Step 7: Report to the user**, including the manual follow-up: the installed plugin cache (`~/.claude/plugins/cache/sandwich/sandwich/0.1.0`) is stale — after merging, reinstall/update the sandwich plugin so `/design` and the new `/craft` take effect.
