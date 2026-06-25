---
name: discover
description: Retroactively generate brief artifacts (prd.md, user-flows.md, technical-notes.md, client-questions.md) from an existing codebase. Use ONLY when explicitly invoked with /discover or when the user asks to document/brief an existing project that has no brief yet. Do NOT invoke during active development, coding tasks, or general conversation.
---

# sandwich/discover

You are running the `discover` pipeline. Your job is to read an existing codebase and produce the same four artifacts as `brief`, written to `docs/sandwich/brief/`.

## When to invoke this skill

- User runs `/discover`
- User says "document this project" / "generate brief from code" / "we don't have a brief yet"
- User is onboarding onto an existing project with no requirements documentation

## Pipeline

Run these steps in order:

1. **Scan structure** — run `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' | head -200` to get file tree. Read `package.json`, `README.md`, `docker-compose.yml` if they exist.

2. **Read key files** — identify and read the 5-10 most revealing files: route definitions, main models/schema, auth middleware, main config. Skip generated files, lock files, and test fixtures.

3. **Read git history** — run `git log --oneline -50` and `git branch -a`.

4. **Synthesize requirements** — combine all signals into the standard requirements format.

5. **Write all four artifacts** — same as brief: prd.md, user-flows.md, technical-notes.md, client-questions.md at `docs/sandwich/brief/`.

## Key difference from brief

- Input is code, not a client document
- Facts are inferred, not stated — prefix inferred items with `[inferred]` in artifacts
- `client-questions.md` will have more questions than usual — that's expected and correct
- `stakeholders` section will be empty or minimal — note this explicitly in prd.md

## Output

After writing all four files, print:
```
✓ docs/sandwich/brief/prd.md
✓ docs/sandwich/brief/user-flows.md
✓ docs/sandwich/brief/technical-notes.md
✓ docs/sandwich/brief/client-questions.md

Discovered from codebase. [N] items inferred — review client-questions.md to validate with the team.
```
