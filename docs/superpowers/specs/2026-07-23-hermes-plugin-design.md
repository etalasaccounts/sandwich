# Hermes Agent plugin

## Problem

Sandwich's four skills (`/order`, `/prep`, `/status`, `/wireframe`) already run in two
harnesses — pi and Claude Code — via a shared `SKILL.md` + `agents/*.md` pipeline per
ingredient, plus a thin per-ingredient harness adapter (`order/pi-extension/order.ts`,
etc.) that does two things: registers the skill's file path with the harness, and injects
a `SANDWICH_ROOT=<path>` line into the system prompt so the skill's own instructions know
where to find `render.ts` and friends.

The user wants the same experience in Hermes Agent (https://hermes-agent.nousresearch.com)
— the same four slash commands, no reduced functionality.

## Constraint: Hermes plugins are Python, sandwich is 100% TypeScript/Node

Hermes's plugin system (`docs/developer-guide/plugins`) is a Python package —
`plugin.yaml` manifest + `__init__.py` exposing `register(ctx)`, which can call
`ctx.register_tool(...)`, `ctx.register_hook(...)`, `ctx.register_skill(name, path)`, etc.
Hermes's Skills system (`docs/user-guide/features/skills`) is `SKILL.md` + YAML
frontmatter, loaded on demand and invoked via `/skill-name` — architecturally close to
what sandwich already ships for pi/Claude Code.

The key realization: nothing about sandwich's actual pipeline logic needs to move to
Python. `ctx.register_skill(name, skill_md_path)` lets a plugin point Hermes at an
existing `SKILL.md` file directly — the same file pi and Claude Code already read. Hermes's
own agent still has shell/file tools and follows the same instructions (including running
`node --experimental-strip-types .../render.ts ...`) exactly like pi and Claude Code do
today. So a Hermes "plugin" here is pure glue: register four existing files, and inject
`SANDWICH_ROOT` once per session — the same two things `order/pi-extension/order.ts`
already does for pi, translated into Hermes's plugin API.

## Design

### File structure

One new top-level directory (a harness adapter spanning all four ingredients, unlike the
pi-extensions which are one per ingredient — Hermes plugins are discovered one-per-directory
under `~/.hermes/plugins/<name>/`, so "sandwich" is naturally a single plugin):

```
hermes-plugin/
├── plugin.yaml
├── __init__.py
└── plugin.selfcheck.py
```

No changes to any existing `SKILL.md`, `agents/*.md`, or `lib/*.ts` file. No new Python
dependency — stdlib only (`pathlib`).

### `plugin.yaml`

```yaml
name: sandwich
version: 0.2.0
description: Composable agent pipeline for software agencies — order, prep, status, wireframe
author: Etalas
provides_hooks:
  - pre_llm_call
```

`version` is kept in sync with the root `package.json`'s `version` field by hand (both are
low-frequency, human-edited values — no build step ties them together, same as sandwich has
no build step anywhere else).

### `__init__.py`

```python
from pathlib import Path

# hermes-plugin/__init__.py -> parent is the sandwich repo root
_REPO_ROOT = Path(__file__).resolve().parent.parent

SKILLS = {
    "order": _REPO_ROOT / "order" / "skills" / "order" / "SKILL.md",
    "prep": _REPO_ROOT / "prep" / "skills" / "prep" / "SKILL.md",
    "status": _REPO_ROOT / "prep" / "skills" / "status" / "SKILL.md",
    "wireframe": _REPO_ROOT / "wireframe" / "skills" / "wireframe" / "SKILL.md",
}


def register(ctx):
    for name, path in SKILLS.items():
        ctx.register_skill(name, path)
    ctx.register_hook("pre_llm_call", inject_sandwich_root)


def inject_sandwich_root(session_id, user_message, conversation_history, is_first_turn, model, platform):
    if not is_first_turn:
        return None
    return {"context": f"SANDWICH_ROOT={_REPO_ROOT}"}
```

This mirrors `order/pi-extension/order.ts` line for line: that file guards on
`event.systemPrompt.includes(MARKER)` to inject the root path exactly once; this uses
Hermes's own `is_first_turn` flag for the same one-time-per-session injection, which is
more direct than string-matching a marker.

### Installation

Since sandwich isn't published to PyPI, this follows Hermes's "user plugin" path rather
than the pip entry-point path: symlink the directory into place and enable it.

```bash
ln -s /path/to/sandwich/hermes-plugin ~/.hermes/plugins/sandwich
hermes plugins enable sandwich
```

A symlink (not a copy) so `git pull` on the sandwich repo keeps the installed plugin
current without a reinstall step — consistent with how the pi/Claude Code integrations
already work by referencing the repo in place rather than vendoring a copy.

### Testing

No live Hermes instance is available this session (confirmed with the user), so nothing
here can exercise Hermes's actual plugin loader or `ctx.register_skill`/`ctx.register_hook`
behavior. What we can verify without Hermes installed:

- `plugin.selfcheck.py` (plain `assert`, no test framework — mirrors the `*.selfcheck.ts`
  convention used everywhere else in this repo): asserts all four paths in `SKILLS` exist
  on disk, asserts `inject_sandwich_root` returns `None` when `is_first_turn=False` and
  returns `{"context": "SANDWICH_ROOT=..."}` (containing the repo root path) when
  `is_first_turn=True`.
- Manual: once the user has Hermes installed, symlink + enable the plugin, run `/order`,
  `/prep`, `/status`, `/wireframe` and confirm each loads and behaves like it does in
  Claude Code today.

### Known unverified assumptions (flag for the user to confirm once Hermes is installed)

Two things the docs don't state clearly enough to build around with certainty, isolated
entirely to `hermes-plugin/` — neither affects the shared `SKILL.md`/`agents/*.md` files:

1. **Frontmatter validation on `register_skill()`.** Hermes's docs describe a `≤60 char
   description` and mandatory semver `version` field for filesystem-discovered skills
   (`~/.hermes/skills/...`). It's not stated whether `ctx.register_skill()` enforces the
   same validation on a plugin-supplied path. Sandwich's existing `SKILL.md` descriptions
   run ~200+ characters (written for Claude Code's routing convention) and have no
   `version` field. If Hermes rejects them, the fix is additive — either a Hermes-specific
   frontmatter override file the plugin points to instead of the shared one, or trimmed
   frontmatter — not a rewrite of this design.
2. **Slash-invocation namespacing.** The docs show namespaced retrieval
   (`skill_view("my-plugin:my-skill")`) for plugin-registered skills but don't confirm
   whether the interactive slash command is bare (`/order`) or namespaced
   (`/sandwich:order`). This plan registers with the bare name (`"order"`, `"prep"`,
   `"status"`, `"wireframe"`) for maximum parity with pi/Claude Code; if Hermes namespaces
   it, that's a Hermes-side invocation detail — no code change needed here, just updated
   user-facing instructions for what to type.

## Out of scope

- Any change to `order/`, `prep/`, `wireframe/`, `registry/` pipeline logic, schemas, or
  `SKILL.md`/`agents/*.md` content — this plan only adds a new adapter directory.
- Publishing to PyPI / an entry-point plugin — not needed for a single user's local
  install; revisit only if sandwich needs broader Hermes-community distribution later.
- Hermes tool/hook types beyond `register_skill` and `pre_llm_call` (e.g.
  `register_command`, `register_cli_command`) — nothing in the current pi/Claude Code
  experience needs them.
