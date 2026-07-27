# Design System

The single source of visual truth for all UI we generate — any project, any
stack. This is a **reference for AI**, not a component library: read the
rules, copy the recipes, produce UI that is indistinguishable from the
exemplars.

## Hard rules

1. Font comes from the `--font-sans` slot (house: **Inter**), weights are the four slots 200/300/400/500. Never semibold or bold classes.
2. Colors come **only from the 27 semantic slots** (see [`theming.md`](./theming.md)). House neutrals are zinc-valued; accents are `accent` (primary/active/success), `info`, `warn`. Raw palette classes (`bg-zinc-*`, `text-green-400`, …) no longer exist — the default palette is wiped.
3. Accents appear only as **small elements** — dots, count badges, avatar fills, icon tints. Never large fills, never gradients, never accent body text. Carve-outs: [`foundations.md` § Documented exceptions](./foundations.md#documented-exceptions).
4. Icons are **Solar linear** (`solar:*-linear`) via iconify. No lucide, no tabler, no emoji.
5. Radius scale is the three slots: `rounded-3xl` app shell (and full-width marketing bands) / `rounded-2xl` panels and cards / `rounded-xl` controls / `rounded-full` pills, icon buttons, avatars, dots.
6. `shadow-sm` is the heaviest shadow. `transition-colors` is the only motion (plus `animate-pulse` for skeletons).
7. Inverse surfaces separate by background shade (`inverse` → `inverse-2` → `inverse-3`), never borders. Base surfaces may use `border-line`.
8. When in doubt, **copy a snippet from `components.md` or a section from `patterns/`** — never invent a new style.

## How to use this

| Task | Read |
|---|---|
| Any styling question (color, type, spacing, radius) | [`foundations.md`](./foundations.md) |
| Building one component (button, table, modal, …) | [`components.md`](./components.md) — find it by id, copy the snippet |
| Building a full screen | [`patterns/patterns.md`](./patterns/patterns.md) — pick the closest pattern, open its HTML, adapt |
| Setting colors for a brand pack | [`theming.md`](./theming.md) — assign your colors to the semantic slots |

Always read `foundations.md` before generating anything. Then pull only the
component sections / pattern files you actually need.

## Adapting to a stack

The exemplars are plain HTML + the Tailwind v4 browser build. The classes
and markup structure are the design system — keep them identical
everywhere:

- **Plain HTML:** copy the canonical shared head from
  [`foundations.md`](./foundations.md#shared-html-head) (Tailwind v4 browser
  build, Inter, iconify script, scrollbar CSS) — every `patterns/*.html`
  file carries that exact block, differing only in `<title>`.
- **React/Next.js:** same markup, `class` → `className`. Icons: keep the
  `<iconify-icon>` custom element (load the iconify script in the root
  layout) or use `@iconify/react`'s `<Icon icon="solar:…-linear" />` —
  same icon names. Load Inter via `next/font/google` with weights
  `["200","300","400","500"]`.
- Tailwind with a build step needs no config beyond the font family — the
  system uses semantic slot utilities defined in the canonical token block.
