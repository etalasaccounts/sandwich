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
