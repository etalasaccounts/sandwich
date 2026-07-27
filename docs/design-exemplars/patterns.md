# Pattern index

A map into the live shadcn/ui registry, plus the strategy for composing UI
for things the registry doesn't literally name. Treat the lists below as
**indicative, not authoritative** — they're a snapshot pulled from the real
registry source while building this doc; the live registry is always the
source of truth, so re-check it rather than trusting stale memory of this
file for anything load-bearing.

## Pulling real source

```bash
# In a real project — installs the component/block, wires dependencies:
npx shadcn@latest add <name>            # e.g. sidebar-07, dashboard-01, card

# Just researching / reading source without installing:
curl -sS "https://ui.shadcn.com/r/styles/new-york-v4/<name>.json"
curl -sS "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/blocks/<name>/page.tsx"

# Full base-component registry index:
curl -sS "https://ui.shadcn.com/r/index.json"

# Block descriptions/metadata (what distinguishes sidebar-01 from -07, etc.):
curl -sS "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/blocks/_registry.ts"
```

Always apply the [icon convention](./icons.md) and swap in
[`themes/default-theme.css`](./themes/default-theme.css) after pulling.

## Base components (`registry:ui`)

Layout & navigation: `sidebar`, `navigation-menu`, `breadcrumb`, `tabs`,
`menubar`, `resizable`, `scroll-area`, `separator`, `pagination`.

Overlays: `dialog`, `alert-dialog`, `drawer`, `sheet`, `popover`,
`hover-card`, `tooltip`, `context-menu`, `dropdown-menu`, `command`.

Forms & inputs: `form`, `field`, `input`, `input-group`, `input-otp`,
`textarea`, `select`, `native-select`, `checkbox`, `radio-group`, `switch`,
`slider`, `toggle`, `toggle-group`, `label`, `button`, `button-group`.

Data display: `table`, `card`, `badge`, `avatar`, `chart`, `calendar`,
`carousel`, `progress`, `skeleton`, `empty`, `item`, `kbd`.

Feedback: `alert`, `sonner` (toast), `spinner`.

Other: `accordion`, `collapsible`, `aspect-ratio`, `direction`, `marker`,
`bubble`, `message`, `message-scroller`, `attachment`.

## Examples (`registry:example`, ~250 files)

Usage snippets for the base components above — "how do I actually wire up
X." Notably deep coverage on:

- **Forms** — full working examples across four different form-handling
  approaches: React Hook Form (`form-rhf-*`), TanStack Form
  (`form-tanstack-*`), Formisch (`form-formisch-*`), and Next.js server
  actions (`form-next-*`). Pick whichever matches the project's existing
  stack rather than defaulting to one.
- **Charts** — 71 variants (`chart-area-*`, `chart-bar-*`, etc.) covering
  axes, legends, tooltips, gradients, stacking, interactivity.
- Combobox, date-picker, carousel, data-table, command-palette, and
  input-group variants.

Fetch the full current list from the `examples/` directory in the registry
path above rather than trusting a frozen list here.

## Blocks (`registry:block`)

Full page-level compositions. Descriptions below are verbatim from the
registry source (`blocks/_registry.ts`):

| block | description |
|---|---|
| `dashboard-01` | A dashboard with sidebar, charts and data table. |
| `sidebar-01` | A simple sidebar with navigation grouped by section. |
| `sidebar-02` | A sidebar with collapsible sections. |
| `sidebar-03` | A sidebar with submenus. |
| `sidebar-04` | A floating sidebar with submenus. |
| `sidebar-05` | A sidebar with collapsible submenus. |
| `sidebar-06` | A sidebar with submenus as dropdowns. |
| `sidebar-07` | A sidebar that collapses to icons. |
| `sidebar-08` | An inset sidebar with secondary navigation. |
| `sidebar-09` | Collapsible nested sidebars. |
| `sidebar-10` | A sidebar in a popover. |
| `sidebar-11` | A sidebar with a collapsible file tree. |
| `sidebar-12` | A sidebar with a calendar. |
| `sidebar-13` | A sidebar in a dialog. |
| `sidebar-14` | A sidebar on the right. |
| `sidebar-15` | A left and right sidebar. |
| `sidebar-16` | A sidebar with a sticky site header. |
| `login-01` | A simple login form. |
| `login-02` | A two column login page with a cover image. |
| `login-03` | A login page with a muted background color. |
| `login-04` | A login page with form and image. |
| `login-05` | A simple email-only login page. |
| `signup-01` | A simple signup form. |
| `signup-02` | A two column signup page with a cover image. |
| `signup-03` | A signup page with a muted background color. |
| `signup-04` | A signup page with form and image. |
| `signup-05` | A simple signup form with social providers. |

`dashboard-01` is itself a good worked example of composition: it pulls in
`sidebar`, `chart`, `card`, `table`, `badge`, `dropdown-menu`, `sheet`, and
more as `registryDependencies` — i.e. blocks are just base components
composed together, the same way you'd compose them yourself.

## Secondary registry: marketing/landing sections

The official registry has **no hero, pricing, testimonial, feature-grid, or
footer blocks** — shadcn is fundamentally an app-UI (behind-login, tool-like)
system, not a marketing-site one. For landing pages, reference
**shadcnblocks.com** as a secondary, CLI-compatible registry:

```bash
npx shadcn@latest add https://shadcnblocks.com/r/hero1.json
```

Verified: this returns a real `registry:block`-typed, schema-compliant JSON
(same shape as the official registry), so it installs the same way.

**Caveats — check before shipping into a client deliverable:**

- **Unofficial third party.** Not affiliated with or endorsed by shadcn/ui
  (their own site says so explicitly). Treat it as a separate, unvetted
  supply chain, not an extension of the official one.
- **Freemium.** Only a subset of blocks are free/CLI-installable without a
  paid plan (plans run $149–$399 one-time as of writing). Don't assume every
  block referenced in a design plan is actually pullable without a
  subscription — confirm access first.
- **Per-block license isn't stated clearly.** Unlike the official registry
  (MIT, unambiguous), don't assume a shadcnblocks.com block is freely
  reusable in client work without checking — verify licensing terms before
  it ends up in a paid deliverable.

Use it specifically for the marketing-section gap above; keep using the
official registry for everything app-UI-shaped.

## Generalizing beyond what's listed here

The registry doesn't have a `marketplace` block, and it never will have one
for every domain a client asks for. That's fine — the point of this index
isn't coverage of every app type, it's a rich enough set of primitives that
most requests decompose into a handful of them, the way an engineer would
build it by hand. Add exemplars for **primitives**, not **domains**.

Worked example — "build a marketplace":

- Nav shell → any `sidebar-*` variant, picked by IA depth (see descriptions
  above — `sidebar-07` if it should collapse to icons, `sidebar-02`/`-05` if
  nav needs grouping/submenus).
- Product grid/listing → `card` in a grid, or the `table`/data-table pattern
  from `dashboard-01` for an admin-side listing view.
- Filters → `combobox`/`select`/`checkbox` group, in a `sheet` on mobile.
- Product detail → `card` + `carousel` (image gallery) + `badge` (price/
  stock) + `button` (add to cart).
- Cart → `sheet` or `drawer`.
- Checkout → `form` + `field` + `input-group`, any of the four form-handling
  examples above.
- Empty search results → `empty`.

None of that required a bespoke "marketplace" exemplar. If you hit a genuine
gap — a primitive the registry has no equivalent for at all — that's the one
case worth hand-building, and it should still follow the theme and icon
conventions here. Add it to this file as a new line so it's not solved ad
hoc again next time.
