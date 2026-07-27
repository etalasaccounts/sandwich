# Components

Reusable HTML snippets composable from the foundations. Copy any section's markup verbatim — styling is part of the design system.

## button-primary

The one solid button per view. Dark fill on any surface.

```html
<button class="flex items-center gap-2 bg-inverse hover:bg-inverse-3 transition-colors rounded-xl py-2 px-4 shadow-sm text-inverse-ink">
  <iconify-icon icon="solar:plain-linear" class="text-sm"></iconify-icon>
  <span class="text-xs font-medium tracking-wide">Send Reply</span>
</button>
```

Full-width form variant: add `w-full justify-center` and use `py-2.5`.

## button-compact

Small labeled action on a dark surface (e.g. Compose).

```html
<button class="flex items-center gap-1.5 bg-inverse-2 rounded-full py-1.5 px-3 hover:bg-inverse-3 transition-colors">
  <iconify-icon icon="solar:pen-new-square-linear" class="text-accent text-sm"></iconify-icon>
  <span class="text-xs text-inverse-ink-2 font-light">Compose</span>
</button>
```

Light-surface secondary button (e.g. SSO, Cancel-adjacent actions):

```html
<button class="flex items-center justify-center gap-2 bg-panel-2/80 border border-line rounded-xl py-2.5 px-4 hover:bg-page transition-colors">
  <iconify-icon icon="solar:shield-keyhole-linear" class="text-ink-2 text-base"></iconify-icon>
  <span class="text-xs font-normal text-ink-mid">Continue with SSO</span>
</button>
```

## filter-pill

Segmented filters/tabs. Active + inactive:

```html
<div class="flex items-center gap-1">
  <button class="rounded-full py-1.5 px-4 text-xs bg-inverse text-inverse-ink font-normal transition-colors tracking-wide">All</button>
  <button class="rounded-full py-1.5 px-4 text-xs text-ink-2 hover:bg-control/50 font-light transition-colors tracking-wide">Unread</button>
</div>
```

## icon-button

`w-8 h-8 rounded-full flex items-center justify-center` + a fill per surface. Three fills:

```html
<!-- on light, filled -->
<button class="w-8 h-8 rounded-full bg-control/50 flex items-center justify-center hover:bg-control transition-colors text-ink-2">
  <iconify-icon icon="solar:sort-vertical-linear" class="text-sm"></iconify-icon>
</button>
<!-- on light, transparent -->
<button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-page transition-colors text-ink-2">
  <iconify-icon icon="solar:star-linear" class="text-base"></iconify-icon>
</button>
<!-- on dark -->
<button class="w-8 h-8 rounded-full bg-inverse-3 flex items-center justify-center hover:bg-inverse-4 transition-colors">
  <iconify-icon icon="solar:settings-linear" class="text-inverse-ink-2 text-sm"></iconify-icon>
</button>
```

## input-search

Dark and light:

```html
<!-- dark -->
<div class="flex items-center gap-2 bg-inverse-2 rounded-xl py-2.5 px-3.5 w-full">
  <iconify-icon icon="solar:magnifer-linear" class="text-inverse-ink-3 text-sm"></iconify-icon>
  <input type="text" placeholder="Search mail..." class="bg-transparent border-none outline-none text-xs text-inverse-ink-mid w-full placeholder:text-inverse-ink-3 font-light" />
</div>
<!-- light -->
<div class="flex items-center gap-2 bg-panel-2/80 border border-line rounded-xl py-2.5 px-3.5 w-full">
  <iconify-icon icon="solar:magnifer-linear" class="text-ink-3 text-sm"></iconify-icon>
  <input type="text" placeholder="Search..." class="bg-transparent border-none outline-none text-xs text-ink-mid w-full placeholder:text-ink-3 font-light" />
</div>
```

## input-field

Labeled form field on light:

```html
<label class="flex flex-col gap-1.5 w-full">
  <span class="text-xs font-light text-ink-2">Email</span>
  <input type="email" placeholder="you@company.com" class="bg-panel-2/80 border border-line rounded-xl py-2.5 px-3.5 text-sm font-light text-ink outline-none placeholder:text-ink-3 w-full focus:border-line-2 transition-colors" />
</label>
```

## textarea

Borderless inside a card (see the reply box in `patterns/dashboard.html`), or standalone using the `input-field` shell with `resize-none min-h-[100px]`.

## nav-item

Sidebar navigation row (dark surface). Active / inactive / with badge:

```html
<!-- active -->
<div class="flex items-center justify-between rounded-xl py-2 px-3 bg-inverse-2 cursor-pointer">
  <div class="flex items-center gap-3">
    <iconify-icon icon="solar:inbox-in-linear" class="text-accent text-base"></iconify-icon>
    <span class="text-sm font-normal text-inverse-ink tracking-tight">Inbox</span>
  </div>
  <span class="rounded-full py-0.5 px-2.5 text-xs font-normal bg-accent text-on-accent">12</span>
</div>
<!-- inactive (badge optional, neutral) -->
<div class="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-inverse-2/50 cursor-pointer transition-colors text-inverse-ink-3">
  <div class="flex items-center gap-3">
    <iconify-icon icon="solar:document-text-linear" class="text-base"></iconify-icon>
    <span class="text-sm font-light text-inverse-ink-2">Drafts</span>
  </div>
  <span class="rounded-full py-0.5 px-2.5 text-xs font-light bg-inverse-3 text-inverse-ink-2">3</span>
</div>
```

## kpi-card

Stat card. Dark and light:

```html
<!-- dark -->
<div class="bg-inverse-2 rounded-2xl p-4 flex flex-col gap-2 flex-1">
  <div class="flex items-center justify-between w-full">
    <span class="text-xs text-inverse-ink-2 font-light">Unreads</span>
    <div class="w-2 h-2 rounded-full bg-accent"></div>
  </div>
  <span class="text-3xl font-extralight text-inverse-ink tracking-tight">6</span>
</div>
<!-- light -->
<div class="bg-panel-2/80 border border-line rounded-2xl p-4 flex flex-col gap-2 flex-1">
  <div class="flex items-center justify-between w-full">
    <span class="text-xs text-ink-2 font-light">Active customers</span>
    <div class="w-2 h-2 rounded-full bg-accent"></div>
  </div>
  <span class="text-3xl font-extralight text-ink tracking-tight">1,284</span>
</div>
```

## list-row

List/inbox item on a `bg-panel-2` panel. Three states:

```html
<!-- selected: panel bg + left accent border -->
<div class="flex gap-3.5 p-4 bg-panel border-l-2 border-ink cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
  <div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-xs font-medium text-on-accent tracking-tight">MR</div>
  <div class="flex flex-col gap-1.5 flex-1 min-w-0 py-0.5">
    <div class="flex items-center justify-between w-full">
      <span class="text-sm font-medium text-ink">Marcus Reid</span>
      <span class="text-xs text-ink-2 font-light">10:42 AM</span>
    </div>
    <span class="text-sm font-medium text-ink truncate tracking-tight">Q3 Proposal — Final Review</span>
    <span class="text-xs text-ink-2 font-light truncate">Preview text goes here…</span>
  </div>
</div>
<!-- unread (not selected): medium weight + green dot next to the name; wrapper: -->
<div class="flex gap-3.5 p-4 border-b border-line cursor-pointer hover:bg-page/50 transition-colors border-l-2 border-transparent">…</div>
<!-- read: same wrapper, but name/title drop to font-light text-ink-2, meta to text-ink-3 -->
```

## avatar

Initials on an accent or zinc fill:

```html
<div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-xs font-medium text-on-accent tracking-tight">MR</div>
```

Sizes: `w-4 h-4 text-[10px]` (chip), `w-9 h-9`, `w-10 h-10`, `w-11 h-11 text-sm`. Fill rotation: `bg-accent`/`bg-info` (text-on-accent), `bg-warn` (text-on-warn), `bg-inverse-3` (text-inverse-ink-mid). Icon variant: `bg-inverse-3` + `solar:user-circle-linear` in `text-inverse-ink-2`.

## badge

Count badge accent `rounded-full py-0.5 px-2.5 text-xs font-normal bg-accent text-on-accent`; count badge neutral `… font-light bg-inverse-3 text-inverse-ink-2` (dark) / `bg-page text-ink-2` (light); label pill `bg-page rounded-full py-0.5 px-3 text-xs font-light text-ink-2`; recipient chip:

```html
<div class="flex items-center gap-1.5 bg-control/50 rounded-full py-1 px-2.5">
  <div class="w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[10px] font-medium text-on-accent">M</div>
  <span class="text-xs font-normal text-ink">Marcus Reid</span>
</div>
```

## label-dot

Status dot + label: `<div class="w-2 h-2 rounded-full bg-accent"></div>` next to `<span class="text-sm font-light text-inverse-ink-2">Work</span>` (dark) or `text-ink-2` (light). Semantics: green active/success, cyan info, orange warning, `bg-line-2` neutral/inactive.

## section-label

`<span class="text-xs uppercase tracking-widest text-inverse-label font-normal">Labels</span>` (dark) / `text-ink-3` (light).

## account-card

User footer (dark):

```html
<div class="flex items-center gap-3 bg-inverse-2 rounded-2xl p-3 w-full">
  <div class="w-9 h-9 rounded-full bg-inverse-3 flex items-center justify-center flex-shrink-0">
    <iconify-icon icon="solar:user-circle-linear" class="text-inverse-ink-2 text-lg"></iconify-icon>
  </div>
  <div class="flex flex-col flex-1 min-w-0">
    <span class="text-sm font-normal text-inverse-ink truncate">Avery Nolan</span>
    <span class="text-xs font-light text-inverse-ink-3 truncate">avery@nordbyte.com</span>
  </div>
  <button class="w-8 h-8 rounded-full bg-inverse-3 flex items-center justify-center flex-shrink-0 hover:bg-inverse-4 transition-colors">
    <iconify-icon icon="solar:settings-linear" class="text-inverse-ink-2 text-sm"></iconify-icon>
  </button>
</div>
```

## file-chip

Attachment/file:

```html
<div class="flex items-center gap-3 bg-panel-2/80 border border-line rounded-xl p-3 cursor-pointer hover:bg-page transition-colors min-w-[200px]">
  <div class="w-8 h-8 rounded-lg bg-panel shadow-sm flex items-center justify-center flex-shrink-0 text-ink-2">
    <iconify-icon icon="solar:document-linear" class="text-lg"></iconify-icon>
  </div>
  <div class="flex flex-col">
    <span class="text-xs font-medium text-ink truncate">Q3_Proposal_Final.pdf</span>
    <span class="text-xs font-light text-ink-2">2.4 MB</span>
  </div>
</div>
```

## empty-state

Zero-data view of any panel/list:

```html
<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <div class="w-12 h-12 rounded-full bg-page flex items-center justify-center">
    <iconify-icon icon="solar:inbox-in-linear" class="text-ink-3 text-xl"></iconify-icon>
  </div>
  <span class="text-sm font-medium text-ink tracking-tight">No messages yet</span>
  <span class="text-xs font-light text-ink-2 max-w-[240px]">When you receive a message it will show up here.</span>
  <button class="mt-2 flex items-center gap-2 bg-inverse hover:bg-inverse-3 transition-colors rounded-xl py-2 px-4 shadow-sm text-inverse-ink">
    <iconify-icon icon="solar:pen-new-square-linear" class="text-sm"></iconify-icon>
    <span class="text-xs font-medium tracking-wide">Compose</span>
  </button>
</div>
```

## modal

Dialog on a scrim:

```html
<div class="fixed inset-0 bg-inverse/50 flex items-center justify-center p-4 z-50">
  <div class="bg-panel rounded-2xl p-6 w-full max-w-md flex flex-col gap-5 shadow-sm">
    <div class="flex items-center justify-between">
      <span class="text-lg font-medium text-ink tracking-tight">Delete message</span>
      <button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-page transition-colors text-ink-2">
        <iconify-icon icon="solar:close-circle-linear" class="text-base"></iconify-icon>
      </button>
    </div>
    <p class="text-sm font-light text-ink-mid leading-relaxed">This will move the message to Trash. You can restore it within 30 days.</p>
    <div class="flex items-center justify-end gap-2 pt-2">
      <button class="rounded-full py-1.5 px-4 text-xs text-ink-2 hover:bg-page font-light transition-colors">Cancel</button>
      <button class="bg-inverse hover:bg-inverse-3 transition-colors rounded-xl py-2 px-4 shadow-sm text-inverse-ink text-xs font-medium tracking-wide">Delete</button>
    </div>
  </div>
</div>
```

## data-table

Header uses the section-label style; rows are light and hoverable:

```html
<table class="w-full text-left">
  <thead>
    <tr class="border-b border-line">
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-ink-3 font-normal">Customer</th>
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-ink-3 font-normal">Status</th>
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-ink-3 font-normal text-right">MRR</th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-line hover:bg-panel-2/50 transition-colors cursor-pointer">
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-on-accent tracking-tight">AC</div>
          <div class="flex flex-col">
            <span class="text-sm font-normal text-ink">Acme Corp</span>
            <span class="text-xs font-light text-ink-2">billing@acme.com</span>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-accent"></div>
          <span class="text-sm font-light text-ink-2">Active</span>
        </div>
      </td>
      <td class="py-3.5 px-4 text-sm font-light text-ink-mid text-right">$2,400</td>
    </tr>
  </tbody>
</table>
```

## toggle

Switch:

```html
<!-- on -->
<button class="w-10 h-6 rounded-full bg-accent p-0.5 flex items-center transition-colors" aria-pressed="true">
  <span class="w-5 h-5 rounded-full bg-panel shadow-sm ml-auto"></span>
</button>
<!-- off (light surface; on dark use bg-inverse-3) -->
<button class="w-10 h-6 rounded-full bg-control p-0.5 flex items-center transition-colors" aria-pressed="false">
  <span class="w-5 h-5 rounded-full bg-panel shadow-sm"></span>
</button>
```

## alert

Inline notice; neutral surface + accent icon only (never accent fills):

```html
<div class="flex items-start gap-3 bg-panel-2/80 border border-line rounded-xl p-4">
  <iconify-icon icon="solar:danger-triangle-linear" class="text-warn text-base mt-0.5"></iconify-icon>
  <div class="flex flex-col gap-1">
    <span class="text-sm font-medium text-ink">Payment overdue</span>
    <span class="text-xs font-light text-ink-2">Invoice #2024-089 was due on March 8th.</span>
  </div>
</div>
```

Variants swap icon+tint: success `solar:check-circle-linear text-accent`, info `solar:info-circle-linear text-info`.

## skeleton-row

Loading state (the one allowed animation besides transition-colors):

```html
<div class="flex gap-3.5 p-4 animate-pulse">
  <div class="w-10 h-10 rounded-full bg-page flex-shrink-0"></div>
  <div class="flex flex-col gap-2 flex-1 py-1">
    <div class="h-3 bg-page rounded-full w-1/3"></div>
    <div class="h-3 bg-page rounded-full w-2/3"></div>
  </div>
</div>
```

On dark surfaces use `bg-inverse-2` blocks.

## Adding a component

A recurring need with no recipe here is a gap: compose it from the DNA (foundations.md), verify it against the Do/Don't table, and add it to this file with a stable kebab-case id — don't solve it ad hoc per project.
