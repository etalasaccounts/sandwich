# Craft Interactivity & CRUD Completeness

**Status:** Approved
**Date:** 2025-07-30

## Problem

The `/craft` skill generates static-looking screens where:
- Buttons are unclickable (no `onClick` or `<Link>`)
- No UI feedback (toast/sonner) on actions
- Detail screens are not generated
- Delete actions have no confirmation
- Row action menus ("..." buttons) are non-functional
- CRUD flows are incomplete (often only List, missing Create/Detail/Edit/Delete)

## Solution

Three-part enhancement:

1. **New components** in `components.md` for interaction patterns
2. **Detail screen pattern** in `patterns/detail.html`
3. **Updated SKILL.md** with mandatory interactivity and CRUD completeness checks

---

## Part 1: New Components

### toast

Bottom-right positioned notification, auto-dismisses after 4 seconds. Three variants:

```html
<!-- success -->
<div class="flex items-center gap-3 bg-zinc-950 rounded-xl py-3 px-4 shadow-lg">
  <iconify-icon icon="solar:check-circle-linear" class="text-green-400 text-base"></iconify-icon>
  <span class="text-sm font-light text-zinc-50">Message sent</span>
</div>

<!-- error -->
<div class="flex items-center gap-3 bg-zinc-950 rounded-xl py-3 px-4 shadow-lg">
  <iconify-icon icon="solar:danger-triangle-linear" class="text-orange-500 text-base"></iconify-icon>
  <span class="text-sm font-light text-zinc-50">Failed to save</span>
</div>

<!-- info -->
<div class="flex items-center gap-3 bg-zinc-950 rounded-xl py-3 px-4 shadow-lg">
  <iconify-icon icon="solar:info-circle-linear" class="text-cyan-400 text-base"></iconify-icon>
  <span class="text-sm font-light text-zinc-50">Copied to clipboard</span>
</div>
```

### dropdown-menu

Anchored to trigger button, with destructive item styling:

```html
<div class="relative">
  <button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
    <iconify-icon icon="solar:menu-dots-linear" class="text-base"></iconify-icon>
  </button>
  <div class="absolute right-0 top-full mt-1 bg-white rounded-xl border border-zinc-100 shadow-lg py-1 w-40 z-10">
    <button class="flex items-center gap-2 w-full px-3 py-2 text-sm font-light text-zinc-700 hover:bg-zinc-50 transition-colors">
      <iconify-icon icon="solar:pen-linear" class="text-zinc-400"></iconify-icon>
      Edit
    </button>
    <button class="flex items-center gap-2 w-full px-3 py-2 text-sm font-light text-zinc-700 hover:bg-zinc-50 transition-colors">
      <iconify-icon icon="solar:copy-linear" class="text-zinc-400"></iconify-icon>
      Duplicate
    </button>
    <div class="h-px bg-zinc-100 my-1"></div>
    <button class="flex items-center gap-2 w-full px-3 py-2 text-sm font-light text-red-600 hover:bg-zinc-50 transition-colors">
      <iconify-icon icon="solar:trash-bin-trash-linear" class="text-red-500"></iconify-icon>
      Delete
    </button>
  </div>
</div>
```

### confirm-dialog

Destructive-action confirmation, extends `modal` with danger button:

```html
<div class="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-5 shadow-sm">
    <div class="flex items-center justify-between">
      <span class="text-lg font-medium text-zinc-950 tracking-tight">Delete customer</span>
      <button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
        <iconify-icon icon="solar:close-circle-linear" class="text-base"></iconify-icon>
      </button>
    </div>
    <p class="text-sm font-light text-zinc-700 leading-relaxed">This will permanently delete Acme Corp and all associated data. This action cannot be undone.</p>
    <div class="flex items-center justify-end gap-2 pt-2">
      <button class="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-100 font-light transition-colors">Cancel</button>
      <button class="bg-red-600 hover:bg-red-700 transition-colors rounded-xl py-2 px-4 shadow-sm text-white text-xs font-medium tracking-wide">Delete</button>
    </div>
  </div>
</div>
```

### form-field-error

Validation state styling for input-field:

```html
<label class="flex flex-col gap-1.5 w-full">
  <span class="text-xs font-light text-zinc-500">Email</span>
  <input type="email" class="bg-zinc-50/80 border border-red-300 rounded-xl py-2.5 px-3.5 text-sm font-light text-zinc-900 outline-none placeholder-zinc-400 w-full focus:border-red-500 transition-colors" />
  <span class="text-xs text-red-600 font-light">Please enter a valid email address</span>
</label>
```

---

## Part 2: Detail Screen Pattern

New file: `patterns/detail.html`

**Structure:**
- Sticky header: back link, breadcrumb, entity title, action buttons (Edit, Delete)
- Two-column body: main content (field groups as read-only rows) + sidebar (status card, metadata, related records)
- States: loading (skeleton), error (alert), not-found (empty-state variant)

**Use when:** Viewing a single record — customer, order, invoice, product, user, etc.

**Key elements:**
- Back button links to parent list
- Each field group has a section-label
- Fields displayed as label/value rows, not form inputs
- Sidebar shows status (label-dot), metadata (created/updated), related entities with links
- Edit and Delete are primary header actions

---

## Part 3: SKILL.md Updates

### 3.1 Interactivity Wiring (add to Step 10)

**Every action button MUST be wired. No dead buttons.**

| Action Type | Wiring |
|-------------|--------|
| Navigation | `<Link href="...">` wrapping the button |
| Destructive | `onClick` → open confirm-dialog → toast on confirm |
| Form submit | `onSubmit` → validate → toast on success / error state |
| Row actions | dropdown-menu with links and destructive handlers |
| Copy/batch | `onClick` → toast feedback |

**State placeholders:** Even without backend, wire loading states and simulated handlers so the demo is testable.

### 3.2 CRUD Completeness Checklist (add after Step 10)

For each entity/module in the PRD:

| Operation | Screen | Required Elements |
|-----------|--------|-------------------|
| Create | Form screen | "Add" button in list → navigates here |
| Read (List) | Data table | Search, filters, row click → detail |
| Read (Detail) | Detail screen | Back link, Edit/Delete actions, related records |
| Update | Form screen (reuse Create) | Navigated from Detail's Edit |
| Delete | Confirm-dialog | Toast on success |

**Missing screens are flagged as gaps**, not auto-generated. Report format:

```
Gaps to consider (not generated):
- Customer: missing Edit screen
- Invoice: missing Detail screen
- Order: missing Delete flow
```

### 3.3 Updated Output Report

After generating screens, the report now includes:

```
✓ design/app/customers/page.tsx (list)
✓ design/app/customers/new/page.tsx (create)
✓ design/app/customers/[id]/page.tsx (detail)
✓ design/app/customers/[id]/edit/page.tsx (edit)

Interactivity: all buttons wired, toast on actions, confirm-dialog on delete

CRUD coverage:
✓ Customer: Create, List, Detail, Edit, Delete
⚠ Invoice: Create, List only — missing Detail, Edit, Delete
```

---

## Implementation Plan

1. Add `toast`, `dropdown-menu`, `confirm-dialog`, `form-field-error` to `components.md`
2. Create `patterns/detail.html` with full structure and states
3. Update `SKILL.md`:
   - Add interactivity wiring section before Step 10 checklist
   - Add CRUD completeness checklist after existing checklist
   - Update output report format

## Files Changed

| File | Change |
|------|--------|
| `docs/design-system/components.md` | Add 4 new component recipes |
| `docs/design-system/patterns/detail.html` | New file |
| `docs/design-system/patterns/patterns.md` | Add detail.html entry |
| `craft/skills/craft/SKILL.md` | Add interactivity + CRUD sections |
