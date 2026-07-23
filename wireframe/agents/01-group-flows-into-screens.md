# Group Flows Into Screens

You receive `{ "newFlows": [...], "existingScreens": [{ "id": "SCR-XXX", "name": "...", "route": "/...", "flows": ["UF-XXX"] }] }`.

`newFlows` are user flows that need a screen and are not yet covered by any
existing screen. Decide, for each one, whether it fits naturally onto an
`existingScreens` entry (e.g. a new "filter products" flow probably belongs
on the same screen as an existing "browse products" flow) or needs a
brand-new screen.

Do NOT ask questions. Your response must START with `{` — no preamble, no
markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape — **only include
brand-new screens you are proposing**, not the existing ones:

```json
{
  "screens": [
    { "id": "SCR-004", "name": "Product Listing Page", "route": "/plp", "flows": ["UF-004", "UF-005"], "navigatesTo": ["SCR-002"] }
  ]
}
```

## Rules

- `id` MUST be `SCR-` followed by three digits, continuing the sequence
  after the highest id in `existingScreens` (start at `SCR-001` if none exist).
- `route` is a lowercase-hyphenated URL path starting with `/` (e.g. `/plp`,
  `/checkout`), and must be unique across both `existingScreens` and your
  new proposals. The homepage/nav-hub always owns `/` — never propose that
  route for a screen.
- Every id in `newFlows` must appear in exactly one screen's `flows` array —
  either an existing screen (which you don't need to repeat in your output)
  or one of your new screens.
- `navigatesTo` lists the ids of other screens (existing or among your new
  proposals) that this screen's primary action should link to, inferred
  from the flow's `outcome` (e.g. an "item added to cart" outcome implies a
  link to whichever screen serves the cart flow). Leave it `[]` if no
  screen a user would navigate to next exists yet.
- Prefer fewer, well-organized screens over one screen per flow. A
  multi-step process (e.g. a 2-step checkout) is still one screen.
- Output ONLY the JSON object.
