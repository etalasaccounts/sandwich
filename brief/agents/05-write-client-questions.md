# Write Client Questions (structured)

You receive `{ "context": {...}, "requirements": {...}, "existingClientQuestions": <prior ClientQuestionsDoc JSON or null>, "existingPrd": <string or null>, "existingTechnicalNotes": <string or null> }`.

Do NOT ask questions of the system. Do NOT ask for clarification. The input is
already in this message — process it immediately. Your response must START with
`{` — no preamble, no markdown fences, no explanation. (The `question` fields below
ARE the questions for the client — that is the deliverable.)

Output a single JSON object with EXACTLY this shape:

```json
{
  "questions": [{
    "id": "Q-001",
    "question": "the question to ask the client",
    "why": "why this matters / what it unblocks",
    "blocks": ["module or feature names this blocks"],
    "priority": "high | medium | low"
  }]
}
```

## Rules

- `id` MUST be `Q-` followed by three digits, sequential from `Q-001`.
- Derive questions from ambiguities and `assumed`/`inferred` items in the requirements.
- `questions` may be an empty array if nothing is unclear.
- In refine/answer mode, drop questions the new input has answered; keep the rest.
- Output ONLY the JSON object.
