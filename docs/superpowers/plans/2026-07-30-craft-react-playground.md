# Craft React Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Next.js setup with lightweight Vite + React playground for viewing all design system patterns.

**Architecture:** Simple Vite app with client-side navigation. UI components in `/components/ui/`, pattern pages in `/patterns/`, all using the design system (zinc-200 borders, green-400 focus).

**Tech Stack:** Vite 6, React 19, Tailwind 3.4, TypeScript 5.6, Iconify

---

## File Structure

```
craft/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Icon.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── InputField.tsx
│   │   │   ├── InputSearch.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Textarea.tsx
│   │   │   └── index.ts
│   │   └── layout/
│   │       ├── AppShell.tsx
│   │       ├── PatternNav.tsx
│   │       └── index.ts
│   ├── patterns/
│   │   ├── AuthPage.tsx
│   │   ├── BlogPostFormPage.tsx
│   │   ├── ChatInterfacePage.tsx
│   │   ├── DataTablePage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── MailboxPage.tsx
│   │   ├── MarketplaceGridPage.tsx
│   │   ├── MobilePage.tsx
│   │   ├── ProductFormPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

### Task 1: Setup Vite Project Structure

**Files:**
- Create: `craft/package.json`
- Create: `craft/vite.config.ts`
- Create: `craft/tsconfig.json`
- Create: `craft/tailwind.config.ts`
- Create: `craft/postcss.config.js`
- Create: `craft/index.html`
- Create: `craft/src/main.tsx`
- Create: `craft/src/index.css`

- [ ] **Step 1: Create package.json with dependencies**

```json
{
  "name": "craft",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@iconify/react": "^5.0.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Craft — Design System Playground</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap" rel="stylesheet">
  </head>
  <body class="bg-zinc-100 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/index.css**

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
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #E4E4E7;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #D4D4D8;
}
```

- [ ] **Step 8: Create src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Create utility function src/lib/utils.ts**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 10: Delete old Next.js files**

Remove the old Next.js structure (keep existing UI components for migration):

```bash
rm -rf craft/template/app
rm -f craft/template/next.config.ts
rm -f craft/template/package.json
rm -f craft/template/postcss.config.js
rm -f craft/template/tsconfig.json
mv craft/template/components craft/src/
mv craft/template/lib craft/src/
rmdir craft/template
```

Then move files to correct structure:

```bash
mv craft/src/components/craft craft/src/components/layout 2>/dev/null || true
```

- [ ] **Step 11: Install dependencies**

```bash
cd craft && npm install
```

---

### Task 2: Create UI Components (Migrate from existing)

**Files:**
- Modify: `craft/src/components/ui/Input.tsx`
- Modify: `craft/src/components/ui/InputField.tsx`
- Modify: `craft/src/components/ui/InputSearch.tsx`
- Modify: `craft/src/components/ui/Select.tsx`
- Modify: `craft/src/components/ui/Textarea.tsx`
- Create: `craft/src/components/ui/Button.tsx`
- Create: `craft/src/components/ui/Icon.tsx`
- Modify: `craft/src/components/ui/index.ts`

- [ ] **Step 1: Update Input.tsx with correct imports**

```tsx
import type { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "bg-zinc-50/80 border border-zinc-200 rounded-xl py-2.5 px-3.5",
          "text-sm font-light text-zinc-900 outline-none placeholder-zinc-400 w-full",
          "focus:border-green-400 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
```

- [ ] **Step 2: Update InputField.tsx with correct imports**

```tsx
import type { ReactNode, forwardRef } from "react";
import { Input, type InputProps } from "./Input";
import { cn } from "@/lib/utils";

export interface InputFieldProps extends Omit<InputProps, "className"> {
  label: string;
  description?: string;
  labelAction?: ReactNode;
  className?: string;
  inputClassName?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, description, labelAction, className, inputClassName, ...props }, ref) => {
    return (
      <label className={cn("flex flex-col gap-1.5 w-full", className)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-light text-zinc-500">{label}</span>
          {labelAction}
        </div>
        <Input ref={ref} className={inputClassName} {...props} />
        {description && (
          <span className="text-xs font-light text-zinc-400">{description}</span>
        )}
      </label>
    );
  }
);

InputField.displayName = "InputField";
```

- [ ] **Step 3: Update InputSearch.tsx with correct imports**

```tsx
import type { InputHTMLAttributes, forwardRef } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

export interface InputSearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  variant?: "dark" | "light";
  className?: string;
}

export const InputSearch = forwardRef<HTMLInputElement, InputSearchProps>(
  ({ variant = "light", className, placeholder = "Search...", ...props }, ref) => {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl py-2.5 px-3.5 w-full",
          variant === "dark"
            ? "bg-zinc-900"
            : "bg-zinc-50/80 border border-zinc-200 focus-within:border-green-400 transition-colors",
          className
        )}
      >
        <Icon icon="solar:magnifer-linear" className={variant === "dark" ? "text-zinc-500" : "text-zinc-400"} />
        <input
          type="text"
          ref={ref}
          placeholder={placeholder}
          className={cn(
            "bg-transparent border-none outline-none text-xs w-full font-light",
            variant === "dark"
              ? "text-zinc-300 placeholder-zinc-500"
              : "text-zinc-700 placeholder-zinc-400"
          )}
          {...props}
        />
      </div>
    );
  }
);

InputSearch.displayName = "InputSearch";
```

- [ ] **Step 4: Update Select.tsx with correct imports**

```tsx
import type { SelectHTMLAttributes, forwardRef } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          className={cn(
            "bg-white border border-zinc-200 rounded-xl py-2.5 px-3.5",
            "text-sm font-light text-zinc-900 outline-none w-full",
            "focus:border-green-400 transition-colors appearance-none pr-9",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          {...props}
        >
          {children}
        </select>
        <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
      </div>
    );
  }
);

Select.displayName = "Select";
```

- [ ] **Step 5: Update Textarea.tsx with correct imports**

```tsx
import type { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "bg-zinc-50/80 border border-zinc-200 rounded-xl py-2.5 px-3.5",
          "text-sm font-light text-zinc-900 outline-none placeholder-zinc-400 w-full",
          "focus:border-green-400 transition-colors resize-none min-h-[100px]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
```

- [ ] **Step 6: Create Icon.tsx wrapper**

```tsx
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";

export interface IconProps {
  icon: string;
  className?: string;
}

export function Icon({ icon, className }: IconProps) {
  return <IconifyIcon icon={icon} className={cn("stroke-width-1.5", className)} />;
}
```

- [ ] **Step 7: Create Button.tsx**

```tsx
import type { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "compact" | "icon";
  icon?: string;
  children?: ReactNode;
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", icon, children, className, ...props }, ref) => {
    const baseStyles = "flex items-center justify-center transition-colors";
    
    const variants = {
      primary: "gap-2 bg-zinc-950 hover:bg-zinc-800 rounded-xl py-2 px-4 shadow-sm text-white",
      secondary: "gap-2 bg-zinc-50/80 border border-zinc-200 rounded-xl py-2.5 px-4 hover:bg-zinc-100 text-zinc-700",
      compact: "gap-1.5 bg-zinc-900 rounded-full py-1.5 px-3 hover:bg-zinc-800 text-zinc-400",
      icon: "w-8 h-8 rounded-full bg-zinc-200/50 hover:bg-zinc-200 text-zinc-600",
    };

    return (
      <button ref={ref} className={cn(baseStyles, variants[variant], className)} {...props}>
        {icon && <Icon icon={icon} className="text-sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
```

- [ ] **Step 8: Update index.ts barrel export**

```ts
export { Button, type ButtonProps } from "./Button";
export { Icon, type IconProps } from "./Icon";
export { Input, type InputProps } from "./Input";
export { InputField, type InputFieldProps } from "./InputField";
export { InputSearch, type InputSearchProps } from "./InputSearch";
export { Select, type SelectProps } from "./Select";
export { Textarea, type TextareaProps } from "./Textarea";
```

---

### Task 3: Create Layout Components

**Files:**
- Create: `craft/src/components/layout/PatternNav.tsx`
- Create: `craft/src/components/layout/index.ts`
- Modify: `craft/src/components/layout/PageHeader.tsx` (update import paths)

- [ ] **Step 1: Create PatternNav.tsx**

```tsx
import { cn } from "@/lib/utils";

export interface Pattern {
  id: string;
  label: string;
}

export interface PatternNavProps {
  patterns: Pattern[];
  current: string;
  onSelect: (id: string) => void;
}

export function PatternNav({ patterns, current, onSelect }: PatternNavProps) {
  return (
    <aside className="bg-zinc-950 w-56 p-4 flex flex-col gap-1 flex-shrink-0 hidden md:flex">
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center">
          <span className="text-zinc-950 text-xs font-medium">C</span>
        </div>
        <span className="text-sm font-medium text-zinc-50 tracking-tight">Craft</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {patterns.map((pattern) => (
          <button
            key={pattern.id}
            onClick={() => onSelect(pattern.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
              current === pattern.id
                ? "bg-zinc-900 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            )}
          >
            <span className="text-sm font-light">{pattern.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create layout/index.ts**

```ts
export { PatternNav, type Pattern, type PatternNavProps } from "./PatternNav";
export { PageHeader } from "./PageHeader";
```

- [ ] **Step 3: Update PageHeader.tsx import path**

Change `import type { ReactNode } from "react"` is already correct, just ensure it uses `@/lib/utils` if needed.

---

### Task 4: Create App.tsx with Navigation

**Files:**
- Create: `craft/src/App.tsx`

- [ ] **Step 1: Create App.tsx with hash-based navigation**

```tsx
import { useState, useEffect } from "react";
import { PatternNav, type Pattern } from "./components/layout";
import {
  AuthPage,
  BlogPostFormPage,
  ChatInterfacePage,
  DataTablePage,
  LandingPage,
  MailboxPage,
  MarketplaceGridPage,
  MobilePage,
  ProductFormPage,
  SettingsPage,
} from "./patterns";

const patterns: Pattern[] = [
  { id: "auth", label: "Auth" },
  { id: "blog-form", label: "Blog Form" },
  { id: "chat", label: "Chat Interface" },
  { id: "data-table", label: "Data Table" },
  { id: "landing", label: "Landing" },
  { id: "mailbox", label: "Mailbox" },
  { id: "marketplace", label: "Marketplace" },
  { id: "mobile", label: "Mobile" },
  { id: "product-form", label: "Product Form" },
  { id: "settings", label: "Settings" },
];

const patternComponents: Record<string, React.ComponentType> = {
  auth: AuthPage,
  "blog-form": BlogPostFormPage,
  chat: ChatInterfacePage,
  "data-table": DataTablePage,
  landing: LandingPage,
  mailbox: MailboxPage,
  marketplace: MarketplaceGridPage,
  mobile: MobilePage,
  "product-form": ProductFormPage,
  settings: SettingsPage,
};

function App() {
  const [current, setCurrent] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash || "auth";
  });

  useEffect(() => {
    window.location.hash = current;
  }, [current]);

  const Pattern = patternComponents[current];

  return (
    <div className="flex h-screen">
      <PatternNav patterns={patterns} current={current} onSelect={setCurrent} />
      <main className="flex-1 overflow-auto bg-white">
        {Pattern ? <Pattern /> : <AuthPage />}
      </main>
    </div>
  );
}

export default App;
```

---

### Task 5: Convert AuthPage Pattern

**Files:**
- Create: `craft/src/patterns/AuthPage.tsx`

- [ ] **Step 1: Create AuthPage.tsx (converted from auth.html)**

Convert the HTML pattern to React JSX, using the UI components where applicable. This is a large file, so include the full structure:

```tsx
import { Button, InputField, Icon } from "@/components/ui";

export function AuthPage() {
  return (
    <div className="bg-zinc-100 min-h-screen flex items-center justify-center p-4">
      <div className="flex rounded-2xl overflow-hidden shadow-xl max-w-[900px] w-full h-[600px]">
        {/* Brand Panel */}
        <aside className="bg-zinc-950 rounded-2xl p-8 flex-col justify-between w-[440px] flex-shrink-0 hidden md:flex overflow-y-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
              <Icon icon="solar:letter-linear" className="text-zinc-950 text-base" />
            </div>
            <span className="text-lg font-medium text-zinc-50 tracking-tight">Mail</span>
          </div>
          
          <div className="flex flex-col gap-6">
            <span className="text-3xl font-extralight text-zinc-100 tracking-tight leading-snug">
              Every conversation, one calm inbox.
            </span>
            <div className="flex gap-3 w-full">
              <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-zinc-400 font-light">Teams on Mail</span>
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                </div>
                <span className="text-3xl font-extralight text-zinc-100 tracking-tight">4,200</span>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-zinc-400 font-light">Avg. reply time</span>
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                </div>
                <span className="text-3xl font-extralight text-zinc-100 tracking-tight">12m</span>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-sm font-light text-zinc-400 leading-relaxed">
                "We moved the whole studio over in an afternoon. Nobody asked a single question — it just made sense."
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">SL</div>
                <div className="flex flex-col">
                  <span className="text-sm font-normal text-zinc-50">Sarah Lin</span>
                  <span className="text-xs font-light text-zinc-500">Ops lead, Nordbyte</span>
                </div>
              </div>
            </div>
          </div>
          <span className="text-xs font-light text-zinc-600">© 2026 Nordbyte</span>
        </aside>

        {/* Form Panel */}
        <main className="bg-white rounded-2xl flex flex-col items-center justify-center flex-1 overflow-y-auto p-8">
          <div className="w-full max-w-[360px] flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xl font-medium text-zinc-950 tracking-tight">Welcome back</span>
              <span className="text-xs font-light text-zinc-500">Sign in to continue to your inbox.</span>
            </div>

            <Button variant="secondary" icon="solar:shield-keyhole-linear" className="w-full">
              <span className="text-xs font-normal">Continue with SSO</span>
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px bg-zinc-200 flex-1"></div>
              <span className="text-xs font-light text-zinc-400">or</span>
              <div className="h-px bg-zinc-200 flex-1"></div>
            </div>

            <div className="flex flex-col gap-4">
              <InputField label="Email" placeholder="you@company.com" type="email" />
              <InputField
                label="Password"
                placeholder="Enter your password"
                type="password"
                labelAction={
                  <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">
                    Forgot password?
                  </a>
                }
              />
            </div>

            <Button variant="primary" icon="solar:login-2-linear" className="w-full py-2.5">
              <span className="text-xs font-medium tracking-wide">Sign In</span>
            </Button>

            <span className="text-xs font-light text-zinc-500 text-center">
              Don't have an account? <a href="#" className="font-normal text-zinc-950 hover:underline">Create one</a>
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

### Task 6: Convert SettingsPage Pattern

**Files:**
- Create: `craft/src/patterns/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsPage.tsx (converted from settings.html)**

This is a complex page with sidebar, sub-nav, and form sections. Convert with the same structure as the HTML but using React components.

---

### Task 7-14: Convert Remaining Patterns

**Files:**
- Create: `craft/src/patterns/MailboxPage.tsx`
- Create: `craft/src/patterns/ChatInterfacePage.tsx`
- Create: `craft/src/patterns/DataTablePage.tsx`
- Create: `craft/src/patterns/LandingPage.tsx`
- Create: `craft/src/patterns/MarketplaceGridPage.tsx`
- Create: `craft/src/patterns/ProductFormPage.tsx`
- Create: `craft/src/patterns/BlogPostFormPage.tsx`
- Create: `craft/src/patterns/MobilePage.tsx`

Each follows the same conversion pattern:
1. Read the HTML file from `docs/design-system/patterns/*.html`
2. Convert to React JSX
3. Use UI components where applicable
4. Maintain the same structure and styling

---

### Task 15: Create Pattern Index and Verify

**Files:**
- Create: `craft/src/patterns/index.ts`

- [ ] **Step 1: Create patterns/index.ts barrel export**

```ts
export { AuthPage } from "./AuthPage";
export { BlogPostFormPage } from "./BlogPostFormPage";
export { ChatInterfacePage } from "./ChatInterfacePage";
export { DataTablePage } from "./DataTablePage";
export { LandingPage } from "./LandingPage";
export { MailboxPage } from "./MailboxPage";
export { MarketplaceGridPage } from "./MarketplaceGridPage";
export { MobilePage } from "./MobilePage";
export { ProductFormPage } from "./ProductFormPage";
export { SettingsPage } from "./SettingsPage";
```

- [ ] **Step 2: Run dev server and verify**

```bash
cd craft && npm run dev
```

Open `http://localhost:5173` and verify:
- Navigation works
- All patterns load
- Components render correctly
- Focus states show green-400

- [ ] **Step 3: Commit**

```bash
git add craft/
git commit -m "feat: replace Next.js with Vite React playground for design system"
```

---

## Notes

- Keep `docs/design-system/patterns/*.html` files as reference until all patterns are verified
- Update `docs/design-system/components.md` after verification to reference React components
- The old `craft/template/` directory should be fully replaced by the new `craft/` structure
