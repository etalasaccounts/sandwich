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


class _FakeCtx:
    def __init__(self):
        self.registered_skills = []
        self.registered_hooks = []

    def register_skill(self, name, path):
        self.registered_skills.append((name, path))

    def register_hook(self, event_name, callback):
        self.registered_hooks.append((event_name, callback))


def check_register_wires_skills_and_hook():
    ctx = _FakeCtx()
    plugin.register(ctx)
    assert set(ctx.registered_skills) == set(plugin.SKILLS.items())
    assert len(ctx.registered_skills) == 4
    assert len(ctx.registered_hooks) == 1
    assert ctx.registered_hooks[0][0] == "pre_llm_call"
    assert ctx.registered_hooks[0][1] is plugin.inject_sandwich_root


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


check("register() wires all four skills and the pre_llm_call hook", check_register_wires_skills_and_hook)
check("all four SKILL.md paths resolve to real files", check_skill_paths_exist)
check("inject_sandwich_root returns None on non-first turn", check_hook_skips_non_first_turn)
check("inject_sandwich_root injects SANDWICH_ROOT on first turn", check_hook_injects_root_on_first_turn)

print(f"\n{n} hermes-plugin checks passed.")
