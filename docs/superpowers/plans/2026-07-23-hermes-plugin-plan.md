# Hermes Agent Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sandwich's four skills (`/order`, `/prep`, `/status`, `/wireframe`) available
in Hermes Agent, with the same install-and-go experience they already have in pi and Claude
Code.

**Architecture:** A single new top-level directory, `hermes-plugin/`, holds a minimal
Python plugin (`plugin.yaml` + `__init__.py`) that registers the four existing `SKILL.md`
files via Hermes's `ctx.register_skill(name, path)` API and injects a
`SANDWICH_ROOT=<repo-root>` line into context once per session via a `pre_llm_call` hook —
the same two things `order/pi-extension/order.ts` already does for pi. No pipeline logic
moves to Python; no existing `SKILL.md`/`agents/*.md`/`lib/*.ts` file changes.

**Tech Stack:** Python 3 stdlib only (`pathlib`, `importlib.util` for the self-check) — no
new dependency, no build step, matching the rest of the repo's zero-build-step convention.

## Global Constraints

- Do not modify any file under `order/`, `prep/`, `wireframe/`, `registry/` — this plan is
  additive only (new `hermes-plugin/` directory, README addition).
- No new Python dependency — stdlib only.
- `hermes-plugin/__init__.py` must not import anything under a package name containing a
  hyphen (`hermes-plugin` is not a valid Python import path) — the self-check loads it via
  `importlib.util.spec_from_file_location`, not a normal `import` statement.
- Design reference: `docs/superpowers/specs/2026-07-23-hermes-plugin-design.md`. Two
  assumptions in that spec are explicitly unverified (Hermes frontmatter validation on
  `register_skill()`, and whether slash invocation is namespaced) — this plan does not
  resolve them; it builds to the documented API and flags them in the README for the user
  to confirm once Hermes is actually installed.

---

### Task 1: Scaffold the Hermes plugin

**Files:**
- Create: `hermes-plugin/plugin.yaml`
- Create: `hermes-plugin/__init__.py`
- Create: `hermes-plugin/plugin.selfcheck.py`
- Modify: `package.json:19` (the `test` script)

**Interfaces:**
- Produces: `SKILLS: dict[str, Path]` (module-level dict in `__init__.py`, keys `"order"`,
  `"prep"`, `"status"`, `"wireframe"`) and
  `inject_sandwich_root(session_id, user_message, conversation_history, is_first_turn,
  model, platform) -> dict | None` — both are what `plugin.selfcheck.py` imports and
  exercises directly.

- [ ] **Step 1: Write the failing self-check**

Create `hermes-plugin/plugin.selfcheck.py`:

```python
#!/usr/bin/env python3
# Self-check for the Hermes plugin glue.
# Run: python3 hermes-plugin/plugin.selfcheck.py
# Plain asserts, no framework. Exits non-zero on first failure.
import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location("hermes_plugin", Path(__file__).parent / "__init__.py")
plugin = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(plugin)

n = 0


def check(name, fn):
    global n
    fn()
    n += 1
    print(f"  ✓ {name}")


def check_skill_paths_exist():
    assert set(plugin.SKILLS.keys()) == {"order", "prep", "status", "wireframe"}
    for name, path in plugin.SKILLS.items():
        assert path.exists(), f"{name} -> {path} does not exist"
        assert path.name == "SKILL.md", f"{name} -> {path} is not a SKILL.md"


def check_hook_skips_non_first_turn():
    result = plugin.inject_sandwich_root(
        session_id="s1", user_message="hi", conversation_history=[],
        is_first_turn=False, model="m", platform="p",
    )
    assert result is None


def check_hook_injects_root_on_first_turn():
    result = plugin.inject_sandwich_root(
        session_id="s1", user_message="hi", conversation_history=[],
        is_first_turn=True, model="m", platform="p",
    )
    assert result is not None
    assert "context" in result
    assert result["context"].startswith("SANDWICH_ROOT=")
    assert str(plugin._REPO_ROOT) in result["context"]


check("all four SKILL.md paths resolve to real files", check_skill_paths_exist)
check("inject_sandwich_root returns None on non-first turn", check_hook_skips_non_first_turn)
check("inject_sandwich_root injects SANDWICH_ROOT on first turn", check_hook_injects_root_on_first_turn)

print(f"\n{n} hermes-plugin checks passed.")
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `python3 hermes-plugin/plugin.selfcheck.py`
Expected: FAIL — `hermes-plugin/__init__.py` doesn't exist yet, so
`_spec.loader.exec_module(plugin)` raises `FileNotFoundError` (or `_spec` itself is `None`
and the next line raises `AttributeError`).

- [ ] **Step 3: Write `hermes-plugin/__init__.py`**

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

- [ ] **Step 4: Run the self-check to confirm it passes**

Run: `python3 hermes-plugin/plugin.selfcheck.py`
Expected:
```
  ✓ all four SKILL.md paths resolve to real files
  ✓ inject_sandwich_root returns None on non-first turn
  ✓ inject_sandwich_root injects SANDWICH_ROOT on first turn

3 hermes-plugin checks passed.
```

- [ ] **Step 5: Write `hermes-plugin/plugin.yaml`**

```yaml
name: sandwich
version: 0.2.0
description: Composable agent pipeline for software agencies — order, prep, status, wireframe
author: Etalas
provides_hooks:
  - pre_llm_call
```

(`version` matches the root `package.json`'s current `"version": "0.2.0"` — both are
hand-edited, low-frequency values with no build step tying them together, same as
everywhere else in this repo.)

- [ ] **Step 6: Add the Python self-check to the repo's test script**

In `package.json`, change the `test` script (line 19) from:
```json
    "test": "node --experimental-strip-types prep/lib/validation.selfcheck.ts && node --experimental-strip-types prep/lib/spec.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types order/lib/validation.selfcheck.ts && node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts"
```
to:
```json
    "test": "node --experimental-strip-types prep/lib/validation.selfcheck.ts && node --experimental-strip-types prep/lib/spec.selfcheck.ts && node --experimental-strip-types registry/registry.selfcheck.ts && node --experimental-strip-types order/lib/validation.selfcheck.ts && node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts && python3 hermes-plugin/plugin.selfcheck.py"
```

- [ ] **Step 7: Run the full repo test suite**

Run: `npm test`
Expected: all six self-check files print their `N checks passed.` line, including the new
`3 hermes-plugin checks passed.`

- [ ] **Step 8: Commit**

```bash
git add hermes-plugin/ package.json
git commit -m "$(cat <<'EOF'
feat: add a minimal Hermes Agent plugin

Registers the existing order/prep/status/wireframe SKILL.md files via
Hermes's ctx.register_skill() and injects SANDWICH_ROOT via a
pre_llm_call hook — the same two things order/pi-extension/order.ts
already does for pi. No pipeline logic moves to Python; the shared
SKILL.md/agents pipeline is untouched.
EOF
)"
```

---

### Task 2: Document Hermes installation in the README

**Files:**
- Modify: `README.md:11-28` (the `## Install` section)

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add a Hermes install block**

In `README.md`, change:
```markdown
## Install

**Pi:**
```bash
\pi install https://github.com/etalasaccounts/sandwich.git
```

**Claude Code:**
```bash
# Step 1: register the sandwich marketplace
claude plugin marketplace add etalasaccounts/sandwich

# Step 2: install
claude plugin install sandwich
```

After installing, restart your AI session so the skills are discovered.
```
to:
```markdown
## Install

**Pi:**
```bash
\pi install https://github.com/etalasaccounts/sandwich.git
```

**Claude Code:**
```bash
# Step 1: register the sandwich marketplace
claude plugin marketplace add etalasaccounts/sandwich

# Step 2: install
claude plugin install sandwich
```

**Hermes Agent:**
```bash
git clone https://github.com/etalasaccounts/sandwich.git
ln -s "$(pwd)/sandwich/hermes-plugin" ~/.hermes/plugins/sandwich
hermes plugins enable sandwich
```

After installing, restart your AI session so the skills are discovered.

> Hermes support is new and untested against a live install — if `/order` (or any of the
> four commands) doesn't show up after enabling the plugin, check
> `HERMES_PLUGINS_DEBUG=1 hermes plugins list` for why, and check whether Hermes needs the
> namespaced form (`/sandwich:order`) instead of the bare command shown below.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Hermes Agent install instructions"
```

---

### Task 3: Manual verification (deferred — requires a live Hermes install)

**Files:** none (verification only)

This task cannot run this session — confirmed with the user that no Hermes install is
available. Leave it as a checklist for whenever the user installs Hermes:

- [ ] **Step 1: Install and enable the plugin**

Follow the README's Hermes install block. Confirm `hermes plugins list` shows `sandwich`
as enabled (or run `HERMES_PLUGINS_DEBUG=1 hermes plugins list` if it doesn't appear, and
check for the discovery issues listed in the Hermes plugin docs — not enabled, wrong
directory depth, missing `__init__.py`/`register()`, missing/malformed `plugin.yaml`).

- [ ] **Step 2: Confirm the four skills load**

Try `/order`, `/prep`, `/status`, `/wireframe` (and, if bare names don't resolve, the
namespaced form `/sandwich:order` etc. — this is exactly the unverified assumption flagged
in the design spec). Confirm each one's behavior matches what the user already gets in
Claude Code.

- [ ] **Step 3: Confirm `SANDWICH_ROOT` injection**

Run `/order` in a fresh session and confirm the skill can find and execute
`node --experimental-strip-types $SANDWICH_ROOT/order/scripts/render.ts <kind>` — i.e. that
the `pre_llm_call` hook actually delivered a usable `SANDWICH_ROOT` value into context on
the first turn.

- [ ] **Step 4: Report back**

If anything is off (frontmatter rejected, namespacing required, hook not firing as
expected), that's the point where `hermes-plugin/` gets a follow-up fix — report back with
what was observed rather than guessing at a fix blind.
