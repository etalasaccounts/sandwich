# Group Flows Into Screens

You receive `{ "newFlows": [...], "existingScreens": [{ "id": "SCR-XXX", "name": "...", "flows": ["UF-XXX"] }] }`.

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
    { "id": "SCR-004", "name": "Product Listing Page", "file": "plp.html", "flows": ["UF-004", "UF-005"] }
  ]
}
```

## Rules

- `id` MUST be `SCR-` followed by three digits, continuing the sequence
  after the highest id in `existingScreens` (start at `SCR-001` if none exist).
- `file` is lowercase, hyphenated, ends in `.html`, and must be unique
  across both `existingScreens` and your new proposals.
- Every id in `newFlows` must appear in exactly one screen's `flows` array —
  either an existing screen (which you don't need to repeat in your output)
  or one of your new screens.
- Prefer fewer, well-organized screens over one screen per flow. A
  multi-step process (e.g. a 2-step checkout) is still one screen.
- Output ONLY the JSON object.
