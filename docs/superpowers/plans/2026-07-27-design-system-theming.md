# Design-System Theming (Brand Packs + Semantic Tokens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tokenize the house design system so client brand packs (colors, fonts, radii) and runtime `data-theme` switching work, while house-default rendering stays visually identical to today.

**Architecture:** A closed set of 27 semantic color slots (plus font/weight/radius variables) defined as CSS custom properties; Tailwind v4 browser build maps them to utilities via `@theme inline`; brand packs are plain-CSS files overriding slot variables under `[data-theme="name"]`. Exemplars (`components.md`, `patterns/*.html`) get a one-time mechanical rename from raw palette classes to semantic classes.

**Tech Stack:** Tailwind CSS v4 (`@tailwindcss/browser@4` CDN build), plain HTML exemplars, iconify (unchanged), Playwright CLI for screenshot verification.

**Spec:** `docs/superpowers/specs/2026-07-27-design-system-theming-design.md` — read it before starting. The spec is authoritative on intent; this plan is authoritative on mechanics.

## Global Constraints

- All paths relative to repo root `sandwich/`. Design system lives in `docs/design-system/`.
- House slot values are **Tailwind v3 hex values** (what `cdn.tailwindcss.com` renders today), NOT v4 oklch. Hexes: zinc-50 `#fafafa`, zinc-100 `#f4f4f5`, zinc-200 `#e4e4e7`, zinc-300 `#d4d4d8`, zinc-400 `#a1a1aa`, zinc-500 `#71717a`, zinc-600 `#52525b`, zinc-700 `#3f3f46`, zinc-800 `#27272a`, zinc-900 `#18181b`, zinc-950 `#09090b`, white `#ffffff`, green-300 `#86efac`, green-400 `#4ade80`, cyan-400 `#22d3ee`, orange-500 `#f97316`.
- After migration, **no raw palette class may remain** in any design-system file. Gate (run per file; expect empty output):
  `grep -nE '(bg|text|border|placeholder|ring|divide|from|via|to)-(zinc|slate|gray|neutral|stone|green|cyan|orange|red|blue|white|black)\b' <file>` and `grep -nE '(bg|text)-white' <file>`
- Never inline a hex color into exemplar markup. Hexes live only in the canonical `:root` block and brand packs.
- Do NOT change layout classes, spacing, icons, copy, or structure — this migration renames colors and swaps heads only.
- Commit after every task with the given message; end every commit message with:
  `Co-Authored-By: Claude <noreply@anthropic.com>`

### The Rename Map (used by Tasks 3–7)

**Context rule — decide per element:**
- **Inverse context:** the element has, or is inside an ancestor that has, one of `bg-zinc-950`, `bg-zinc-900`, `bg-zinc-800` (pre-rename). This covers: sidebars, stat bands, mobile bottom navs, dark pricing cards, and dark buttons (e.g. the `bg-zinc-950 text-zinc-50 hover:bg-zinc-800` primary button — its own dark bg makes it inverse context).
- **Accent context:** the element has, or is inside, `bg-green-400` / `bg-cyan-400` / `bg-orange-500` (accent-filled dots, badges, avatars, the one landing CTA).
- **Base context:** everything else (light surfaces).

**Any-context mappings** (prefix `bg-`/`hover:bg-` etc., opacity suffixes like `/50` `/80` are preserved verbatim):

| Original | New |
|---|---|
| `bg-white` | `bg-panel` |
| `bg-zinc-50` | `bg-panel-2` |
| `bg-zinc-100` | `bg-page` |
| `bg-zinc-200` | `bg-control` |
| `bg-zinc-300` | `bg-line-2` |
| `bg-zinc-800` | `bg-inverse-3` |
| `bg-zinc-900` | `bg-inverse-2` |
| `bg-zinc-950` | `bg-inverse` |
| `hover:bg-zinc-700` | `hover:bg-inverse-4` |
| `bg-green-400` | `bg-accent` |
| `hover:bg-green-300` | `hover:bg-accent-hover` |
| `bg-cyan-400` | `bg-info` |
| `bg-orange-500` | `bg-warn` |
| `text-green-400` | `text-accent` |
| `text-cyan-400` | `text-info` |
| `text-orange-500` | `text-warn` |
| `border-zinc-100` | `border-line` |
| `border-zinc-300` | `border-line-2` |
| `border-zinc-950` | `border-ink` |

**Placeholder colors** (all contexts): Tailwind v4 dropped the `placeholder-{color}` utility for the `placeholder:` variant. Map `placeholder-zinc-400` → `placeholder:text-ink-3` (base context) / `placeholder:text-inverse-ink-2` (inverse context); `placeholder-zinc-500` → `placeholder:text-ink-2` (base) / `placeholder:text-inverse-ink-3` (inverse). If a placeholder looks slightly different from the baseline afterward, that is this syntax correction, not a bug — note it in the commit message.

**Base-context text** (also applies to `hover:text-` prefixes):

| Original | New | Note |
|---|---|---|
| `text-zinc-950` | `text-ink` | |
| `text-zinc-900` | `text-ink` | deliberate normalization |
| `text-zinc-700` | `text-ink-mid` | |
| `text-zinc-600` | `text-ink-2` | deliberate normalization |
| `text-zinc-500` | `text-ink-2` | |
| `text-zinc-400` | `text-ink-3` | |
| `text-zinc-300` | `text-ink-faint` | |

**Inverse-context text:**

| Original | New | Note |
|---|---|---|
| `text-zinc-50` | `text-inverse-ink` | |
| `text-zinc-100` | `text-inverse-ink` | deliberate normalization |
| `text-white` | `text-inverse-ink` | normalization, decorative white on dark |
| `text-zinc-300` | `text-inverse-ink-mid` | |
| `text-zinc-400` | `text-inverse-ink-2` | |
| `text-zinc-500` | `text-inverse-ink-3` | |
| `text-zinc-600` | `text-inverse-label` | |

**Accent-context text** (text sitting ON an accent fill):

| Original | New |
|---|---|
| `text-zinc-950` on `bg-accent` | `text-on-accent` |
| `text-zinc-950` on `bg-info` | `text-on-info` |
| `text-white` on `bg-warn` | `text-on-warn` |

**Known oddity:** one occurrence of a malformed `text-zinc-600/` (trailing slash) exists somewhere in the files. When you hit it, inspect the element, fix it to the correct mapped class (with a real opacity suffix only if one was clearly intended), and mention it in that task's commit message.

**If you meet a (class, context) pair not in this map: STOP.** Do not guess. Map it to the slot whose house hex is nearest, add a row to this table in the plan file, note it in the commit message.

---

### Task 1: Baseline screenshots (pre-migration)

**Files:**
- Modify: `.gitignore` (add one line)
- Create (not committed): `.baselines/*.png`

**Interfaces:**
- Produces: `.baselines/<name>-before.png` for all six patterns; Tasks 5–7 compare against these.

- [ ] **Step 1: Gitignore the baselines dir**

Append the line `.baselines/` to `.gitignore` (create the file if missing).

- [ ] **Step 2: Install Playwright chromium**

Run: `npx -y playwright install chromium`
Expected: exits 0 (may download ~120MB on first run).

- [ ] **Step 3: Capture the six baselines**

```bash
mkdir -p .baselines
for f in auth dashboard data-table landing mobile settings; do
  npx -y playwright screenshot --viewport-size=1600,1000 --wait-for-timeout=3000 \
    "file://$PWD/docs/design-system/patterns/$f.html" ".baselines/$f-before.png"
done
```
Expected: six PNGs exist. Open (Read) `dashboard-before.png` and confirm it shows a rendered dashboard (dark sidebar, light content), not a blank page. `--wait-for-timeout=3000` matters — the Tailwind CDN compiles at runtime.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore .baselines for theming migration"
```

---

### Task 2: Canonical token block, `theming.md`, and v4 mechanics verification

**Files:**
- Create: `docs/design-system/theming.md`
- Create (not committed): `.baselines/token-test.html`

**Interfaces:**
- Produces: the canonical shared head (below) that Tasks 3 and 5–7 copy verbatim; the slot documentation Tasks 8–9 reference.

- [ ] **Step 1: Write the canonical shared head**

This exact block is the new "Shared HTML head". Only `<title>` may differ per page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAGE TITLE HERE</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<style type="text/tailwindcss">
@theme inline {
  --color-*: initial;
  --color-page: var(--page);
  --color-panel: var(--panel);
  --color-panel-2: var(--panel-2);
  --color-control: var(--control);
  --color-line: var(--line);
  --color-line-2: var(--line-2);
  --color-ink: var(--ink);
  --color-ink-mid: var(--ink-mid);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-ink-faint: var(--ink-faint);
  --color-inverse: var(--inverse);
  --color-inverse-2: var(--inverse-2);
  --color-inverse-3: var(--inverse-3);
  --color-inverse-4: var(--inverse-4);
  --color-inverse-ink: var(--inverse-ink);
  --color-inverse-ink-mid: var(--inverse-ink-mid);
  --color-inverse-ink-2: var(--inverse-ink-2);
  --color-inverse-ink-3: var(--inverse-ink-3);
  --color-inverse-label: var(--inverse-label);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-on-accent: var(--on-accent);
  --color-info: var(--info);
  --color-on-info: var(--on-info);
  --color-warn: var(--warn);
  --color-on-warn: var(--on-warn);
}
:root {
  --page: #f4f4f5;
  --panel: #ffffff;
  --panel-2: #fafafa;
  --control: #e4e4e7;
  --line: #f4f4f5;
  --line-2: #d4d4d8;
  --ink: #09090b;
  --ink-mid: #3f3f46;
  --ink-2: #71717a;
  --ink-3: #a1a1aa;
  --ink-faint: #d4d4d8;
  --inverse: #09090b;
  --inverse-2: #18181b;
  --inverse-3: #27272a;
  --inverse-4: #3f3f46;
  --inverse-ink: #fafafa;
  --inverse-ink-mid: #d4d4d8;
  --inverse-ink-2: #a1a1aa;
  --inverse-ink-3: #71717a;
  --inverse-label: #52525b;
  --accent: #4ade80;
  --accent-hover: #86efac;
  --on-accent: #09090b;
  --info: #22d3ee;
  --on-info: #09090b;
  --warn: #f97316;
  --on-warn: #ffffff;
  --font-sans: 'Inter', sans-serif;
}
body { font-family: var(--font-sans); }
iconify-icon { stroke-width: 1.5; }
/* Custom Scrollbar for a cleaner look */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--control); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--line-2); }
</style></head>
```

- [ ] **Step 2: Build the verification page**

Write `.baselines/token-test.html`: the canonical head above (title "Token test") plus this body:

```html
<body class="bg-page p-8 text-sm antialiased text-ink" data-note="toggle data-theme on html to test">
  <div class="bg-panel rounded-2xl p-6 shadow-sm max-w-md flex flex-col gap-3">
    <p id="t1" class="text-ink font-medium">ink / weight-500</p>
    <p id="t2" class="text-ink-2 font-light">ink-2 / weight-300</p>
    <p id="t3" class="text-ink-3 font-extralight text-3xl tracking-tight">ink-3 / weight-200</p>
    <div class="bg-inverse rounded-2xl p-4">
      <p class="text-inverse-ink">inverse-ink on inverse</p>
      <p class="text-inverse-label text-xs uppercase tracking-widest">inverse-label</p>
    </div>
    <div class="flex gap-2 items-center">
      <span class="w-2 h-2 rounded-full bg-accent"></span>
      <span class="text-accent">accent</span>
      <span class="bg-info text-on-info rounded-full px-2 text-xs">info</span>
      <span class="bg-warn text-on-warn rounded-full px-2 text-xs">warn</span>
    </div>
    <div class="bg-panel-2/80 border border-line rounded-xl p-3">opacity + border</div>
    <div class="bg-zinc-900 text-zinc-100 p-2">WIPE CHECK: this must be UNSTYLED (transparent bg, inherited text)</div>
  </div>
  <style>
    [data-theme="probe"] {
      --accent: #6366f1; --page: #eef2ff; --font-sans: Georgia, serif;
      --radius-2xl: 0.25rem; --font-weight-extralight: 600;
    }
  </style>
</body>
</html>
```

- [ ] **Step 3: Screenshot house rendering**

Run: `npx -y playwright screenshot --viewport-size=800,900 --wait-for-timeout=3000 "file://$PWD/.baselines/token-test.html" .baselines/token-test-house.png`
Read the PNG and verify: colors match the house look (zinc-ish panel on light page, green dot, cyan/orange chips), opacity panel renders, and the WIPE CHECK row has **no** dark background (palette wipe works).

- [ ] **Step 4: Screenshot themed rendering**

Edit `.baselines/token-test.html`: change `<html lang="en">` to `<html lang="en" data-theme="probe">`. Re-run the screenshot to `.baselines/token-test-probe.png`. Read it and verify ALL of: page background is indigo-tinted, dot/accent text is indigo, font is a serif, the card corners are visibly squarer (`--radius-2xl` override reached `rounded-2xl`), and the weight-200 line renders bold-ish (`--font-weight-extralight` override reached `font-extralight`).
**If radius or weight overrides did NOT take effect:** v4 inlined those utilities; fix by adding `--radius-*` / `--font-weight-*` mappings to the `@theme inline` block the same way colors are mapped (e.g. `--radius-2xl: var(--r-2xl);` with `--r-2xl` set in `:root` and packs), update the canonical head + spec accordingly, and note it in the commit message. Then revert the `data-theme` attribute change.

- [ ] **Step 5: Write `docs/design-system/theming.md`**

Contents, in this order:
1. **Intro** (2–3 sentences): identity lives in slots; house is the default; packs override; structure never varies per brand.
2. **Slot reference table**: all 27 color slots (copy from the spec's Token vocabulary table, adding the house hex for each) plus bucket-2 variables `--font-sans`, `--font-weight-extralight/light/normal/medium`, `--radius-3xl/2xl/xl` with house values (200/300/400/500; 1.5rem/1rem/0.75rem).
3. **Canonical shared head**: the full block from Step 1, verbatim, in a fenced code block.
4. **Brand pack authoring guide**: one `.css` file at `design/themes/<name>.css` in the consuming project; exactly one `[data-theme="<name>"]` block; only known variables allowed; partial packs valid (cascade falls back to house); font changes carry their own `@import` on line 1; full example pack:

```css
/* design/themes/acme.css — Acme brand pack */
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap');
[data-theme="acme"] {
  --accent: #6366f1;
  --on-accent: #ffffff;
  --inverse: #0a1628;
  --inverse-2: #12203a;
  --inverse-3: #1b2d4e;
  --font-sans: 'Sora', sans-serif;
  --font-weight-extralight: 300;
  --font-weight-medium: 600;
  --radius-3xl: 1rem;
  --radius-2xl: 0.75rem;
  --radius-xl: 0.5rem;
}
```
5. **Resolution rules** (copy the three-rule list from the spec's Brand packs section) and **runtime switching** (load pack stylesheets after the token block; flip `data-theme` on `<html>`; no rebuild).
6. **Build-step stacks**: the `@theme inline` + `:root` CSS moves into `globals.css` (real Tailwind v4, not the browser build); pack files imported after it; `data-theme` set on the root element.

- [ ] **Step 6: Commit**

```bash
git add docs/design-system/theming.md
git commit -m "feat(design-system): add theming.md — 27 semantic slots, brand pack guide, canonical v4 head"
```

---

### Task 3: Migrate `foundations.md`

**Files:**
- Modify: `docs/design-system/foundations.md`

**Interfaces:**
- Consumes: canonical head from Task 2 (copy from `theming.md`).
- Produces: token-phrased rules that `components.md`/patterns must match; Tasks 4–8 rely on its tables.

- [ ] **Step 1: Rewrite the Color section**

Replace the three color tables using the Rename Map. The dark-surface table becomes the **Inverse stack** (`bg-inverse`, `bg-inverse-2`, `bg-inverse-3`, `text-inverse-ink`, `text-inverse-ink-2`, `text-inverse-ink-3`, `text-inverse-label`; hover `hover:bg-inverse-2/50`, `hover:bg-inverse-4`). The light-surface table becomes the **Base stack** (`bg-page`, `bg-panel`, `bg-panel-2` — cards often `bg-panel-2/80 border border-line` — `bg-control/50` hover `bg-control`, `border-line`/`border-line-2`, `text-ink`, `text-ink-mid`, `text-ink-2`, `text-ink-3`, `text-ink-faint`). The accents table becomes slot-named: `accent` (text on it: `text-on-accent`), `info` (`text-on-info`), `warn` (`text-on-warn`); dot example becomes `bg-accent`. Add one sentence after the tables: "Slot house values and brand overrides: see [`theming.md`](./theming.md)."

- [ ] **Step 2: Update rules phrased around raw classes**

- Typography table row "De-emphasized row text": `(+ lighter zinc)` → `(+ lighter ink shade)`. Emphasis sentence: "zinc-950 vs zinc-500" → "`ink` vs `ink-2`".
- App shell snippet: `bg-zinc-100` → `bg-page`, `text-zinc-900` → `text-ink`; sidebar snippet `bg-zinc-950` → `bg-inverse`; list panel `bg-zinc-50` → `bg-panel-2`; main `bg-white` → `bg-panel`.
- Icons section: default tints → `text-ink-3` / `text-ink-2` (base) and accent tint `text-accent`; icon example class `text-zinc-400` → `text-ink-3`.
- Documented exceptions: CTA recipe string becomes `bg-accent text-on-accent rounded-xl py-2.5 w-full text-xs font-medium tracking-wide hover:bg-accent-hover transition-colors`; "green-300 exists solely as that button's hover state" → "`accent-hover` exists solely as that button's hover state"; dots `bg-green-400` → `bg-accent`.
- Do/Don't table: "Zinc + the 3 accents" → "Slot colors only (`theming.md`)"; keep the Don't side.

- [ ] **Step 3: Replace the Shared HTML head section**

Swap the old head block for the canonical block from `theming.md` (keep the surrounding prose about six pattern files carrying it verbatim; update the build-step paragraph to point at `theming.md` §6).

- [ ] **Step 4: Run the gate**

Run both grep gates from Global Constraints against `docs/design-system/foundations.md`. Expected: empty. (`font-family: 'Inter'` in prose is fine; raw palette **classes** are not.)

- [ ] **Step 5: Commit**

```bash
git add docs/design-system/foundations.md
git commit -m "feat(design-system): retokenize foundations.md to semantic slots"
```

---

### Task 4: Migrate `components.md`

**Files:**
- Modify: `docs/design-system/components.md`

- [ ] **Step 1: Apply the Rename Map to every snippet and prose mention**

Work top to bottom, one component recipe at a time, applying the context rule per element (a dark button recipe is inverse context; a badge on `bg-accent` is accent context). Preserve every opacity suffix exactly.

- [ ] **Step 2: Run the gate**

Both grep gates against `docs/design-system/components.md`. Expected: empty.

- [ ] **Step 3: Spot-check three recipes**

Paste the migrated button-primary, a table row, and a badge recipe into a copy of `.baselines/token-test.html`'s body; screenshot; Read the PNG; confirm they look like the house style (dark zinc button, light row, small accent badge).

- [ ] **Step 4: Commit**

```bash
git add docs/design-system/components.md
git commit -m "feat(design-system): retokenize components.md recipes to semantic slots"
```

---

### Task 5: Migrate patterns — `auth.html` + `settings.html`

**Files:**
- Modify: `docs/design-system/patterns/auth.html`, `docs/design-system/patterns/settings.html`

- [ ] **Step 1: Swap heads**

Replace each file's `<head>` with the canonical head (from `theming.md`), keeping each file's original `<title>`.

- [ ] **Step 2: Apply the Rename Map to each body**

Use the context rule. Sidebars/stat bands (`bg-zinc-950/900/800` containers) are inverse context; everything on light panels is base context; accent-filled elements are accent context.

- [ ] **Step 3: Run the gate on both files**

Both grep gates per file. Expected: empty.

- [ ] **Step 4: Screenshot and compare with baseline**

```bash
for f in auth settings; do
  npx -y playwright screenshot --viewport-size=1600,1000 --wait-for-timeout=3000 \
    "file://$PWD/docs/design-system/patterns/$f.html" ".baselines/$f-after.png"
done
```
Read each `-after.png` next to its `-before.png`. They must match except the documented normalizations (near-invisible text-shade shifts). Layout shift, missing styling, or color-category change (e.g. a gray thing now transparent) = a wrong mapping; fix before proceeding.

- [ ] **Step 5: Commit**

```bash
git add docs/design-system/patterns/auth.html docs/design-system/patterns/settings.html
git commit -m "feat(design-system): retokenize auth + settings patterns"
```

---

### Task 6: Migrate patterns — `dashboard.html` + `data-table.html`

Same five steps as Task 5, for `dashboard.html` and `data-table.html`. These are the KPI-heavy files: expect stat bands (inverse context) embedded in light pages, `w-2 h-2` status dots (`bg-accent`), and the selected-row shadow `shadow-[0_1px_3px_rgba(0,0,0,0.02)]` (leave untouched — it is not a palette class).

- [ ] **Step 1: Swap heads** (canonical head from `theming.md`, keep each file's `<title>`)
- [ ] **Step 2: Apply the Rename Map** (context rule per element)
- [ ] **Step 3: Run the gate on both files** (both grep gates from Global Constraints; expect empty)
- [ ] **Step 4: Screenshot both, compare with `-before` baselines**

```bash
for f in dashboard data-table; do
  npx -y playwright screenshot --viewport-size=1600,1000 --wait-for-timeout=3000 \
    "file://$PWD/docs/design-system/patterns/$f.html" ".baselines/$f-after.png"
done
```
Read each `-after.png` next to its `-before.png`; only documented normalizations may differ.

- [ ] **Step 5: Commit**

```bash
git add docs/design-system/patterns/dashboard.html docs/design-system/patterns/data-table.html
git commit -m "feat(design-system): retokenize dashboard + data-table patterns"
```

---

### Task 7: Migrate patterns — `landing.html` + `mobile.html`

Same five steps as Task 5, for `landing.html` and `mobile.html`. Special cases here:
- `landing.html` dark pricing card: inverse context; its CTA is the one sanctioned accent fill → `bg-accent text-on-accent hover:bg-accent-hover`.
- `landing.html` dark stats band keeps `rounded-3xl` (documented exception).
- `mobile.html` bottom nav is inverse context; inline unread dots are `w-1.5 h-1.5 ... bg-accent`.

- [ ] **Step 1: Swap heads** (canonical head from `theming.md`, keep each file's `<title>`)
- [ ] **Step 2: Apply the Rename Map** (context rule per element)
- [ ] **Step 3: Run the gate on both files** (both grep gates from Global Constraints; expect empty)
- [ ] **Step 4: Screenshot both, compare with `-before` baselines**

```bash
for f in landing mobile; do
  npx -y playwright screenshot --viewport-size=1600,1000 --wait-for-timeout=3000 \
    "file://$PWD/docs/design-system/patterns/$f.html" ".baselines/$f-after.png"
done
npx -y playwright screenshot --viewport-size=430,900 --wait-for-timeout=3000 \
  "file://$PWD/docs/design-system/patterns/mobile.html" ".baselines/mobile-narrow-after.png"
```
Read each `-after.png` next to its `-before.png` (mobile-narrow is eyeball-only — no baseline); only documented normalizations may differ.

- [ ] **Step 5: Commit**

```bash
git add docs/design-system/patterns/landing.html docs/design-system/patterns/mobile.html
git commit -m "feat(design-system): retokenize landing + mobile patterns"
```

---

### Task 8: Rewrite `README.md` hard rules in token terms

**Files:**
- Modify: `docs/design-system/README.md`

- [ ] **Step 1: Replace the Hard rules list**

New text for rules 1–8 (keep numbering and the surrounding doc structure):

1. Font comes from the `--font-sans` slot (house: **Inter**), weights are the four slots 200/300/400/500. Never semibold or bold classes.
2. Colors come **only from the 27 semantic slots** (see [`theming.md`](./theming.md)). House neutrals are zinc-valued; accents are `accent` (primary/active/success), `info`, `warn`. Raw palette classes (`bg-zinc-*`, `text-green-400`, …) no longer exist — the default palette is wiped.
3. Accents appear only as **small elements** — dots, count badges, avatar fills, icon tints. Never large fills, never gradients, never accent body text. Carve-outs: [`foundations.md` § Documented exceptions](./foundations.md#documented-exceptions).
4. Icons are **Solar linear** (`solar:*-linear`) via iconify. No lucide, no tabler, no emoji.
5. Radius scale is the three slots: `rounded-3xl` app shell (and full-width marketing bands) / `rounded-2xl` panels and cards / `rounded-xl` controls / `rounded-full` pills, icon buttons, avatars, dots.
6. `shadow-sm` is the heaviest shadow. `transition-colors` is the only motion (plus `animate-pulse` for skeletons).
7. Inverse surfaces separate by background shade (`inverse` → `inverse-2` → `inverse-3`), never borders. Base surfaces may use `border-line`.
8. When in doubt, **copy a snippet from `components.md` or a section from `patterns/`** — never invent a new style.

- [ ] **Step 2: Update "Adapting to a stack" and the read-me table**

Replace the v3-CDN bullet content with: plain HTML copies the canonical head from `foundations.md` (unchanged pointer); add a row/line pointing brand-pack questions to `theming.md`. Update the closing sentence "stock zinc/green/cyan/orange utilities" → "semantic slot utilities defined in the canonical token block".

- [ ] **Step 3: Run the gate** on `README.md` — expected output: ONLY the matches inside rule 2's illustrative mentions of forbidden classes (`bg-zinc-*`, `text-green-400`); anything else is a real miss. Then **commit**

```bash
git add docs/design-system/README.md
git commit -m "feat(design-system): restate hard rules in token terms"
```

---

### Task 9: Update the `/design` skill

**Files:**
- Modify: `design/skills/design/SKILL.md`

- [ ] **Step 1: Update frontmatter description**

Replace the parenthetical `(fixed identity: Inter 200–500, zinc neutrals + green/cyan/orange accents, Solar icons, rounded-2xl panels, dark sidebar + light content)` with `(house identity by default — Inter 200–500, zinc-valued neutrals + green/cyan/orange accents, Solar icons, rounded-2xl panels, dark sidebar + light content; projects override colors/font/radii via brand packs in design/themes/)`. Keep the rest of the description verbatim.

- [ ] **Step 2: Insert a new Pipeline step 0 (renumber existing 1–5 to 2–6, new step 1 below)**

```markdown
1. **Resolve the theme** — look for `design/themes/*.css` in the target
   project:
   - None → house identity; never set `data-theme`.
   - One pack → project default: set `data-theme="<name>"` on `<html>`
     (or the framework root) and ensure the pack stylesheet loads after
     the token block.
   - Several → the invocation may name one (`/design … --theme acme`);
     otherwise ask. Non-default packs remain runtime switch targets.
   Validate every pack you load: only variables from
   `$SANDWICH_ROOT/docs/design-system/theming.md`'s slot list may appear.
   Unknown variables or non-slot declarations (selectors beyond the one
   `[data-theme]` block, added shadows, etc.) → report the specific
   violations to the user and offer the house fallback; never silently
   drop or "fix" a pack.
```

- [ ] **Step 3: Update the read-the-rules step**

Add `theming.md` to the always-read list: "Read `$SANDWICH_ROOT/docs/design-system/README.md`, `foundations.md`, and `theming.md`, in full, every invocation."

- [ ] **Step 4: Update stack-detection step**

Plain HTML bullet: "copy the canonical shared head from `foundations.md`'s 'Shared HTML head' section (Tailwind v4 browser build + token block, Inter link, iconify script, scrollbar CSS)". React bullet: append "token block (`@theme inline` + `:root` slots) goes in `globals.css`; brand pack files are imported after it (see `theming.md` § build-step stacks)".

- [ ] **Step 5: Rewrite the self-check list**

Replace the color bullet with: "Only semantic slot utilities (`bg-panel`, `text-ink-2`, `bg-accent`, …) — never raw palette classes (they render unstyled: any visually unstyled element is a violation) and never inline hex values; accents only as dots, badges, avatar fills, icon tints (same CTA exception)." Add a final bullet: "If a pack is active, confirm `data-theme` is set and the pack file loads after the token block." Keep the weight/icon/radius/shadow bullets as they are.

- [ ] **Step 6: Update the Forbidden section**

Append to the existing list: "raw Tailwind palette classes (`*-zinc-*`, `*-green-400`, …) and inline hex colors in markup — colors enter only through slot variables".

- [ ] **Step 7: Commit**

```bash
git add design/skills/design/SKILL.md
git commit -m "feat(design): theme-aware /design skill — pack resolution step + token self-check"
```

---

### Task 10: End-to-end brand-pack test + cleanup

**Files:**
- Create (not committed): `.baselines/theme-e2e.html`, `.baselines/test-brand.css`

- [ ] **Step 1: Create a fixture pack**

Write `.baselines/test-brand.css` with exactly the example pack from `theming.md` (Task 2 Step 5.4), renaming `acme` → `test-brand` in the attribute selector and comment.

- [ ] **Step 2: Build the e2e page**

Copy `docs/design-system/patterns/dashboard.html` to `.baselines/theme-e2e.html`. In the copy only: add `<link rel="stylesheet" href="./test-brand.css">` immediately after the closing `</style>` of the token block, and set `data-theme="test-brand"` on `<html>`.

- [ ] **Step 3: Verify the switch, both directions**

Screenshot to `.baselines/theme-e2e-branded.png` (same playwright command pattern, 1600×1000, 3000ms wait). Read it and verify against `dashboard-after.png` from Task 6: sidebar is navy (not black), accent dots/badges are indigo, font is Sora (visibly different letterforms), corners are squarer. Then remove the `data-theme` attribute (keep the stylesheet link), re-screenshot to `.baselines/theme-e2e-house.png`, and verify it matches `dashboard-after.png` — proving an inert pack changes nothing until the attribute flips.

- [ ] **Step 4: Verify resolution behaviors are documented, then clean up**

Confirm `theming.md` § resolution matches SKILL.md step 1 (they were written in different tasks — fix any drift now). Then: `rm -rf .baselines` (baselines and fixtures are throwaway; the gitignore line stays).

- [ ] **Step 5: Final commit (if drift fixes were needed)**

```bash
git add -A docs/design-system design/skills/design
git commit -m "fix(design-system): align theming.md and SKILL.md resolution rules" # only if Step 4 changed files
```

---

## Post-plan checks (for the executor)

- `git log --oneline` shows one commit per task (≈9–10 commits).
- Full-tree gate: both grep commands from Global Constraints against `docs/design-system/**` return nothing — EXCEPT the illustrative forbidden-class mentions in `README.md` rule 2 and `SKILL.md`'s Forbidden section, which are allowed.
- `docs/design-system/theming.md` exists and is linked from `README.md`, `foundations.md`, and `SKILL.md`.

## Manual QA after implementation (human/tech-lead, not the executor)

The spec's skill-flow test needs real `/design` invocations, which this plan
cannot script: run `/design` in (a) a project with no `design/themes/`,
(b) one pack, (c) two packs, and confirm resolution rules 1–3 (house
fallback / auto-default / ask-or-`--theme`). Do this before calling the
feature shipped.
