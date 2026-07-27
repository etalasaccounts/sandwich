---
name: design
description: "Generate UI in any project following the house design system (house identity by default — Inter 200–500, zinc-valued neutrals + green/cyan/orange accents, Solar icons, rounded-2xl panels, dark sidebar + light content; projects override colors/font/radii via brand packs in design/themes/). Use ONLY when the user explicitly runs /design (or /sandwich:design). Do NOT invoke on topical similarity — discussing design or UI in general conversation is NOT an invocation unless the literal command is typed."
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

1. **Resolve the theme** — look for `design/themes/*.css` in the target
   project:
   - None → house identity; never set `data-theme`.
   - One pack → project default: set `data-theme="<name>"` on `<html>`
     (or the framework root) and ensure the pack stylesheet loads after
     the token block.
   - Several → the invocation may name one (`/design … --theme acme`);
     otherwise ask. Non-default packs remain runtime switch targets.
   Validate every pack you load: only variables from
   `$SANDWICH_ROOT/docs/design-system/theming.md`'s slot list may appear.
   Unknown variables or non-slot declarations (selectors beyond the one
   `[data-theme]` block, added shadows, etc.) → report the specific
   violations to the user and offer the house fallback; never silently
   drop or "fix" a pack.
2. **Read the rules** — `$SANDWICH_ROOT/docs/design-system/README.md`,
   `foundations.md`, and `theming.md`, in full, every invocation. Do not
   work from memory of a previous session.
3. **Pick references** — open `patterns/patterns.md`, pick the closest
   pattern file(s) for what's being built and read them; pull the
   `components.md` sections you actually need. Full screens start from a
   pattern's shell; single components come straight from `components.md`.
4. **Detect the target stack** — look at the project you're in:
   - Plain HTML: copy the canonical shared head from `foundations.md`'s
     "Shared HTML head" section (Tailwind v4 browser build + token block,
     Inter link, iconify script, scrollbar CSS) — every `patterns/*.html`
     file carries that exact block, differing only in `<title>`.
   - React/Next.js + Tailwind: same markup with `className`; Inter via
     `next/font/google` weights `["200","300","400","500"]`; icons via
     `@iconify/react` (`<Icon icon="solar:…-linear" />`) or the
     `iconify-icon` script in the root layout. Token block (`@theme
     inline` + `:root` slots) goes in `globals.css`; brand pack files are
     imported after it (see `theming.md` § build-step stacks).
   - Follow the project's existing conventions for file placement and
     componentization — the design system fixes *how things look*, not
     your framework choices.
5. **Generate** — markup structure and class strings come from the
   reference files. Adapt content, not style.
6. **Self-check before finishing** — verify against the hard rules:
   - Only semantic slot utilities (`bg-panel`, `text-ink-2`, `bg-accent`,
     …) — never raw palette classes (they render unstyled: any visually
     unstyled element is a violation) and never inline hex values;
     accents only as dots, badges, avatar fills, icon tints (same CTA
     exception).
   - Inter 200–500 only; no `font-semibold`/`font-bold`.
   - Only `solar:*-linear` icons; no lucide/tabler/emoji.
   - Radius scale: 3xl shell / 2xl panels / xl controls / full pills.
   - `shadow-sm` max; `transition-colors` only (plus `animate-pulse`
     skeletons).
   - If a pack is active, confirm `data-theme` is set and the pack file
     loads after the token block.
   Anything that fails the check gets fixed before you report done. The only
   sanctioned deviations are the closed list in `foundations.md`'s
   "Documented exceptions" section — check there before "fixing" something
   you copied straight out of a pattern file.

## Forbidden

Component libraries (shadcn, MUI, Chakra, daisyUI, …), other icon sets,
colors outside the palette, other fonts, gradients, heavy shadows,
scale/slide animations, raw Tailwind palette classes (`*-zinc-*`,
`*-green-400`, …) and inline hex colors in markup — colors enter only
through slot variables. If the design system genuinely lacks something you
need, say so in your report and propose it as an addition to
`components.md` — don't improvise off-DNA.
