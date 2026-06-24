# 🥪 Sandwich

A composable agent stack for a software agency. Pick the ingredients you want —
some projects take the lettuce, some don't.

Each ingredient is a self-contained agent capability that installs across
harnesses (Pi, OpenClaw, Hermes, Claude Code) and proves its value on its own.
Ingredients compose through shared, git-backed artifacts in the project repo —
no ingredient depends on another being present.

## The menu

| Ingredient | Role | Status |
|---|---|---|
| [`breakdown/`](breakdown/) | **Plan** — client intake (any format) → standardized PRD → refined task breakdown, kept current as requirements evolve | ✅ built |
| [`next-ingredient/`](next-ingredient/) | placeholder — the next slice (Build / Review / QA / Handover…) | 🪧 reserved |

The `breakdown` ingredient already pairs with a Build slice: the `task` skill
loads a task from breakdown's registry and implements it. Plan → Build is the
first bite of the sandwich.

## Philosophy

- **Optional layers.** Assemble the sandwich a project needs; leave out what it
  doesn't.
- **Each slice ships standalone.** An ingredient must be useful alone before the
  next composes on top.
- **State lives with the project.** Ingredients read and write git-backed
  artifacts in the consuming repo, so any harness — or any teammate — picks up
  where the last left off.
- **No speculative layers.** Don't add an ingredient until there's real appetite
  for it.

## Installation

Each ingredient installs on its own — there is no umbrella-level install. Open the
ingredient's README and follow its **Installation** section:

- **Breakdown** → [`breakdown/README.md` § Installation](breakdown/README.md#installation)
  — prerequisites, then per-harness steps for Pi, OpenClaw, Hermes, and Claude Code.
- **next-ingredient** → placeholder, nothing to install yet.

## Working on an ingredient

Each ingredient is self-contained. To work on Breakdown:

```bash
cd breakdown
npm install
npm test
```

See [`breakdown/README.md`](breakdown/README.md) for its layout, pipeline, and modes.
