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
   body text. The only carve-outs are the short, closed list in
   [`foundations.md` § Documented exceptions](./foundations.md#documented-exceptions).
4. Icons are **Solar linear** (`solar:*-linear`) via iconify. No lucide,
   no tabler, no emoji.
5. Radius scale is fixed: `rounded-3xl` app shell (and full-width marketing
   bands — see § Documented exceptions) / `rounded-2xl` panels and cards /
   `rounded-xl` controls / `rounded-full` pills, icon buttons, avatars, dots.
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

- **Plain HTML:** copy the canonical shared head from
  [`foundations.md`](./foundations.md#shared-html-head) (Tailwind CDN, Inter,
  iconify script, scrollbar CSS) — every `patterns/*.html` file carries that
  exact block, differing only in `<title>`.
- **React/Next.js:** same markup, `class` → `className`. Icons: keep the
  `<iconify-icon>` custom element (load the iconify script in the root
  layout) or use `@iconify/react`'s `<Icon icon="solar:…-linear" />` —
  same icon names. Load Inter via `next/font/google` with weights
  `["200","300","400","500"]`.
- Tailwind with a build step needs no config beyond the font family — the
  system uses stock zinc/green/cyan/orange utilities on purpose.

## Project Theme Packs

Projects can override the house design system by creating their own `docs/design-system/` directory.

### Required files

```
docs/design-system/
├── foundations.md    # Colors, typography, layout rules
├── components.md     # Component recipes (optional, falls back to house)
└── patterns/         # Pattern files (optional, falls back to house)
```

### Minimal override

To customize just the color palette while keeping everything else:

1. Copy the house `foundations.md` to `$PROJECT_ROOT/docs/design-system/`
2. Modify only the accent colors:

```markdown
## Color

### Accents

| Accent | Meaning | Text on top |
|---|---|---|
| `blue-500` | primary accent | `text-white` |
| `violet-400` | secondary | `text-zinc-950` |
| `amber-500` | warning | `text-zinc-950` |
```

3. Update the `@theme` block in the shared head to match:

```css
@theme {
  --color-accent-primary: #3b82f6;     /* blue-500 */
  --color-accent-secondary: #a78bfa;   /* violet-400 */
  --color-accent-warning: #f59e0b;     /* amber-500 */
  --font-sans: 'Inter', sans-serif;
}
```

### Full override

If your project has a significantly different design language (different font, radius philosophy, surface colors), copy all files from the house design system and modify freely. The `/design` skill will use your project's files instead of the house defaults.

### How it works

The `/design` skill checks for `$PROJECT_ROOT/docs/design-system/foundations.md` first. If found, it uses that directory as the design system. If not, it falls back to the house design system at `$SANDWICH_ROOT/docs/design-system/`.
