# `@tn-figueiredo/cms-ui` Package Design

> **For agentic workers:** This spec defines a new package in the `tnf-ecosystem` monorepo. Implementation plan follows.

**Goal:** Extract the OneCMS shell + UI primitives into a self-contained, publishable package so every `@tn-figueiredo/*` consumer gets the CMS with full design polish out of the box.

**Repository:** `TN-Figueiredo/tnf-ecosystem` → `packages/cms-ui/`

**Version:** `0.1.0`

**Status:** Design approved, pending implementation.

---

## 1. Architecture

Self-contained package that exports the CMS layout shell (sidebar, topbar, bottom nav) + 10 UI primitives + pre-compiled CSS (design tokens + Tailwind 4 utility classes). Published to GitHub Packages. Built with tsup + PostCSS (Tailwind 4 compilation). Zero runtime dependencies beyond React 19 + Next.js 15 (peer deps).

Consumer minimal setup:

```tsx
import '@tn-figueiredo/cms-ui/styles.css'
import { CmsShell } from '@tn-figueiredo/cms-ui/client'

export default function Layout({ children }) {
  return (
    <CmsShell siteName="MySite" siteInitials="MS" userDisplayName="User" userRole="editor">
      {children}
    </CmsShell>
  )
}
```

---

## 2. CSS Build Pipeline

### Problem

Components use Tailwind 4 custom utility classes (`bg-cms-surface`, `text-cms-text-muted`, `hover:bg-cms-surface-hover`, responsive variants like `md:hidden`, `lg:grid-cols-5`) that depend on `--cms-*` CSS custom properties. The consumer may or may not have Tailwind configured.

### Solution: Pre-compile Tailwind 4 at package build time

1. `src/styles.css` contains:
   - `@import "tailwindcss"` directive
   - `@source` directives pointing to component files
   - `@theme` block registering `--cms-*` tokens as Tailwind color/spacing values
   - Design tokens: `[data-area="cms"]` (dark default) + `[data-theme="light"] [data-area="cms"]` overrides
   - Keyframes (`shimmer`, `slideUp`)

2. **Two-step build** (CSS is NOT handled by tsup):
   - **Step 1 — CSS:** `postcss src/styles.css -o dist/styles.css` with `@tailwindcss/postcss` plugin. Tailwind 4 scans `src/**/*.tsx` via `@source` directives, resolves `@theme` values, outputs ALL utility classes used by components.
   - **Step 2 — JS:** `tsup` compiles TypeScript/JSX to ESM + CJS + .d.ts (does NOT touch CSS).
   - `package.json` scripts: `"build": "postcss src/styles.css -o dist/styles.css && tsup"`

3. Consumer imports `@tn-figueiredo/cms-ui/styles.css` — done. **No Tailwind setup required. No `transpilePackages` needed.** But if they do use Tailwind, the `--cms-*` vars are available for extension.

### `src/styles.css` structure

```css
@import "tailwindcss";

/* Tell Tailwind 4 which files to scan for class usage */
@source "./shell/**/*.tsx";
@source "./ui/**/*.tsx";

/* Register CMS tokens as Tailwind theme values so utilities
   like bg-cms-surface, text-cms-text etc. are generated */
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
  --radius-cms: var(--cms-radius);
}

/* Design tokens — dark theme (default) */
[data-area="cms"] { /* ... token definitions ... */ }

/* Light theme overrides */
[data-theme="light"] [data-area="cms"] { /* ... overrides ... */ }

/* Keyframes */
@keyframes shimmer { /* ... */ }
@keyframes slideUp { /* ... */ }
```

### CSS scope and reset

The package does NOT include any CSS reset or normalize. It assumes the consumer already has one (Next.js provides one via `globals.css`). All CMS styles are scoped to `[data-area="cms"]` via CSS custom properties — no global side effects beyond the token definitions and utility classes.

### Standalone primitive usage (without CmsShell)

If a consumer imports only primitives (e.g., `StatusBadge`) without `CmsShell`, the CSS tokens must still be active. Wrap the usage area in an element with `data-area="cms"`:

```tsx
import '@tn-figueiredo/cms-ui/styles.css'
import { StatusBadge } from '@tn-figueiredo/cms-ui/client'

function MyWidget() {
  return (
    <div data-area="cms">
      <StatusBadge variant="published" label="Live" pill />
    </div>
  )
}
```

`CmsShell` sets `data-area="cms"` automatically on its root div.

### Token override mechanism

Consumer overrides via standard CSS specificity, after the import:

```css
@import '@tn-figueiredo/cms-ui/styles.css';

[data-area="cms"] {
  --cms-accent: #0ea5e9;
  --cms-radius: 12px;
}
```

### Design Tokens (dark default)

```css
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
```

### Light theme overrides

```css
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
```

### Keyframes

- `shimmer` — 1.5s linear infinite for skeleton loaders
- `slideUp` — 200ms ease-out entrance for toasts

---

## 3. Export Map

| Subpath | Content | `'use client'` | Tree-shakeable |
|---|---|---|---|
| `./styles.css` | Tokens + compiled Tailwind utilities + keyframes | N/A | N/A |
| `.` (root) | Types + server-safe constants (`DEFAULT_SECTIONS`, `DEFAULT_BOTTOM_TABS`, `DEFAULT_SETTINGS_ITEM`, `ROLE_RANK`) | No | Yes |
| `./client` | All React components | Yes | Yes (tsup splitting: true) |

### package.json exports field

```json
{
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
  }
}
```

---

## 4. Shell Components

### `CmsShell`

Root layout wrapper. Composes SidebarProvider + ToastProvider + CmsSidebar + CmsBottomNav + main content area. Sets `data-area="cms"` on root div for CSS theming.

| Prop | Type | Default | Description |
|---|---|---|---|
| `siteName` | `string` | required | Site name in header |
| `siteInitials` | `string` | required | 2-char avatar |
| `userDisplayName` | `string` | required | User name in footer |
| `userRole` | `string` | required | Role for nav filtering |
| `sections` | `SidebarSection[]` | `DEFAULT_SECTIONS` | Sidebar nav items |
| `bottomTabs` | `BottomTab[]` | `DEFAULT_BOTTOM_TABS` | Mobile bottom nav tabs |
| `settingsItem` | `SidebarNavItem \| null` | `DEFAULT_SETTINGS_ITEM` | Settings item (null = hidden) |
| `siteSwitcher` | `ReactNode` | `undefined` | Slot for site switcher widget |
| `badges` | `Record<string, string \| number>` | `undefined` | Badge counts keyed by href |
| `logoutAction` | `string` | `'/cms/logout'` | Form action for logout POST |
| `children` | `ReactNode` | required | Page content |

### `CmsSidebar`

Responsive sidebar with role-based filtering. 3 modes:
- **expanded** (≥1280px): full sidebar with labels, `w-[var(--cms-sidebar-w)]`
- **collapsed** (768–1279px): icon-only, `w-12`
- **mobile** (<768px): hidden (bottom nav takes over)

Features: brand header, section labels (10px uppercase), active indicator (3px accent bar), user footer with role + logout, settings divider. `useMemo` on filtered sections.

### `CmsTopbar`

Page header. Props: `title: string`, `actions?: ReactNode`. Responsive sizing (compact on mobile).

### `CmsBottomNav`

Mobile-only tab bar (fixed bottom, z-50, h-14). Props: `tabs: BottomTab[]`. Only renders when `mode === 'mobile'`. Active tab highlighted with accent color.

```typescript
interface BottomTab {
  icon: string
  label: string
  href: string
}
```

### `SidebarProvider` + `useSidebar()`

React context managing sidebar mode. Listens to window resize. Provides `mode` and `toggle()`. Breakpoints: `<768` mobile, `768–1279` collapsed, `≥1280` expanded.

---

## 5. UI Primitives

| Component | Key Props | a11y Contract |
|---|---|---|
| `KpiCard` | `label, value, sub?, trend?, sparklineData?` | Semantic structure |
| `StatusBadge` | `variant: StatusVariant, label: string, pill?, dot?` | `data-status` attribute |
| `CmsButton` | `variant: 'primary'\|'ghost'\|'danger', size: 'sm'\|'md', children` | `forwardRef`, native button semantics |
| `SkeletonBlock` | `className?` | `aria-hidden="true"`, shimmer animation |
| `EmptyState` | `icon, title, description?, action?, hints?` | Semantic headings |
| `ContextMenu` | `trigger: ReactNode, children: ContextMenuItem[]` | `aria-expanded`, `aria-haspopup`, Escape closes, outside click closes |
| `ContextMenuItem` | `label, onClick, icon?, disabled?` | Disabled state respected |
| `ContextMenuDivider` | (none) | `role="separator"` |
| `ToastProvider` + `useToast()` | `show(message, type?, opts?)` | `role="status"`, `aria-live="polite"`, auto-dismiss by type, max 3 visible |
| `Sparkline` | `points: number[], color?, width?, height?` | `aria-hidden="true"` (decorative micro-chart) |
| `Pagination` | `page, totalPages, onPageChange, showSummary?` | `aria-label="Pagination"`, `aria-current="page"` on active |
| `formatRelativeTime` | `date: Date \| string, locale?: string` | N/A (utility, default locale `'en'`) |

### Complete Type Definitions

```typescript
// --- StatusBadge ---
type StatusVariant =
  | 'draft' | 'review' | 'pending' | 'pending_review' | 'ready'
  | 'queued' | 'scheduled' | 'published' | 'sent' | 'sending'
  | 'failed' | 'archived' | 'confirmed' | 'unsubscribed'
  | 'bounced' | 'complained' | 'paused' | 'active' | 'inactive'
  | 'expired' | 'cancelled'

interface StatusBadgeProps {
  variant: StatusVariant
  label: string
  pill?: boolean     // rounded-full vs rounded-md
  dot?: boolean      // colored dot prefix
}

// --- KpiCard ---
interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: { value: number; label: string }  // e.g. { value: 12, label: '+12%' }
  sparklineData?: number[]
}

// --- CmsButton ---
interface CmsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

// --- EmptyState ---
interface EmptyStateHint {
  icon: string
  title: string
  description: string
}
interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  hints?: EmptyStateHint[]
}

// --- Toast ---
type ToastType = 'success' | 'error' | 'info'
interface ToastOptions {
  action?: { label: string; onClick: () => void }
  duration?: number  // override auto-dismiss (ms)
}
// Auto-dismiss defaults: success=3000ms, info=4000ms, error=6000ms
// useToast() returns: { show(message: string, type?: ToastType, opts?: ToastOptions): void }

// --- Pagination ---
interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  showSummary?: boolean  // "Page X of Y"
}
```

---

## 6. Sidebar Customization

### Default sections (exported as `DEFAULT_SECTIONS`)

```typescript
const DEFAULT_SECTIONS: SidebarSection[] = [
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
```

### Default settings item (exported as `DEFAULT_SETTINGS_ITEM`)

```typescript
const DEFAULT_SETTINGS_ITEM: SidebarNavItem = {
  icon: '⚙️', label: 'Settings', href: '/cms/settings', minRole: 'org_admin'
}
```

### Default bottom tabs (exported as `DEFAULT_BOTTOM_TABS`)

```typescript
const DEFAULT_BOTTOM_TABS: BottomTab[] = [
  { icon: '🏠', label: 'Home', href: '/cms' },
  { icon: '📅', label: 'Schedule', href: '/cms/schedule' },
  { icon: '📝', label: 'Posts', href: '/cms/blog' },
  { icon: '📈', label: 'Analytics', href: '/cms/analytics' },
  { icon: '📰', label: 'Letters', href: '/cms/newsletters' },
]
```

### Types (exported from root)

```typescript
interface SidebarNavItem {
  icon: string
  label: string
  href: string
  badge?: string | number
  minRole?: 'reporter' | 'editor' | 'org_admin' | 'super_admin'
}

interface SidebarSection {
  label?: string
  items: SidebarNavItem[]
}

interface BottomTab {
  icon: string
  label: string
  href: string
}
```

Consumer customization — pass different sections/tabs:

```tsx
<CmsShell
  sections={[
    { label: 'Visão Geral', items: [
      { icon: '📊', label: 'Dashboard', href: '/cms' },
    ]},
    { label: 'Conteúdo', items: [
      { icon: '📝', label: 'Artigos', href: '/cms/blog' },
    ]},
  ]}
  bottomTabs={[
    { icon: '🏠', label: 'Início', href: '/cms' },
    { icon: '📝', label: 'Artigos', href: '/cms/blog' },
  ]}
  settingsItem={null}
  {...otherProps}
>
```

---

## 7. Next.js Coupling

Shell components (`CmsSidebar`, `CmsBottomNav`) use `next/link` and `next/navigation` (`usePathname`). This is intentional — the CMS is designed for Next.js App Router. `next` is a required peer dependency.

The **UI primitives** (KpiCard, StatusBadge, CmsButton, Sparkline, etc.) do NOT depend on Next.js and work in any React 19 app. Only the shell requires Next.js.

---

## 8. Peer Dependencies

```json
{
  "peerDependencies": {
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0",
    "next": ">=15.0.0"
  }
}
```

Zero runtime dependencies. No lucide-react, no recharts. Icons are emoji strings (via `icon` prop). Charts are pure SVG.

### Consumer does NOT need `transpilePackages`

The package ships pre-compiled JS (ESM + CJS via tsup) and pre-compiled CSS (via PostCSS/Tailwind 4). The `'use client'` banner is embedded in the `./client` entry. No JSX or TypeScript reaches the consumer — only `.js`, `.cjs`, `.d.ts`, and `.css` files. This matches `@tn-figueiredo/admin@0.6.2` which also does not require `transpilePackages`.

---

## 9. Package Structure

```
packages/cms-ui/
├── package.json
├── tsup.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── src/
│   ├── index.ts                (types + constants — server-safe)
│   ├── client.ts               ('use client' barrel — all components)
│   ├── styles.css              (tokens + @import tailwindcss + keyframes)
│   ├── shell/
│   │   ├── cms-shell.tsx
│   │   ├── cms-sidebar.tsx
│   │   ├── cms-topbar.tsx
│   │   ├── cms-bottom-nav.tsx
│   │   └── sidebar-context.tsx
│   └── ui/
│       ├── kpi-card.tsx
│       ├── status-badge.tsx
│       ├── cms-button.tsx
│       ├── skeleton-block.tsx
│       ├── empty-state.tsx
│       ├── context-menu.tsx
│       ├── toast.tsx
│       ├── sparkline.tsx
│       ├── pagination.tsx
│       └── format-date.ts
├── test/
│   ├── shell/
│   │   ├── cms-sidebar.test.tsx
│   │   └── sidebar-context.test.tsx
│   └── ui/
│       ├── status-badge.test.tsx
│       ├── context-menu.test.tsx
│       ├── toast.test.tsx
│       ├── sparkline.test.tsx
│       ├── pagination.test.tsx
│       └── empty-state.test.tsx
└── dist/                        (build output, .gitignored)
```

---

## 10. Testing

Vitest + `@testing-library/react`. Port existing tests from `apps/web/test/components/cms/ui/`:
- context-menu: 11 tests (open/close, outside click, Escape, item click, disabled, divider)
- empty-state: 8 tests (render, action, hint cards)
- toast: 10 tests (show, auto-dismiss, manual dismiss, action, max 3)
- sparkline: 10 tests (SVG, polyline, circle, null on <2 points, custom color/size, aria-hidden)

Add new tests:
- cms-sidebar: role filtering, collapsed mode, active link detection, badges, settings visibility
- sidebar-context: mode switching on resize, toggle
- status-badge: variant rendering, pill/dot modes, data-status attribute
- pagination: page navigation, ellipsis, summary, aria attributes

Target: ≥90% statement coverage on exported components.

---

## 11. Bundle Size Budget

| Entry | Target (gzip) |
|---|---|
| `styles.css` | < 15 KB |
| `client.js` (ESM, all components) | < 25 KB |
| `index.js` (types + constants) | < 2 KB |

tsup with `splitting: true` enables tree-shaking — consumer importing only `StatusBadge` does not load `CmsShell`.

---

## 12. Migration Plan for `bythiagofigueiredo`

After publishing `@tn-figueiredo/cms-ui@0.1.0`:

1. `npm install @tn-figueiredo/cms-ui@0.1.0` in apps/web
2. `globals.css`: remove `[data-area="cms"] { ... }` block (~48 lines) + `[data-theme="light"] [data-area="cms"]` block + `shimmer`/`slideUp` keyframes; add `@import '@tn-figueiredo/cms-ui/styles.css'`
3. Search-replace imports: `@/components/cms/ui` → `@tn-figueiredo/cms-ui/client` (~15 files)
4. Search-replace shell imports: `@/components/cms/cms-shell` → `@tn-figueiredo/cms-ui/client`; same for sidebar, topbar, bottom-nav, sidebar-context
5. Delete `apps/web/src/components/cms/ui/` (10 files) + 5 shell files (cms-shell, cms-sidebar, cms-topbar, cms-bottom-nav, sidebar-context)
6. Keep `apps/web/src/components/cms/site-switcher-provider.tsx` (app-specific glue with `@tn-figueiredo/admin/site-switcher`)
7. Move relevant tests from `apps/web/test/components/cms/ui/` to the package
8. Run `npm test` + `npm run build` — verify zero regressions
9. Commit

---

## 13. Publishing

Follows ecosystem pattern:
- Changesets for versioning
- Tag-triggered publish workflow
- GitHub Packages registry (`https://npm.pkg.github.com`)
- Pre-1.0 semver: breaking changes allowed in minor bumps
- Consumers pin exact versions (no `^`)

---

## 14. Future Considerations (NOT in v0.1.0)

- **Separate `./shell` and `./ui` subpaths** — if consumers want primitives without Next.js dependency
- **CSS Layers** — wrap tokens in `@layer cms-tokens` for cleaner cascade control
- **Icon component** — replace emoji strings with a configurable icon system
- **Theme provider** — React context for programmatic dark/light switching
- **Storybook** — visual component catalog
