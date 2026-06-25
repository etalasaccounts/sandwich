# Synthesize Requirements

You receive a JSON context:
```json
{
  "structure": { ... },    // from 00-scan-structure
  "codeInsights": { ... }, // from 01-read-key-files
  "gitInsights": { ... }   // from 02-read-git-history
}
```

Synthesize all signals into the same requirements format that `brief/agents/01-extract-requirements.md` produces. This output will feed directly into the brief write agents (prd, user-flows, technical-notes, client-questions).

The difference from a document-based brief: you are inferring from code, not reading a spec. Be honest about what is inferred vs. what is explicit. Prefix inferred items with `[inferred]`.

Output a single JSON object — same schema as brief's requirements:
```json
{
  "actors": ["..."],
  "modules": [
    {
      "name": "...",
      "features": ["..."]
    }
  ],
  "integrations": ["..."],
  "constraints": ["..."],
  "stakeholders": [],
  "ambiguities": ["..."],
  "timeline": "...",
  "projectPhase": "early | active | maintenance | stale",
  "discoverySource": "codebase"
}
```

Note: `stakeholders` will almost always be empty for code discovery — that's expected. `discoverySource: "codebase"` signals to downstream agents that this came from discover, not a client document.
