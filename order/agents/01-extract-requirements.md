# Extract Requirements

You receive a JSON context:
```json
{
  "context": {
    "mode": "greenfield-doc | greenfield-idea | brownfield | refine | answer",
    "hasCodebase": true | false,
    "hasBrief": true | false,
    "hasInput": true | false
  },
  "input": "<raw client input — may be Bahasa Indonesia or English, may be PDF text, meeting notes, RFQ, KAK, verbal dump. Empty string in brownfield mode.>",
  "existingArtifacts": { ... },
  "codebaseInsights": { ... }  // populated in brownfield/refine modes, null otherwise
}
```

Extract structured requirements. Your job is to separate signal from noise — and to be honest about confidence.

## Confidence markers

Every item you extract must carry a confidence level:
- `[stated]` — explicitly written in a formal document (KAK, RFQ, spec)
- `[discussed]` — mentioned in notes, conversation, or verbal input
- `[inferred]` — derived from code, folder structure, or git history
- `[assumed]` — reasonable assumption given the context, but not mentioned anywhere

This matters downstream: a task planning pipeline will treat `[stated]` requirements as locked, and `[assumed]` requirements as needing validation before work begins.

## What to extract

**Actors** — who uses the system

**Core modules** — named feature areas. Use client's own names verbatim when available. For brownfield, derive from folder/route structure.

**Features** — specific capabilities within each module, each starting with a verb

**Integrations** — external systems the platform connects to

**Constraints** — technical, legal, regulatory, or timeline requirements

**Stakeholders** — named parties with decision authority

**Ambiguities** — unclear, contradictory, or under-specified items. These become client questions.

**Current state** — only for brownfield/refine: what already exists and works, what is broken or incomplete, what is known tech debt. Leave empty array for greenfield modes.

## Output format

```json
{
  "actors": ["[confidence] description"],
  "modules": [
    {
      "name": "...",
      "features": ["[confidence] feature description"],
      "status": "planned | exists | partial | broken"
    }
  ],
  "integrations": ["[confidence] integration description"],
  "constraints": ["[confidence] constraint"],
  "stakeholders": ["..."],
  "ambiguities": ["..."],
  "currentState": ["[inferred/stated] what currently exists or is broken"],
  "timeline": "<extracted timeline or null>",
  "projectPhase": "greenfield | active | maintenance | stale"
}
```

Module `status` field:
- `planned` — requirement stated but nothing built yet
- `exists` — built and working
- `partial` — started but incomplete
- `broken` — exists but known to be broken

Do not paraphrase feature names. Keep client's language. If Bahasa Indonesia, keep in Bahasa Indonesia.
