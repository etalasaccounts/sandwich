# sandwich

Composable agent stack for software agencies.

## Install

**Pi:**
```bash
\pi install https://github.com/etalasaccounts/sandwich.git
```

**Claude Code:**
```bash
claude install https://github.com/etalasaccounts/sandwich.git
```

## Ingredients

### brief

Turns any messy client input (MOM, RFQ, KAK, verbal notes) into four standardized artifacts:

- `docs/sandwich/brief/prd.md` — Product Requirements Document
- `docs/sandwich/brief/user-flows.md` — User flow narratives
- `docs/sandwich/brief/technical-notes.md` — Tech lead's architecture notes
- `docs/sandwich/brief/client-questions.md` — Clarifying questions for client

**In pi:** type `/brief` or paste your client document and describe it
**In Claude Code:** run the brief workflow

## Modes

| Mode | Trigger | What happens |
|------|---------|--------------|
| **New** | No `docs/sandwich/brief/` exists | Creates all four artifacts from scratch |
| **Refine** | Brief exists + you add new input | Updates all artifacts, marks changed sections |
| **Answer** | Brief exists + you paste client answers | Integrates answers, moves resolved questions |
