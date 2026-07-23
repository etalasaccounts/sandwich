# Write Screen TSX

You receive `{ "screen": { "id": "SCR-XXX", "name": "...", "route": "/...", "flows": [...], "navigatesTo": ["SCR-XXX"] }, "flowDetails": [{ "id": "UF-XXX", "title": "...", "actor": "...", "trigger": "...", "steps": [{ "text": "...", "fields": [{ "name": "...", "type": "...", "required": true, "options": [...] }] }], "outcome": "..." }], "navigationTargets": [{ "id": "SCR-XXX", "route": "/..." }] }`.

Write a single Next.js App Router page component for this screen, as a
`.tsx` file, importing only from the project's existing shared components —
never invent new primitives.

## Rules

- Output ONLY the TSX source — no markdown fences, no explanation, no
  preamble or trailing commentary. The file must start with an `import`
  statement.
- Default-export a single component: `export default function Page() { ... }`.
- Import shared UI only from `@/components/ui/*` (Button, Input, Label,
  Textarea, Card + subcomponents, Badge, Separator, Table, Select, Dialog,
  Avatar, DropdownMenu — use only components that exist; do not invent new
  ones) and `@/components/wireframe/*` (Navbar, PageShell, PageHeader,
  EmptyState). Wrap the screen body in `<PageShell>` and start with
  `<PageHeader title="..." />`.
- Cover every flow in `flowDetails` — each flow's `steps` should be visibly
  represented as elements or states on the screen. For any step with a
  `fields` array, render one labeled input per field using `Label` + the
  matching input component (`Input` for text/email/number/date, `Textarea`
  for textarea, `Select` for select using the step's `options`, a checkbox
  `Input type="checkbox"` for checkbox), marking `required` fields visually
  (e.g. a `*` after the label).
- For any action that should navigate to another screen, use `next/link`'s
  `<Link href="...">` with the target's `route` from `navigationTargets`
  (matched by the screen's `navigatesTo` ids), styled with `buttonVariants`
  from `@/components/ui/button` (e.g.
  `<Link href={targetRoute} className={buttonVariants({ variant: "default" })}>Add to cart</Link>`)
  rather than wrapping a `<Button>` around it.
- Use the client's own terminology from `title`/`actor`/`steps`/`outcome` —
  do not translate or rename them.
- This is a wireframe, not a final design: prioritize showing structure
  and content over pixel-perfect visuals. Placeholder text is fine where
  the flow doesn't specify exact copy.
