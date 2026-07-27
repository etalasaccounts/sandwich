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
