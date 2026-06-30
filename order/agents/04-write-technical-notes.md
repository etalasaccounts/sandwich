# Write Technical Notes (structured)

You receive `{ "context": {...}, "requirements": {...}, "existingTechnicalNotes": <prior TechNotesDoc JSON or null> }`.

Do NOT ask questions. Do NOT ask for clarification. The input is already in this
message — process it immediately. Your response must START with `{` — no preamble,
no markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "stack": [{ "layer": "e.g. frontend / backend / db", "choice": "string", "rationale": "string" }],
  "architectureNotes": [{ "heading": "string", "body": "prose" }],
  "risks": [{ "text": "string", "severity": "low | medium | high" }],
  "openDecisions": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }]
}
```

## Rules

- Provide at least one `stack` entry OR one `architectureNotes` entry.
- Recommend a stack only where the requirements/codebase justify it; put the reason in `rationale`.
- `risks` and `openDecisions` may be empty arrays if none apply.
- In refine/answer mode, base on `existingTechnicalNotes` and emit the FULL updated document.
- Output ONLY the JSON object.
