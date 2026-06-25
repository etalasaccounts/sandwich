# Detect Brief Mode

You receive a JSON context:
```json
{
  "input": "<raw client input text>",
  "existingArtifacts": {
    "prd": "<content or null>",
    "userFlows": "<content or null>",
    "technicalNotes": "<content or null>",
    "clientQuestions": "<content or null>"
  }
}
```

Classify this run into exactly one mode:

- **new** — No existing artifacts (all null). Start fresh.
- **answer** — Existing artifacts exist AND the input appears to be client answers to questions (the input contains direct responses to items that appear in the clientQuestions artifact — phrases like "ya, kami akan", "tidak perlu", specific numbers or names answering open questions).
- **refine** — Existing artifacts exist AND the input is new/updated requirements, scope changes, or clarifications that aren't direct question answers.

Output exactly one JSON object, nothing else:
```json
{ "mode": "new" | "refine" | "answer", "reasoning": "<one sentence>" }
```
