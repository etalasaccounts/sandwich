# Reconcile Changes

You receive a JSON context:
```json
{
  "mode": "refine" | "answer",
  "input": "<new client input>",
  "before": {
    "prd": "<old content>",
    "userFlows": "<old content>",
    "technicalNotes": "<old content>",
    "clientQuestions": "<old content>"
  },
  "after": {
    "prd": "<new content>",
    "userFlows": "<new content>",
    "technicalNotes": "<new content>",
    "clientQuestions": "<new content>"
  }
}
```

Write a short change summary — what changed and why.

## Output format

```markdown
## Brief Updated — [mode: refine|answer]

**Input summary:** [one sentence describing what the new input was]

**Changes:**
- `prd.md`: [what changed, or "no changes"]
- `user-flows.md`: [what changed, or "no changes"]
- `technical-notes.md`: [what changed, or "no changes"]
- `client-questions.md`: [what changed, or "no changes"]

**Next step:** [one sentence — e.g. "Share client-questions.md with the client" or "Technical notes updated — review risky areas before starting architecture"]
```

Output only this markdown block. Nothing else.
