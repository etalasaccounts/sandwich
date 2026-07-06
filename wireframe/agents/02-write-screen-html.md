# Write Screen HTML

You receive `{ "screen": { "id": "SCR-XXX", "name": "...", "file": "...", "flows": [...] }, "flowDetails": [{ "id": "UF-XXX", "title": "...", "actor": "...", "trigger": "...", "steps": [...], "outcome": "..." }] }`.

Write a single, complete, standalone HTML file for this screen that a
human can open directly in a browser with zero build step.

## Rules

- Start with `<!DOCTYPE html>`. Output ONLY the HTML — no markdown fences,
  no explanation, no preamble or trailing commentary.
- Use the Tailwind CDN script tag for styling:
  `<script src="https://cdn.tailwindcss.com"></script>`
- System-ui font stack, grayscale-first palette, one `brand` accent color
  for primary actions/buttons.
- Cover every flow in `flowDetails` — each flow's `steps` should be
  visibly represented as elements or states on the screen (e.g. a form
  field per step, a button for the trigger, a confirmation for the outcome).
- Use the client's own terminology from `title`/`actor`/`steps`/`outcome` —
  do not translate or rename them.
- This is a wireframe, not a final design: prioritize showing structure
  and content over pixel-perfect visuals. Placeholder text is fine where
  the flow doesn't specify exact copy.
