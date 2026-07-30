# Craft React Pattern Playground

Replace the current Next.js setup in `/craft/template/` with a lightweight Vite + React application for design system preview and development.

## Goal

A single playground for viewing all design system patterns live — like Storybook-lite, without the complexity. React components replace standalone HTML files as the source of truth.

## Architecture

```
craft/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── InputField.tsx
│   │   │   ├── InputSearch.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Icon.tsx
│   │   │   └── index.ts
│   │   └── layout/          # Shell components
│   │       ├── AppShell.tsx
│   │       ├── PatternNav.tsx
│   │       └── index.ts
│   ├── patterns/            # Full page layouts
│   │   ├── AuthPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── MailboxPage.tsx
│   │   ├── ChatInterfacePage.tsx
│   │   ├── DataTablePage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── MarketplaceGridPage.tsx
│   │   ├── ProductFormPage.tsx
│   │   ├── BlogPostFormPage.tsx
│   │   ├── MobilePage.tsx
│   │   └── index.ts
│   ├── App.tsx              # Main app with navigation
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind + custom styles
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

## Components

### UI Components

Already partially exists in `craft/template/components/ui/`. Migrate and extend:

| Component | Props | Purpose |
|-----------|-------|---------|
| `Input` | `className, type, ...props` | Base text input with focus:border-green-400 |
| `InputField` | `label, description, labelAction, ...inputProps` | Labeled form field |
| `InputSearch` | `variant: 'dark' | 'light', placeholder` | Search input with icon |
| `Select` | `children, ...props` | Styled select with chevron |
| `Textarea` | `...props` | Multi-line input |
| `Button` | `variant: 'primary' | 'secondary', children` | Action button |
| `Icon` | `icon, className` | Iconify wrapper |

All UI components follow the design system:
- Border: `border-zinc-200` (visible)
- Focus: `focus:border-green-400` (primary accent)
- Radius: `rounded-xl`
- Font: Inter, weights 200-500

### Layout Components

| Component | Purpose |
|-----------|---------|
| `AppShell` | Main playground shell — dark sidebar left, pattern content right |
| `PatternNav` | Navigation list for switching between patterns |

### Pattern Components

Each pattern is a self-contained React component matching its HTML exemplar:

| Pattern | Description |
|---------|-------------|
| `AuthPage` | Login/signup forms with brand panel |
| `SettingsPage` | Profile, notifications, billing forms |
| `MailboxPage` | Email client with sidebar, list, detail pane |
| `ChatInterfacePage` | Two-party chat with bubbles |
| `DataTablePage` | Sortable table with rows |
| `LandingPage` | Marketing page (flat, no shell) |
| `MarketplaceGridPage` | Product browse grid |
| `ProductFormPage` | Product editor with dropzones |
| `BlogPostFormPage` | Blog post editor with rich text |
| `MobilePage` | Mobile bottom-nav layout |

## Navigation

Simple client-side navigation using React state:

```tsx
// App.tsx
const patterns = [
  { id: 'auth', label: 'Auth', component: AuthPage },
  { id: 'settings', label: 'Settings', component: SettingsPage },
  { id: 'mailbox', label: 'Mailbox', component: MailboxPage },
  { id: 'chat', label: 'Chat', component: ChatInterfacePage },
  { id: 'data-table', label: 'Data Table', component: DataTablePage },
  { id: 'landing', label: 'Landing', component: LandingPage },
  { id: 'marketplace', label: 'Marketplace', component: MarketplaceGridPage },
  { id: 'product-form', label: 'Product Form', component: ProductFormPage },
  { id: 'blog-form', label: 'Blog Form', component: BlogPostFormPage },
  { id: 'mobile', label: 'Mobile', component: MobilePage },
]

function App() {
  const [current, setCurrent] = useState(() => {
    const hash = window.location.hash.slice(1)
    return hash || 'auth'
  })

  useEffect(() => {
    window.location.hash = current
  }, [current])

  const Pattern = patterns.find(p => p.id === current)?.component

  return (
    <div className="flex h-screen">
      <PatternNav patterns={patterns} current={current} onSelect={setCurrent} />
      <main className="flex-1 overflow-auto">
        {Pattern && <Pattern />}
      </main>
    </div>
  )
}
```

Hash-based routing for bookmarkable URLs (`#auth`, `#settings`, etc).

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^6.0.0 | Build tool, dev server, HMR |
| react | ^19.0.0 | UI library |
| react-dom | ^19.0.0 | React DOM renderer |
| tailwindcss | ^3.4.0 | Utility-first CSS |
| postcss | ^8.4.0 | CSS processing |
| autoprefixer | ^10.4.0 | Vendor prefixes |
| @iconify/react | ^5.0.0 | Solar icons |
| clsx | ^2.1.1 | Conditional classes |
| tailwind-merge | ^2.5.0 | Merge Tailwind classes |
| typescript | ^5.6.0 | Type safety |

## Styling

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', sans-serif;
}

iconify-icon {
  stroke-width: 1.5;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E4E4E7; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #D4D4D8; }
```

Font loading via Google Fonts CDN in `index.html`.

## Migration Steps

1. **Create Vite structure** — new directories and config files
2. **Migrate UI components** — move existing `components/ui/` to new location
3. **Create layout components** — AppShell, PatternNav
4. **Convert patterns one by one** — HTML → React, starting with Auth
5. **Delete Next.js artifacts** — `app/`, `next.config.ts`, etc
6. **Update docs** — `components.md` references React, not HTML

## Success Criteria

- [ ] All 10 patterns viewable in playground
- [ ] Navigation between patterns works
- [ ] Components use design system colors (zinc-200 border, green-400 focus)
- [ ] HMR works for fast iteration
- [ ] Build produces static files
- [ ] Old patterns/*.html remains as reference (not deleted until verified)

## Non-Goals

- Not a component library for export
- Not an npm package
- Not a replacement for production app code
- No unit tests (visual verification only)
- No CI/CD pipeline
