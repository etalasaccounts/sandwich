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
`questions.json`, `journal.jsonl`. Nothing is written.

## Output

`/status` prints:

- **Gates** — is the brief approved? is the queue approved?
- **Lifecycle counts** — proposed / queued / speced / building / review / done / deferred / rejected
- **Flags** — changed (brief moved), stale specs, blocked, orphaned
- **Awaiting you** — the specific actions only a human can take, in priority order:
  answer open questions → re-review changed features → regenerate stale specs →
  confirm orphan removals → approve the queue
- **Recent activity** — the last few journal events

`/status --report` prints a maintenance report (shipped features + activity
summary) built from the journal — for a maintenance engagement, the journal is
the billing and SLA evidence.

## Commands

| Command | Behavior |
|---------|----------|
| `/status` | Show the project dashboard |
| `/status --report` | Generate a maintenance report from the journal |

## Key principle

This is the morning-check command. If `Awaiting you` is empty, the queue is
approved and current, and you can pick a feature and run `/recipe <F-id>`.
