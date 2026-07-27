# Design System — Design Doc

**Date:** 2026-07-27
**Status:** Approved direction, pending spec review
**Owner:** Ria (hanifyaskur@gmail.com)

## Problem

AI-generated UI across projects is inconsistent. The previous attempt at
consistency — `docs/design-exemplars/` layered on the live shadcn/ui
registry, consumed by `/craft` via `npx shadcn add` — produced output whose
quality Ria judged unacceptable ("hasilnya buruk banget"). The registry
approach also made every screen depend on an external library's look instead
of a house identity.

## Goal

A **self-contained, AI-first design system** living in this repo:

- One fixed visual identity (the "signature style"), derived from an email
  dashboard exemplar Ria provided (raw source preserved at
  [`assets/2026-07-27-email-dashboard-source.html`](./assets/2026-07-27-email-dashboard-source.html)).
- Pure reference material — tokens, rules, HTML snippets, full-page HTML
  exemplars. **No npm package, no component library, no external registry.**
- Consumed two ways:
  1. A new `/design` skill usable from any project, any stack.
  2. A rewritten `/craft` that composes screens from the design system
     instead of pulling shadcn blocks.

## Decisions already made (brainstorming, 2026-07-27)

| Question | Decision |
|---|---|
| Form of the repo | Pure AI reference (docs + HTML exemplars), not a component library |
| Visual identity | One fixed identity for all projects — no theming |
| Coverage | App/dashboard, auth & onboarding, landing/marketing, mobile |
| Where it lives | Inside the sandwich repo, ships with the plugin |
| Old `docs/design-exemplars/` (monochrome default-theme, shadcn patterns, icons.md) | **Deleted entirely**, replaced by the new system |
| `/craft` | Rewritten in this project: keep the pipeline engine, replace the design source |
| Empty `~/Documents/nightshift/design-system/` folder | Deleted (superseded by this) |

## The visual DNA (normative)

Extracted from the source dashboard. These are the rules every artifact in
`docs/design-system/` encodes, and that generated UI must follow.

### Typography

- Font: **Inter**, weights 200/300/400/500 only. Loaded via Google Fonts.
  `antialiased` on body. Base size `text-sm`.
- Display numbers (KPIs): `text-3xl font-extralight tracking-tight`
- Page/panel titles: `text-lg font-medium tracking-tight`; detail-pane
  titles `text-xl font-medium tracking-tight`
- Emphasized row text: `text-sm font-medium`; de-emphasized (read/inactive)
  rows drop to `font-light` and a lighter zinc
- Body copy: `text-sm font-light leading-relaxed`
- Meta/secondary: `text-xs font-light`
- Section labels: `text-xs uppercase tracking-widest font-normal`
- Buttons: `text-xs`, `font-medium` (primary) / `font-light` (secondary),
  often `tracking-wide`
- Weights above 500 (semibold/bold) are **never** used.

### Color

- Neutrals: **zinc scale only.**
  - Dark surface stack: `zinc-950` panel → `zinc-900` card/input/active →
    `zinc-800` nested/hover. Text on dark: `zinc-50` primary, `zinc-400`
    secondary, `zinc-500` muted, `zinc-600` section labels.
  - Light surface stack: `zinc-100` page background → `white` shell/primary
    panel → `zinc-50` secondary panel → `zinc-200(/50)` control fills.
    Text on light: `zinc-950` primary, `zinc-500` secondary, `zinc-400`
    tertiary. Borders: `zinc-100` (sometimes `/50`).
- Accents — exactly three, with fixed semantics:
  - `green-400` — primary accent: active nav, selected, success, live
    indicators, primary avatar color
  - `cyan-400` — secondary/informational
  - `orange-500` — warning/attention
- Accent application rules: accents appear only as **small elements** — 2×2
  dots (`w-2 h-2 rounded-full`), count badges, avatar fills, icon tints.
  Never as large surface fills, never as body-text color, never gradients.
  One accent (green) dominates per view; cyan/orange are supporting.
- Dark accent-on-fill text: `text-zinc-950` on `green-400`/`cyan-400`,
  `text-white` on `orange-500`.

### Surfaces & layout

- App shell: body `bg-zinc-100 h-screen flex items-center justify-center
  p-2 sm:p-4`; shell `bg-white rounded-3xl p-2 gap-2 flex w-full
  max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden`.
- Inside the shell: columns are `rounded-2xl` panels — dark sidebar
  (`bg-zinc-950 w-[320px]`, hidden below `lg`), optional list panel
  (`bg-zinc-50 w-[380px]`), main content (`bg-white flex-1`, hidden below
  `md` when a list panel exists).
- Dark surfaces separate by background shade, not borders. Light surfaces
  may use `border-zinc-100`.

### Radius, shadow, motion

- Radius scale: `rounded-3xl` shell / `rounded-2xl` panels & cards /
  `rounded-xl` controls (nav items, inputs, rect buttons, chips) /
  `rounded-full` pills, icon buttons, avatars, badges, dots. `rounded-lg`
  only for small nested thumbnails.
- Shadows: `shadow-sm` only (plus the near-invisible
  `shadow-[0_1px_3px_rgba(0,0,0,0.02)]` for selected list rows). Nothing
  heavier.
- Motion: `transition-colors` on interactive elements. No other animation
  by default.

### Controls (canonical recipes)

- Primary button: `bg-zinc-950 text-white rounded-xl py-2 px-4 shadow-sm
  hover:bg-zinc-800 transition-colors` + optional leading Solar icon,
  label `text-xs font-medium tracking-wide`
- Filter pill: `rounded-full py-1.5 px-4 text-xs`; active `bg-zinc-950
  text-white font-normal`; inactive `text-zinc-500 font-light
  hover:bg-zinc-200/50`
- Icon button: `w-8 h-8 rounded-full flex items-center justify-center` with
  surface-appropriate fill (`bg-zinc-200/50 hover:bg-zinc-200` on light,
  `bg-zinc-800 hover:bg-zinc-700` on dark, or transparent
  `hover:bg-zinc-100`)
- Input (dark): `bg-zinc-900 rounded-xl py-2.5 px-3.5`, borderless, inner
  `bg-transparent outline-none text-xs font-light` with `placeholder-zinc-500`
- Input/card (light): `bg-zinc-50/80 border border-zinc-100 rounded-xl`
- Scrollbar: 6px, thumb `#E4E4E7`, hover `#D4D4D8`, rounded

### Icons

- **Solar linear icons only**, via the `iconify-icon` web component
  (`https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js`),
  names like `solar:inbox-in-linear`. Sizes via text size utilities
  (`text-sm`/`text-base`/`text-lg`). Default tint `zinc-400`/`zinc-500`;
  accent tint on active. No lucide, no tabler, no emoji, no other icon set.
  In React targets, `iconify-icon` still works (it's a custom element) or
  `@iconify/react` may be used with the same `solar:*-linear` names.

## Deliverable 1 — `docs/design-system/`

Replaces `docs/design-exemplars/` (which is deleted).

```
docs/design-system/
  README.md          entry point for AI consumers
  foundations.md     the DNA above, as normative reference
  components.md      snippet catalog
  patterns/
    patterns.md      index: which pattern, when
    dashboard.html   the source exemplar, cleaned
    auth.html        login screen
    landing.html     marketing page
    settings.html    settings/form page
    data-table.html  data-heavy list page
    mobile.html      mobile app view
```

### README.md

- What this is: the single source of visual truth; generated UI follows it
  exactly.
- Hard rules (short list): Inter only; zinc + 3 accents only; Solar icons
  only; radius scale fixed; `shadow-sm` max; accents are small elements;
  no font weights above 500; when in doubt copy a snippet, don't invent.
- Reading order / task routing: building one component → `components.md`;
  building a full screen → pick the closest `patterns/*.html` and adapt;
  any styling question → `foundations.md`.
- Note that patterns are plain HTML + Tailwind CDN and how to adapt to
  React/Next (className, same classes, same markup).

### foundations.md

The "visual DNA" section above, expanded into reference form with
copy-pasteable class strings and a closing **Do / Don't** table (e.g. don't
introduce colors outside the palette, don't use borders on dark surfaces,
don't use `font-bold`, don't use lucide, don't use gradients, don't round
corners below `xl` on controls).

### components.md

One section per component: a stable kebab-case id (e.g. `kpi-card`,
`list-row`, `filter-pill`) used as the heading and referenced by `/craft`'s
`componentsUsed` manifest field, then purpose, when to use, HTML snippet(s),
variants (dark-surface / light-surface where both exist). All snippets derived from
the source dashboard or composed strictly from its recipes. Catalog:

1. Buttons — primary, pill filter (active/inactive), icon button (3 fills),
   compact labeled button (Compose-style)
2. Inputs — search field (dark + light), text field, textarea, select-style
   field
3. Nav item — active (bg + accent icon + badge), inactive, with/without
   count badge
4. KPI stat card (dark + light variants)
5. List row — selected (left border accent + white bg), unread (medium
   weight + green dot), read (light weight, lighter text)
6. Avatar — initials on accent fill; sizes 4/9/10/11; icon avatar
7. Badges & pills — count badge (accent + neutral), label pill, recipient
   chip
8. Label dot (`w-2 h-2 rounded-full` + label)
9. Section label (uppercase tracking-widest)
10. User/account footer card
11. Attachment/file chip
12. Tabs (filter pill row)
13. Empty state (icon + title + caption, centered)
14. Modal/dialog (rounded-2xl white card on `zinc-950/50` overlay)
15. Table — header row (section-label style), data row, row actions
16. Toggle/switch (zinc track, white knob, green-400 active track)
17. Alert/banner — info (cyan), warning (orange), success (green): accent
    dot/icon + neutral surface, never accent fill
18. Skeleton row (`animate-pulse` zinc blocks) — the one allowed animation
    beyond transition-colors

Items 13–18 don't exist in the source dashboard; they are composed from the
DNA rules (neutral surfaces, accent dots, radius scale) and reviewed against
the Do/Don't list.

### patterns/

Every pattern is a standalone `.html`: Tailwind CDN + Inter Google Fonts +
iconify script + the scrollbar CSS, realistic content (no lorem ipsum), no
analytics or third-party scripts. Section-by-section content specs for the
five new pages live in the implementation plan; scope here:

- **dashboard.html** — the source exemplar verbatim, minus the promotekit
  script and the GA4 block; title stays "Email Inbox" or becomes "Dashboard".
- **auth.html** — split screen: left dark `zinc-950` `rounded-2xl` brand
  panel (logo, tagline, small KPI/social-proof cards), right white panel
  with centered login form (email, password, primary button, "forgot
  password" light link, divider, secondary provider button, sign-up link).
- **landing.html** — scrolling page (not the app shell): top nav, hero
  (display type `font-extralight tracking-tight`, primary + secondary CTA),
  logo/social-proof strip, features grid of `rounded-2xl` cards, dark
  full-width stats band (`zinc-950` with KPI cards), pricing (3
  `rounded-2xl` cards, featured one dark), footer.
- **settings.html** — app shell + condensed dark sidebar + white content
  panel: settings sections (profile fields, notification toggles, plan
  card), each a light card group; danger zone using `orange-500` accent
  markers only.
- **data-table.html** — app shell + dark sidebar + white panel: KPI row,
  toolbar (search, filter pills, sort icon button, primary action), data
  table per the table recipes, pagination footer.
- **mobile.html** — a phone-width (`max-w-[390px]`) `rounded-3xl` frame on
  `zinc-100`: status/header row, KPI cards, list rows, fixed bottom nav
  (5 Solar icons, active green-400), demonstrating the mobile translation
  of the shell (no side panels, bottom nav instead of sidebar).

### patterns.md

Table: file → screen type → when to use → what it demonstrates. Plus the
generalization rule: for a screen type with no pattern, start from the
closest pattern's shell and compose the rest from `components.md` — never
invent outside the DNA.

## Deliverable 2 — `/design` skill

New module directory following repo convention:

```
design/
  skills/
    design/
      SKILL.md
```

Registered in `.claude-plugin/plugin.json` `skills` array as
`"./design/skills/design"`.

SKILL.md behavior:

- **Invocation:** explicit `/design` (or `/sandwich:design`) only — same
  strict-invocation convention as `/craft` (see commit 27fe4e2). Not
  auto-invoked on topical similarity.
- **No prerequisites.** Works in any project, any stack; does not require
  `/order` artifacts.
- **Path resolution:** reads the design system from
  `$SANDWICH_ROOT/docs/design-system/` with the same "SANDWICH_ROOT is
  injected context text, substitute literally" instructions used by
  `/craft`'s SKILL.md.
- **Pipeline:** (1) always read `README.md` + `foundations.md`; (2) pick the
  closest pattern(s) for the requested screen(s) and read them, plus
  `components.md` sections actually needed; (3) detect the target project's
  stack (plain HTML, React, Next.js, etc.) and generate UI there using the
  exact class recipes — markup adapted to the stack, classes and structure
  not reinvented; (4) restate the hard rules as a self-check before
  finishing (palette, font, icons, radius, accent discipline).
- Explicitly forbids: other component libraries, other icon sets, colors
  outside the palette, `font-bold`+.

## Deliverable 3 — `/craft` rewrite

`craft/skills/craft/SKILL.md` is rewritten; the pipeline engine is kept,
the design source is replaced.

**Kept as-is:** explicit-invocation rules; `user-flows.json` prerequisite
hard stop; readiness gate (validateOrderForPlanning + open high-priority
questions); fresh/incremental mode detection; snapshot diff → stale/orphaned
flags; write-once invariant for screens; per-screen
empty/loading/error/responsive checklist; report format; the "never
overwrite, flag instead" philosophy.

**Removed:** everything shadcn — registry pulls (`npx shadcn add`),
`components.json`, `@shadcnblocks` secondary registry, blocks-first logic,
the lucide→Solar icon-swap pass (icons are Solar from the start),
`registryUses`.

**Replaced:**

- Scaffold step: template (`craft/template/`) updated — no shadcn config;
  Inter via `next/font/google` (weights 200/300/400/500); `globals.css`
  gets `bg-zinc-100` body, scrollbar CSS; iconify available (script tag in
  root layout, or `@iconify/react`); `components/craft/PageShell.tsx`
  implements the app-shell + dark-sidebar pattern translated from
  `patterns/dashboard.html`; `PageHeader.tsx` follows the panel-header
  recipe. Exact dependency edits to `package.json`/`tailwind.config.ts`
  are enumerated in the implementation plan after inspecting the current
  template.
- Screen composition step: per screen, pick the closest
  `docs/design-system/patterns/*.html`, compose content from
  `components.md` recipes as TSX. "Never invent a primitive" becomes:
  every element must trace to a `components.md` recipe or a pattern
  section; genuinely new needs are reported as gaps (and are candidates to
  add to `components.md`), not hand-rolled off-DNA.
- Manifest field `registryUses` → **`componentsUsed`**: string[] of
  `components.md` component ids and/or `patterns/*` file names actually
  used. The zod schema (`craft/lib/`), `craft/scripts/render.ts`
  validation, and any selfcheck fixtures are updated to match.
- "Why this is different from /wireframe" section: rewritten as the
  three-generation history — `/wireframe` (lo-fi, removed) → `/craft` v1
  (shadcn registry — sound engineering, rejected output quality) →
  `/craft` v2 (house design system), with a comparison table so future
  edits don't regress to either failure mode.

## Cleanup

- `git rm -r docs/design-exemplars/`
- Delete the empty `~/Documents/nightshift/design-system/` directory
  (outside this repo)
- Repo-wide grep for `design-exemplars`, `shadcn`, `lucide`,
  `shadcnblocks`, `registryUses` — update every live reference (skills,
  READMEs, hermes-plugin, workflows, lib code). Historical references in
  `docs/superpowers/specs/*` and git history stay.

## Verification

- Every `patterns/*.html` opened in a real browser and visually checked
  against the Do/Don't list (screenshot per page).
- `.claude-plugin/plugin.json` parses as JSON and lists the new skill.
- Craft schema validation runs green: `node --experimental-strip-types
  craft/scripts/render.ts` against a sample manifest using
  `componentsUsed`; any craft selfcheck script runs green.
- Grep confirms zero live references to the removed approach.
- `npm install && npm run build` (or at minimum `tsc --noEmit`) passes on a
  scaffold produced from the updated `craft/template`.

## Out of scope

- No npm package / publishable component library.
- No changes to `/order`, `/prep`, `/status`.
- No regeneration of `design/` apps already generated in client projects.
- Plugin cache refresh: the installed cache
  (`~/.claude/plugins/cache/sandwich/.../0.1.0`) is already stale (it still
  contains the removed `wireframe` module). Reinstalling/updating the
  plugin after merge is a **manual user step**, called out in the final
  report, not automated here.

## Risks

- **Quality of the five new pattern pages** is the load-bearing risk — they
  define what "on-DNA" means for every future screen. Mitigation: the
  implementation plan specs each page section-by-section with exact class
  recipes, and verification includes browser screenshots reviewed against
  the Do/Don't list.
- **Craft schema change** (`registryUses` → `componentsUsed`) touches lib +
  scripts + skill doc together; the plan sequences them as one task so the
  validator never disagrees with the skill.
