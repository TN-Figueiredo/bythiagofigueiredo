# OneCMS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 30/100-rated CMS with a 98/100 redesigned OneCMS — new sidebar, 9 screens, design system, responsive, dark+light theme.

**Architecture:** Local `CmsShell` replaces `AdminShellWithSwitcher` for full layout control. Design tokens in `globals.css` under CMS scope. Shared CMS components in `apps/web/src/components/cms/ui/`. Each screen is a server component page with client islands. Existing `@tn-figueiredo/*` package components reused where possible, wrapped with new design system styling.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4 (CSS-first `@theme`), TypeScript 5, Supabase, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-04-22-onecms-redesign-design.md`

**Mockups:** `.superpowers/brainstorm/52761-1776906453/content/01–09*.html`

---

## Phase 0: Design System Foundation

All subsequent phases depend on these tasks. Must be completed first.

---

### Task 1: CMS Design Tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`

This task adds the CMS design system CSS custom properties from spec section 3.1. They live alongside the existing pinboard palette.

- [ ] **Step 1: Add CMS token block to globals.css**

Add after the existing `[data-theme="light"]` pinboard block (around line 90+):

```css
/* ===== CMS Design System ===== */
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
  --cms-purple: #8b5cf6;
  --cms-purple-subtle: rgba(139,92,246,.12);
  --cms-radius: 8px;
  --cms-sidebar-w: 230px;
}

[data-area="cms"][data-theme="light"] {
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
  --cms-purple-subtle: rgba(139,92,246,.08);
}
```

- [ ] **Step 2: Add CMS Tailwind utilities via @theme inline**

Add inside the existing `@theme inline` block or create a new one:

```css
@theme inline {
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
  --color-cms-purple: var(--cms-purple);
  --color-cms-purple-subtle: var(--cms-purple-subtle);
}
```

- [ ] **Step 3: Verify tokens load**

Run: `npm run build -w apps/web 2>&1 | tail -5`
Expected: Build succeeds without CSS errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(cms): add OneCMS design system tokens to globals.css"
```

---

### Task 2: Shared CMS UI Components — Primitives

**Files:**
- Create: `apps/web/src/components/cms/ui/kpi-card.tsx`
- Create: `apps/web/src/components/cms/ui/status-badge.tsx`
- Create: `apps/web/src/components/cms/ui/cms-button.tsx`
- Create: `apps/web/src/components/cms/ui/skeleton-block.tsx`
- Create: `apps/web/src/components/cms/ui/empty-state.tsx`
- Create: `apps/web/src/components/cms/ui/context-menu.tsx`
- Create: `apps/web/src/components/cms/ui/toast.tsx`
- Create: `apps/web/src/components/cms/ui/sparkline.tsx`
- Create: `apps/web/src/components/cms/ui/index.ts`
- Test: `apps/web/test/components/cms/ui/kpi-card.test.tsx`
- Test: `apps/web/test/components/cms/ui/status-badge.test.tsx`

- [ ] **Step 1: Create KpiCard component**

```tsx
// apps/web/src/components/cms/ui/kpi-card.tsx
'use client'

import { Sparkline } from './sparkline'

interface KpiCardProps {
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
  trendPositive?: 'up' | 'down' // which direction is "good" (e.g. 'down' for bounce rate)
  sparklinePoints?: number[]
  color?: 'default' | 'green' | 'amber' | 'red' | 'cyan'
}

const COLOR_MAP = {
  default: 'text-cms-text',
  green: 'text-cms-green',
  amber: 'text-cms-amber',
  red: 'text-cms-red',
  cyan: 'text-cms-cyan',
} as const

export function KpiCard({ label, value, trend, trendPositive = 'up', sparklinePoints, color = 'default' }: KpiCardProps) {
  const isPositive = trend?.direction === (trendPositive ?? 'up')
  const trendColor = !trend ? '' : isPositive ? 'text-cms-green' : trend.direction === 'flat' ? 'text-cms-text-dim' : 'text-cms-red'

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-cms-text-dim uppercase tracking-wide">{label}</div>
          <div className={`text-2xl font-semibold mt-1 ${COLOR_MAP[color]}`}>{value}</div>
          {trend && (
            <div className={`text-[11px] mt-1 ${trendColor}`} aria-label={`${label} ${value}, ${trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'down' : 'flat'} ${trend.label}`}>
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.label}
            </div>
          )}
        </div>
        {sparklinePoints && sparklinePoints.length > 1 && (
          <Sparkline points={sparklinePoints} color={isPositive ? 'var(--cms-green)' : 'var(--cms-red)'} className="mt-1" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create StatusBadge component**

```tsx
// apps/web/src/components/cms/ui/status-badge.tsx
const VARIANTS = {
  draft: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
  review: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
  ready: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  queued: { bg: 'bg-cms-purple-subtle', text: 'text-cms-purple' },
  published: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  live: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  archived: { bg: 'bg-cms-surface-hover', text: 'text-cms-text-dim' },
  scheduled: { bg: 'bg-cms-cyan-subtle', text: 'text-cms-cyan' },
  sent: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  sending: { bg: 'bg-cms-purple-subtle', text: 'text-cms-purple' },
  failed: { bg: 'bg-cms-red-subtle', text: 'text-cms-red' },
  pending: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
  confirmed: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  bounced: { bg: 'bg-cms-red-subtle', text: 'text-cms-red' },
  unsubscribed: { bg: 'bg-cms-surface-hover', text: 'text-cms-text-dim' },
  complained: { bg: 'bg-cms-rose/10', text: 'text-cms-rose' },
  active: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  paused: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
} as const

export type StatusVariant = keyof typeof VARIANTS

interface StatusBadgeProps {
  variant: StatusVariant
  label?: string
  className?: string
}

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const v = VARIANTS[variant] ?? VARIANTS.draft
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${v.bg} ${v.text} ${className}`}>
      {label ?? variant}
    </span>
  )
}
```

- [ ] **Step 3: Create CmsButton component**

```tsx
// apps/web/src/components/cms/ui/cms-button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface CmsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-[var(--cms-radius)] font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-cms-accent text-white hover:bg-cms-accent-hover',
  ghost: 'bg-transparent text-cms-text-muted border border-cms-border hover:text-cms-text hover:bg-cms-surface-hover',
  danger: 'bg-transparent text-cms-red border border-cms-red/30 hover:bg-cms-red-subtle',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-[13px]',
}

export const CmsButton = forwardRef<HTMLButtonElement, CmsButtonProps>(
  ({ variant = 'ghost', size = 'md', className = '', ...props }, ref) => (
    <button ref={ref} className={`${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`} {...props} />
  )
)
CmsButton.displayName = 'CmsButton'
```

- [ ] **Step 4: Create SkeletonBlock component**

```tsx
// apps/web/src/components/cms/ui/skeleton-block.tsx
interface SkeletonBlockProps {
  className?: string
  width?: string
  height?: string
}

export function SkeletonBlock({ className = '', width, height }: SkeletonBlockProps) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-cms-surface via-cms-surface-hover to-cms-surface bg-[length:200%_100%] ${className}`}
      style={{ width, height }}
      aria-busy="true"
    />
  )
}
```

Add shimmer animation to globals.css (inside the existing `@theme` or at the end):

```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-shimmer {
  animation: shimmer 1.5s linear infinite;
}
```

- [ ] **Step 5: Create EmptyState component**

```tsx
// apps/web/src/components/cms/ui/empty-state.tsx
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  actions?: ReactNode
  hints?: Array<{ icon: string; title: string; description: string }>
}

export function EmptyState({ icon, title, description, actions, hints }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-5">
      <div className="text-5xl mb-4 opacity-40">{icon}</div>
      <h3 className="text-base font-semibold text-cms-text mb-2">{title}</h3>
      <p className="text-[13px] text-cms-text-muted max-w-md mx-auto mb-5">{description}</p>
      {actions && <div className="flex gap-3 justify-center mb-6">{actions}</div>}
      {hints && hints.length > 0 && (
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mt-2">
          {hints.map((h) => (
            <div key={h.title} className="p-4 bg-cms-bg border border-dashed border-cms-border rounded-[10px] text-center">
              <div className="text-xl mb-1.5">{h.icon}</div>
              <div className="text-xs font-medium mb-1">{h.title}</div>
              <div className="text-[11px] text-cms-text-dim">{h.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create ContextMenu component**

```tsx
// apps/web/src/components/cms/ui/context-menu.tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface ContextMenuProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function ContextMenu({ open, onClose, children, className = '' }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div ref={ref} role="menu" className={`bg-cms-surface border border-cms-border rounded-[10px] p-1 min-w-[200px] shadow-[0_8px_24px_rgba(0,0,0,.4)] z-50 ${className}`}>
      {children}
    </div>
  )
}

interface ContextMenuItemProps {
  icon?: string
  label: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function ContextMenuItem({ icon, label, danger, disabled, onClick }: ContextMenuItemProps) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 text-[13px] rounded-md transition-colors duration-100
        ${danger ? 'text-cms-red hover:bg-cms-red-subtle' : 'text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon && <span className="w-4 text-center text-sm">{icon}</span>}
      <span>{label}</span>
    </button>
  )
}

export function ContextMenuDivider() {
  return <div className="h-px bg-cms-border my-1" />
}
```

- [ ] **Step 7: Create Toast component**

```tsx
// apps/web/src/components/cms/ui/toast.tsx
'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  variant: ToastVariant
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toast: (variant: ToastVariant, message: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const BORDER_COLOR: Record<ToastVariant, string> = {
  success: 'border-l-cms-green',
  error: 'border-l-cms-red',
  warning: 'border-l-cms-amber',
  info: 'border-l-cms-accent',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((variant: ToastVariant, message: string, action?: Toast['action']) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-2), { id, variant, message, action }])
    if (variant !== 'error' && variant !== 'warning') {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-md:left-4 max-md:right-4 max-md:bottom-16 max-md:items-center">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-[var(--cms-radius)] border border-cms-border border-l-[3px] ${BORDER_COLOR[t.variant]} bg-cms-surface shadow-lg animate-[slideUp_200ms_ease-out] min-w-[280px] max-w-[420px]`}>
            <span className="text-[13px] text-cms-text flex-1">{t.message}</span>
            {t.action && (
              <button onClick={t.action.onClick} className="text-xs text-cms-accent font-medium hover:underline">
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="text-cms-text-dim hover:text-cms-text text-sm">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

Add slideUp keyframe to globals.css:

```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 8: Create Sparkline standalone component**

```tsx
// apps/web/src/components/cms/ui/sparkline.tsx
interface SparklineProps {
  points: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ points, color = 'var(--cms-green)', width = 48, height = 28, className = '' }: SparklineProps) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((p - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  const lastCoord = coords[coords.length - 1].split(',')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={lastCoord[0]} cy={lastCoord[1]} r="2" fill={color} />
    </svg>
  )
}
```

- [ ] **Step 9: Create barrel export**

```tsx
// apps/web/src/components/cms/ui/index.ts
export { KpiCard } from './kpi-card'
export { StatusBadge, type StatusVariant } from './status-badge'
export { CmsButton } from './cms-button'
export { SkeletonBlock } from './skeleton-block'
export { EmptyState } from './empty-state'
export { ContextMenu, ContextMenuItem, ContextMenuDivider } from './context-menu'
export { ToastProvider, useToast } from './toast'
export { Sparkline } from './sparkline'
```

- [ ] **Step 10: Write tests for KpiCard and StatusBadge**

```tsx
// apps/web/test/components/cms/ui/kpi-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '@/components/cms/ui/kpi-card'

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Total Posts" value={42} />)
    expect(screen.getByText('Total Posts')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
  })

  it('renders trend with up arrow', () => {
    render(<KpiCard label="Opens" value="38.4%" trend={{ direction: 'up', label: '2.1% vs prior' }} />)
    expect(screen.getByText(/↑/)).toBeDefined()
    expect(screen.getByText(/2.1% vs prior/)).toBeDefined()
  })

  it('renders sparkline when points provided', () => {
    const { container } = render(<KpiCard label="Test" value={1} sparklinePoints={[1, 3, 2, 5, 4]} />)
    expect(container.querySelector('svg')).toBeDefined()
    expect(container.querySelector('polyline')).toBeDefined()
  })
})
```

```tsx
// apps/web/test/components/cms/ui/status-badge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/cms/ui/status-badge'

describe('StatusBadge', () => {
  it('renders variant label by default', () => {
    render(<StatusBadge variant="draft" />)
    expect(screen.getByText('draft')).toBeDefined()
  })

  it('renders custom label', () => {
    render(<StatusBadge variant="published" label="Live" />)
    expect(screen.getByText('Live')).toBeDefined()
  })

  it('applies correct color classes for each variant', () => {
    const { container } = render(<StatusBadge variant="failed" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('text-cms-red')
    expect(el.className).toContain('bg-cms-red-subtle')
  })
})
```

- [ ] **Step 11: Run tests**

Run: `npm run test:web -- --run test/components/cms/ui/`
Expected: All tests pass.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/components/cms/ui/ apps/web/test/components/cms/ui/ apps/web/src/app/globals.css
git commit -m "feat(cms): add shared UI component library — KpiCard, StatusBadge, CmsButton, SkeletonBlock, EmptyState, ContextMenu, Toast, Sparkline"
```

---

### Task 3: CMS Shell — Sidebar + Layout + Responsive

**Files:**
- Create: `apps/web/src/components/cms/cms-shell.tsx`
- Create: `apps/web/src/components/cms/cms-sidebar.tsx`
- Create: `apps/web/src/components/cms/cms-topbar.tsx`
- Create: `apps/web/src/components/cms/cms-bottom-nav.tsx`
- Create: `apps/web/src/components/cms/sidebar-context.tsx`
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`
- Test: `apps/web/test/components/cms/cms-sidebar.test.tsx`

- [ ] **Step 1: Create SidebarContext**

```tsx
// apps/web/src/components/cms/sidebar-context.tsx
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

- [ ] **Step 2: Create CmsSidebar component**

```tsx
// apps/web/src/components/cms/cms-sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'

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

const ROLE_RANK: Record<string, number> = { reporter: 0, editor: 1, org_admin: 2, super_admin: 3 }

const SECTIONS: SidebarSection[] = [
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
      { icon: '📧', label: 'Subscribers', href: '/cms/subscribers', minRole: 'editor' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: '📈', label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
    ],
  },
]

const SETTINGS_ITEM: SidebarNavItem = { icon: '⚙️', label: 'Settings', href: '/cms/settings', minRole: 'org_admin' }

interface CmsSidebarProps {
  siteName: string
  siteInitials: string
  userDisplayName: string
  userRole: string
  siteSwitcher?: React.ReactNode
}

function hasAccess(userRole: string, minRole?: string): boolean {
  if (!minRole) return true
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

export function CmsSidebar({ siteName, siteInitials, userDisplayName, userRole, siteSwitcher }: CmsSidebarProps) {
  const { mode } = useSidebar()
  const pathname = usePathname()

  if (mode === 'mobile') return null

  const isCollapsed = mode === 'collapsed'

  const filteredSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((item) => hasAccess(userRole, item.minRole)),
  })).filter((s) => s.items.length > 0)

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
      <nav className="flex-1 overflow-y-auto py-2">
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
        {hasAccess(userRole, SETTINGS_ITEM.minRole) && (
        <div className="border-t border-cms-border mt-2 pt-2">
          <Link
            href={SETTINGS_ITEM.href}
            className={`flex items-center gap-2.5 text-[13px] text-cms-text-dim transition-all duration-150 hover:text-cms-text hover:bg-cms-surface-hover
              ${isCollapsed ? 'justify-center py-2 mx-1 rounded-md' : 'px-5 py-2'}
              ${pathname.startsWith(SETTINGS_ITEM.href) ? 'text-cms-accent bg-cms-accent-subtle' : ''}`}
          >
            <span className={`text-sm shrink-0 ${isCollapsed ? '' : 'w-[18px] text-center'}`}>{SETTINGS_ITEM.icon}</span>
            {!isCollapsed && <span>{SETTINGS_ITEM.label}</span>}
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
            <div className="text-xs min-w-0">
              <div className="text-cms-text font-medium truncate">{userDisplayName}</div>
              <div className="text-cms-text-dim text-[10px]">{userRole}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Create CmsBottomNav component**

```tsx
// apps/web/src/components/cms/cms-bottom-nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'

const TABS = [
  { icon: '📊', label: 'Home', href: '/cms' },
  { icon: '📅', label: 'Schedule', href: '/cms/schedule' },
  { icon: '📝', label: 'Posts', href: '/cms/blog' },
  { icon: '📈', label: 'Analytics', href: '/cms/analytics' },
  { icon: '⋯', label: 'More', href: '/cms/more' },
] as const

export function CmsBottomNav() {
  const { mode } = useSidebar()
  const pathname = usePathname()

  if (mode !== 'mobile') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-cms-surface border-t border-cms-border flex items-center justify-around z-50">
      {TABS.map((tab) => {
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

- [ ] **Step 4: Create CmsTopbar component**

```tsx
// apps/web/src/components/cms/cms-topbar.tsx
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

- [ ] **Step 5: Create CmsShell that composes everything**

```tsx
// apps/web/src/components/cms/cms-shell.tsx
'use client'

import type { ReactNode } from 'react'
import { SidebarProvider } from './sidebar-context'
import { CmsSidebar } from './cms-sidebar'
import { CmsBottomNav } from './cms-bottom-nav'
import { ToastProvider } from './ui/toast'

interface CmsShellProps {
  siteName: string
  siteInitials: string
  userDisplayName: string
  userRole: string
  siteSwitcher?: ReactNode
  children: ReactNode
}

export function CmsShell({ siteName, siteInitials, userDisplayName, userRole, siteSwitcher, children }: CmsShellProps) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <div className="flex h-screen bg-cms-bg text-cms-text" data-area="cms">
          <CmsSidebar
            siteName={siteName}
            siteInitials={siteInitials}
            userDisplayName={userDisplayName}
            userRole={userRole}
            siteSwitcher={siteSwitcher}
          />
          <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>
          <CmsBottomNav />
        </div>
      </ToastProvider>
    </SidebarProvider>
  )
}
```

- [ ] **Step 6: Update CMS layout to use CmsShell**

Modify `apps/web/src/app/cms/(authed)/layout.tsx`:

Replace the `AdminShellWithSwitcher` rendering with `CmsShell`. Keep all the auth and site-fetching logic. The key change is in the return statement:

```tsx
import { CmsShell } from '@/components/cms/cms-shell'
import { SiteSwitcherProvider } from '@tn-figueiredo/admin/site-switcher'

// ... (keep existing auth + sites fetching)

return (
  <SiteSwitcherProvider sites={sites} currentSiteId={currentSiteId}>
    <CmsShell
      siteName={currentSite?.name ?? 'OneCMS'}
      siteInitials={currentSite?.name?.slice(0, 2).toUpperCase() ?? 'CM'}
      userDisplayName={userDisplayName}
      userRole={userRole}
      siteSwitcher={<CmsSiteSwitcherSlot />}
    >
      {children}
    </CmsShell>
  </SiteSwitcherProvider>
)
```

Remove the `CMS_CONFIG` constant, `createAdminLayout` import, and `AdminShellWithSwitcher` usage.

- [ ] **Step 7: Move `data-area="cms"` to the layout for token scoping**

The `data-area="cms"` attribute is set on the shell's root `<div>`, which means the CSS tokens `[data-area="cms"]` will activate. Verify by checking the root layout doesn't conflict. The `data-area` is independent of `data-theme` — they compose.

- [ ] **Step 8: Write sidebar test**

```tsx
// apps/web/test/components/cms/cms-sidebar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CmsSidebar } from '@/components/cms/cms-sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/cms',
}))

// Mock sidebar context
vi.mock('@/components/cms/sidebar-context', () => ({
  useSidebar: () => ({ mode: 'expanded' as const, isExpanded: true, toggle: () => {} }),
}))

describe('CmsSidebar', () => {
  const props = {
    siteName: 'Test Site',
    siteInitials: 'TS',
    userDisplayName: 'Test User',
    userRole: 'editor',
  }

  it('renders all nav sections', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Posts')).toBeDefined()
    expect(screen.getByText('Newsletters')).toBeDefined()
    expect(screen.getByText('Campaigns')).toBeDefined()
    expect(screen.getByText('Authors')).toBeDefined()
    expect(screen.getByText('Subscribers')).toBeDefined()
    expect(screen.getByText('Analytics')).toBeDefined()
    expect(screen.getByText('Schedule')).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
  })

  it('renders site name and user info', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.getByText('Test Site')).toBeDefined()
    expect(screen.getByText('Test User')).toBeDefined()
    expect(screen.getByText('editor')).toBeDefined()
  })

  it('highlights active Dashboard link', () => {
    const { container } = render(<CmsSidebar {...props} />)
    const dashboardLink = container.querySelector('a[href="/cms"]')
    expect(dashboardLink?.className).toContain('text-cms-accent')
  })
})
```

- [ ] **Step 9: Run tests + build**

Run: `npm run test:web -- --run test/components/cms/ && npm run build -w apps/web 2>&1 | tail -3`
Expected: Tests pass + build succeeds.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/cms/ apps/web/src/app/cms/\(authed\)/layout.tsx apps/web/test/components/cms/
git commit -m "feat(cms): new CmsShell with redesigned sidebar, topbar, bottom nav, responsive layout"
```

---

## Phase 1: Core Screens

Tasks 4–6 can be implemented in parallel. Each creates/modifies a single screen.

---

### Task 4: Dashboard Page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-kpis.tsx`
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/_components/coming-up.tsx`
- Create: `apps/web/src/app/cms/(authed)/_components/continue-editing.tsx`
- Test: `apps/web/test/app/cms/dashboard.test.tsx`

- [ ] **Step 1: Create DashboardKpis server component**

Fetches 4 KPIs from Supabase: published post count (30d), newsletter opens (30d from `newsletter_editions.stats_opens`), campaign submissions (30d), total active subscribers. Renders 4 `<KpiCard>` in a responsive grid.

```tsx
// apps/web/src/app/cms/(authed)/_components/dashboard-kpis.tsx
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { KpiCard } from '@/components/cms/ui'

export async function DashboardKpis() {
  const supabase = await getSupabaseServerClient()
  const { siteId } = await getSiteContext()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [postsRes, opensRes, subsRes, subscribersRes] = await Promise.all([
    supabase.from('blog_posts').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'published').gte('published_at', thirtyDaysAgo),
    supabase.from('newsletter_editions').select('stats_opens')
      .eq('site_id', siteId).eq('status', 'sent').gte('sent_at', thirtyDaysAgo),
    supabase.from('campaign_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).gte('created_at', thirtyDaysAgo),
    supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'confirmed'),
  ])

  const totalOpens = (opensRes.data ?? []).reduce((sum, e) => sum + (e.stats_opens ?? 0), 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Published (30d)" value={postsRes.count ?? 0} color="default" />
      <KpiCard label="Newsletter Opens" value={totalOpens.toLocaleString()} color="green" />
      <KpiCard label="Campaign Leads" value={subsRes.count ?? 0} color="amber" />
      <KpiCard label="Subscribers" value={subscribersRes.count ?? 0} color="cyan" />
    </div>
  )
}
```

- [ ] **Step 2: Create ComingUp server component**

Fetches next 3 scheduled items (queued posts + scheduled editions) and renders as a list with colored left borders.

```tsx
// apps/web/src/app/cms/(authed)/_components/coming-up.tsx
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteContext } from '@/lib/cms/site-context'
import Link from 'next/link'

export async function ComingUp() {
  const supabase = await getSupabaseServerClient()
  const { siteId } = await getSiteContext()
  const today = new Date().toISOString().split('T')[0]

  const [postsRes, editionsRes] = await Promise.all([
    supabase.from('blog_posts').select('id, slot_date, blog_translations(title, locale)')
      .eq('site_id', siteId).eq('status', 'queued').gte('slot_date', today)
      .order('slot_date', { ascending: true }).limit(3),
    supabase.from('newsletter_editions').select('id, scheduled_at, subject')
      .eq('site_id', siteId).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true }).limit(3),
  ])

  type UpcomingItem = { id: string; title: string; date: string; type: 'post' | 'newsletter'; href: string }
  const items: UpcomingItem[] = [
    ...(postsRes.data ?? []).map((p: any) => ({
      id: p.id, title: p.blog_translations?.[0]?.title ?? 'Untitled', date: p.slot_date,
      type: 'post' as const, href: `/cms/blog/${p.id}/edit`,
    })),
    ...(editionsRes.data ?? []).map((e: any) => ({
      id: e.id, title: e.subject ?? 'Untitled', date: e.scheduled_at?.split('T')[0] ?? '',
      type: 'newsletter' as const, href: `/cms/newsletters/${e.id}/edit`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)

  if (items.length === 0) {
    return <p className="text-sm text-cms-text-dim">Nothing scheduled yet.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link key={item.id} href={item.href}
          className={`flex items-center gap-3 p-3 rounded-[var(--cms-radius)] bg-cms-bg border-l-[3px] hover:bg-cms-surface-hover transition-colors
            ${item.type === 'post' ? 'border-l-cms-accent' : 'border-l-cms-green'}`}>
          <span className="text-sm">{item.type === 'post' ? '📝' : '📰'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-cms-text truncate">{item.title}</div>
            <div className="text-[11px] text-cms-text-dim">{item.date}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create ContinueEditing client component**

Reads `localStorage` for last-edited post and renders a banner.

```tsx
// apps/web/src/app/cms/(authed)/_components/continue-editing.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CmsButton } from '@/components/cms/ui'

interface LastEdited { id: string; title: string; updatedAt: string }

export function ContinueEditing({ siteId }: { siteId: string }) {
  const [item, setItem] = useState<LastEdited | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cms:lastEdited:${siteId}`)
      if (raw) setItem(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [siteId])

  if (!item) return null

  const timeAgo = getRelativeTime(item.updatedAt)

  return (
    <div className="flex items-center gap-4 p-4 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]">
      <span className="text-2xl">📝</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-cms-text-dim uppercase tracking-wide">Continue editing</div>
        <div className="text-[13px] font-medium text-cms-text truncate">{item.title}</div>
        <div className="text-[11px] text-cms-text-dim">Last edited {timeAgo}</div>
      </div>
      <Link href={`/cms/blog/${item.id}/edit`}>
        <CmsButton variant="primary" size="sm">Resume</CmsButton>
      </Link>
    </div>
  )
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
```

- [ ] **Step 4: Rewrite dashboard page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/page.tsx
import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { SkeletonBlock } from '@/components/cms/ui'
import { DashboardKpis } from './_components/dashboard-kpis'
import { ComingUp } from './_components/coming-up'
import { ContinueEditing } from './_components/continue-editing'

export default async function CmsDashboardPage() {
  const { siteId } = await getSiteContext()

  return (
    <div>
      <CmsTopbar title="Dashboard" />
      <div className="p-6 lg:p-8 space-y-6">
        <ContinueEditing siteId={siteId} />

        <Suspense fallback={<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} className="h-[88px]" />)}</div>}>
          <DashboardKpis />
        </Suspense>

        <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-5">
            <h3 className="text-sm font-semibold text-cms-text mb-4">Content Performance</h3>
            <div className="h-44 flex items-center justify-center text-cms-text-dim text-sm">
              Chart — implemented in Phase 3 (Analytics)
            </div>
          </div>

          <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-5">
            <h3 className="text-sm font-semibold text-cms-text mb-4">Coming Up</h3>
            <Suspense fallback={<div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <SkeletonBlock key={i} className="h-14" />)}</div>}>
              <ComingUp />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write dashboard test**

```tsx
// apps/web/test/app/cms/dashboard.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Dashboard', () => {
  it('exports a default server component', async () => {
    const mod = await import('@/app/cms/(authed)/page')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})
```

- [ ] **Step 6: Run tests + verify build**

Run: `npm run test:web -- --run test/app/cms/dashboard.test.tsx && npm run test:web -- --run test/components/cms/`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/page.tsx apps/web/src/app/cms/\(authed\)/_components/ apps/web/test/app/cms/
git commit -m "feat(cms): redesigned dashboard with KPIs, Coming Up, Continue Editing"
```

---

### Task 5: Posts List Redesign

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_components/posts-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_components/posts-filters.tsx`
- Create: `apps/web/src/app/cms/(authed)/blog/_components/posts-skeleton.tsx`
- Test: `apps/web/test/app/cms/blog-list.test.tsx`

This task replaces the current minimal post list with the spec's full design: status tabs, locale filter, search, 9-column table, bulk actions, responsive card layout, empty/no-results states. Reference mockup: `02-posts-list-v4.html`, spec section 4.2.

- [ ] **Step 1: Create PostsFilters client component**

Renders status filter tabs (All/Draft/Review/Ready/Queued/Published/Archived), locale toggle (All/pt-BR/en), and search input. Drives URL state via `useRouter().push()` with searchParams.

```tsx
// apps/web/src/app/cms/(authed)/blog/_components/posts-filters.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Review' },
  { value: 'ready', label: 'Ready' },
  { value: 'queued', label: 'Queued' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
] as const

const STATUS_COLORS: Record<string, string> = {
  '': '', draft: 'text-cms-amber', pending_review: 'text-yellow-500', ready: 'text-blue-500',
  queued: 'text-cms-purple', published: 'text-cms-green', archived: 'text-cms-text-dim',
}

const LOCALE_OPTIONS = ['', 'pt-BR', 'en'] as const

interface PostsFiltersProps {
  counts: Record<string, number>
}

export function PostsFilters({ counts }: PostsFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(params.get('q') ?? '')

  const currentStatus = params.get('status') ?? ''
  const currentLocale = params.get('locale') ?? ''

  const updateParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    startTransition(() => router.push(`/cms/blog?${next.toString()}`))
  }, [params, router, startTransition])

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const isActive = currentStatus === tab.value
          const count = tab.value ? (counts[tab.value] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)
          return (
            <button key={tab.value} onClick={() => updateParam('status', tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${isActive ? 'bg-cms-accent-subtle text-cms-accent' : `text-cms-text-muted hover:bg-cms-surface-hover ${STATUS_COLORS[tab.value]}`}`}>
              {tab.label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <input type="search" value={search}
            onChange={(e) => { setSearch(e.target.value); updateParam('q', e.target.value) }}
            placeholder="Search posts..."
            className="w-full px-3 py-2 text-sm bg-cms-bg border border-cms-border rounded-[var(--cms-radius)] text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none" />
        </div>

        {/* Locale toggle */}
        <div className="flex border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
          {LOCALE_OPTIONS.map((loc) => (
            <button key={loc} onClick={() => updateParam('locale', loc)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${currentLocale === loc ? 'bg-cms-accent-subtle text-cms-accent' : 'text-cms-text-muted hover:bg-cms-surface-hover'}`}>
              {loc || 'All'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PostsTable client component**

Renders the redesigned table (desktop) or card layout (mobile). Includes status badges, locale badges, pagination. Reference: spec section 4.2 + mockup `02-posts-list-v4.html`.

```tsx
// apps/web/src/app/cms/(authed)/blog/_components/posts-table.tsx
'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/cms/ui'
import type { StatusVariant } from '@/components/cms/ui'

interface PostRow {
  id: string
  title: string
  slug: string
  status: string
  locales: string[]
  authorName: string
  authorInitials: string
  updatedAt: string
  readingTime: number
}

interface PostsTableProps {
  posts: PostRow[]
  total: number
  page: number
  pageSize: number
}

export function PostsTable({ posts, total, page, pageSize }: PostsTableProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30">📝</div>
        <h3 className="text-sm font-semibold text-cms-text mb-1">No posts yet</h3>
        <p className="text-xs text-cms-text-muted mb-4">Write your first blog post. Save as draft, schedule, or publish now.</p>
        <Link href="/cms/blog/new" className="inline-flex px-4 py-2 bg-cms-accent text-white text-sm rounded-[var(--cms-radius)] font-medium">
          Create first post
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cms-border text-left">
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Title</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Status</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Locale</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Author</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Updated</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim w-16"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-cms-border-subtle hover:bg-cms-surface-hover transition-colors group">
                <td className="py-3 px-4">
                  <Link href={`/cms/blog/${post.id}/edit`} className="block">
                    <div className="text-[13px] font-medium text-cms-text truncate max-w-xs">{post.title}</div>
                    <div className="text-[11px] text-cms-text-dim">/{post.slug} · {post.readingTime} min read</div>
                  </Link>
                </td>
                <td className="py-3 px-4"><StatusBadge variant={post.status as StatusVariant} /></td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    {post.locales.map((l) => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded border border-cms-border text-cms-text-muted">{l}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cms-accent flex items-center justify-center text-[9px] text-white font-semibold">{post.authorInitials}</div>
                    <span className="text-xs text-cms-text-muted">{post.authorName}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-cms-text-dim">{post.updatedAt}</td>
                <td className="py-3 px-4">
                  <Link href={`/cms/blog/${post.id}/edit`} className="text-xs text-cms-accent opacity-0 group-hover:opacity-100 transition-opacity">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {posts.map((post) => (
          <Link key={post.id} href={`/cms/blog/${post.id}/edit`}
            className="block p-3 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] font-medium text-cms-text line-clamp-2">{post.title}</div>
              <StatusBadge variant={post.status as StatusVariant} />
            </div>
            <div className="text-[11px] text-cms-text-dim mt-1">{post.authorName} · {post.updatedAt}</div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-xs text-cms-text-muted">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex gap-1">
            {page > 1 && <Link href={`/cms/blog?page=${page - 1}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Prev</Link>}
            <Link href={`/cms/blog?page=${page + 1}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Next</Link>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite blog/page.tsx**

Integrate `PostsFilters` + `PostsTable` with server-side data fetching. Keep existing query logic but map results to the new component shape.

```tsx
// apps/web/src/app/cms/(authed)/blog/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { CmsButton, SkeletonBlock } from '@/components/cms/ui'
import { PostsFilters } from './_components/posts-filters'
import { PostsTable } from './_components/posts-table'

interface Props { searchParams: Promise<Record<string, string | undefined>> }

export default async function BlogListPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await getSupabaseServerClient()
  const { siteId } = await getSiteContext()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 20

  // Count by status for filter tabs
  const { data: countData } = await supabase.rpc('count_posts_by_status', { p_site_id: siteId }).single()
  const counts: Record<string, number> = countData ?? {}

  // Build query
  let query = supabase
    .from('blog_posts')
    .select('id, slug, status, slot_date, updated_at, owner_user_id, blog_translations(title, locale, reading_time_min), authors!blog_posts_owner_user_id_fkey(display_name)')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (params.status) query = query.eq('status', params.status)
  if (params.locale) query = query.contains('blog_translations.locale', params.locale)
  if (params.q) query = query.ilike('blog_translations.title', `%${params.q}%`)

  const { data: posts, count: total } = await query

  const rows = (posts ?? []).map((p: any) => ({
    id: p.id,
    title: p.blog_translations?.[0]?.title ?? 'Untitled',
    slug: p.slug ?? '',
    status: p.status ?? 'draft',
    locales: (p.blog_translations ?? []).map((t: any) => t.locale),
    authorName: p.authors?.display_name ?? 'Unknown',
    authorInitials: (p.authors?.display_name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    updatedAt: new Date(p.updated_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    readingTime: p.blog_translations?.[0]?.reading_time_min ?? 0,
  }))

  return (
    <div>
      <CmsTopbar title="Posts" actions={
        <Link href="/cms/blog/new"><CmsButton variant="primary" size="sm">+ New Post</CmsButton></Link>
      } />
      <div className="p-6 lg:p-8 space-y-4">
        <Suspense fallback={<SkeletonBlock className="h-20" />}>
          <PostsFilters counts={counts} />
        </Suspense>
        <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
          <PostsTable posts={rows} total={total ?? rows.length} page={page} pageSize={pageSize} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write test**

```tsx
// apps/web/test/app/cms/blog-list.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Blog List', () => {
  it('exports PostsFilters component', async () => {
    const mod = await import('@/app/cms/(authed)/blog/_components/posts-filters')
    expect(mod.PostsFilters).toBeDefined()
  })

  it('exports PostsTable component', async () => {
    const mod = await import('@/app/cms/(authed)/blog/_components/posts-table')
    expect(mod.PostsTable).toBeDefined()
  })
})
```

- [ ] **Step 5: Run tests + build**

Run: `npm run test:web -- --run test/app/cms/blog-list.test.tsx`
Expected: Pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/
git commit -m "feat(cms): redesigned Posts List with status tabs, locale filter, search, responsive table/cards"
```

---

### Task 6: Authors Page (New)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/authors/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/authors/_components/author-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/authors/_components/author-filters.tsx`
- Test: `apps/web/test/app/cms/authors.test.tsx`

Reference: spec section 4.6, mockup `06-authors.html`.

- [ ] **Step 1: Create AuthorCard component**

```tsx
// apps/web/src/app/cms/(authed)/authors/_components/author-card.tsx
import { StatusBadge } from '@/components/cms/ui'

interface AuthorCardProps {
  id: string
  displayName: string
  slug: string
  role: string
  bio: string | null
  avatarUrl: string | null
  initials: string
  postsCount: number
  publishedCount: number
  campaignsCount: number
  lastActiveAt: string | null
}

const ROLE_VARIANT: Record<string, { variant: string; label: string }> = {
  super_admin: { variant: 'active', label: 'Super Admin' },
  org_admin: { variant: 'scheduled', label: 'Admin' },
  editor: { variant: 'confirmed', label: 'Editor' },
  reporter: { variant: 'paused', label: 'Reporter' },
}

export function AuthorCard(props: AuthorCardProps) {
  const role = ROLE_VARIANT[props.role] ?? ROLE_VARIANT.editor
  const activityColor = getActivityColor(props.lastActiveAt)

  return (
    <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-4 hover:border-cms-accent transition-colors cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        {props.avatarUrl ? (
          <img src={props.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-cms-accent flex items-center justify-center text-lg font-semibold text-white">
            {props.initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-cms-text">{props.displayName}</div>
          <div className="text-[11px] text-cms-text-dim font-mono">@{props.slug}</div>
          <StatusBadge variant={role.variant as any} label={role.label} className="mt-1" />
        </div>
      </div>

      {props.bio && (
        <p className="text-xs text-cms-text-muted line-clamp-2 mb-3">{props.bio}</p>
      )}

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-cms-border-subtle text-center">
        <div><div className="text-sm font-semibold text-cms-text">{props.postsCount}</div><div className="text-[10px] text-cms-text-dim">Posts</div></div>
        <div><div className="text-sm font-semibold text-cms-text">{props.publishedCount}</div><div className="text-[10px] text-cms-text-dim">Published</div></div>
        <div><div className="text-sm font-semibold text-cms-text">{props.campaignsCount}</div><div className="text-[10px] text-cms-text-dim">Campaigns</div></div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-cms-text-dim">
        <span className={`w-2 h-2 rounded-full ${activityColor}`}></span>
        {props.lastActiveAt ? `Active ${getRelativeTime(props.lastActiveAt)}` : 'Never logged in'}
      </div>
    </div>
  )
}

function getActivityColor(lastActive: string | null): string {
  if (!lastActive) return 'bg-gray-500'
  const diff = Date.now() - new Date(lastActive).getTime()
  if (diff < 5 * 60 * 1000) return 'bg-cms-green shadow-[0_0_4px_var(--cms-green)]'
  if (diff < 7 * 86400000) return 'bg-cms-amber'
  return 'bg-gray-500'
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
```

- [ ] **Step 2: Create Authors page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/authors/page.tsx
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { EmptyState, CmsButton } from '@/components/cms/ui'
import { AuthorCard } from './_components/author-card'

export default async function AuthorsPage() {
  const supabase = await getSupabaseServerClient()
  const { siteId } = await getSiteContext()

  const { data: authors } = await supabase
    .from('authors')
    .select('id, display_name, slug, bio, avatar_url, user_id, site_memberships!inner(role)')
    .eq('site_id', siteId)
    .order('display_name')

  // Count posts/campaigns per author
  const authorRows = await Promise.all(
    (authors ?? []).map(async (a: any) => {
      const [postsRes, pubRes, campsRes] = await Promise.all([
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('owner_user_id', a.user_id).eq('site_id', siteId),
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('owner_user_id', a.user_id).eq('site_id', siteId).eq('status', 'published'),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('owner_user_id', a.user_id).eq('site_id', siteId),
      ])
      return {
        id: a.id,
        displayName: a.display_name,
        slug: a.slug ?? a.id.slice(0, 8),
        role: a.site_memberships?.[0]?.role ?? 'editor',
        bio: a.bio,
        avatarUrl: a.avatar_url,
        initials: a.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        postsCount: postsRes.count ?? 0,
        publishedCount: pubRes.count ?? 0,
        campaignsCount: campsRes.count ?? 0,
        lastActiveAt: null, // Realtime presence deferred to Sprint 7+
      }
    })
  )

  if (authorRows.length === 0) {
    return (
      <div>
        <CmsTopbar title="Authors" />
        <div className="p-8">
          <EmptyState icon="👤" title="You're the only author" description="Invite team members from Admin to add more authors." actions={<CmsButton variant="primary" size="sm">Go to Admin → Users</CmsButton>} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <CmsTopbar title="Authors" />
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {authorRows.map((author) => (
            <AuthorCard key={author.id} {...author} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write test**

```tsx
// apps/web/test/app/cms/authors.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Authors', () => {
  it('exports AuthorCard component', async () => {
    const mod = await import('@/app/cms/(authed)/authors/_components/author-card')
    expect(mod.AuthorCard).toBeDefined()
  })
})
```

- [ ] **Step 4: Run test + commit**

```bash
npm run test:web -- --run test/app/cms/authors.test.tsx
git add apps/web/src/app/cms/\(authed\)/authors/ apps/web/test/app/cms/authors.test.tsx
git commit -m "feat(cms): new Authors page with card grid, role badges, activity status"
```

---

## Phase 2: Content Screens

Tasks 7–9 can be implemented in parallel.

---

### Task 7: Newsletters List Redesign

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/editions-table.tsx`

Reference: spec section 4.4, mockup `04-newsletters.html`.

- [ ] **Step 1: Create TypeCards component**

Renders the horizontal row of newsletter type summary cards. Each card shows subscribers, avg open rate, last sent, cadence, edition count. Click filters the edition list.

```tsx
// apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx
'use client'

interface TypeCardData {
  id: string
  name: string
  color: string
  subscribers: number
  avgOpenRate: number
  lastSent: string | null
  cadence: string
  editionCount: number
  isPaused: boolean
}

interface TypeCardsProps {
  types: TypeCardData[]
  selectedTypeId: string | null
  onSelect: (id: string | null) => void
}

export function TypeCards({ types, selectedTypeId, onSelect }: TypeCardsProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {types.map((t) => (
        <button key={t.id} onClick={() => onSelect(selectedTypeId === t.id ? null : t.id)}
          className={`shrink-0 w-56 bg-cms-surface border rounded-[var(--cms-radius)] p-4 text-left transition-all
            ${selectedTypeId === t.id ? 'border-cms-accent ring-1 ring-cms-accent' : 'border-cms-border hover:border-cms-accent/50'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-cms-text">{t.name}</span>
            {t.isPaused && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cms-amber-subtle text-cms-amber uppercase">Paused</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div><div className="font-semibold text-cms-text">{t.subscribers}</div><div className="text-cms-text-dim">Subs</div></div>
            <div><div className="font-semibold text-cms-green">{t.avgOpenRate}%</div><div className="text-cms-text-dim">Opens</div></div>
            <div><div className="font-semibold text-cms-text">{t.editionCount}</div><div className="text-cms-text-dim">Editions</div></div>
          </div>
          <div className="mt-3 pt-2 border-t border-cms-border-subtle text-[10px] text-cms-text-dim">
            {t.cadence} · {t.lastSent ? `Last: ${t.lastSent}` : 'Never sent'}
          </div>
        </button>
      ))}
      <button className="shrink-0 w-40 border border-dashed border-cms-border rounded-[var(--cms-radius)] flex items-center justify-center text-sm text-cms-text-dim hover:border-cms-accent hover:text-cms-accent transition-colors">
        + Add type
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create EditionsTable component**

Renders the editions list with status badges, sending state (pulsing dot), and failed state (red tint). Similar structure to PostsTable.

- [ ] **Step 3: Rewrite newsletters/page.tsx**

Integrate TypeCards + EditionsTable. Keep the existing `NewsletterDashboard` from `@tn-figueiredo/newsletter-admin/client` as a fallback, but wrap with the new layout shell (CmsTopbar + design tokens).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/
git commit -m "feat(cms): redesigned Newsletters with type cards, status filters, editions table"
```

---

### Task 8: Campaigns List Redesign

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/campaigns/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/campaigns/_components/campaign-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/campaigns/_components/campaign-kpis.tsx`

Reference: spec section 4.5, mockup `05-campaigns-v2.html`.

- [ ] **Step 1: Create CampaignKpis component**

4 KPI tiles: Active campaigns, Total submissions, PDF downloads/30d, Conversion rate.

- [ ] **Step 2: Create CampaignTable component**

Table with type badge (PDF/Link), locale badges, status, submissions + sparkline, conversion rate.

- [ ] **Step 3: Rewrite campaigns/page.tsx**

Integrate KPIs + table + CmsTopbar.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/campaigns/
git commit -m "feat(cms): redesigned Campaigns with KPI tiles, sparklines, responsive table"
```

---

### Task 9: Subscribers Page (Move to /cms/subscribers)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/subscribers/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-kpis.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/growth-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/engagement-dots.tsx`

Reference: spec section 4.7, mockup `07-subscribers.html`.

- [ ] **Step 1: Create EngagementDots component**

Renders 5 colored dots for last 5 sends (green=opened, cyan=clicked, gray=none, red=bounced, rose=complained).

```tsx
// apps/web/src/app/cms/(authed)/subscribers/_components/engagement-dots.tsx
type DotStatus = 'opened' | 'clicked' | 'none' | 'bounced' | 'complained'

const DOT_COLORS: Record<DotStatus, string> = {
  opened: 'bg-cms-green',
  clicked: 'bg-cms-cyan',
  none: 'bg-gray-500',
  bounced: 'bg-cms-red',
  complained: 'bg-cms-rose',
}

interface EngagementDotsProps {
  dots: DotStatus[]
  ariaLabel: string
}

export function EngagementDots({ dots, ariaLabel }: EngagementDotsProps) {
  return (
    <div className="flex gap-1" aria-label={ariaLabel} role="img">
      {dots.slice(0, 5).map((d, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${DOT_COLORS[d]}`} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create GrowthChart component (CSS bars)**

- [ ] **Step 3: Create SubscriberKpis + SubscriberTable**

- [ ] **Step 4: Create subscribers/page.tsx**

Server component that gates on `is_org_admin || is_super_admin` (spec: PII-heavy page). Fetches from `newsletter_subscriptions` with joins to `newsletter_sends` for engagement data.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/subscribers/
git commit -m "feat(cms): new Subscribers page at /cms/subscribers with growth chart, engagement dots, RBAC gate"
```

---

## Phase 3: Advanced Screens

Tasks 10–11 can be implemented in parallel.

---

### Task 10: Analytics Page (New)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/analytics-tabs.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/overview-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/newsletters-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/campaigns-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/content-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/delivery-funnel.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/donut-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/area-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/heatmap.tsx`

Reference: spec section 4.8, mockup `08-analytics.html`.

- [ ] **Step 1: Create DeliveryFunnel component**

5-step horizontal bar funnel (Sent→Delivered→Opened→Clicked→Bounced).

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/delivery-funnel.tsx
interface FunnelStep {
  label: string
  value: number
  percentage: number
  color: string
}

interface DeliveryFunnelProps {
  steps: FunnelStep[]
}

export function DeliveryFunnel({ steps }: DeliveryFunnelProps) {
  const maxValue = steps[0]?.value ?? 1

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-3">
          <span className="text-[11px] text-cms-text-muted w-20 text-right shrink-0">{step.label}</span>
          <div className="flex-1 h-7 bg-cms-bg rounded overflow-hidden">
            <div className="h-full rounded flex items-center px-2 text-[10px] font-medium text-white transition-all"
              style={{ width: `${(step.value / maxValue) * 100}%`, backgroundColor: step.color, minWidth: '24px' }}>
              {step.value.toLocaleString()}
            </div>
          </div>
          <span className="text-[11px] text-cms-text-dim w-12 text-right">{step.percentage}%</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create DonutChart component (CSS conic-gradient)**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/donut-chart.tsx
interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  centerLabel: string
  centerValue: string | number
  size?: number
}

export function DonutChart({ segments, centerLabel, centerValue, size = 120 }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  let cumulative = 0
  const gradientStops = segments.map((s) => {
    const start = (cumulative / total) * 100
    cumulative += s.value
    const end = (cumulative / total) * 100
    return `${s.color} ${start}% ${end}%`
  }).join(', ')

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${gradientStops})` }} />
        <div className="absolute inset-[25%] rounded-full bg-cms-surface flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-cms-text">{centerValue}</span>
          <span className="text-[9px] text-cms-text-dim">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-cms-text-muted">{s.label}</span>
            <span className="text-cms-text font-medium ml-auto">{s.value}</span>
            <span className="text-cms-text-dim w-8 text-right">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create AnalyticsTabs + OverviewTab**

Tab navigation (Overview/Newsletters/Campaigns/Content) with period selector. Overview tab composes KpiCards + area chart + donut + funnel + top tables.

- [ ] **Step 4: Create remaining tabs (Newsletters, Campaigns, Content)**

Each tab follows the pattern: KPI row + period selector + type-specific charts/tables.

- [ ] **Step 5: Create analytics/page.tsx**

```tsx
// apps/web/src/app/cms/(authed)/analytics/page.tsx
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { CmsButton } from '@/components/cms/ui'
import { AnalyticsTabs } from './_components/analytics-tabs'

export default async function AnalyticsPage() {
  return (
    <div>
      <CmsTopbar title="Analytics" actions={<CmsButton variant="ghost" size="sm">Export Report</CmsButton>} />
      <div className="p-6 lg:p-8">
        <AnalyticsTabs />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/analytics/
git commit -m "feat(cms): new Analytics page with 4 tabs, funnel, donut chart, heatmap, period selector"
```

---

### Task 11: Schedule Page (New)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/schedule/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/week-view.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/month-view.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/backlog-panel.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/cadence-panel.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/quick-schedule-dialog.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/agenda-view.tsx`

Reference: spec section 4.9, mockup `09-schedule.html`.

- [ ] **Step 1: Create WeekView component**

CSS grid (8 columns: time label + 7 days), 3 slot rows. Calendar items color-coded (post=indigo, newsletter=green, campaign=amber). Empty slots as dashed. Overdue in red.

```tsx
// apps/web/src/app/cms/(authed)/schedule/_components/week-view.tsx
'use client'

import { useMemo } from 'react'

interface CalendarItem {
  id: string
  title: string
  type: 'post' | 'newsletter' | 'campaign'
  status: string
  date: string
  slot: number
  sendTime?: string
  subscriberCount?: number
}

interface EmptySlot {
  date: string
  slot: number
  type: 'blog' | 'newsletter'
  isOverdue: boolean
}

interface WeekViewProps {
  startDate: Date
  items: CalendarItem[]
  emptySlots: EmptySlot[]
  onItemClick: (item: CalendarItem) => void
  onSlotClick: (slot: EmptySlot) => void
}

const TYPE_STYLES = {
  post: 'bg-cms-accent-subtle text-cms-accent border-l-cms-accent',
  newsletter: 'bg-cms-green-subtle text-cms-green border-l-cms-green',
  campaign: 'bg-cms-amber-subtle text-cms-amber border-l-cms-amber',
} as const

export function WeekView({ startDate, items, emptySlots, onItemClick, onSlotClick }: WeekViewProps) {
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      return d
    }), [startDate])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="grid grid-cols-[60px_repeat(7,1fr)] border border-cms-border rounded-[10px] overflow-hidden bg-cms-surface">
      {/* Header row */}
      <div className="border-b border-cms-border" />
      {days.map((d) => {
        const dateStr = d.toISOString().split('T')[0]
        const isToday = dateStr === today
        return (
          <div key={dateStr} className={`p-2 text-center border-b border-cms-border ${isToday ? 'text-cms-accent' : 'text-cms-text-dim'}`}>
            <div className="text-[11px] uppercase tracking-wide">{d.toLocaleDateString('en', { weekday: 'short' })}</div>
            <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-cms-accent bg-cms-accent-subtle w-[30px] h-[30px] rounded-full inline-flex items-center justify-center' : 'text-cms-text'}`}>
              {d.getDate()}
            </div>
          </div>
        )
      })}

      {/* 3 slot rows */}
      {[1, 2, 3].map((slot) => (
        <>
          <div key={`label-${slot}`} className="px-2 py-1 text-[9px] text-cms-text-dim text-right border-r border-cms-border border-b border-b-cms-border-subtle h-20 flex items-start justify-end">
            Slot {slot}
          </div>
          {days.map((d) => {
            const dateStr = d.toISOString().split('T')[0]
            const isToday = dateStr === today
            const cellItems = items.filter((it) => it.date === dateStr && it.slot === slot)
            const cellSlots = emptySlots.filter((s) => s.date === dateStr && s.slot === slot)

            return (
              <div key={`${dateStr}-${slot}`} className={`border-r border-r-cms-border-subtle border-b border-b-cms-border-subtle p-1 h-20 ${isToday ? 'bg-[rgba(99,102,241,.03)]' : ''}`}>
                {cellItems.map((item) => (
                  <button key={item.id} onClick={() => onItemClick(item)}
                    className={`w-full text-left px-2 py-1 rounded-md text-[11px] font-medium mb-0.5 border-l-[3px] cursor-pointer hover:brightness-110 transition-all
                      ${TYPE_STYLES[item.type]} ${item.status === 'draft' ? 'opacity-60' : ''}`}>
                    {item.type === 'post' ? '📝' : item.type === 'newsletter' ? '📰' : '📢'} {item.title}
                  </button>
                ))}
                {cellSlots.map((s, i) => (
                  <button key={i} onClick={() => onSlotClick(s)}
                    className={`w-full text-center px-2 py-1 rounded-md text-[10px] mb-0.5 border border-dashed cursor-pointer transition-colors
                      ${s.isOverdue ? 'border-cms-red text-cms-red bg-cms-red-subtle' : 'border-cms-border text-cms-text-dim hover:border-cms-accent hover:text-cms-accent hover:bg-cms-accent-subtle'}`}>
                    + Empty {s.type} slot
                  </button>
                ))}
              </div>
            )
          })}
        </>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create BacklogPanel + CadencePanel**

Right panel with draggable backlog items, cadence config rows, and "This Week" summary.

- [ ] **Step 3: Create QuickScheduleDialog**

Modal with mini-calendar, slot indicators (green dots), "Schedule for [date]" CTA.

- [ ] **Step 4: Create AgendaView (mobile)**

Date-grouped chronological feed for mobile. Each card shows type icon + title + locale + status badge. Empty slots inline as dashed cards.

- [ ] **Step 5: Create schedule/page.tsx**

Server component fetching `blog_cadence`, `newsletter_types.cadence_*`, queued posts, scheduled editions. Computes slots via `generateSlots()`. Renders WeekView (desktop/tablet) or AgendaView (mobile).

```tsx
// apps/web/src/app/cms/(authed)/schedule/page.tsx
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { ScheduleClient } from './_components/schedule-client'

export default async function SchedulePage() {
  const supabase = await getSupabaseServerClient()
  const { siteId } = await getSiteContext()

  const [postsRes, editionsRes, cadenceRes, backlogRes] = await Promise.all([
    supabase.from('blog_posts').select('id, slot_date, status, blog_translations(title, locale)')
      .eq('site_id', siteId).in('status', ['queued', 'scheduled']).not('slot_date', 'is', null),
    supabase.from('newsletter_editions').select('id, subject, status, scheduled_at, newsletter_types(name)')
      .eq('site_id', siteId).in('status', ['scheduled', 'queued']),
    supabase.from('blog_cadence').select('*').eq('site_id', siteId),
    supabase.from('blog_posts').select('id, blog_translations(title, locale, reading_time_min)')
      .eq('site_id', siteId).eq('status', 'ready').is('slot_date', null).order('created_at').limit(10),
  ])

  return (
    <div>
      <CmsTopbar title="Schedule" />
      <ScheduleClient
        posts={postsRes.data ?? []}
        editions={editionsRes.data ?? []}
        cadence={cadenceRes.data ?? []}
        backlog={backlogRes.data ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/schedule/
git commit -m "feat(cms): new Schedule page with week/month/agenda views, backlog, cadence config"
```

---

## Phase 4: Cleanup & Integration

---

### Task 12: Remove Old Routes + Update Navigation

**Files:**
- Modify: `apps/web/src/components/cms/cms-sidebar.tsx` (add dynamic badges from DB)
- Delete: `apps/web/src/app/cms/(authed)/contacts/` (moved to /admin per spec)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/subscribers/page.tsx` → redirect to `/cms/subscribers`

- [ ] **Step 1: Add redirect from old subscribers route**

```tsx
// apps/web/src/app/cms/(authed)/newsletters/subscribers/page.tsx
import { redirect } from 'next/navigation'
export default function OldSubscribersPage() { redirect('/cms/subscribers') }
```

- [ ] **Step 2: Add dynamic badge counts to sidebar**

Modify `CmsShell` to accept badge data fetched in the layout (draft count for Posts, subscriber count for Subscribers).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(cms): redirect old routes, wire dynamic sidebar badges"
```

---

### Task 13: Tests + Build Verification

**Files:**
- All test files created in previous tasks

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (web + api).

- [ ] **Step 2: Run build**

Run: `npm run build -w apps/web`
Expected: Build succeeds.

- [ ] **Step 3: Start dev server and manually verify**

Run: `npm run dev -w apps/web`
Check: Navigate to `/cms` → verify sidebar, dashboard, all screens render.

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "fix(cms): address build and test issues from OneCMS redesign"
```

---

## Summary

| Phase | Tasks | Parallelizable | Description |
|-------|-------|---------------|-------------|
| 0 | 1–3 | Sequential | Design tokens → UI components → Shell |
| 1 | 4–6 | Yes (all 3) | Dashboard, Posts List, Authors |
| 2 | 7–9 | Yes (all 3) | Newsletters, Campaigns, Subscribers |
| 3 | 10–11 | Yes (both) | Analytics, Schedule |
| 4 | 12–13 | Sequential | Cleanup, route redirects, final verification |

Total: 13 tasks. Phase 0 is foundation (must be first). Phases 1–3 have parallel tracks. Phase 4 is cleanup.
