# Components

Reusable HTML snippets composable from the foundations. Copy any section's markup verbatim — styling is part of the design system.

## button-primary

The one solid button per view. Dark fill on any surface.

```html
<button class="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 transition-colors rounded-xl py-2 px-4 shadow-sm text-white">
  <iconify-icon icon="solar:plain-linear" class="text-sm"></iconify-icon>
  <span class="text-xs font-medium tracking-wide">Send Reply</span>
</button>
```

Full-width form variant: add `w-full justify-center` and use `py-2.5`.

## button-compact

Small labeled action on a dark surface (e.g. Compose).

```html
<button class="flex items-center gap-1.5 bg-zinc-900 rounded-full py-1.5 px-3 hover:bg-zinc-800 transition-colors">
  <iconify-icon icon="solar:pen-new-square-linear" class="text-green-400 text-sm"></iconify-icon>
  <span class="text-xs text-zinc-400 font-light">Compose</span>
</button>
```

Light-surface secondary button (e.g. SSO, Cancel-adjacent actions):

```html
<button class="flex items-center justify-center gap-2 bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-4 hover:bg-zinc-100 transition-colors">
  <iconify-icon icon="solar:shield-keyhole-linear" class="text-zinc-500 text-base"></iconify-icon>
  <span class="text-xs font-normal text-zinc-700">Continue with SSO</span>
</button>
```

## filter-pill

Segmented filters/tabs. Active + inactive:

```html
<div class="flex items-center gap-1">
  <button class="rounded-full py-1.5 px-4 text-xs bg-zinc-950 text-white font-normal transition-colors tracking-wide">All</button>
  <button class="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-200/50 font-light transition-colors tracking-wide">Unread</button>
</div>
```

## icon-button

`w-8 h-8 rounded-full flex items-center justify-center` + a fill per surface. Three fills:

```html
<!-- on light, filled -->
<button class="w-8 h-8 rounded-full bg-zinc-200/50 flex items-center justify-center hover:bg-zinc-200 transition-colors text-zinc-600">
  <iconify-icon icon="solar:sort-vertical-linear" class="text-sm"></iconify-icon>
</button>
<!-- on light, transparent -->
<button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
  <iconify-icon icon="solar:star-linear" class="text-base"></iconify-icon>
</button>
<!-- on dark -->
<button class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors">
  <iconify-icon icon="solar:settings-linear" class="text-zinc-400 text-sm"></iconify-icon>
</button>
```

## input-search

Dark and light:

```html
<!-- dark -->
<div class="flex items-center gap-2 bg-zinc-900 rounded-xl py-2.5 px-3.5 w-full">
  <iconify-icon icon="solar:magnifer-linear" class="text-zinc-500 text-sm"></iconify-icon>
  <input type="text" placeholder="Search mail..." class="bg-transparent border-none outline-none text-xs text-zinc-300 w-full placeholder-zinc-500 font-light" />
</div>
<!-- light -->
<div class="flex items-center gap-2 bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-3.5 w-full">
  <iconify-icon icon="solar:magnifer-linear" class="text-zinc-400 text-sm"></iconify-icon>
  <input type="text" placeholder="Search..." class="bg-transparent border-none outline-none text-xs text-zinc-700 w-full placeholder-zinc-400 font-light" />
</div>
```

## input-field

Labeled form field on light:

```html
<label class="flex flex-col gap-1.5 w-full">
  <span class="text-xs font-light text-zinc-500">Email</span>
  <input type="email" placeholder="you@company.com" class="bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-3.5 text-sm font-light text-zinc-900 outline-none placeholder-zinc-400 w-full focus:border-zinc-300 transition-colors" />
</label>
```

## textarea

Borderless inside a card (see the reply box in `patterns/dashboard.html`), or standalone using the `input-field` shell with `resize-none min-h-[100px]`.

## nav-item

Sidebar navigation row (dark surface). Active / inactive / with badge:

```html
<!-- active -->
<div class="flex items-center justify-between rounded-xl py-2 px-3 bg-zinc-900 cursor-pointer">
  <div class="flex items-center gap-3">
    <iconify-icon icon="solar:inbox-in-linear" class="text-green-400 text-base"></iconify-icon>
    <span class="text-sm font-normal text-zinc-50 tracking-tight">Inbox</span>
  </div>
  <span class="rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950">12</span>
</div>
<!-- inactive (badge optional, neutral) -->
<div class="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
  <div class="flex items-center gap-3">
    <iconify-icon icon="solar:document-text-linear" class="text-base"></iconify-icon>
    <span class="text-sm font-light text-zinc-400">Drafts</span>
  </div>
  <span class="rounded-full py-0.5 px-2.5 text-xs font-light bg-zinc-800 text-zinc-400">3</span>
</div>
```

## kpi-card

Stat card. Dark and light:

```html
<!-- dark -->
<div class="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
  <div class="flex items-center justify-between w-full">
    <span class="text-xs text-zinc-400 font-light">Unreads</span>
    <div class="w-2 h-2 rounded-full bg-green-400"></div>
  </div>
  <span class="text-3xl font-extralight text-zinc-100 tracking-tight">6</span>
</div>
<!-- light -->
<div class="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-4 flex flex-col gap-2 flex-1">
  <div class="flex items-center justify-between w-full">
    <span class="text-xs text-zinc-500 font-light">Active customers</span>
    <div class="w-2 h-2 rounded-full bg-green-400"></div>
  </div>
  <span class="text-3xl font-extralight text-zinc-950 tracking-tight">1,284</span>
</div>
```

## list-row

List/inbox item on a `bg-zinc-50` panel. Three states:

```html
<!-- selected: white bg + left accent border -->
<div class="flex gap-3.5 p-4 bg-white border-l-2 border-zinc-950 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
  <div class="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-950 tracking-tight">MR</div>
  <div class="flex flex-col gap-1.5 flex-1 min-w-0 py-0.5">
    <div class="flex items-center justify-between w-full">
      <span class="text-sm font-medium text-zinc-950">Marcus Reid</span>
      <span class="text-xs text-zinc-500 font-light">10:42 AM</span>
    </div>
    <span class="text-sm font-medium text-zinc-950 truncate tracking-tight">Q3 Proposal — Final Review</span>
    <span class="text-xs text-zinc-500 font-light truncate">Preview text goes here…</span>
  </div>
</div>
<!-- unread (not selected): medium weight + green dot next to the name; wrapper: -->
<div class="flex gap-3.5 p-4 border-b border-zinc-100 cursor-pointer hover:bg-zinc-100/50 transition-colors border-l-2 border-transparent">…</div>
<!-- read: same wrapper, but name/title drop to font-light text-zinc-600/text-zinc-700, meta to text-zinc-400 -->
```

## avatar

Initials on an accent or zinc fill:

```html
<div class="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-950 tracking-tight">MR</div>
```

Sizes: `w-4 h-4 text-[10px]` (chip), `w-9 h-9`, `w-10 h-10`, `w-11 h-11 text-sm`. Fill rotation: `bg-green-400`/`bg-cyan-400` (text-zinc-950), `bg-orange-500` (text-white), `bg-zinc-800` (text-zinc-300). Icon variant: `bg-zinc-800` + `solar:user-circle-linear` in `text-zinc-400`.

## badge

Count badge accent `rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950`; count badge neutral `… font-light bg-zinc-800 text-zinc-400` (dark) / `bg-zinc-100 text-zinc-600` (light); label pill `bg-zinc-100 rounded-full py-0.5 px-3 text-xs font-light text-zinc-600`; recipient chip:

```html
<div class="flex items-center gap-1.5 bg-zinc-200/50 rounded-full py-1 px-2.5">
  <div class="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center text-[10px] font-medium text-zinc-950">M</div>
  <span class="text-xs font-normal text-zinc-900">Marcus Reid</span>
</div>
```

## label-dot

Status dot + label: `<div class="w-2 h-2 rounded-full bg-green-400"></div>` next to `<span class="text-sm font-light text-zinc-400">Work</span>` (dark) or `text-zinc-600` (light). Semantics: green active/success, cyan info, orange warning, `bg-zinc-300` neutral/inactive.

## section-label

`<span class="text-xs uppercase tracking-widest text-zinc-600 font-normal">Labels</span>` (dark) / `text-zinc-400` (light).

## account-card

User footer (dark):

```html
<div class="flex items-center gap-3 bg-zinc-900 rounded-2xl p-3 w-full">
  <div class="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
    <iconify-icon icon="solar:user-circle-linear" class="text-zinc-400 text-lg"></iconify-icon>
  </div>
  <div class="flex flex-col flex-1 min-w-0">
    <span class="text-sm font-normal text-zinc-50 truncate">Avery Nolan</span>
    <span class="text-xs font-light text-zinc-500 truncate">avery@nordbyte.com</span>
  </div>
  <button class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 hover:bg-zinc-700 transition-colors">
    <iconify-icon icon="solar:settings-linear" class="text-zinc-400 text-sm"></iconify-icon>
  </button>
</div>
```

## file-chip

Attachment/file:

```html
<div class="flex items-center gap-3 bg-zinc-50/80 border border-zinc-100 rounded-xl p-3 cursor-pointer hover:bg-zinc-100 transition-colors min-w-[200px]">
  <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-zinc-500">
    <iconify-icon icon="solar:document-linear" class="text-lg"></iconify-icon>
  </div>
  <div class="flex flex-col">
    <span class="text-xs font-medium text-zinc-900 truncate">Q3_Proposal_Final.pdf</span>
    <span class="text-xs font-light text-zinc-500">2.4 MB</span>
  </div>
</div>
```

## empty-state

Zero-data view of any panel/list:

```html
<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <div class="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
    <iconify-icon icon="solar:inbox-in-linear" class="text-zinc-400 text-xl"></iconify-icon>
  </div>
  <span class="text-sm font-medium text-zinc-950 tracking-tight">No messages yet</span>
  <span class="text-xs font-light text-zinc-500 max-w-[240px]">When you receive a message it will show up here.</span>
  <button class="mt-2 flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 transition-colors rounded-xl py-2 px-4 shadow-sm text-white">
    <iconify-icon icon="solar:pen-new-square-linear" class="text-sm"></iconify-icon>
    <span class="text-xs font-medium tracking-wide">Compose</span>
  </button>
</div>
```

## modal

Dialog on a scrim:

```html
<div class="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-5 shadow-sm">
    <div class="flex items-center justify-between">
      <span class="text-lg font-medium text-zinc-950 tracking-tight">Delete message</span>
      <button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
        <iconify-icon icon="solar:close-circle-linear" class="text-base"></iconify-icon>
      </button>
    </div>
    <p class="text-sm font-light text-zinc-700 leading-relaxed">This will move the message to Trash. You can restore it within 30 days.</p>
    <div class="flex items-center justify-end gap-2 pt-2">
      <button class="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-100 font-light transition-colors">Cancel</button>
      <button class="bg-zinc-950 hover:bg-zinc-800 transition-colors rounded-xl py-2 px-4 shadow-sm text-white text-xs font-medium tracking-wide">Delete</button>
    </div>
  </div>
</div>
```

## data-table

Header uses the section-label style; rows are light and hoverable:

```html
<table class="w-full text-left">
  <thead>
    <tr class="border-b border-zinc-100">
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Customer</th>
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Status</th>
      <th class="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal text-right">MRR</th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">AC</div>
          <div class="flex flex-col">
            <span class="text-sm font-normal text-zinc-950">Acme Corp</span>
            <span class="text-xs font-light text-zinc-500">billing@acme.com</span>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-green-400"></div>
          <span class="text-sm font-light text-zinc-600">Active</span>
        </div>
      </td>
      <td class="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$2,400</td>
    </tr>
  </tbody>
</table>
```

## toggle

Switch:

```html
<!-- on -->
<button class="w-10 h-6 rounded-full bg-green-400 p-0.5 flex items-center transition-colors" aria-pressed="true">
  <span class="w-5 h-5 rounded-full bg-white shadow-sm ml-auto"></span>
</button>
<!-- off (light surface; on dark use bg-zinc-800) -->
<button class="w-10 h-6 rounded-full bg-zinc-200 p-0.5 flex items-center transition-colors" aria-pressed="false">
  <span class="w-5 h-5 rounded-full bg-white shadow-sm"></span>
</button>
```

## alert

Inline notice; neutral surface + accent icon only (never accent fills):

```html
<div class="flex items-start gap-3 bg-zinc-50/80 border border-zinc-100 rounded-xl p-4">
  <iconify-icon icon="solar:danger-triangle-linear" class="text-orange-500 text-base mt-0.5"></iconify-icon>
  <div class="flex flex-col gap-1">
    <span class="text-sm font-medium text-zinc-950">Payment overdue</span>
    <span class="text-xs font-light text-zinc-500">Invoice #2024-089 was due on March 8th.</span>
  </div>
</div>
```

Variants swap icon+tint: success `solar:check-circle-linear text-green-400`, info `solar:info-circle-linear text-cyan-400`.

## skeleton-row

Loading state (the one allowed animation besides transition-colors):

```html
<div class="flex gap-3.5 p-4 animate-pulse">
  <div class="w-10 h-10 rounded-full bg-zinc-100 flex-shrink-0"></div>
  <div class="flex flex-col gap-2 flex-1 py-1">
    <div class="h-3 bg-zinc-100 rounded-full w-1/3"></div>
    <div class="h-3 bg-zinc-100 rounded-full w-2/3"></div>
  </div>
</div>
```

On dark surfaces use `bg-zinc-900` blocks.

## Adding a component

A recurring need with no recipe here is a gap: compose it from the DNA (foundations.md), verify it against the Do/Don't table, and add it to this file with a stable kebab-case id — don't solve it ad hoc per project.
