# Read Git History

You receive a JSON context:
```json
{
  "gitLog": "<last 50 commit messages with dates>",
  "gitBranches": "<branch list>",
  "structure": { ... }
}
```

From the git history, infer:

**Project phase** — is this early (lots of initial commits, scaffolding), active (feature work), maintenance (mostly fixes), or stale (no recent commits)?

**Recent focus areas** — what modules or features have been touched most recently? (last 30 days)

**Constraints and decisions** — commit messages often reveal why things were built a certain way. Look for: "fix:", "revert:", "hotfix:", migration commits, security patches.

**Timeline** — when did this project start, roughly? Any milestones visible in history?

**Risks** — many reverts, frequent hotfixes, or long-lived WIP branches are signals.

Output a single JSON object:
```json
{
  "projectPhase": "early | active | maintenance | stale",
  "recentFocusAreas": ["..."],
  "constraints": ["..."],
  "timeline": "...",
  "risks": ["..."]
}
```
