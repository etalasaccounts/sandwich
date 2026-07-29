# Tailwind v4 & Design System Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade design system to Tailwind v4, add token infrastructure via `@theme`, and enable project-level theme resolution.

**Architecture:** 
1. Replace Tailwind v3 CDN with v4 `@tailwindcss/browser` CDN script
2. Add `@theme` block in shared head defining design tokens as CSS variables
3. Update SKILL.md with Step 0 for theme resolution from project
4. Document theme pack structure (optional, for projects that need custom themes)

**Tech Stack:** Tailwind CSS v4, CSS custom properties, Markdown docs

---

## Task 1: Research Tailwind v4 CDN syntax ✓

**Status: COMPLETE (research done inline)**

**Key findings:**

1. **CDN script URL**: Still `https://cdn.tailwindcss.com` (same as v3)
2. **@theme directive**: Supported in `<style type="text/tailwindcss">` blocks
3. **Class compatibility**: v3 utility classes work with v4 CDN
4. **Configuration**: CSS-first approach instead of `tailwind.config.js`

**v4 @theme syntax:**
```html
<style type="text/tailwindcss">
  @theme {
    --color-accent-primary: #4ade80;
    --color-accent-secondary: #22d3ee;
    --color-accent-warning: #f97316;
    --font-sans: 'Inter', sans-serif;
  }
</style>
```

**Action needed:** No code changes in Task 1 - research confirmed approach.

- [x] **Research complete** - proceed to Task 2

---

## Task 2: Add @theme token block to shared head

**Files:**
- Modify: `docs/design-system/foundations.md` (Shared HTML head section)

**Goal:** Define all design tokens in `@theme` block so CSS variables are auto-generated.

- [ ] **Step 1: Design the @theme block structure**

Map existing tokens from foundations.md:

```
Colors:
  - zinc-* (neutrals via @theme extends default)
  - green-400, green-300 (primary accent)
  - cyan-400 (secondary accent)
  - orange-500 (warning accent)

Font:
  - Inter 200/300/400/500

Radius scale:
  - 3xl (shell), 2xl (panels), xl (controls), full (pills)
```

- [ ] **Step 2: Write @theme block in foundations.md**

Update the "Shared HTML head" section in `docs/design-system/foundations.md`. Replace the current `<style>` block with:

```html
<style type="text/tailwindcss">
  @theme {
    /* Colors - zinc is built-in, only define accents */
    --color-accent-primary: #4ade80;      /* green-400 */
    --color-accent-primary-hover: #86efac; /* green-300 */
    --color-accent-secondary: #22d3ee;    /* cyan-400 */
    --color-accent-warning: #f97316;      /* orange-500 */
    
    /* Font family */
    --font-sans: 'Inter', sans-serif;
    
    /* Border radius scale */
    --radius-3xl: 1.5rem;
    --radius-2xl: 1rem;
    --radius-xl: 0.75rem;
    --radius-full: 9999px;
  }

  body { 
    font-family: var(--font-sans); 
  }
  
  iconify-icon { 
    stroke-width: 1.5; 
  }
  
  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
</style>
```

**Note:** v4 CDN still uses `<script src="https://cdn.tailwindcss.com"></script>` but now looks for `type="text/tailwindcss"` style blocks for `@theme`.

- [ ] **Step 3: Update the canonical shared head block**

The full shared head in `foundations.md` becomes:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAGE TITLE HERE</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<style type="text/tailwindcss">
  @theme {
    --color-accent-primary: #4ade80;
    --color-accent-primary-hover: #86efac;
    --color-accent-secondary: #22d3ee;
    --color-accent-warning: #f97316;
    --font-sans: 'Inter', sans-serif;
    --radius-3xl: 1.5rem;
    --radius-2xl: 1rem;
    --radius-xl: 0.75rem;
    --radius-full: 9999px;
  }
  body { font-family: var(--font-sans); }
  iconify-icon { stroke-width: 1.5; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
</style>
</head>
```

- [ ] **Step 4: Commit foundations update**

```bash
git add docs/design-system/foundations.md
git commit -m "feat(design-system): add @theme token block for Tailwind v4"
```

---

## Task 3: Update all pattern HTML files

**Files:**
- Modify: `docs/design-system/patterns/auth.html`
- Modify: `docs/design-system/patterns/blog-post-form.html`
- Modify: `docs/design-system/patterns/chat-interface.html`
- Modify: `docs/design-system/patterns/data-table.html`
- Modify: `docs/design-system/patterns/landing.html`
- Modify: `docs/design-system/patterns/mailbox.html`
- Modify: `docs/design-system/patterns/marketplace-grid.html`
- Modify: `docs/design-system/patterns/mobile.html`
- Modify: `docs/design-system/patterns/product-form.html`
- Modify: `docs/design-system/patterns/settings.html`

Each file needs the same head block replacement.

- [ ] **Step 1: Update auth.html**

Replace lines 1-23 (the `<head>` section) with the new canonical shared head from Task 2. Keep the `<title>Auth — login</title>` as-is.

- [ ] **Step 2: Update blog-post-form.html**

Replace head section, keep `<title>Blog post form</title>`.

- [ ] **Step 3: Update chat-interface.html**

Replace head section, keep `<title>Chat interface</title>`.

- [ ] **Step 4: Update data-table.html**

Replace head section, keep `<title>Data table</title>`.

- [ ] **Step 5: Update landing.html**

Replace head section, keep `<title>Landing page</title>`.

- [ ] **Step 6: Update mailbox.html**

Replace head section, keep `<title>Mailbox</title>`.

- [ ] **Step 7: Update marketplace-grid.html**

Replace head section, keep `<title>Marketplace grid</title>`.

- [ ] **Step 8: Update mobile.html**

Replace head section, keep `<title>Mobile</title>`.

- [ ] **Step 9: Update product-form.html**

Replace head section, keep `<title>Product form</title>`.

- [ ] **Step 10: Update settings.html**

Replace head section, keep `<title>Settings</title>`.

- [ ] **Step 11: Commit all pattern updates**

```bash
git add docs/design-system/patterns/*.html
git commit -m "feat(patterns): update all patterns with @theme token block"
```

---

## Task 4: Add Step 0 (theme resolution) to SKILL.md

**Files:**
- Modify: `design/skills/design/SKILL.md`

**Goal:** Before reading house design system, check if project has its own theme pack.

- [ ] **Step 1: Write Step 0 in SKILL.md**

Insert before "## Pipeline" section, or as first item in Pipeline:

```markdown
## Pipeline

0. **Resolve theme** — check for project-level design system:
   - Look for `$PROJECT_ROOT/docs/design-system/` (or `THEME_PATH` env if set)
   - If found and contains `foundations.md`, use that as the design system
   - If not found, use house design system at `$SANDWICH_ROOT/docs/design-system/`
   - Report which theme is active at the start of your response

1. **Read the rules** — ...
```

- [ ] **Step 2: Update the "Where the design system lives" section**

Change from:

```markdown
## Where the design system lives

`$SANDWICH_ROOT/docs/design-system/`. ...
```

To:

```markdown
## Where the design system lives

**House design system:** `$SANDWICH_ROOT/docs/design-system/`

**Project overrides:** If `$PROJECT_ROOT/docs/design-system/` exists with a `foundations.md`, that takes precedence. This allows projects to define their own color palette, fonts, and component styles while still following the structural patterns.

`SANDWICH_ROOT` and `PROJECT_ROOT` are injected into your context at session start. Read the paths from your context and substitute literally.
```

- [ ] **Step 3: Commit SKILL.md update**

```bash
git add design/skills/design/SKILL.md
git commit -m "feat(design-skill): add Step 0 for theme resolution"
```

---

## Task 5: Document theme pack structure (optional)

**Files:**
- Create: `docs/design-system/README.md` (append to existing)

**Goal:** Document how projects can create their own theme pack.

- [ ] **Step 1: Add "Project Theme Packs" section to README.md**

```markdown
## Project Theme Packs

Projects can override the house design system by creating their own `docs/design-system/` directory.

### Required files

```
docs/design-system/
├── foundations.md    # Colors, typography, layout rules
├── components.md     # Component recipes (optional, falls back to house)
└── patterns/         # Pattern files (optional, falls back to house)
```

### Minimal override

To customize just the color palette while keeping everything else:

```markdown
# foundations.md

Copy the house `foundations.md` and modify only:

## Color

### Accents

| Accent | Meaning | Text on top |
|---|---|---|
| `blue-500` | primary accent | `text-white` |
| `violet-400` | secondary | `text-zinc-950` |
| `amber-500` | warning | `text-zinc-950` |

Update the `@theme` block accordingly.
```

### Full override

If your project has significantly different design language (different font, different radius philosophy, different surface colors), copy all files and modify freely. The `/design` skill will use your project's files instead of the house defaults.
```

- [ ] **Step 2: Commit documentation**

```bash
git add docs/design-system/README.md
git commit -m "docs(design-system): document project theme pack structure"
```

---

## Task 6: Visual verification

**Files:**
- None (browser testing)

- [ ] **Step 1: Open each pattern in browser**

Open `docs/design-system/patterns/*.html` files directly in browser (file:// protocol). CDN-based Tailwind works without a server.

Verify:
- All colors render correctly
- Inter font loads
- Icons display
- Layouts match expected structure
- No console errors

- [ ] **Step 2: Test CSS variable usage**

In browser DevTools, verify CSS variables are set:
```js
getComputedStyle(document.documentElement).getPropertyValue('--color-accent-primary')
// Should return: #4ade80
```

- [ ] **Step 3: Document any issues**

If v4 CDN has breaking changes with v3 class syntax, document and adjust `@theme` block accordingly.

---

## Summary

| Task | Description | Effort |
|------|-------------|--------|
| 1 | Research v4 CDN compatibility | Small |
| 2 | Add @theme token block to foundations | Medium |
| 3 | Update 10 pattern HTML files | Medium (repetitive) |
| 4 | Add Step 0 to SKILL.md | Small |
| 5 | Document theme pack structure | Small |
| 6 | Visual verification | Small |

**Total estimated effort:** 2-3 hours

**Dependencies:** Tasks 2-3 depend on Task 1 research. Tasks 4-5 are independent and can run in parallel.

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-07-28-tailwind-v4-design-system-upgrade.md`.**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
