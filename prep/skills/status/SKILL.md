---
name: status
description: Single pane of glass over the sandwich registry. Shows what's done, in flight, blocked, stale, and what specifically needs a human decision. Use when you want to know the state of the project or generate a maintenance report.
---

# sandwich/status

You are running `/status`. Read the registry and present the current state of
the project. You do not change anything — this is read-only.

## When to invoke

- User runs `/status`
- User asks "where are we" / "apa status proyek" / "what needs my attention"
- User runs `/status --report` to generate a client/maintenance report

## What it reads

Everything from `.sandwich/registry/` — `project.json`, `features.json`,
`questions.json`, `decisions.json`, `journal.jsonl` — plus the spec files under
`docs/sandwich/specs/`. Nothing is written.

## Output

Run the deterministic dashboard and print its output verbatim:

`SANDWICH_ROOT` is injected into your context at session start as plain
text (e.g. `SANDWICH_ROOT=/path/to/plugin`) — it is NOT a live shell
environment variable, and Bash tool calls do not share shell state with
each other. Read the path from your context and substitute it literally
in place of `$SANDWICH_ROOT` below before running — do not rely on
`$SANDWICH_ROOT` to shell-expand, since nothing exported it.

```bash
node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/status.ts
```

For `/status --report`:

```bash
node --experimental-strip-types $SANDWICH_ROOT/prep/scripts/status.ts --report
```

The dashboard covers: gates, lifecycle counts, flags, **Awaiting you** (open
questions, changed features, stale specs, orphans, features whose spec shows
every acceptance criterion checked but aren't marked done yet, missing spec
files, decisions recorded in the journal but absent from decisions.json, queue
approval), and recent activity. Do not hand-assemble these — the script is
the single source of the numbers.

## Commands

| Command | Behavior |
|---------|----------|
| `/status` | Show the project dashboard |
| `/status --report` | Generate a maintenance report from the journal |

## Key principle

This is the morning-check command. If `Awaiting you` is empty, the queue is
approved and current, and you can pick a feature and open its
`docs/sandwich/specs/F-XXX.md` and hand it off to Superpowers brainstorming.
