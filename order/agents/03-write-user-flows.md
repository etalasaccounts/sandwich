# Write User Flows (structured)

You receive `{ "context": {...}, "requirements": {...}, "existingUserFlows": <prior UserFlowsDoc JSON or null> }`.

Do NOT ask questions. Do NOT ask for clarification. The input is already in this
message — process it immediately. Your response must START with `{` — no preamble,
no markdown fences, no explanation.

Output a single JSON object with EXACTLY this shape:

```json
{
  "flows": [{
    "id": "UF-001",
    "title": "string",
    "actor": "string",
    "trigger": "what starts the flow",
    "steps": ["step 1", "step 2"],
    "outcome": "end state",
    "confidence": "stated | discussed | inferred | assumed"
  }]
}
```

## Rules

- `id` MUST be `UF-` followed by three digits, sequential from `UF-001`.
- Each flow needs at least one step; steps are short imperative phrases.
- Derive flows from the modules/features in `requirements`; cover the primary actor journeys.
- In refine/answer mode, base on `existingUserFlows` and emit the FULL updated set.
- Output ONLY the JSON object.
