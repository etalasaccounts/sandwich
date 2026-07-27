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
   - Plain HTML: copy the canonical shared head from `foundations.md`'s
     "Shared HTML head" section (Tailwind CDN, Inter link, iconify script,
     scrollbar CSS) — every `patterns/*.html` file carries that exact block,
     differing only in `<title>`.
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
     dots, badges, avatar fills, icon tints (the one documented exception:
     a single accent-filled CTA button on a marketing page's featured
     pricing tier — see `foundations.md`'s Documented exceptions section).
   - Inter 200–500 only; no `font-semibold`/`font-bold`.
   - Only `solar:*-linear` icons; no lucide/tabler/emoji.
   - Radius scale: 3xl shell / 2xl panels / xl controls / full pills.
   - `shadow-sm` max; `transition-colors` only (plus `animate-pulse`
     skeletons).
   Anything that fails the check gets fixed before you report done. The only
   sanctioned deviations are the closed list in `foundations.md`'s
   "Documented exceptions" section — check there before "fixing" something
   you copied straight out of a pattern file.

## Forbidden

Component libraries (shadcn, MUI, Chakra, daisyUI, …), other icon sets,
colors outside the palette, other fonts, gradients, heavy shadows,
scale/slide animations. If the design system genuinely lacks something you
need, say so in your report and propose it as an addition to
`components.md` — don't improvise off-DNA.
