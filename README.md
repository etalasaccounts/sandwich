<div align="center">

<pre>
 .--------------------------.
 |     S A N D W I C H      |
 |--------------------------|
 |  >  breakdown    · plan  |
 |  >  next-layer   · soon  |
 '--------------------------'
</pre>

# 🥪 Sandwich

**A composable agent stack for software agencies — pick the ingredients you want.**

</div>

---

Each ingredient is a self-contained agent capability that installs across harnesses
(Pi, OpenClaw, Hermes, Claude Code) and earns its place on its own. Ingredients
compose through shared, git-backed artifacts in the project repo — no ingredient
depends on another being present. Some projects take the lettuce, some don't.

## 🧾 The menu

| Ingredient | Role | Status |
| :--- | :--- | :---: |
| [**breakdown**](breakdown/) | **Plan** — client intake (any format) → standardized PRD → refined task breakdown, kept current as requirements evolve | ✅ built |
| [next-ingredient](next-ingredient/) | the next slice — Build · Review · QA · Handover … | 🪧 reserved |

> **breakdown** already pairs with a Build slice: the `task` skill loads a task from
> breakdown's registry and implements it. **Plan → Build** is the first bite.

## 🥬 Philosophy

- **Optional layers** — assemble the sandwich a project needs; leave out the rest.
- **Each slice ships standalone** — an ingredient must be useful alone before the next composes on top.
- **State lives with the project** — ingredients read and write git-backed artifacts in the consuming repo, so any harness (or teammate) picks up where the last left off.
- **No speculative layers** — don't add an ingredient until there's real appetite for it.

## 📦 Installation

There is no umbrella-level install — each ingredient installs on its own. Open the
ingredient and follow its **Installation** section:

- **breakdown** → [`breakdown/README.md` › Installation](breakdown/README.md#installation) — prerequisites, then per-harness steps for Pi, OpenClaw, Hermes, and Claude Code.
- **next-ingredient** → placeholder, nothing to install yet.

## 🛠️ Working on an ingredient

Each ingredient is self-contained:

```bash
cd breakdown
npm install
npm test
```

See [`breakdown/README.md`](breakdown/README.md) for its layout, pipeline, and modes.
