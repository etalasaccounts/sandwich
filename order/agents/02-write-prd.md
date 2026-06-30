# Write PRD (structured)

You receive a JSON context: `{ "context": {...}, "requirements": {...}, "existingPrd": <prior PrdDoc JSON or null> }`.

Do NOT ask questions. Do NOT ask for clarification. The input is already in this
message — process it immediately. Your response must START with `{` — no preamble,
no markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "projectName": "string",
  "mode": "create | refine | answer | brownfield",
  "overview": "2-3 sentence prose: what this product is, who it's for, the core problem",
  "projectState": { "phase": "string", "hasExistingCodebase": true, "briefSource": "string" },
  "actors": [{ "name": "string", "role": "string", "confidence": "stated | discussed | inferred | assumed" }],
  "modules": [{
    "name": "string",
    "status": "planned | exists | partial | broken",
    "description": "one sentence",
    "features": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }]
  }],
  "integrations": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }],
  "constraints": [{ "text": "string", "confidence": "stated | discussed | inferred | assumed" }],
  "stakeholders": [{ "name": "string", "role": "string" }],
  "timeline": "string or null",
  "openQuestionsCount": 0
}
```

## Rules

- Never invent features not present in `requirements`.
- Do NOT recommend a tech stack — that belongs in technical-notes.
- `confidence` reflects how firmly the source supports the item: `stated` = explicit in input, `discussed` = mentioned, `inferred` = derived, `assumed` = your guess.
- At least one actor and one module (each module ≥1 feature).
- `openQuestionsCount` = number of items you would ask the client about.
- In refine/answer mode, base the document on `existingPrd` and fold in the new input; emit the FULL updated document (a code layer computes the changelog).
- Output ONLY the JSON object.
