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
    "steps": [
      { "text": "step 1" },
      { "text": "enter shipping address", "fields": [
        { "name": "city", "type": "text", "required": true },
        { "name": "country", "type": "select", "required": true, "options": ["Indonesia", "Singapore"] }
      ] }
    ],
    "outcome": "end state",
    "confidence": "stated | discussed | inferred | assumed",
    "needsUI": true
  }]
}
```

## Rules

- `id` MUST be `UF-` followed by three digits, sequential from `UF-001`.
- Each flow needs at least one step; `text` is a short imperative phrase.
- When a step involves entering or selecting data (a form field, a search box, a filter), add a `fields` array: one entry per field with `name`, `type` (`text`|`email`|`number`|`date`|`select`|`textarea`|`checkbox`), `required`, and `options` (only for `type: "select"`). Omit `fields` entirely for purely navigational/action steps (e.g. "click checkout").
- `needsUI` is `true` when a human actor interacts with a screen for this flow (e.g. "End User", "Admin"); `false` when the actor is a system/cron/webhook/background process that never renders UI.
- Derive flows from the modules/features in `requirements`; cover the primary actor journeys.
- In refine/answer mode, base on `existingUserFlows` and emit the FULL updated set.
- Output ONLY the JSON object.
