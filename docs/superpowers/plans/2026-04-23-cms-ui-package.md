# `@tn-figueiredo/cms-ui` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the OneCMS shell + UI primitives from `bythiagofigueiredo` into a self-contained `@tn-figueiredo/cms-ui` package in the `tnf-ecosystem` monorepo.

**Architecture:** Two-repo workflow. Package created in `/Users/figueiredo/Workspace/tnf-ecosystem/packages/cms-ui/` with tsup (JS) + PostCSS/Tailwind 4 (CSS) build. After publish, `bythiagofigueiredo` migrates to consume it. Components adapted from hardcoded to props-driven (sidebar sections, bottom tabs, settings item, logout action).

**Tech Stack:** TypeScript 5, React 19, Next.js 15 (peer), tsup 8.5, Tailwind CSS 4 (PostCSS), Vitest 4, @testing-library/react

**Repos:**
- Package: `/Users/figueiredo/Workspace/tnf-ecosystem` (branch: `feat/cms-ui`)
- Consumer migration: `/Users/figueiredo/Workspace/bythiagofigueiredo` (branch: `feat/onecms-redesign`)

**Parallelism:** Tasks 2, 3, 4 are independent and can run simultaneously after Task 1. Task 5 depends on 3+4. Task 6 depends on 5. Tasks 7+8 are sequential.

---

## File Map

### New files in `tnf-ecosystem/packages/cms-ui/`

| File | Responsibility |
|---|---|
| `package.json` | Package metadata, exports, peer deps, scripts |
| `tsconfig.json` | TypeScript config extending base |
| `tsup.config.ts` | JS/TS build (ESM + CJS + DTS) |
| `postcss.config.mjs` | Tailwind 4 PostCSS plugin |
| `vitest.config.ts` | Test runner config |
| `src/styles.css` | Design tokens + Tailwind 4 `@theme` + keyframes |
| `src/index.ts` | Server-safe exports: types + constants |
| `src/client.ts` | `'use client'` barrel: all React components |
| `src/ui/kpi-card.tsx` | KPI metric card with trend + sparkline |
| `src/ui/status-badge.tsx` | Status indicator (21 variants) |
| `src/ui/cms-button.tsx` | Styled button (primary/ghost/danger) |
| `src/ui/skeleton-block.tsx` | Shimmer loading placeholder |
| `src/ui/empty-state.tsx` | Empty state with icon, action, hints |
| `src/ui/context-menu.tsx` | Dropdown menu with items + divider |
| `src/ui/toast.tsx` | Toast notifications provider + hook |
| `src/ui/sparkline.tsx` | Micro SVG line chart |
| `src/ui/pagination.tsx` | Page navigation with windowed list |
| `src/ui/format-date.ts` | `formatRelativeTime` utility |
| `src/shell/sidebar-context.tsx` | SidebarProvider + useSidebar hook |
| `src/shell/cms-sidebar.tsx` | Responsive sidebar (props-driven sections) |
| `src/shell/cms-topbar.tsx` | Page header with title + actions |
| `src/shell/cms-bottom-nav.tsx` | Mobile tab bar (props-driven tabs) |
| `src/shell/cms-shell.tsx` | Root layout wrapper composing all shell + providers |
| `src/__tests__/setup.ts` | Test setup (jest-dom matchers) |
| `src/__tests__/ui/context-menu.test.tsx` | 11 tests |
| `src/__tests__/ui/empty-state.test.tsx` | 8 tests |
| `src/__tests__/ui/toast.test.tsx` | 10 tests |
| `src/__tests__/ui/sparkline.test.tsx` | 10 tests |
| `src/__tests__/ui/status-badge.test.tsx` | 6 tests (new) |
| `src/__tests__/ui/pagination.test.tsx` | 7 tests (new) |
| `src/__tests__/shell/sidebar-context.test.tsx` | 5 tests (new) |

### Modified files in `bythiagofigueiredo` (Task 8 — migration)

| File | Change |
|---|---|
| `apps/web/package.json` | Add `@tn-figueiredo/cms-ui` dep |
| `apps/web/src/app/globals.css` | Remove CMS tokens block, import package CSS |
| ~15 files importing `@/components/cms/ui` | Change to `@tn-figueiredo/cms-ui/client` |
| ~5 files importing shell components | Change to `@tn-figueiredo/cms-ui/client` |
| `apps/web/src/components/cms/ui/` | Delete directory (10 files) |
| `apps/web/src/components/cms/cms-shell.tsx` | Delete |
| `apps/web/src/components/cms/cms-sidebar.tsx` | Delete |
| `apps/web/src/components/cms/cms-topbar.tsx` | Delete |
| `apps/web/src/components/cms/cms-bottom-nav.tsx` | Delete |
| `apps/web/src/components/cms/sidebar-context.tsx` | Delete |

---

### Task 1: Package Scaffold

**Files:**
- Create: `packages/cms-ui/package.json`
- Create: `packages/cms-ui/tsconfig.json`
- Create: `packages/cms-ui/tsup.config.ts`
- Create: `packages/cms-ui/postcss.config.mjs`
- Create: `packages/cms-ui/vitest.config.ts`
- Create: `packages/cms-ui/src/__tests__/setup.ts`

**Context:** All work in this task happens in `/Users/figueiredo/Workspace/tnf-ecosystem`. Create a new branch `feat/cms-ui` from `main`.

- [ ] **Step 1: Create branch**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git checkout main && git pull
git checkout -b feat/cms-ui
```

- [ ] **Step 2: Create package.json**

Create `packages/cms-ui/package.json`:

```json
{
  "name": "@tn-figueiredo/cms-ui",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "require": "./dist/client.cjs",
      "import": "./dist/client.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build:css": "postcss src/styles.css -o dist/styles.css",
    "build:js": "tsup",
    "build": "npm run build:css && npm run build:js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "dev": "tsup --watch"
  },
  "peerDependencies": {
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0",
    "next": ">=15.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "happy-dom": "^18.0.1",
    "next": "^15.0.0",
    "postcss": "^8.5.0",
    "postcss-cli": "^11.0.0",
    "tailwindcss": "^4.1.0",
    "tsup": "*",
    "typescript": "*",
    "vitest": "*"
  },
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/TN-Figueiredo/tnf-ecosystem.git",
    "directory": "packages/cms-ui"
  },
  "license": "MIT",
  "author": "Thiago Figueiredo <tnfigueiredotv@gmail.com>"
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `packages/cms-ui/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "src/__tests__"]
}
```

- [ ] **Step 4: Create tsup.config.ts**

Create `packages/cms-ui/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  external: ['react', 'react-dom', 'next'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
  banner: ({ format }) => {
    // 'use client' banner is in client.ts source, tsup preserves it
    return {}
  },
})
```

- [ ] **Step 5: Create postcss.config.mjs**

Create `packages/cms-ui/postcss.config.mjs`:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 6: Create vitest.config.ts**

Create `packages/cms-ui/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
})
```

- [ ] **Step 7: Create test setup**

Create `packages/cms-ui/src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 8: Install dependencies**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npm install
```

- [ ] **Step 9: Commit scaffold**

```bash
git add packages/cms-ui/
git commit -m "feat(cms-ui): scaffold package with tsup + postcss + vitest"
```

---

### Task 2: CSS — Design Tokens + Tailwind 4 Theme

**Files:**
- Create: `packages/cms-ui/src/styles.css`

**Context:** This file is the ONLY CSS the consumer needs to import. It contains design tokens (dark + light themes), Tailwind 4 `@theme` registration (so utilities like `bg-cms-surface` compile), `@source` directives (so Tailwind scans component files for used classes), and keyframe animations. PostCSS compiles this into `dist/styles.css` with all resolved utility classes.

**Important:** Use `@import "tailwindcss/utilities"` (NOT `@import "tailwindcss"`) — we do NOT want Tailwind's preflight/reset as the consumer already has one.

- [ ] **Step 1: Create styles.css**

Create `packages/cms-ui/src/styles.css`:

```css
/* @tn-figueiredo/cms-ui — Design System Tokens + Utilities
   Import this file once in your app: @import '@tn-figueiredo/cms-ui/styles.css' */

@import "tailwindcss/utilities";

/* Tell Tailwind 4 which source files to scan for class usage */
@source "./shell/**/*.tsx";
@source "./ui/**/*.tsx";

/* Register CMS tokens as Tailwind theme values.
   This enables utility classes like bg-cms-surface, text-cms-text, etc. */
@theme {
  --color-cms-bg: var(--cms-bg);
  --color-cms-surface: var(--cms-surface);
  --color-cms-surface-hover: var(--cms-surface-hover);
  --color-cms-border: var(--cms-border);
  --color-cms-border-subtle: var(--cms-border-subtle);
  --color-cms-text: var(--cms-text);
  --color-cms-text-muted: var(--cms-text-muted);
  --color-cms-text-dim: var(--cms-text-dim);
  --color-cms-accent: var(--cms-accent);
  --color-cms-accent-hover: var(--cms-accent-hover);
  --color-cms-accent-subtle: var(--cms-accent-subtle);
  --color-cms-green: var(--cms-green);
  --color-cms-green-subtle: var(--cms-green-subtle);
  --color-cms-amber: var(--cms-amber);
  --color-cms-amber-subtle: var(--cms-amber-subtle);
  --color-cms-red: var(--cms-red);
  --color-cms-red-subtle: var(--cms-red-subtle);
  --color-cms-cyan: var(--cms-cyan);
  --color-cms-cyan-subtle: var(--cms-cyan-subtle);
  --color-cms-rose: var(--cms-rose);
  --color-cms-rose-subtle: var(--cms-rose-subtle);
  --color-cms-purple: var(--cms-purple);
  --color-cms-purple-subtle: var(--cms-purple-subtle);
}

/* ===== Dark theme (default) ===== */
[data-area="cms"] {
  --cms-bg: #0f1117;
  --cms-surface: #1a1d27;
  --cms-surface-hover: #1f2330;
  --cms-border: #2a2d3a;
  --cms-border-subtle: #22252f;
  --cms-text: #e4e4e7;
  --cms-text-muted: #71717a;
  --cms-text-dim: #52525b;
  --cms-accent: #6366f1;
  --cms-accent-hover: #818cf8;
  --cms-accent-subtle: rgba(99,102,241,.12);
  --cms-green: #22c55e;
  --cms-green-subtle: rgba(34,197,94,.12);
  --cms-amber: #f59e0b;
  --cms-amber-subtle: rgba(245,158,11,.12);
  --cms-red: #ef4444;
  --cms-red-subtle: rgba(239,68,68,.12);
  --cms-cyan: #06b6d4;
  --cms-cyan-subtle: rgba(6,182,212,.12);
  --cms-rose: #f43f5e;
  --cms-rose-subtle: rgba(244,63,94,.12);
  --cms-purple: #8b5cf6;
  --cms-purple-subtle: rgba(139,92,246,.12);
  --cms-radius: 8px;
  --cms-sidebar-w: 230px;
}

/* ===== Light theme overrides ===== */
[data-theme="light"] [data-area="cms"] {
  --cms-bg: #f8f9fb;
  --cms-surface: #ffffff;
  --cms-surface-hover: #f3f4f6;
  --cms-border: #e5e7eb;
  --cms-border-subtle: #f0f0f3;
  --cms-text: #1f2937;
  --cms-text-muted: #6b7280;
  --cms-text-dim: #9ca3af;
  --cms-accent: #6366f1;
  --cms-accent-hover: #4f46e5;
  --cms-accent-subtle: rgba(99,102,241,.08);
  --cms-green-subtle: rgba(34,197,94,.08);
  --cms-amber-subtle: rgba(245,158,11,.08);
  --cms-red-subtle: rgba(239,68,68,.08);
  --cms-cyan-subtle: rgba(6,182,212,.08);
  --cms-rose-subtle: rgba(244,63,94,.08);
  --cms-purple-subtle: rgba(139,92,246,.08);
}

/* ===== Keyframes ===== */
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Utility class for skeleton shimmer animation */
@utility animate-shimmer {
  animation: shimmer 1.5s linear infinite;
}
```

- [ ] **Step 2: Verify CSS build works**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
mkdir -p packages/cms-ui/dist
npx postcss packages/cms-ui/src/styles.css -o packages/cms-ui/dist/styles.css --config packages/cms-ui/postcss.config.mjs
```

Expected: `dist/styles.css` is created with resolved utility classes. If there are errors about missing source files (because component .tsx files don't exist yet), that's expected — the CSS build will be re-run in Task 7 after all source files exist.

- [ ] **Step 3: Commit**

```bash
git add packages/cms-ui/src/styles.css
git commit -m "feat(cms-ui): add design tokens + Tailwind 4 theme CSS"
```

---

### Task 3: UI Primitives

**Files:**
- Create: `packages/cms-ui/src/ui/format-date.ts`
- Create: `packages/cms-ui/src/ui/sparkline.tsx`
- Create: `packages/cms-ui/src/ui/skeleton-block.tsx`
- Create: `packages/cms-ui/src/ui/cms-button.tsx`
- Create: `packages/cms-ui/src/ui/status-badge.tsx`
- Create: `packages/cms-ui/src/ui/kpi-card.tsx`
- Create: `packages/cms-ui/src/ui/empty-state.tsx`
- Create: `packages/cms-ui/src/ui/context-menu.tsx`
- Create: `packages/cms-ui/src/ui/toast.tsx`
- Create: `packages/cms-ui/src/ui/pagination.tsx`

**Context:** Copy these files from `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/components/cms/ui/`. The ONLY change needed is fixing internal imports — the originals import from `'./sparkline'` which is fine (they're co-located). No path alias changes needed since these files reference each other with relative paths already.

**Important:** Do NOT create `src/ui/index.ts` — exports are handled by `src/client.ts` (Task 5).

- [ ] **Step 1: Copy all UI primitive files**

Copy each file verbatim from `bythiagofigueiredo`. The files are self-contained with relative imports only. Copy these 10 files:

Source → Destination mapping:
- `apps/web/src/components/cms/ui/format-date.ts` → `packages/cms-ui/src/ui/format-date.ts`
- `apps/web/src/components/cms/ui/sparkline.tsx` → `packages/cms-ui/src/ui/sparkline.tsx`
- `apps/web/src/components/cms/ui/skeleton-block.tsx` → `packages/cms-ui/src/ui/skeleton-block.tsx`
- `apps/web/src/components/cms/ui/cms-button.tsx` → `packages/cms-ui/src/ui/cms-button.tsx`
- `apps/web/src/components/cms/ui/status-badge.tsx` → `packages/cms-ui/src/ui/status-badge.tsx`
- `apps/web/src/components/cms/ui/kpi-card.tsx` → `packages/cms-ui/src/ui/kpi-card.tsx`
- `apps/web/src/components/cms/ui/empty-state.tsx` → `packages/cms-ui/src/ui/empty-state.tsx`
- `apps/web/src/components/cms/ui/context-menu.tsx` → `packages/cms-ui/src/ui/context-menu.tsx`
- `apps/web/src/components/cms/ui/toast.tsx` → `packages/cms-ui/src/ui/toast.tsx`
- `apps/web/src/components/cms/ui/pagination.tsx` → `packages/cms-ui/src/ui/pagination.tsx`

Verify: `ls packages/cms-ui/src/ui/` should show exactly 10 files.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx tsc --noEmit -p packages/cms-ui/tsconfig.json
```

Expected: No errors (all internal imports are relative).

- [ ] **Step 3: Commit**

```bash
git add packages/cms-ui/src/ui/
git commit -m "feat(cms-ui): add 10 UI primitive components"
```

---

### Task 4: Shell Components (Props-Driven Adaptation)

**Files:**
- Create: `packages/cms-ui/src/shell/sidebar-context.tsx`
- Create: `packages/cms-ui/src/shell/cms-topbar.tsx`
- Create: `packages/cms-ui/src/shell/cms-sidebar.tsx`
- Create: `packages/cms-ui/src/shell/cms-bottom-nav.tsx`
- Create: `packages/cms-ui/src/shell/cms-shell.tsx`

**Context:** These are adapted from `bythiagofigueiredo` with key changes:
1. **CmsSidebar**: Accept `sections`, `settingsItem`, `logoutAction` as props (instead of hardcoded `SECTIONS`/`SETTINGS_ITEM`). Move defaults to `src/index.ts`.
2. **CmsBottomNav**: Accept `tabs` as prop (instead of hardcoded `TABS`). Move defaults to `src/index.ts`.
3. **CmsShell**: Accept all customization props and pass through.
4. **Imports**: Toast imported from `../ui/toast` (relative within package). `sidebar-context` imported from `./sidebar-context`.

- [ ] **Step 1: Create sidebar-context.tsx**

Create `packages/cms-ui/src/shell/sidebar-context.tsx` — this is an exact copy (no changes needed):

```typescript
'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type SidebarMode = 'expanded' | 'collapsed' | 'mobile'

interface SidebarContextValue {
  mode: SidebarMode
  isExpanded: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({ mode: 'expanded', isExpanded: true, toggle: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SidebarMode>('expanded')

  useEffect(() => {
    function onResize() {
      const w = window.innerWidth
      if (w < 768) setMode('mobile')
      else if (w < 1280) setMode('collapsed')
      else setMode('expanded')
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'expanded' ? 'collapsed' : 'expanded'))
  }, [])

  return (
    <SidebarContext.Provider value={{ mode, isExpanded: mode === 'expanded', toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}
```

- [ ] **Step 2: Create cms-topbar.tsx**

Create `packages/cms-ui/src/shell/cms-topbar.tsx` — exact copy with import path fix:

```typescript
'use client'

import { useSidebar } from './sidebar-context'

interface CmsTopbarProps {
  title: string
  actions?: React.ReactNode
}

export function CmsTopbar({ title, actions }: CmsTopbarProps) {
  const { mode } = useSidebar()

  if (mode === 'mobile') {
    return (
      <header className="flex items-center justify-between px-4 py-3 border-b border-cms-border bg-cms-surface">
        <h1 className="text-base font-semibold text-cms-text">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    )
  }

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-cms-border bg-cms-surface">
      <h1 className="text-lg font-semibold text-cms-text">{title}</h1>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  )
}
```

- [ ] **Step 3: Create cms-sidebar.tsx — ADAPTED for props**

Create `packages/cms-ui/src/shell/cms-sidebar.tsx`. Key changes vs original:
- `sections` prop replaces hardcoded `SECTIONS`
- `settingsItem` prop replaces hardcoded `SETTINGS_ITEM` (null = hidden)
- `logoutAction` prop replaces hardcoded `'/cms/logout'`
- `ROLE_RANK` and `hasAccess` kept internal (also exported from index.ts)

```typescript
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'
import type { SidebarSection, SidebarNavItem } from '../index'

const ROLE_RANK: Record<string, number> = { reporter: 0, editor: 1, org_admin: 2, super_admin: 3 }

function hasAccess(userRole: string, minRole?: string): boolean {
  if (!minRole) return true
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

interface CmsSidebarProps {
  siteName: string
  siteInitials: string
  userDisplayName: string
  userRole: string
  sections: SidebarSection[]
  settingsItem: SidebarNavItem | null
  logoutAction: string
  siteSwitcher?: React.ReactNode
  badges?: Record<string, string | number>
}

export function CmsSidebar({ siteName, siteInitials, userDisplayName, userRole, sections, settingsItem, logoutAction, siteSwitcher, badges }: CmsSidebarProps) {
  const { mode } = useSidebar()
  const pathname = usePathname()

  if (mode === 'mobile') return null

  const isCollapsed = mode === 'collapsed'

  const filteredSections = useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        items: s.items
          .filter((item) => hasAccess(userRole, item.minRole))
          .map((item) => ({ ...item, badge: badges?.[item.href] ?? item.badge })),
      })).filter((s) => s.items.length > 0),
    [userRole, badges, sections],
  )

  return (
    <aside
      className={`flex flex-col h-screen bg-cms-surface border-r border-cms-border transition-[width] duration-200 shrink-0 ${isCollapsed ? 'w-12' : 'w-[var(--cms-sidebar-w)]'}`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-2.5 border-b border-cms-border ${isCollapsed ? 'justify-center py-3' : 'px-5 py-4'}`}>
        <div className="w-7 h-7 rounded-md bg-cms-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
          {siteInitials}
        </div>
        {!isCollapsed && <span className="text-sm font-semibold text-cms-text truncate">{siteName}</span>}
      </div>

      {/* Nav sections */}
      <nav aria-label="CMS Navigation" className="flex-1 overflow-y-auto py-2">
        {filteredSections.map((section) => (
          <div key={section.label} className="py-1">
            {section.label && !isCollapsed && (
              <div className="px-5 py-1 text-[10px] uppercase tracking-[1.5px] text-cms-text-dim">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const isActive = item.href === '/cms' ? pathname === '/cms' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-2.5 text-[13px] transition-all duration-150
                    ${isCollapsed ? 'justify-center py-2 mx-1 rounded-md' : 'px-5 py-2'}
                    ${isActive
                      ? 'text-cms-accent bg-cms-accent-subtle'
                      : 'text-cms-text-muted hover:text-cms-text hover:bg-cms-surface-hover'
                    }`}
                >
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-sm bg-cms-accent" />
                  )}
                  <span className={`text-sm shrink-0 ${isCollapsed ? '' : 'w-[18px] text-center'}`}>{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {!isCollapsed && item.badge != null && (
                    <span className="ml-auto text-[11px] px-1.5 py-px rounded-full bg-cms-accent-subtle text-cms-accent font-medium">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
        {/* Settings divider + item (admin+ only) */}
        {settingsItem && hasAccess(userRole, settingsItem.minRole) && (
        <div className="border-t border-cms-border mt-2 pt-2">
          <Link
            href={settingsItem.href}
            className={`flex items-center gap-2.5 text-[13px] text-cms-text-dim transition-all duration-150 hover:text-cms-text hover:bg-cms-surface-hover
              ${isCollapsed ? 'justify-center py-2 mx-1 rounded-md' : 'px-5 py-2'}
              ${pathname.startsWith(settingsItem.href) ? 'text-cms-accent bg-cms-accent-subtle' : ''}`}
          >
            <span className={`text-sm shrink-0 ${isCollapsed ? '' : 'w-[18px] text-center'}`}>{settingsItem.icon}</span>
            {!isCollapsed && <span>{settingsItem.label}</span>}
          </Link>
        </div>
        )}
      </nav>

      {/* Site switcher slot */}
      {siteSwitcher && !isCollapsed && (
        <div className="border-t border-cms-border px-3 py-2">{siteSwitcher}</div>
      )}

      {/* User footer */}
      <div className={`border-t border-cms-border ${isCollapsed ? 'flex justify-center py-3' : 'px-3 py-3'}`}>
        <div className={`flex items-center gap-2.5 ${isCollapsed ? '' : 'px-2 py-1.5 rounded-[var(--cms-radius)]'}`}>
          <div className="w-7 h-7 rounded-full bg-cms-accent flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
            {userDisplayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 text-xs min-w-0">
              <div className="text-cms-text font-medium truncate">{userDisplayName}</div>
              <div className="text-cms-text-dim text-[10px]">{userRole}</div>
            </div>
          )}
          {!isCollapsed && (
            <form action={logoutAction} method="POST">
              <button type="submit" className="text-cms-text-dim hover:text-cms-text text-xs transition-colors" title="Sign out" aria-label="Sign out">
                ↗
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create cms-bottom-nav.tsx — ADAPTED for props**

Create `packages/cms-ui/src/shell/cms-bottom-nav.tsx`. Key change: accepts `tabs` prop.

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'
import type { BottomTab } from '../index'

interface CmsBottomNavProps {
  tabs: BottomTab[]
}

export function CmsBottomNav({ tabs }: CmsBottomNavProps) {
  const { mode } = useSidebar()
  const pathname = usePathname()

  if (mode !== 'mobile') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-cms-surface border-t border-cms-border flex items-center justify-around z-50">
      {tabs.map((tab) => {
        const isActive = tab.href === '/cms' ? pathname === '/cms' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 text-[10px] ${isActive ? 'text-cms-accent' : 'text-cms-text-dim'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 5: Create cms-shell.tsx — ADAPTED as orchestrator**

Create `packages/cms-ui/src/shell/cms-shell.tsx`. Orchestrates all shell components. Accepts all customization props with defaults.

```typescript
'use client'

import type { ReactNode } from 'react'
import { SidebarProvider } from './sidebar-context'
import { CmsSidebar } from './cms-sidebar'
import { CmsBottomNav } from './cms-bottom-nav'
import { ToastProvider } from '../ui/toast'
import { DEFAULT_SECTIONS, DEFAULT_SETTINGS_ITEM, DEFAULT_BOTTOM_TABS } from '../index'
import type { SidebarSection, SidebarNavItem, BottomTab } from '../index'

export interface CmsShellProps {
  siteName: string
  siteInitials: string
  userDisplayName: string
  userRole: string
  sections?: SidebarSection[]
  bottomTabs?: BottomTab[]
  settingsItem?: SidebarNavItem | null
  logoutAction?: string
  siteSwitcher?: ReactNode
  badges?: Record<string, string | number>
  children: ReactNode
}

export function CmsShell({
  siteName,
  siteInitials,
  userDisplayName,
  userRole,
  sections = DEFAULT_SECTIONS,
  bottomTabs = DEFAULT_BOTTOM_TABS,
  settingsItem = DEFAULT_SETTINGS_ITEM,
  logoutAction = '/cms/logout',
  siteSwitcher,
  badges,
  children,
}: CmsShellProps) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <div className="flex h-screen bg-cms-bg text-cms-text" data-area="cms">
          <CmsSidebar
            siteName={siteName}
            siteInitials={siteInitials}
            userDisplayName={userDisplayName}
            userRole={userRole}
            sections={sections}
            settingsItem={settingsItem}
            logoutAction={logoutAction}
            siteSwitcher={siteSwitcher}
            badges={badges}
          />
          <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>
          <CmsBottomNav tabs={bottomTabs} />
        </div>
      </ToastProvider>
    </SidebarProvider>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/cms-ui/src/shell/
git commit -m "feat(cms-ui): add shell components — sidebar, topbar, bottom nav, shell orchestrator"
```

---

### Task 5: Entry Points — index.ts + client.ts

**Files:**
- Create: `packages/cms-ui/src/index.ts`
- Create: `packages/cms-ui/src/client.ts`

**Context:** Depends on Tasks 3 and 4 being complete. `index.ts` exports types and server-safe constants. `client.ts` has the `'use client'` directive and re-exports all React components.

- [ ] **Step 1: Create index.ts**

Create `packages/cms-ui/src/index.ts`:

```typescript
// --- Types ---

export interface SidebarNavItem {
  icon: string
  label: string
  href: string
  badge?: string | number
  minRole?: 'reporter' | 'editor' | 'org_admin' | 'super_admin'
}

export interface SidebarSection {
  label?: string
  items: SidebarNavItem[]
}

export interface BottomTab {
  icon: string
  label: string
  href: string
}

export type { StatusVariant } from './ui/status-badge'
export type { CmsShellProps } from './shell/cms-shell'
export type { PaginationProps } from './ui/pagination'

// --- Server-safe constants ---

export const ROLE_RANK: Record<string, number> = {
  reporter: 0,
  editor: 1,
  org_admin: 2,
  super_admin: 3,
}

export const DEFAULT_SECTIONS: SidebarSection[] = [
  {
    label: 'Overview',
    items: [
      { icon: '📊', label: 'Dashboard', href: '/cms' },
      { icon: '📅', label: 'Schedule', href: '/cms/schedule' },
    ],
  },
  {
    label: 'Content',
    items: [
      { icon: '📝', label: 'Posts', href: '/cms/blog' },
      { icon: '📰', label: 'Newsletters', href: '/cms/newsletters', minRole: 'editor' },
      { icon: '📢', label: 'Campaigns', href: '/cms/campaigns', minRole: 'editor' },
    ],
  },
  {
    label: 'People',
    items: [
      { icon: '👤', label: 'Authors', href: '/cms/authors', minRole: 'editor' },
      { icon: '📧', label: 'Subscribers', href: '/cms/subscribers', minRole: 'org_admin' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: '📈', label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
    ],
  },
]

export const DEFAULT_SETTINGS_ITEM: SidebarNavItem = {
  icon: '⚙️',
  label: 'Settings',
  href: '/cms/settings',
  minRole: 'org_admin',
}

export const DEFAULT_BOTTOM_TABS: BottomTab[] = [
  { icon: '🏠', label: 'Home', href: '/cms' },
  { icon: '📅', label: 'Schedule', href: '/cms/schedule' },
  { icon: '📝', label: 'Posts', href: '/cms/blog' },
  { icon: '📈', label: 'Analytics', href: '/cms/analytics' },
  { icon: '📰', label: 'Letters', href: '/cms/newsletters' },
]
```

- [ ] **Step 2: Create client.ts**

Create `packages/cms-ui/src/client.ts`:

```typescript
'use client'

// Shell
export { CmsShell } from './shell/cms-shell'
export type { CmsShellProps } from './shell/cms-shell'
export { CmsSidebar } from './shell/cms-sidebar'
export { CmsTopbar } from './shell/cms-topbar'
export { CmsBottomNav } from './shell/cms-bottom-nav'
export { SidebarProvider, useSidebar } from './shell/sidebar-context'

// UI Primitives
export { KpiCard } from './ui/kpi-card'
export { StatusBadge } from './ui/status-badge'
export type { StatusVariant } from './ui/status-badge'
export { CmsButton } from './ui/cms-button'
export { SkeletonBlock } from './ui/skeleton-block'
export { EmptyState } from './ui/empty-state'
export { ContextMenu, ContextMenuItem, ContextMenuDivider } from './ui/context-menu'
export { ToastProvider, useToast } from './ui/toast'
export { Sparkline } from './ui/sparkline'
export { Pagination } from './ui/pagination'
export type { PaginationProps } from './ui/pagination'
export { formatRelativeTime } from './ui/format-date'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx tsc --noEmit -p packages/cms-ui/tsconfig.json
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cms-ui/src/index.ts packages/cms-ui/src/client.ts
git commit -m "feat(cms-ui): add entry points — index.ts (types+constants) + client.ts (use client barrel)"
```

---

### Task 6: Tests

**Files:**
- Create: `packages/cms-ui/src/__tests__/ui/context-menu.test.tsx`
- Create: `packages/cms-ui/src/__tests__/ui/empty-state.test.tsx`
- Create: `packages/cms-ui/src/__tests__/ui/toast.test.tsx`
- Create: `packages/cms-ui/src/__tests__/ui/sparkline.test.tsx`
- Create: `packages/cms-ui/src/__tests__/ui/status-badge.test.tsx`
- Create: `packages/cms-ui/src/__tests__/ui/pagination.test.tsx`
- Create: `packages/cms-ui/src/__tests__/shell/sidebar-context.test.tsx`

**Context:** Port 4 existing test files from `bythiagofigueiredo` with import path changes (`@/components/cms/ui/*` → `../../ui/*`). Add 3 new test files for status-badge, pagination, and sidebar-context. Mock `next/link` and `next/navigation` for shell tests.

- [ ] **Step 1: Port context-menu tests**

Create `packages/cms-ui/src/__tests__/ui/context-menu.test.tsx`. Change import from `@/components/cms/ui/context-menu` to `../../ui/context-menu`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu, ContextMenuItem, ContextMenuDivider } from '../../ui/context-menu'

describe('ContextMenu', () => {
  it('renders nothing when closed', () => {
    render(
      <ContextMenu open={false} onClose={() => {}}>
        <span>menu content</span>
      </ContextMenu>
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('renders menu with children when open', () => {
    render(
      <ContextMenu open={true} onClose={() => {}}>
        <span>menu content</span>
      </ContextMenu>
    )
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByText('menu content')).toBeTruthy()
  })

  it('calls onClose on outside click', () => {
    const onClose = vi.fn()
    render(
      <div>
        <ContextMenu open={true} onClose={onClose}>
          <span>inside menu</span>
        </ContextMenu>
        <button data-testid="outside">outside</button>
      </div>
    )
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu open={true} onClose={onClose}>
        <span>menu</span>
      </ContextMenu>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when clicking inside the menu', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu open={true} onClose={onClose}>
        <span data-testid="inside">inside menu</span>
      </ContextMenu>
    )
    fireEvent.mouseDown(screen.getByTestId('inside'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not attach listeners when closed', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu open={false} onClose={onClose}>
        <span>menu</span>
      </ContextMenu>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ContextMenuItem', () => {
  it('renders label text', () => {
    render(<ContextMenuItem label="Edit post" />)
    expect(screen.getByText('Edit post')).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ContextMenuItem label="Delete" onClick={onClick} />)
    fireEvent.click(screen.getByRole('menuitem'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders icon when provided', () => {
    render(<ContextMenuItem icon="✏️" label="Edit" />)
    expect(screen.getByText('✏️')).toBeTruthy()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ContextMenuItem label="Disabled action" disabled={true} />)
    const btn = screen.getByRole('menuitem') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<ContextMenuItem label="Disabled" disabled={true} onClick={onClick} />)
    fireEvent.click(screen.getByRole('menuitem'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ContextMenuDivider', () => {
  it('renders a divider element', () => {
    const { container } = render(<ContextMenuDivider />)
    const divider = container.querySelector('.bg-cms-border')
    expect(divider).toBeTruthy()
  })
})
```

- [ ] **Step 2: Port empty-state, toast, sparkline tests**

Same pattern — copy from `bythiagofigueiredo/apps/web/test/components/cms/ui/` with import path change from `@/components/cms/ui/*` to `../../ui/*`. Create 3 files:
- `packages/cms-ui/src/__tests__/ui/empty-state.test.tsx`
- `packages/cms-ui/src/__tests__/ui/toast.test.tsx`
- `packages/cms-ui/src/__tests__/ui/sparkline.test.tsx`

- [ ] **Step 3: Write new status-badge tests**

Create `packages/cms-ui/src/__tests__/ui/status-badge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../../ui/status-badge'

describe('StatusBadge', () => {
  it('renders with default label from variant name', () => {
    render(<StatusBadge variant="draft" />)
    expect(screen.getByText('draft')).toBeTruthy()
  })

  it('renders custom label when provided', () => {
    render(<StatusBadge variant="published" label="Live" />)
    expect(screen.getByText('Live')).toBeTruthy()
  })

  it('sets data-status attribute', () => {
    const { container } = render(<StatusBadge variant="sent" label="Sent" />)
    expect(container.querySelector('[data-status="sent"]')).toBeTruthy()
  })

  it('renders pill shape when pill prop is true', () => {
    const { container } = render(<StatusBadge variant="confirmed" label="OK" pill />)
    const badge = container.querySelector('[data-status="confirmed"]')
    expect(badge?.className).toContain('rounded-full')
  })

  it('renders animated dot when dot prop is true', () => {
    const { container } = render(<StatusBadge variant="sending" label="Sending" dot />)
    const dot = container.querySelector('.animate-pulse')
    expect(dot).toBeTruthy()
  })

  it('applies additional className', () => {
    const { container } = render(<StatusBadge variant="draft" className="ml-2" />)
    const badge = container.querySelector('[data-status="draft"]')
    expect(badge?.className).toContain('ml-2')
  })
})
```

- [ ] **Step 4: Write new pagination tests**

Create `packages/cms-ui/src/__tests__/ui/pagination.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '../../ui/pagination'

describe('Pagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />)
    expect(container.querySelector('nav')).toBeNull()
  })

  it('renders navigation with correct aria-label', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByLabelText('Pagination')).toBeTruthy()
  })

  it('calls onPageChange when clicking a page button', () => {
    const onChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onChange} />)
    fireEvent.click(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('marks current page with aria-current', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={() => {}} />)
    const currentBtn = screen.getByText('2')
    expect(currentBtn.getAttribute('aria-current')).toBe('page')
  })

  it('disables Prev button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />)
    const prev = screen.getByLabelText('Previous page') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
  })

  it('disables Next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />)
    const next = screen.getByLabelText('Next page') as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it('shows summary with totalItems and pageSize', () => {
    render(<Pagination currentPage={2} totalPages={3} totalItems={25} pageSize={10} onPageChange={() => {}} />)
    expect(screen.getByText(/11–20 of 25/)).toBeTruthy()
  })
})
```

- [ ] **Step 5: Write new sidebar-context tests**

Create `packages/cms-ui/src/__tests__/shell/sidebar-context.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SidebarProvider, useSidebar } from '../../shell/sidebar-context'

function SidebarModeDisplay() {
  const { mode, toggle } = useSidebar()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggle}>Toggle</button>
    </div>
  )
}

describe('SidebarProvider', () => {
  it('defaults to expanded mode on wide screens', () => {
    vi.stubGlobal('innerWidth', 1400)
    render(
      <SidebarProvider>
        <SidebarModeDisplay />
      </SidebarProvider>
    )
    expect(screen.getByTestId('mode').textContent).toBe('expanded')
    vi.unstubAllGlobals()
  })

  it('sets collapsed mode for medium screens', () => {
    vi.stubGlobal('innerWidth', 900)
    render(
      <SidebarProvider>
        <SidebarModeDisplay />
      </SidebarProvider>
    )
    expect(screen.getByTestId('mode').textContent).toBe('collapsed')
    vi.unstubAllGlobals()
  })

  it('sets mobile mode for small screens', () => {
    vi.stubGlobal('innerWidth', 600)
    render(
      <SidebarProvider>
        <SidebarModeDisplay />
      </SidebarProvider>
    )
    expect(screen.getByTestId('mode').textContent).toBe('mobile')
    vi.unstubAllGlobals()
  })

  it('toggles between expanded and collapsed', () => {
    vi.stubGlobal('innerWidth', 1400)
    render(
      <SidebarProvider>
        <SidebarModeDisplay />
      </SidebarProvider>
    )
    expect(screen.getByTestId('mode').textContent).toBe('expanded')
    fireEvent.click(screen.getByText('Toggle'))
    expect(screen.getByTestId('mode').textContent).toBe('collapsed')
    vi.unstubAllGlobals()
  })

  it('responds to window resize', () => {
    vi.stubGlobal('innerWidth', 1400)
    render(
      <SidebarProvider>
        <SidebarModeDisplay />
      </SidebarProvider>
    )
    expect(screen.getByTestId('mode').textContent).toBe('expanded')

    act(() => {
      vi.stubGlobal('innerWidth', 600)
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByTestId('mode').textContent).toBe('mobile')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx vitest run --config packages/cms-ui/vitest.config.ts
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/cms-ui/src/__tests__/
git commit -m "test(cms-ui): add 57 tests — ported 39 + 18 new for status-badge, pagination, sidebar-context"
```

---

### Task 7: Build + Verify

**Files:**
- No new files — verify the build pipeline produces correct output.

- [ ] **Step 1: Run full build**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npm run build -w packages/cms-ui
```

Expected: `dist/` contains:
- `index.js`, `index.cjs`, `index.d.ts`
- `client.js`, `client.cjs`, `client.d.ts`
- `styles.css`

- [ ] **Step 2: Verify styles.css content**

```bash
head -50 packages/cms-ui/dist/styles.css
```

Expected: Should contain resolved utility classes like `.bg-cms-surface`, `.text-cms-text`, etc. NOT raw `@import` or `@theme` directives.

- [ ] **Step 3: Verify client.js has 'use client' directive**

```bash
head -3 packages/cms-ui/dist/client.js
```

Expected: First line should be `'use client';` or `"use client";`.

- [ ] **Step 4: Verify bundle sizes**

```bash
wc -c packages/cms-ui/dist/styles.css packages/cms-ui/dist/client.js packages/cms-ui/dist/index.js
gzip -k packages/cms-ui/dist/styles.css packages/cms-ui/dist/client.js packages/cms-ui/dist/index.js
ls -la packages/cms-ui/dist/*.gz
```

Check against budget: styles.css < 15KB gzip, client.js < 25KB gzip, index.js < 2KB gzip.

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx tsc --noEmit -p packages/cms-ui/tsconfig.json
```

- [ ] **Step 6: Run tests one more time**

```bash
npx vitest run --config packages/cms-ui/vitest.config.ts
```

- [ ] **Step 7: Clean up gzip artifacts and commit**

```bash
rm -f packages/cms-ui/dist/*.gz
git add packages/cms-ui/
git commit -m "chore(cms-ui): verify build — CSS compiled, client.js has use-client banner, sizes within budget"
```

---

### Task 8: Publish to GitHub Packages

**Context:** This task publishes `@tn-figueiredo/cms-ui@0.1.0` to GitHub Packages. Requires `NPM_TOKEN` with `write:packages` scope.

- [ ] **Step 1: Create changeset**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
npx changeset
```

Select `@tn-figueiredo/cms-ui`, bump type: `minor` (0.0.0 → 0.1.0), summary: "Initial release — CMS shell + 10 UI primitives + design tokens CSS"

- [ ] **Step 2: Version the package**

```bash
npx changeset version
```

- [ ] **Step 3: Build + publish**

```bash
npm run build -w packages/cms-ui
cd packages/cms-ui && npm publish
```

- [ ] **Step 4: Verify on GitHub**

Check `https://github.com/orgs/TN-Figueiredo/packages` — `cms-ui` should appear in the list.

- [ ] **Step 5: Commit + push**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add .
git commit -m "chore(cms-ui): publish v0.1.0"
git push -u origin feat/cms-ui
```

---

### Task 9: Migration — Wire bythiagofigueiredo to consume package

**Context:** All work in this task happens in `/Users/figueiredo/Workspace/bythiagofigueiredo` on branch `feat/onecms-redesign`.

- [ ] **Step 1: Install the package**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm install @tn-figueiredo/cms-ui@0.1.0
```

- [ ] **Step 2: Update globals.css — replace inline tokens with package import**

In `apps/web/src/app/globals.css`, remove the entire `/* ===== CMS Design System ===== */` block (from `[data-area="cms"] {` through the closing `}` of light theme overrides), the `@keyframes shimmer` block, and the `.animate-shimmer` class. Add at the top of the file:

```css
@import '@tn-figueiredo/cms-ui/styles.css';
```

- [ ] **Step 3: Search-replace UI component imports**

Find all files importing from `@/components/cms/ui` or `@/components/cms/ui/*` and change to `@tn-figueiredo/cms-ui/client`:

```bash
grep -rl "@/components/cms/ui" apps/web/src/ | head -20
```

For each file: replace `from '@/components/cms/ui'` or `from '@/components/cms/ui/...'` with `from '@tn-figueiredo/cms-ui/client'`.

- [ ] **Step 4: Search-replace shell component imports**

Find all files importing shell components and change:
- `from '@/components/cms/cms-shell'` → `from '@tn-figueiredo/cms-ui/client'`
- `from '@/components/cms/cms-sidebar'` → `from '@tn-figueiredo/cms-ui/client'`
- `from '@/components/cms/cms-topbar'` → `from '@tn-figueiredo/cms-ui/client'`
- `from '@/components/cms/cms-bottom-nav'` → `from '@tn-figueiredo/cms-ui/client'`
- `from '@/components/cms/sidebar-context'` → `from '@tn-figueiredo/cms-ui/client'`
- `from '../sidebar-context'` or `from './sidebar-context'` → `from '@tn-figueiredo/cms-ui/client'`

```bash
grep -rl "cms-shell\|cms-sidebar\|cms-topbar\|cms-bottom-nav\|sidebar-context" apps/web/src/ | grep -v node_modules
```

- [ ] **Step 5: Delete extracted source files**

```bash
rm -rf apps/web/src/components/cms/ui/
rm apps/web/src/components/cms/cms-shell.tsx
rm apps/web/src/components/cms/cms-sidebar.tsx
rm apps/web/src/components/cms/cms-topbar.tsx
rm apps/web/src/components/cms/cms-bottom-nav.tsx
rm apps/web/src/components/cms/sidebar-context.tsx
```

Keep `apps/web/src/components/cms/site-switcher-provider.tsx` — this is app-specific glue.

- [ ] **Step 6: Update test mocks if needed**

Check `apps/web/test/cms-layout.test.tsx` — it mocks `../src/components/cms/cms-shell`. Update mock path to `@tn-figueiredo/cms-ui/client`.

- [ ] **Step 7: Run tests**

```bash
npm run test:web
```

Expected: All 804+ tests pass.

- [ ] **Step 8: Build**

```bash
cd apps/web && npx next build
```

Expected: Build succeeds with no module resolution errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(cms): migrate to @tn-figueiredo/cms-ui@0.1.0 — delete 15 local files, import from package"
```
