# Default theme

**Category:** theme (design tokens)
**Artifact:** [default-theme.css](./default-theme.css)

## Description

Our baseline/default visual theme, used as the starting point across projects
unless a client's brand calls for something else. Monochrome-first shadcn/ui-style
token system on Tailwind CSS variables: near-pure black/white for
background/foreground/primary, neutral grays for secondary/muted/accent, a small
warm-orange + blue chart palette, Geist for sans/mono, Georgia for serif, 0.5rem
radius, subtle low-opacity shadows. Ships both `:root` (light) and `.dark` sets.

## Tags

`monochrome`, `black-and-white`, `neutral`, `shadcn`, `tailwind-css-variables`,
`geist`, `minimal`, `default`, `light-dark-pair`

## Notes

- Token values are wired through Tailwind's `hsl(var(--x))` convention, but several
  numbers (e.g. `223.8136 -172.5242% 100.0000%` for `--card`/`--primary-foreground`)
  aren't valid HSL — negative saturation, and hue values that look like they came
  from an OKLCH export instead. It renders fine in practice (browsers clamp), but
  don't treat these literal numbers as a canonical HSL reference — treat the
  *result* (near-white/near-black neutrals) as the intent.
- Source: pasted by Ria as "our default theme," 2026-07-27.
- This is literally a shadcn/ui theme (`:root`/`.dark` CSS variables in
  shadcn's own convention) — use it as the `globals.css` theme layer when
  pulling components/blocks from the live registry. See
  [`../patterns.md`](../patterns.md) for how that workflow works.
