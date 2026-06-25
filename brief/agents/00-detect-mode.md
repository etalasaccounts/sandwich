# Detect Brief Mode

> NOTE: Mode detection is handled in brief-lib.ts (detectContext). This agent is kept as documentation only and is not called by the workflow.

The five modes:

- **greenfield-doc** — no codebase, formal document input (KAK, RFQ, MOM, long structured text)
- **greenfield-idea** — no codebase, conversational or vague input
- **brownfield** — codebase exists, no brief yet → scan codebase first
- **refine** — brief exists + new requirements or scope changes
- **answer** — brief exists + client answered questions from client-questions.md
