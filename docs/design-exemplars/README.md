# Design exemplars

This is **not** a gallery of UI screenshots or hand-recreated pages. It's a
thin layer of house conventions meant to sit on top of the **live shadcn/ui
registry** (https://ui.shadcn.com, source at
https://github.com/shadcn-ui/ui), which already provides:

- ~60 accessible, tested base components (`registry:ui`)
- ~250 usage examples covering forms (4 different form libraries), charts
  (71 variants), data tables, comboboxes, date pickers, and more
  (`registry:example`)
- Real page-level blocks: a full dashboard, **16 sidebar variants**, 5 login
  and 5 signup page layouts (`registry:block`)

That's broader and more reliable than anything we could capture by pasting
screenshots one at a time, it's actively maintained upstream, and — not a
coincidence — [`themes/default-theme.css`](./themes/default-theme.css) is
already written in shadcn's own CSS-variable theming format. Referencing the
registry live means this library never goes stale and never duplicates code
that shadcn already maintains.

## What lives here

- **`themes/default-theme.css`** — our actual theme (light + dark), in
  shadcn's `:root`/`.dark` CSS-variable format. Drop it in as a project's
  theme layer (e.g. `app/globals.css` in a shadcn project).
- **`icons.md`** — the icon convention: **Solar Icons only**, never the
  lucide-react/@tabler-icons-react that ship by default in registry
  components, never emoji.
- **`patterns.md`** — the pattern index: what's in the registry (base
  components, examples, blocks — with real descriptions pulled from the
  registry source, not guessed), how to pull real source from it, and the
  strategy for composing UI for domains the registry doesn't literally name
  (a marketplace, a booking flow, etc.).

## Workflow for building UI from this

1. **Identify the need** — nav shell? data table? login page? full dashboard?
2. **Check [`patterns.md`](./patterns.md)** for a pointer into the registry.
3. **Pull real, current source** — `npx shadcn@latest add <name>` in a real
   project, or read it straight from GitHub/the registry API when just
   researching. Never hand-retype or approximate registry source from memory.
4. **Apply house conventions** — swap in `themes/default-theme.css` as the
   theme layer, and replace every icon import per `icons.md`.
5. **For anything the registry doesn't cover**, compose it from base
   primitives rather than inventing bespoke UI from scratch (see the
   generalization section in `patterns.md`). If it's a recurring need, add a
   line to `patterns.md` rather than solving it ad hoc each time.
