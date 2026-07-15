# Flag Screen Gaps

You receive `{ "projectType": "...", "actors": ["..."], "modules": [{ "name": "...", "description": "..." }], "existingScreens": [{ "id": "SCR-XXX", "name": "..." }] }`.

Identify commonly-expected supporting screens for a project of this kind
that are **not** covered by any `existingScreens` entry — e.g. login/auth,
404/not-found, an empty-state for a list screen, account/settings. Judge
from `actors` and `modules`, not from a fixed checklist — a project with no
`Admin` actor doesn't need an admin screen flagged.

Do NOT ask questions. Your response must START with `{` — no preamble, no
markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "gaps": ["Login", "404 / Not found", "Account settings"]
}
```

## Rules

- Each entry is a short human-readable screen name, not an id — these are
  suggestions for a human to consider, not screens this pipeline will
  generate.
- Output `{ "gaps": [] }` if you can't identify any reasonable gap — don't
  pad the list to seem thorough.
- Output ONLY the JSON object.
