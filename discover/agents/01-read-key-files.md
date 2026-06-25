# Read Key Files

You receive a JSON context:
```json
{
  "structure": { ... },  // output from 00-scan-structure
  "keyFiles": {
    "<filepath>": "<content>"
  }
}
```

The key files are the most important files for understanding what this project does — routes, models, main config, schema, API definitions.

From these files, extract:

**Actors** — who uses this system? Look for: auth roles, user types in DB schema, route guards, permission checks (e.g. `role: 'admin'`, `req.user`, middleware names)

**Features** — what does the system actually do? Derive from route names, controller names, service names, model names. One feature per meaningful endpoint group or domain object.

**Data model highlights** — key entities and their relationships (from schema files, models, migrations)

**Business rules** — any logic that reveals constraints or domain rules (validation, pricing logic, state machines)

**Ambiguities** — things that are unclear, inconsistent, or that a new team member would find confusing

Output a single JSON object:
```json
{
  "actors": ["..."],
  "features": [
    { "module": "...", "name": "...", "description": "..." }
  ],
  "dataHighlights": ["..."],
  "businessRules": ["..."],
  "ambiguities": ["..."]
}
```
