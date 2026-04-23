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
  --cms-rose-subtle: rgba(244,63,94,.12);
  --cms-purple: #8b5cf6;
  --cms-purple-subtle: rgba(139,92,246,.12);
  --cms-radius: 8px;
  --cms-sidebar-w: 230px;
}

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
  --color-cms-rose-subtle: var(--cms-rose-subtle);
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
  review: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
  ready: { bg: 'bg-cms-cyan-subtle', text: 'text-cms-cyan' },
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

@media (prefers-reduced-motion: reduce) {
  .animate-shimmer { animation: none; }
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

@media (prefers-reduced-motion: reduce) {
  @keyframes slideUp {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

- [ ] **Step 8: Create shared date formatting utility**

```tsx
// apps/web/src/components/cms/ui/format-date.ts
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const date = new Date(iso)
  const now = new Date()
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
```

- [ ] **Step 9: Create Sparkline standalone component**

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

- [ ] **Step 10: Create barrel export**

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
export { formatRelativeTime } from './format-date'
```

- [ ] **Step 11: Write tests for KpiCard and StatusBadge**

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

- [ ] **Step 12: Run tests**

Run: `npm run test:web -- --run test/components/cms/ui/`
Expected: All tests pass.

- [ ] **Step 13: Commit**

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
  { icon: '📰', label: 'Letters', href: '/cms/newsletters' },
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
import { describe, it, expect, vi } from 'vitest'
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
  })

  it('hides Settings from editor role', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.queryByText('Settings')).toBeNull()
  })

  it('shows Settings for org_admin', () => {
    render(<CmsSidebar {...props} userRole="org_admin" />)
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
import { CmsButton, formatRelativeTime } from '@/components/cms/ui'

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

  const timeAgo = formatRelativeTime(item.updatedAt)

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
- Test: `apps/web/test/app/cms/blog-list.test.tsx`

This task replaces the current minimal post list with the spec's full design: status tabs, locale filter, search, 9-column table, bulk actions, responsive card layout, empty/no-results states. Reference mockup: `02-posts-list-v4.html`, spec section 4.2.

- [ ] **Step 1: Create PostsFilters client component**

Renders status filter tabs (All/Draft/Review/Ready/Queued/Published/Archived), locale toggle (All/pt-BR/en), and search input. Drives URL state via `useRouter().push()` with searchParams.

```tsx
// apps/web/src/app/cms/(authed)/blog/_components/posts-filters.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useRef, useState, useTransition } from 'react'

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
  const debounceRef = useRef<NodeJS.Timeout>(null)

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
            onChange={(e) => {
              setSearch(e.target.value)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              debounceRef.current = setTimeout(() => updateParam('q', e.target.value), 300)
            }}
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
  currentParams?: string
}

function preserveParams(params: string | undefined, newPage: number): string {
  const sp = new URLSearchParams(params ?? '')
  sp.set('page', String(newPage))
  return sp.toString()
}

export function PostsTable({ posts, total, page, pageSize, currentParams }: PostsTableProps) {
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
            {page > 1 && <Link href={`/cms/blog?${preserveParams(currentParams, page - 1)}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Prev</Link>}
            <Link href={`/cms/blog?${preserveParams(currentParams, page + 1)}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Next</Link>
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

  // Count by status (single query, group client-side)
  const { data: statusData } = await supabase
    .from('blog_posts')
    .select('status')
    .eq('site_id', siteId)
  
  const counts: Record<string, number> = {}
  for (const row of statusData ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }

  // Build query
  let query = supabase
    .from('blog_posts')
    .select('id, slug, status, slot_date, updated_at, owner_user_id, blog_translations(title, locale, reading_time_min), authors!blog_posts_owner_user_id_fkey(display_name)', { count: 'exact' })
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (params.status) query = query.eq('status', params.status)
  if (params.locale) query = query.eq('blog_translations.locale', params.locale)
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
          <PostsTable posts={rows} total={total ?? rows.length} page={page} pageSize={pageSize} currentParams={new URLSearchParams(params as Record<string,string>).toString()} />
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
- Test: `apps/web/test/app/cms/authors.test.tsx`

Reference: spec section 4.6, mockup `06-authors.html`.

- [ ] **Step 1: Create AuthorCard component**

```tsx
// apps/web/src/app/cms/(authed)/authors/_components/author-card.tsx
import { StatusBadge, formatRelativeTime } from '@/components/cms/ui'

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
        {props.lastActiveAt ? `Active ${formatRelativeTime(props.lastActiveAt)}` : 'Never logged in'}
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
    .select('id, display_name, slug, bio, avatar_url, user_id')
    .eq('site_id', siteId)
    .order('display_name')

  // Fetch roles separately (no direct FK from authors to site_memberships)
  const userIds = (authors ?? []).map((a: any) => a.user_id).filter(Boolean)
  const { data: memberships } = userIds.length > 0
    ? await supabase.from('site_memberships').select('user_id, role').eq('site_id', siteId).in('user_id', userIds)
    : { data: [] }
  const roleMap: Record<string, string> = {}
  for (const m of memberships ?? []) roleMap[m.user_id] = m.role
  
  const [postCountsRes, pubCountsRes, campCountsRes] = await Promise.all([
    supabase.from('blog_posts').select('owner_user_id', { count: 'exact' }).eq('site_id', siteId).in('owner_user_id', userIds),
    supabase.from('blog_posts').select('owner_user_id', { count: 'exact' }).eq('site_id', siteId).eq('status', 'published').in('owner_user_id', userIds),
    supabase.from('campaigns').select('owner_user_id', { count: 'exact' }).eq('site_id', siteId).in('owner_user_id', userIds),
  ])

  // Group counts by user_id
  function countBy(data: any[] | null, field: string): Record<string, number> {
    return (data ?? []).reduce((acc: Record<string, number>, row: any) => {
      acc[row[field]] = (acc[row[field]] ?? 0) + 1
      return acc
    }, {})
  }
  const postCounts = countBy(postCountsRes.data, 'owner_user_id')
  const pubCounts = countBy(pubCountsRes.data, 'owner_user_id')
  const campCounts = countBy(campCountsRes.data, 'owner_user_id')

  const authorRows = (authors ?? []).map((a: any) => ({
    id: a.id,
    displayName: a.display_name,
    slug: a.slug ?? a.id.slice(0, 8),
    role: roleMap[a.user_id] ?? 'editor',
    bio: a.bio,
    avatarUrl: a.avatar_url,
    initials: a.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    postsCount: postCounts[a.user_id] ?? 0,
    publishedCount: pubCounts[a.user_id] ?? 0,
    campaignsCount: campCounts[a.user_id] ?? 0,
    lastActiveAt: null, // TODO: fetch from auth.users.last_sign_in_at via service-role client
  }))

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

Renders the editions list with status badges, sending state (pulsing dot + purple tint), and failed state (red tint). Desktop table + mobile cards. Similar structure to CampaignTable.

```tsx
// apps/web/src/app/cms/(authed)/newsletters/_components/editions-table.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

export interface EditionRow {
  id: string
  subject: string
  preheader?: string | null
  status: string
  typeName: string
  typeColor: string
  newsletter_type_id: string
  sendCount: number
  statsDelivered: number
  statsOpens: number
  statsClicks: number
  sentAt: string | null
  scheduledAt: string | null
  createdAt: string
}

interface EditionsTableProps {
  editions: EditionRow[]
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot?: string }> = {
    draft: {
      label: 'Draft',
      cls: 'bg-cms-amber-subtle text-[var(--cms-amber)] border-[rgba(245,158,11,.3)]',
    },
    ready: {
      label: 'Ready',
      cls: 'bg-cms-cyan-subtle text-[var(--cms-cyan)] border-[rgba(6,182,212,.3)]',
    },
    scheduled: {
      label: 'Scheduled',
      cls: 'bg-cms-cyan-subtle text-[var(--cms-cyan)] border-[rgba(6,182,212,.3)]',
    },
    sending: {
      label: 'Sending',
      cls: 'bg-cms-purple-subtle text-[var(--cms-purple)] border-[rgba(139,92,246,.3)]',
      dot: 'animate-pulse',
    },
    sent: {
      label: 'Sent',
      cls: 'bg-cms-green-subtle text-[var(--cms-green)] border-[rgba(34,197,94,.3)]',
    },
    failed: {
      label: 'Failed',
      cls: 'bg-cms-red-subtle text-[var(--cms-red)] border-[rgba(239,68,68,.3)]',
    },
  }
  const badge = map[status] ?? {
    label: status,
    cls: 'bg-[rgba(113,113,122,.12)] text-cms-text-muted border-[rgba(113,113,122,.3)]',
  }
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
    >
      {badge.dot && (
        <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${badge.dot}`} />
      )}
      {badge.label}
    </span>
  )
}

function TypeDot({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-xs text-cms-text-muted truncate">{name}</span>
    </div>
  )
}

function OpenRate({ opens, delivered }: { opens: number; delivered: number }) {
  if (delivered === 0) return <span className="text-xs text-cms-text-dim">—</span>
  const rate = Math.round((opens / delivered) * 100)
  return <span className="text-xs font-medium text-[var(--cms-green)]">{rate}%</span>
}

// ── Pagination ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function Pagination({
  total,
  page,
  onPage,
}: {
  total: number
  page: number
  onPage: (p: number) => void
}) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <nav
      className="flex items-center justify-between border-t border-cms-border px-4 py-3 text-sm text-cms-text-muted"
      aria-label="Pagination"
    >
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of{' '}
        {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover disabled:opacity-30"
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .reduce<(number | '…')[]>((acc, p, i, arr) => {
            if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
              acc.push('…')
            }
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                aria-current={p === page ? 'page' : undefined}
                className={`min-w-[28px] rounded px-2 py-1 text-xs ${
                  p === page ? 'bg-cms-accent text-white' : 'hover:bg-cms-surface-hover'
                }`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover disabled:opacity-30"
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  )
}

// ── Desktop row ────────────────────────────────────────────────────────────

function DesktopRow({ edition }: { edition: EditionRow }) {
  const isSending = edition.status === 'sending'
  const isFailed = edition.status === 'failed'

  return (
    <tr
      className={`border-b border-cms-border transition-colors hover:bg-cms-surface-hover
        ${isSending ? 'bg-cms-purple-subtle' : ''}
        ${isFailed ? 'bg-cms-red-subtle' : ''}`}
    >
      {/* Subject + preheader */}
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
          >
            {edition.subject || 'Untitled'}
          </Link>
          {edition.preheader && (
            <p className="mt-0.5 truncate text-[11px] text-cms-text-dim">{edition.preheader}</p>
          )}
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <TypeDot color={edition.typeColor} name={edition.typeName} />
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={edition.status} />
      </td>

      {/* Sent */}
      <td className="px-4 py-3 text-xs text-cms-text tabular-nums">
        {edition.sendCount > 0 ? edition.sendCount.toLocaleString() : '—'}
      </td>

      {/* Open rate */}
      <td className="px-4 py-3">
        <OpenRate opens={edition.statsOpens} delivered={edition.statsDelivered} />
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-cms-text-muted">
        {edition.sentAt
          ? new Date(edition.sentAt).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : edition.scheduledAt
            ? `Sched. ${new Date(edition.scheduledAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
            : new Date(edition.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
          >
            Edit
          </Link>
          {edition.status === 'sent' && (
            <Link
              href={`/cms/newsletters/${edition.id}/analytics`}
              className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
            >
              Analytics
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Mobile card ────────────────────────────────────────────────────────────

function MobileCard({ edition }: { edition: EditionRow }) {
  const isSending = edition.status === 'sending'
  const isFailed = edition.status === 'failed'

  return (
    <div
      className={`rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4
        ${isSending ? 'border-[var(--cms-purple)] bg-cms-purple-subtle' : ''}
        ${isFailed ? 'border-[var(--cms-red)] bg-cms-red-subtle' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
          >
            {edition.subject || 'Untitled'}
          </Link>
          {edition.preheader && (
            <p className="mt-0.5 truncate text-[11px] text-cms-text-dim">{edition.preheader}</p>
          )}
        </div>
        <StatusBadge status={edition.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TypeDot color={edition.typeColor} name={edition.typeName} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-cms-text-muted">
        <div className="flex items-center gap-3">
          {edition.sendCount > 0 && (
            <span>
              <span className="font-medium text-cms-text">{edition.sendCount.toLocaleString()}</span>{' '}
              sent
            </span>
          )}
          {edition.statsDelivered > 0 && (
            <span>
              <OpenRate opens={edition.statsOpens} delivered={edition.statsDelivered} /> opens
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover"
          >
            Edit
          </Link>
          {edition.status === 'sent' && (
            <Link
              href={`/cms/newsletters/${edition.id}/analytics`}
              className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover"
            >
              Analytics
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function EditionsTable({ editions }: EditionsTableProps) {
  const [page, setPage] = useState(1)

  const paginated = editions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (editions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="editions-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-cms-text-dim mb-3" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
        <p className="text-sm font-medium text-cms-text">No editions yet</p>
        <p className="mt-1 text-xs text-cms-text-dim">Create your first newsletter edition</p>
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface"
      data-testid="editions-table"
    >
      {/* Desktop table — hidden below md */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cms-border text-left">
              {['Subject', 'Type', 'Status', 'Sent', 'Opens', 'Date', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((e) => (
              <DesktopRow key={e.id} edition={e} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — visible below md */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {paginated.map((e) => (
          <MobileCard key={e.id} edition={e} />
        ))}
      </div>

      <Pagination total={editions.length} page={page} onPage={setPage} />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite newsletters/page.tsx**

Integrate TypeCards + EditionsTable with server-side data fetching. Query newsletter types and editions from Supabase, map to component shapes. Wrap with CmsTopbar + design tokens.

```tsx
// apps/web/src/app/cms/(authed)/newsletters/page.tsx
import Link from 'next/link'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { CmsButton } from '@/components/cms/ui'
import { TypeCards } from './_components/type-cards'
import { EditionsTable } from './_components/editions-table'
import type { EditionRow } from './_components/editions-table'

export const dynamic = 'force-dynamic'

export default async function NewsletterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const supabase = getSupabaseServiceClient()

  // Fetch newsletter types with subscriber counts + edition counts
  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, last_sent_at, cadence_paused')
    .eq('active', true)
    .order('sort_order')

  // Build editions query with optional filters
  let editionsQuery = supabase
    .from('newsletter_editions')
    .select(
      'id, subject, preheader, status, newsletter_type_id, slot_date, scheduled_at, sent_at, send_count, stats_opens, stats_delivered, stats_clicks, created_at'
    )
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (params.type) editionsQuery = editionsQuery.eq('newsletter_type_id', params.type)
  if (params.status) editionsQuery = editionsQuery.eq('status', params.status)

  const { data: editions } = await editionsQuery

  // Build type → name/color lookup
  const typeMap = new Map(
    (types ?? []).map((t) => [t.id, { name: t.name, color: t.color }])
  )

  // Map types to TypeCards shape
  const mappedTypes = (types ?? []).map((t) => {
    const typeEditions = (editions ?? []).filter((e) => e.newsletter_type_id === t.id)
    const sentEditions = typeEditions.filter((e) => e.status === 'sent')
    const totalOpens = sentEditions.reduce((sum, e) => sum + (e.stats_opens ?? 0), 0)
    const totalDelivered = sentEditions.reduce((sum, e) => sum + (e.stats_delivered ?? 0), 0)
    const avgOpenRate = totalDelivered > 0 ? Math.round((totalOpens / totalDelivered) * 100) : 0

    return {
      id: t.id,
      name: t.name,
      color: t.color ?? '#6366f1',
      subscribers: 0, // subscriber count requires separate query — deferred
      avgOpenRate,
      lastSent: t.last_sent_at
        ? new Date(t.last_sent_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
        : null,
      cadence: t.cadence_days ? `Every ${t.cadence_days}d` : 'Manual',
      editionCount: typeEditions.length,
      isPaused: t.cadence_paused ?? false,
    }
  })

  // Map editions to EditionsTable shape
  const mappedEditions: EditionRow[] = (editions ?? []).map((e) => {
    const typeInfo = typeMap.get(e.newsletter_type_id)
    return {
      id: e.id,
      subject: e.subject,
      preheader: e.preheader,
      status: e.status,
      typeName: typeInfo?.name ?? 'Unknown',
      typeColor: typeInfo?.color ?? '#71717a',
      newsletter_type_id: e.newsletter_type_id,
      sendCount: e.send_count ?? 0,
      statsDelivered: e.stats_delivered ?? 0,
      statsOpens: e.stats_opens ?? 0,
      statsClicks: e.stats_clicks ?? 0,
      sentAt: e.sent_at,
      scheduledAt: e.scheduled_at,
      createdAt: e.created_at,
    }
  })

  return (
    <div>
      <CmsTopbar
        title="Newsletters"
        actions={
          <Link href="/cms/newsletters/new">
            <CmsButton variant="primary" size="sm">
              + New Edition
            </CmsButton>
          </Link>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        {/* Type summary cards */}
        <TypeCards
          types={mappedTypes}
          selectedTypeId={params.type ?? null}
          onSelect={() => {}}
        />

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 text-xs">
          {['all', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed'].map((s) => {
            const isActive = (params.status ?? 'all') === s
            return (
              <Link
                key={s}
                href={`/cms/newsletters?${new URLSearchParams({
                  ...(params.type ? { type: params.type } : {}),
                  ...(s !== 'all' ? { status: s } : {}),
                }).toString()}`}
                className={`rounded-full px-3 py-1.5 font-medium capitalize transition-colors ${
                  isActive
                    ? 'bg-cms-accent text-white'
                    : 'text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'
                }`}
              >
                {s}
              </Link>
            )
          })}
        </div>

        {/* Editions table */}
        <EditionsTable editions={mappedEditions} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write test**

```tsx
// apps/web/test/app/cms/newsletters.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Newsletters', () => {
  it('exports TypeCards component', async () => {
    const mod = await import('@/app/cms/(authed)/newsletters/_components/type-cards')
    expect(mod.TypeCards).toBeDefined()
  })

  it('exports EditionsTable component', async () => {
    const mod = await import('@/app/cms/(authed)/newsletters/_components/editions-table')
    expect(mod.EditionsTable).toBeDefined()
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/ apps/web/test/app/cms/newsletters.test.tsx
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

**Note:** This component uses inline CSS variable references (`var(--cms-*)`) for styling. During implementation, prefer `bg-cms-surface`, `border-cms-border` etc. Tailwind utilities when available — the CSS vars are equivalent but utilities keep JSX consistent with other CMS components.

```tsx
// apps/web/src/app/cms/(authed)/campaigns/_components/campaign-kpis.tsx
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../../lib/cms/site-context'

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  color?: 'amber' | 'green' | 'indigo' | 'default'
}

function KpiTile({ label, value, sub, color = 'default' }: KpiTileProps) {
  const accentMap = {
    amber: 'border-t-[var(--amber,#f59e0b)]',
    green: 'border-t-[var(--green,#22c55e)]',
    indigo: 'border-t-[var(--accent,#6366f1)]',
    default: 'border-t-[var(--border,#2a2d3a)]',
  }
  return (
    <div
      className={`rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] border-t-2 bg-[var(--surface,#1a1d27)] px-4 py-4 ${accentMap[color]}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-[var(--text-muted,#71717a)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold leading-none text-[var(--text,#e4e4e7)]">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] text-[var(--text-dim,#52525b)]">{sub}</p>
      )}
    </div>
  )
}

export async function CampaignKpis() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Active campaigns count (published/scheduled)
  const { count: activeCount } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', ctx.siteId)
    .in('status', ['published', 'scheduled'])

  // Total submissions ever
  const { count: totalSubmissions } = await supabase
    .from('campaign_submissions')
    .select('id', { count: 'exact', head: true })
    .in(
      'campaign_id',
      await supabase
        .from('campaigns')
        .select('id')
        .eq('site_id', ctx.siteId)
        .then((r) => (r.data ?? []).map((c) => c.id)),
    )

  // PDF downloads in last 30d (submissions with downloaded_at set)
  const { count: pdfDownloads30d } = await supabase
    .from('campaign_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('downloaded_at', thirtyDaysAgo)
    .in(
      'campaign_id',
      await supabase
        .from('campaigns')
        .select('id')
        .eq('site_id', ctx.siteId)
        .then((r) => (r.data ?? []).map((c) => c.id)),
    )

  // Conversion rate: submissions / unique visitors (approximation: sub / total campaigns * 100)
  // Since we don't have analytics, compute as (total submissions / published campaigns) as a
  // proxy for submissions per active campaign
  const conversionRate =
    (activeCount ?? 0) > 0
      ? (((totalSubmissions ?? 0) / (activeCount ?? 1)) * 10).toFixed(1)
      : '—'

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      data-testid="campaign-kpis"
    >
      <KpiTile
        label="Active campaigns"
        value={activeCount ?? 0}
        color="amber"
      />
      <KpiTile
        label="Total submissions"
        value={totalSubmissions ?? 0}
        color="green"
      />
      <KpiTile
        label="PDF downloads / 30d"
        value={pdfDownloads30d ?? 0}
        color="indigo"
      />
      <KpiTile
        label="Conv. rate"
        value={conversionRate === '—' ? '—' : `${conversionRate}%`}
        sub="subs per active campaign × 10"
      />
    </div>
  )
}
```

- [ ] **Step 2: Create CampaignTable component**

Table with type badge (PDF/Link), locale badges, status, submissions + sparkline, conversion rate.

```tsx
// apps/web/src/app/cms/(authed)/campaigns/_components/campaign-table.tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CampaignListItem } from '@tn-figueiredo/cms'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CampaignRow extends CampaignListItem {
  /** Whether the campaign has a PDF attached (derived from pdf_storage_path). */
  has_pdf: boolean
  /** Submission count for this campaign. */
  submission_count: number
  /** Last 7 days of daily submission counts (oldest→newest). */
  sparkline_data: number[]
  /** Delta vs 7d prior (can be negative). */
  submissions_delta: number
}

interface CampaignTableProps {
  campaigns: CampaignRow[]
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: {
      label: 'Draft',
      cls: 'bg-[rgba(245,158,11,.12)] text-[#f59e0b] border-[rgba(245,158,11,.3)]',
    },
    published: {
      label: 'Live',
      cls: 'bg-[rgba(34,197,94,.12)] text-[#22c55e] border-[rgba(34,197,94,.3)]',
    },
    scheduled: {
      label: 'Scheduled',
      cls: 'bg-[rgba(6,182,212,.12)] text-[#06b6d4] border-[rgba(6,182,212,.3)]',
    },
    archived: {
      label: 'Archived',
      cls: 'bg-[rgba(113,113,122,.12)] text-[#71717a] border-[rgba(113,113,122,.3)]',
    },
    active: {
      label: 'Live',
      cls: 'bg-[rgba(34,197,94,.12)] text-[#22c55e] border-[rgba(34,197,94,.3)]',
    },
  }
  const badge = map[status] ?? {
    label: status,
    cls: 'bg-[rgba(113,113,122,.12)] text-[#71717a] border-[rgba(113,113,122,.3)]',
  }
  return (
    <span
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
    >
      {badge.label}
    </span>
  )
}

function TypeBadge({ hasPdf }: { hasPdf: boolean }) {
  return hasPdf ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(99,102,241,.3)] bg-[rgba(99,102,241,.12)] px-2 py-0.5 text-[11px] font-medium text-[#6366f1]">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      PDF
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(6,182,212,.3)] bg-[rgba(6,182,212,.12)] px-2 py-0.5 text-[11px] font-medium text-[#06b6d4]">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      Link
    </span>
  )
}

function LocaleBadge({ locale }: { locale: string }) {
  return (
    <span className="rounded border border-[var(--border,#2a2d3a)] bg-[var(--surface-hover,#1f2330)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted,#71717a)]">
      {locale}
    </span>
  )
}

function Sparkline({ data, delta }: { data: number[]; delta: number }) {
  if (!data || data.length === 0) return <span className="text-[var(--text-dim,#52525b)] text-xs">—</span>

  const max = Math.max(...data, 1)
  const width = 48
  const height = 18
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - (v / max) * height
      return `${x},${y}`
    })
    .join(' ')

  const lastX = width
  const lastY = height - (data[data.length - 1] / max) * height

  const deltaColor =
    delta > 0
      ? '#22c55e'
      : delta < 0
        ? '#ef4444'
        : '#71717a'
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta)

  return (
    <div className="flex items-center gap-1.5">
      <svg width={width} height={height} aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r="2.5" fill="#f59e0b" />
      </svg>
      {delta !== 0 && (
        <span className="text-[11px] font-medium" style={{ color: deltaColor }}>
          {deltaLabel}
        </span>
      )}
    </div>
  )
}

function NoPdfWarning() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.08)] px-1.5 py-0.5 text-[10px] text-[#f59e0b]">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      No PDF
    </span>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function Pagination({
  total,
  page,
  onPage,
}: {
  total: number
  page: number
  onPage: (p: number) => void
}) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <nav
      className="flex items-center justify-between border-t border-[var(--border,#2a2d3a)] px-4 py-3 text-sm text-[var(--text-muted,#71717a)]"
      aria-label="Pagination"
    >
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover,#1f2330)] disabled:opacity-30"
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .reduce<(number | '…')[]>((acc, p, i, arr) => {
            if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
              acc.push('…')
            }
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                aria-current={p === page ? 'page' : undefined}
                className={`min-w-[28px] rounded px-2 py-1 text-xs ${
                  p === page
                    ? 'bg-[var(--accent,#6366f1)] text-white'
                    : 'hover:bg-[var(--surface-hover,#1f2330)]'
                }`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className="rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover,#1f2330)] disabled:opacity-30"
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  )
}

// ── Desktop row ────────────────────────────────────────────────────────────

function DesktopRow({
  campaign,
  onDelete,
}: {
  campaign: CampaignRow
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const isArchived = campaign.status === 'archived'
  const isDraft = campaign.status === 'draft'

  return (
    <tr
      className={`border-b border-[var(--border,#2a2d3a)] transition-colors hover:bg-[var(--surface-hover,#1f2330)] ${isArchived ? 'opacity-50' : ''}`}
    >
      {/* Name + slug */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius,8px)] bg-[rgba(245,158,11,.1)] text-[#f59e0b]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="min-w-0">
            <Link
              href={`/cms/campaigns/${campaign.id}/edit`}
              className="block truncate text-sm font-medium text-[var(--text,#e4e4e7)] hover:text-[var(--accent,#6366f1)]"
            >
              {campaign.translation.meta_title ?? campaign.translation.context_tag ?? campaign.translation.slug}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-[var(--text-dim,#52525b)]">
                {campaign.translation.slug}
              </span>
              {campaign.has_pdf && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" aria-label="Has PDF" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              {isDraft && !campaign.has_pdf && <NoPdfWarning />}
            </div>
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <TypeBadge hasPdf={campaign.has_pdf} />
      </td>

      {/* Locales */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {campaign.available_locales.map((l) => (
            <LocaleBadge key={l} locale={l} />
          ))}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={campaign.status} />
      </td>

      {/* Submissions + sparkline */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--text,#e4e4e7)]">
            {campaign.submission_count.toLocaleString()}
          </span>
          <Sparkline data={campaign.sparkline_data} delta={campaign.submissions_delta} />
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-[var(--text-muted,#71717a)]">
        {campaign.published_at
          ? new Date(campaign.published_at).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/cms/campaigns/${campaign.id}/edit`}
            className="rounded px-2 py-1 text-xs text-[var(--text-muted,#71717a)] hover:bg-[var(--surface-hover,#1f2330)] hover:text-[var(--text,#e4e4e7)]"
          >
            Edit
          </Link>
          {(campaign.status === 'draft' || campaign.status === 'archived') && (
            <DeleteButton campaignId={campaign.id} onDelete={onDelete} />
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Delete button ──────────────────────────────────────────────────────────

function DeleteButton({
  campaignId,
  onDelete,
}: {
  campaignId: string
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm('Delete this campaign? This action is permanent.')) return
    setError(null)
    startTransition(async () => {
      const result = await onDelete(campaignId)
      if (!result.ok) setError(result.error ?? 'Failed to delete')
    })
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded px-2 py-1 text-xs text-[#ef4444] hover:bg-[rgba(239,68,68,.1)] disabled:opacity-40"
        aria-label="Delete campaign"
      >
        {isPending ? '…' : 'Delete'}
      </button>
      {error && (
        <span role="alert" className="text-[10px] text-[#ef4444]">
          {error}
        </span>
      )}
    </>
  )
}

// ── Mobile card ────────────────────────────────────────────────────────────

function MobileCard({
  campaign,
  onDelete,
}: {
  campaign: CampaignRow
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const isArchived = campaign.status === 'archived'
  const isDraft = campaign.status === 'draft'

  return (
    <div
      className={`rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)] p-4 ${isArchived ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/cms/campaigns/${campaign.id}/edit`}
            className="block truncate text-sm font-medium text-[var(--text,#e4e4e7)] hover:text-[var(--accent,#6366f1)]"
          >
            {campaign.translation.meta_title ?? campaign.translation.context_tag ?? campaign.translation.slug}
          </Link>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--text-dim,#52525b)]">
            {campaign.translation.slug}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TypeBadge hasPdf={campaign.has_pdf} />
        {isDraft && !campaign.has_pdf && <NoPdfWarning />}
        {campaign.available_locales.map((l) => (
          <LocaleBadge key={l} locale={l} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text,#e4e4e7)]">
            {campaign.submission_count.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted,#71717a)]">subs</span>
          <Sparkline data={campaign.sparkline_data} delta={campaign.submissions_delta} />
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cms/campaigns/${campaign.id}/edit`}
            className="rounded px-2 py-1 text-xs text-[var(--text-muted,#71717a)] hover:bg-[var(--surface-hover,#1f2330)]"
          >
            Edit
          </Link>
          {(campaign.status === 'draft' || campaign.status === 'archived') && (
            <DeleteButton campaignId={campaign.id} onDelete={onDelete} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function CampaignTable({ campaigns, onDelete }: CampaignTableProps) {
  const [page, setPage] = useState(1)

  const paginated = campaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div
      className="overflow-hidden rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)]"
      data-testid="campaign-table"
    >
      {/* Desktop table — hidden below md */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border,#2a2d3a)] text-left">
              {['Campaign', 'Type', 'Locales', 'Status', 'Submissions', 'Date', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-[var(--text-muted,#71717a)]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.map((c) => (
              <DesktopRow key={c.id} campaign={c} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — visible below md */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {paginated.map((c) => (
          <MobileCard key={c.id} campaign={c} onDelete={onDelete} />
        ))}
      </div>

      <Pagination total={campaigns.length} page={page} onPage={setPage} />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite campaigns/page.tsx**

Integrate KPIs + table + CmsTopbar.

```tsx
// apps/web/src/app/cms/(authed)/campaigns/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import type { ContentStatus } from '@tn-figueiredo/cms'
import { campaignRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { deleteCampaign } from './[id]/edit/actions'
import { CampaignKpis } from './_components/campaign-kpis'
import { CampaignTable, type CampaignRow } from './_components/campaign-table'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; locale?: string; search?: string }>
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function KpisSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-[68px] animate-pulse rounded-[var(--radius,8px)] bg-[var(--surface,#1a1d27)]"
        />
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)]">
      <div className="flex gap-3 border-b border-[var(--border,#2a2d3a)] px-4 py-3">
        <div className="h-9 w-60 animate-pulse rounded-[var(--radius,8px)] bg-[var(--surface-hover,#1f2330)]" />
        <div className="h-9 w-24 animate-pulse rounded-[var(--radius,8px)] bg-[var(--surface-hover,#1f2330)]" />
      </div>
      <div className="border-b border-[var(--border,#2a2d3a)] px-4 py-3">
        <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-hover,#1f2330)]" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border-b border-[var(--border,#2a2d3a)] px-4 py-4">
          <div className="h-10 w-full animate-pulse rounded bg-[var(--surface-hover,#1f2330)]" />
        </div>
      ))}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)] px-6 py-16 text-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mb-4 text-[var(--text-dim,#52525b)]"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-base font-semibold text-[var(--text,#e4e4e7)]">No campaigns yet</p>
      <p className="mt-1 text-sm text-[var(--text-muted,#71717a)]">
        Create your first lead-capture campaign.
      </p>
      <Link
        href="/cms/campaigns/new"
        className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius,8px)] bg-[var(--accent,#6366f1)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover,#818cf8)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Create first campaign
      </Link>
    </div>
  )
}

// ── Filter bar ─────────────────────────────────────────────────────────────

function FilterBar({
  status,
  locale,
  search,
}: {
  status: string
  locale: string
  search: string
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-center gap-3"
      data-testid="campaign-filters"
    >
      <input
        type="search"
        name="search"
        placeholder="Search campaigns…"
        defaultValue={search}
        aria-label="title search"
        className="h-9 w-64 rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)] px-3 text-sm text-[var(--text,#e4e4e7)] placeholder-[var(--text-dim,#52525b)] outline-none focus:border-[var(--accent,#6366f1)]"
      />
      <select
        name="status"
        defaultValue={status}
        aria-label="status filter"
        className="h-9 rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)] px-3 text-sm text-[var(--text,#e4e4e7)] outline-none focus:border-[var(--accent,#6366f1)]"
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="scheduled">Scheduled</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
      <select
        name="locale"
        defaultValue={locale}
        aria-label="locale filter"
        className="h-9 rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)] px-3 text-sm text-[var(--text,#e4e4e7)] outline-none focus:border-[var(--accent,#6366f1)]"
      >
        <option value="">All locales</option>
        <option value="pt-BR">pt-BR</option>
        <option value="en">en</option>
      </select>
      <button
        type="submit"
        className="h-9 rounded-[var(--radius,8px)] border border-[var(--border,#2a2d3a)] bg-[var(--surface,#1a1d27)] px-3 text-sm text-[var(--text-muted,#71717a)] hover:bg-[var(--surface-hover,#1f2330)]"
      >
        Filter
      </button>
    </form>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

async function CampaignsContent({ status, locale, search, siteId, defaultLocale }: {
  status: string
  locale: string
  search: string
  siteId: string
  defaultLocale: string
}) {
  const supabase = getSupabaseServiceClient()

  const campaigns = await campaignRepo().list({
    siteId,
    locale: locale || defaultLocale,
    status: (status as ContentStatus) || undefined,
    search: search || undefined,
    perPage: 200, // fetch all, paginate client-side
  })

  if (campaigns.length === 0) {
    return <EmptyState />
  }

  // Enrich with submission counts + sparkline data
  const campaignIds = campaigns.map((c) => c.id)

  // Total submission counts per campaign
  const { data: submissionCounts } = await supabase
    .from('campaign_submissions')
    .select('campaign_id')
    .in('campaign_id', campaignIds)

  const countMap: Record<string, number> = {}
  for (const row of submissionCounts ?? []) {
    const cid = row.campaign_id as string
    countMap[cid] = (countMap[cid] ?? 0) + 1
  }

  // Sparkline data: last 14 days of daily submissions per campaign
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: recentSubs } = await supabase
    .from('campaign_submissions')
    .select('campaign_id, submitted_at')
    .in('campaign_id', campaignIds)
    .gte('submitted_at', fourteenDaysAgo)

  // Build sparkline arrays (7 days) per campaign
  const today = new Date()
  const sparklineMap: Record<string, number[]> = {}
  const deltaMap: Record<string, number> = {}

  for (const id of campaignIds) {
    const days14 = Array(14).fill(0)
    for (const row of recentSubs ?? []) {
      if (row.campaign_id !== id) continue
      const submittedDate = new Date(row.submitted_at as string)
      const daysAgo = Math.floor(
        (today.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysAgo >= 0 && daysAgo < 14) {
        days14[13 - daysAgo] = (days14[13 - daysAgo] ?? 0) + 1
      }
    }
    const recent7 = days14.slice(7)
    const prior7 = days14.slice(0, 7)
    const recent7Total = recent7.reduce((a, b) => a + b, 0)
    const prior7Total = prior7.reduce((a, b) => a + b, 0)
    sparklineMap[id] = recent7
    deltaMap[id] = recent7Total - prior7Total
  }

  // Fetch pdf_storage_path per campaign (not on CampaignListItem)
  const { data: pdfData } = await supabase
    .from('campaigns')
    .select('id, pdf_storage_path')
    .in('id', campaignIds)

  const pdfMap: Record<string, boolean> = {}
  for (const row of pdfData ?? []) {
    pdfMap[row.id as string] = !!(row.pdf_storage_path as string | null)
  }

  const rows: CampaignRow[] = campaigns.map((c) => ({
    ...c,
    has_pdf: pdfMap[c.id] ?? false,
    submission_count: countMap[c.id] ?? 0,
    sparkline_data: sparklineMap[c.id] ?? [],
    submissions_delta: deltaMap[c.id] ?? 0,
  }))

  async function handleDelete(id: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const result = await deleteCampaign(id)
    if (result.ok) return { ok: true }
    return { ok: false, error: result.message ?? result.error }
  }

  return <CampaignTable campaigns={rows} onDelete={handleDelete} />
}

export default async function CmsCampaignsListPage({ searchParams }: Props) {
  const sp = await searchParams
  const ctx = await getSiteContext()

  const status = sp.status ?? ''
  const locale = sp.locale ?? ''
  const search = sp.search ?? ''

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text,#e4e4e7)]">Campaigns</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted,#71717a)]">
            Lead-capture landing pages
          </p>
        </div>
        <Link
          href="/cms/campaigns/new"
          data-testid="new-campaign-btn"
          className="inline-flex items-center gap-2 rounded-[var(--radius,8px)] bg-[var(--accent,#6366f1)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover,#818cf8)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Campaign
        </Link>
      </div>

      {/* KPI tiles */}
      <Suspense fallback={<KpisSkeleton />}>
        <CampaignKpis />
      </Suspense>

      {/* Filters */}
      <FilterBar status={status} locale={locale} search={search} />

      {/* Table */}
      <Suspense fallback={<TableSkeleton />}>
        <CampaignsContent
          status={status}
          locale={locale}
          search={search}
          siteId={ctx.siteId}
          defaultLocale={ctx.defaultLocale}
        />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: Add tests for CampaignKpis and CampaignTable exports**

```tsx
// apps/web/test/app/cms/campaigns.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Campaigns', () => {
  it('exports CampaignKpis component', async () => {
    const mod = await import('@/app/cms/(authed)/campaigns/_components/campaign-kpis')
    expect(mod.CampaignKpis).toBeDefined()
  })

  it('exports CampaignTable component', async () => {
    const mod = await import('@/app/cms/(authed)/campaigns/_components/campaign-table')
    expect(mod.CampaignTable).toBeDefined()
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/campaigns/ apps/web/test/app/cms/campaigns.test.tsx
git commit -m "feat(cms): redesigned Campaigns with KPI tiles, sparklines, responsive table"
```

---

### Task 9: Subscribers Page (Move to /cms/subscribers)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/subscribers/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-table-shell.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-kpis.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/growth-chart.tsx`
- Create: `apps/web/src/app/cms/(authed)/subscribers/_components/engagement-dots.tsx`
- Create: `apps/web/test/app/cms/subscribers.test.tsx`

Reference: spec section 4.7, mockup `07-subscribers.html`.

- [ ] **Step 1: Create EngagementDots component**

Renders 5 colored dots for last 5 sends (green=opened, cyan=clicked, gray=none, red=bounced, rose=complained).

```tsx
// apps/web/src/app/cms/(authed)/subscribers/_components/engagement-dots.tsx
export type DotStatus = 'opened' | 'clicked' | 'none' | 'bounced' | 'complained'

const DOT_COLORS: Record<DotStatus, string> = {
  opened: 'bg-cms-green',
  clicked: 'bg-cms-cyan',
  none: 'bg-cms-text-dim',
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

Client component with period toggle (7d/30d/90d/1y). Pure CSS bars (no chart library). Shows gain (green) and loss (red) bars per day, with net summary. Responsive — hidden on mobile per spec.

```tsx
// apps/web/src/app/cms/(authed)/subscribers/_components/growth-chart.tsx
'use client'

import { useState } from 'react'

export interface GrowthDataPoint {
  date: string
  gain: number
  loss: number
}

interface GrowthChartProps {
  data: GrowthDataPoint[]
}

type Period = '7d' | '30d' | '90d' | '1y'

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '1y': '1 ano',
}

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function GrowthChart({ data }: GrowthChartProps) {
  const [period, setPeriod] = useState<Period>('30d')

  const days = PERIOD_DAYS[period]
  const sliced = data.slice(-days)

  const maxValue = Math.max(
    1,
    ...sliced.map((d) => Math.max(d.gain, d.loss)),
  )

  const totalGain = sliced.reduce((s, d) => s + d.gain, 0)
  const totalLoss = sliced.reduce((s, d) => s + d.loss, 0)
  const net = totalGain - totalLoss

  return (
    <section
      className="rounded-lg border p-4 mb-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label="Gráfico de crescimento de assinantes"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--text)' }}
          >
            Crescimento de assinantes
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            <span className="text-green-500 font-medium">+{totalGain}</span>
            {' · '}
            <span className="text-red-500 font-medium">-{totalLoss}</span>
            {' · '}
            <span
              className={net >= 0 ? 'text-green-500' : 'text-red-500'}
              style={{ fontWeight: 500 }}
            >
              líquido {net >= 0 ? '+' : ''}{net}
            </span>
          </p>
        </div>

        {/* Period toggle */}
        <div
          className="flex gap-1 rounded-md p-0.5"
          style={{ background: 'var(--surface-hover)' }}
          role="group"
          aria-label="Período"
        >
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className="text-xs px-2.5 py-1 rounded transition-colors"
              style={
                period === p
                  ? {
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }
                  : { color: 'var(--text-dim)' }
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div
        className="flex items-end gap-px overflow-hidden"
        style={{ height: 80 }}
        role="img"
        aria-label={`Barras de crescimento nos últimos ${PERIOD_LABELS[period]}`}
      >
        {sliced.length === 0 ? (
          <div
            className="flex-1 flex items-center justify-center text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            Sem dados
          </div>
        ) : (
          sliced.map((point, i) => {
            const gainH = maxValue > 0 ? Math.round((point.gain / maxValue) * 76) : 0
            const lossH = maxValue > 0 ? Math.round((point.loss / maxValue) * 76) : 0
            const isLast = i === sliced.length - 1
            return (
              <div
                key={point.date}
                className="flex-1 flex flex-col items-center justify-end gap-px"
                style={{ minWidth: 2 }}
                title={`${formatDate(point.date)}: +${point.gain} / -${point.loss}`}
              >
                {point.gain > 0 && (
                  <div
                    style={{
                      height: gainH,
                      background: '#22c55e',
                      width: '100%',
                      borderRadius: '1px 1px 0 0',
                      opacity: isLast ? 1 : 0.8,
                    }}
                  />
                )}
                {point.loss > 0 && (
                  <div
                    style={{
                      height: lossH,
                      background: '#ef4444',
                      width: '100%',
                      borderRadius: '0 0 1px 1px',
                      opacity: isLast ? 1 : 0.8,
                    }}
                  />
                )}
                {point.gain === 0 && point.loss === 0 && (
                  <div
                    style={{
                      height: 2,
                      background: 'var(--border)',
                      width: '100%',
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* X-axis labels — show only first, mid, last */}
      {sliced.length > 1 && sliced[0] && sliced[sliced.length - 1] && (
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {formatDate(sliced[0].date)}
          </span>
          {sliced.length > 2 && sliced[Math.floor(sliced.length / 2)] && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {formatDate(sliced[Math.floor(sliced.length / 2)]!.date)}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {formatDate(sliced[sliced.length - 1]!.date)}
          </span>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Create SubscriberKpis component**

Server component that fetches KPI data: total active (confirmed), new in 30d, churn rate (unsubscribed_30d / (active + unsubscribed_30d)), and average open rate from sent editions. Color-coded accent thresholds (green/amber/red).

```tsx
// apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-kpis.tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'default' | 'amber' | 'red' | 'green'
}

function KpiCard({ label, value, sub, accent = 'default' }: KpiCardProps) {
  const accentColor =
    accent === 'amber'
      ? '#f59e0b'
      : accent === 'red'
        ? '#ef4444'
        : accent === 'green'
          ? '#22c55e'
          : 'var(--text)'

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-1"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span className="text-2xl font-bold leading-tight" style={{ color: accentColor }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

interface SubscriberKpisProps {
  siteId: string
}

export async function SubscriberKpis({ siteId }: SubscriberKpisProps) {
  const supabase = getSupabaseServiceClient()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Total active (confirmed only)
  const { count: totalActive } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'confirmed')

  // New in 30d (confirmed subscribed in window)
  const { count: newLast30d } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'confirmed')
    .gte('confirmed_at', thirtyDaysAgo)

  // Unsubscribed in 30d (churn numerator)
  const { count: unsubLast30d } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'unsubscribed')
    .gte('unsubscribed_at', thirtyDaysAgo)

  // Churn rate = unsubscribed_30d / (total_active + unsubscribed_30d)
  const churnDenom = (totalActive ?? 0) + (unsubLast30d ?? 0)
  const churnRate = churnDenom > 0 ? ((unsubLast30d ?? 0) / churnDenom) * 100 : 0
  const churnPct = churnRate.toFixed(1) + '%'
  const churnAccent: KpiCardProps['accent'] =
    churnRate >= 5 ? 'red' : churnRate >= 2 ? 'amber' : 'default'

  // Avg open rate from sent editions in last 30d
  const { data: editionStats } = await supabase
    .from('newsletter_editions')
    .select('stats_opens, stats_delivered')
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .gte('sent_at', thirtyDaysAgo)

  const editions = editionStats ?? []
  let avgOpenRate = 0
  if (editions.length > 0) {
    const totalDelivered = editions.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
    const totalOpens = editions.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
    avgOpenRate = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0
  }
  const openRatePct = avgOpenRate.toFixed(1) + '%'
  const openAccent: KpiCardProps['accent'] =
    avgOpenRate >= 30 ? 'green' : avgOpenRate >= 15 ? 'default' : 'amber'

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      data-testid="subscriber-kpis"
    >
      <KpiCard
        label="Total ativos"
        value={(totalActive ?? 0).toLocaleString('pt-BR')}
        sub="confirmados"
        accent="default"
      />
      <KpiCard
        label="Novos (30d)"
        value={(newLast30d ?? 0).toLocaleString('pt-BR')}
        sub="últimos 30 dias"
        accent="green"
      />
      <KpiCard
        label="Taxa de churn"
        value={churnPct}
        sub={churnRate >= 5 ? 'crítico' : churnRate >= 2 ? 'atenção' : 'saudável'}
        accent={churnAccent}
      />
      <KpiCard
        label="Média de abertura"
        value={openRatePct}
        sub={`${editions.length} edições (30d)`}
        accent={openAccent}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create SubscriberTable + SubscriberTableShell components**

`SubscriberTable` is a client component with search (debounced 300ms), status filter chips, newsletter type dropdown, select-all checkbox, engagement dots per row, LGPD anonymized row handling (lock icon, disabled actions), context menu per status, mobile card layout, and smart pagination.

`SubscriberTableShell` is a thin client wrapper that bridges URL search params to `SubscriberTable` props via `useRouter`/`useSearchParams`, resetting to page 1 on filter changes.

```tsx
// apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-table.tsx
'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from 'react'
import { EngagementDots, type DotStatus } from './engagement-dots'

export type SubscriberStatus =
  | 'confirmed'
  | 'pending'
  | 'bounced'
  | 'unsubscribed'
  | 'complained'

export interface SubscriberRow {
  id: string
  email: string
  status: SubscriberStatus
  newsletter_type_name: string
  newsletter_type_color: string | null
  engagement_dots: DotStatus[]
  tracking_consent: boolean
  subscribed_at: string
  confirmed_at: string | null
  is_anonymized: boolean
}

interface SubscriberTableProps {
  initialRows: SubscriberRow[]
  totalCount: number
  page: number
  perPage: number
  newsletterTypes: { id: string; name: string; color: string | null }[]
  onPageChange: (page: number) => void
  onSearch: (query: string) => void
  onStatusFilter: (status: string) => void
  onTypeFilter: (typeId: string) => void
  currentSearch: string
  currentStatus: string
  currentType: string
}

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  bounced: 'Bounce',
  unsubscribed: 'Cancelado',
  complained: 'Reclamação',
}

const STATUS_COLORS: Record<SubscriberStatus, string> = {
  confirmed: '#22c55e',
  pending: '#f59e0b',
  bounced: '#ef4444',
  unsubscribed: '#6b7280',
  complained: '#f43f5e',
}

function StatusBadge({ status }: { status: SubscriberStatus }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: STATUS_COLORS[status] + '22',
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}44`,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function TypeBadge({ name, color }: { name: string; color: string | null }) {
  const c = color ?? '#6b7280'
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: c + '22',
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {name}
    </span>
  )
}

function LgpdLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-label="Dados anonimizados (LGPD)"
      role="img"
    >
      <rect x="1" y="5" width="10" height="7" rx="1.5" fill="#6b7280" />
      <path
        d="M3 5V3.5a3 3 0 016 0V5"
        stroke="#6b7280"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ConsentIcon({ consent }: { consent: boolean }) {
  return consent ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Tracking consentido" role="img">
      <circle cx="6" cy="6" r="5" fill="#22c55e22" stroke="#22c55e" strokeWidth="1" />
      <path d="M3.5 6l2 2 3-3" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Sem consentimento de tracking" role="img">
      <circle cx="6" cy="6" r="5" fill="#6b728022" stroke="#6b7280" strokeWidth="1" />
      <path d="M4 4l4 4M8 4l-4 4" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function ActionMenu({
  row,
  disabled,
}: {
  row: SubscriberRow
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (disabled) {
    return (
      <span
        className="text-xs px-2 py-1 rounded cursor-not-allowed"
        style={{ color: 'var(--text-dim)' }}
        title="PII anonimizado por LGPD"
      >
        ⋯
      </span>
    )
  }

  const items: { label: string; danger?: boolean; action: string }[] = []
  if (row.status === 'confirmed') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Histórico de engajamento', action: 'history' },
      { label: 'Reenviar boas-vindas', action: 'resend_welcome' },
      { label: 'Copiar email', action: 'copy' },
      { label: 'Cancelar assinatura', action: 'unsubscribe', danger: true },
    )
  } else if (row.status === 'pending') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Reenviar confirmação', action: 'resend_confirm' },
      { label: 'Copiar email', action: 'copy' },
      { label: 'Remover expirado', action: 'delete', danger: true },
    )
  } else if (row.status === 'bounced') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Detalhes do bounce', action: 'bounce_details' },
      { label: 'Tentar reativar', action: 'retry' },
      { label: 'Remover', action: 'delete', danger: true },
    )
  } else {
    items.push({ label: 'Ver detalhes', action: 'view' })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-2 py-1 rounded transition-colors"
        style={{ color: 'var(--text-dim)' }}
        aria-label="Ações"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-10 py-1 min-w-[180px]"
          role="menu"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {items.map((item) => (
            <button
              key={item.action}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                if (item.action === 'copy') {
                  navigator.clipboard.writeText(row.email).catch(() => {})
                }
              }}
              className="w-full text-left text-xs px-3 py-1.5 transition-colors"
              style={{
                color: item.danger ? '#ef4444' : 'var(--text)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileCard({ row }: { row: SubscriberRow }) {
  return (
    <div
      className="rounded-lg border p-3 mb-2"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {row.is_anonymized ? (
            <span
              className="font-mono text-xs italic"
              style={{ color: 'var(--text-dim)' }}
            >
              {row.email}
            </span>
          ) : (
            <span
              className="font-mono text-xs truncate block"
              style={{ color: 'var(--text)' }}
            >
              {row.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {row.is_anonymized && <LgpdLockIcon />}
          <StatusBadge status={row.status} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeBadge
            name={row.newsletter_type_name}
            color={row.newsletter_type_color}
          />
          <EngagementDots
            dots={
              row.is_anonymized
                ? (['none', 'none', 'none', 'none', 'none'] as DotStatus[])
                : row.engagement_dots
            }
            ariaLabel="Engajamento nos últimos 5 envios"
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {new Date(row.subscribed_at).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  )
}

export function SubscriberTable({
  initialRows,
  totalCount,
  page,
  perPage,
  newsletterTypes,
  onPageChange,
  onSearch,
  onStatusFilter,
  onTypeFilter,
  currentSearch,
  currentStatus,
  currentType,
}: SubscriberTableProps) {
  const [searchInput, setSearchInput] = useState(currentSearch)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const totalPages = Math.ceil(totalCount / perPage)
  const startRow = (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalCount)

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearchInput(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(val)
      }, 300)
    },
    [onSearch],
  )

  // cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const allIds = initialRows
    .filter((r) => !r.is_anonymized)
    .map((r) => r.id)
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section aria-label="Lista de assinantes">
      {/* Filter bar */}
      <div
        className="rounded-lg border p-3 mb-4 flex flex-wrap gap-2 items-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <input
          type="search"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Buscar por email…"
          aria-label="Buscar assinante"
          className="flex-1 min-w-[180px] text-sm rounded-md px-3 py-1.5 border outline-none"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
          }}
        />

        <select
          value={currentType}
          onChange={(e) => onTypeFilter(e.target.value)}
          aria-label="Filtrar por newsletter"
          className="text-sm rounded-md px-2 py-1.5 border outline-none"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
          }}
        >
          <option value="">Todas as newsletters</option>
          {newsletterTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Status chips */}
        <div className="flex gap-1 flex-wrap">
          {(['', 'confirmed', 'pending', 'bounced', 'unsubscribed'] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => onStatusFilter(s)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={
                  currentStatus === s
                    ? {
                        background: 'var(--text)',
                        color: 'var(--surface)',
                        borderColor: 'var(--text)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        borderColor: 'var(--border)',
                      }
                }
                aria-pressed={currentStatus === s}
              >
                {s === '' ? 'Todos' : STATUS_LABELS[s as SubscriberStatus]}
              </button>
            ),
          )}
        </div>

        {selectedIds.size > 0 && (
          <span
            className="ml-auto text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'var(--surface-hover)', color: 'var(--text-dim)' }}
          >
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          data-testid="subscriber-table"
        >
          <thead>
            <tr
              className="text-left text-xs uppercase"
              style={{ color: 'var(--text-dim)', letterSpacing: '0.06em' }}
            >
              <th className="pb-2 pr-3 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                  className="rounded"
                />
              </th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Newsletter</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Engajamento</th>
              <th className="pb-2 pr-4 hidden lg:table-cell">Consent</th>
              <th className="pb-2 pr-4">Inscrito em</th>
              <th className="pb-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {initialRows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-sm"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Nenhum assinante encontrado.
                </td>
              </tr>
            )}
            {initialRows.map((row) => (
              <tr
                key={row.id}
                className="border-t transition-colors"
                style={{ borderColor: 'var(--border-subtle)' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background =
                    'var(--surface-hover)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                }}
              >
                {/* Checkbox */}
                <td className="py-2.5 pr-3">
                  <input
                    type="checkbox"
                    disabled={row.is_anonymized}
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Selecionar ${row.email}`}
                    className="rounded disabled:opacity-30"
                  />
                </td>

                {/* Email */}
                <td className="py-2.5 pr-4 max-w-[220px]">
                  {row.is_anonymized ? (
                    <span
                      className="font-mono text-xs italic truncate block"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {row.email}
                    </span>
                  ) : (
                    <span
                      className="font-mono text-xs truncate block"
                      style={{ color: 'var(--text)' }}
                    >
                      {row.email}
                    </span>
                  )}
                </td>

                {/* Type */}
                <td className="py-2.5 pr-4">
                  <TypeBadge
                    name={row.newsletter_type_name}
                    color={row.newsletter_type_color}
                  />
                </td>

                {/* Status */}
                <td className="py-2.5 pr-4">
                  <StatusBadge status={row.status} />
                </td>

                {/* Engagement dots */}
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    {row.is_anonymized && <LgpdLockIcon />}
                    <EngagementDots
                      dots={
                        row.is_anonymized
                          ? (['none', 'none', 'none', 'none', 'none'] as DotStatus[])
                          : row.engagement_dots
                      }
                      ariaLabel="Engajamento nos últimos 5 envios"
                    />
                  </div>
                </td>

                {/* Consent */}
                <td className="py-2.5 pr-4 hidden lg:table-cell">
                  <ConsentIcon consent={row.tracking_consent} />
                </td>

                {/* Date */}
                <td
                  className="py-2.5 pr-4 text-xs whitespace-nowrap"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {new Date(row.subscribed_at).toLocaleDateString('pt-BR')}
                </td>

                {/* Actions */}
                <td className="py-2.5 text-right">
                  <ActionMenu row={row} disabled={row.is_anonymized} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {initialRows.length === 0 && (
          <p
            className="text-center py-10 text-sm"
            style={{ color: 'var(--text-dim)' }}
          >
            Nenhum assinante encontrado.
          </p>
        )}
        {initialRows.map((row) => (
          <MobileCard key={row.id} row={row} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between mt-4 pt-4 border-t text-sm"
          style={{ borderColor: 'var(--border)' }}
          aria-label="Paginação"
        >
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {totalCount === 0
              ? 'Sem resultados'
              : `Mostrando ${startRow}–${endRow} de ${totalCount}`}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded border text-xs disabled:opacity-40 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current
              const mid = Math.min(Math.max(page, 4), totalPages - 3)
              const pageNum =
                totalPages <= 7
                  ? i + 1
                  : i === 0
                    ? 1
                    : i === 6
                      ? totalPages
                      : mid - 3 + i
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className="px-3 py-1.5 rounded border text-xs transition-colors"
                  style={
                    pageNum === page
                      ? {
                          background: 'var(--text)',
                          color: 'var(--surface)',
                          borderColor: 'var(--text)',
                        }
                      : { borderColor: 'var(--border)', color: 'var(--text)' }
                  }
                  aria-current={pageNum === page ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded border text-xs disabled:opacity-40 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Próxima →
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
```

```tsx
// apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-table-shell.tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { SubscriberTable, type SubscriberRow } from './subscriber-table'

interface SubscriberTableShellProps {
  initialRows: SubscriberRow[]
  totalCount: number
  page: number
  perPage: number
  newsletterTypes: { id: string; name: string; color: string | null }[]
  currentSearch: string
  currentStatus: string
  currentType: string
}

export function SubscriberTableShell({
  initialRows,
  totalCount,
  page,
  perPage,
  newsletterTypes,
  currentSearch,
  currentStatus,
  currentType,
}: SubscriberTableShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val) {
        params.set(key, val)
      } else {
        params.delete(key)
      }
    }
    // Reset to page 1 when filters change (unless explicitly setting page)
    if (!('page' in updates)) {
      params.delete('page')
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const handlePageChange = useCallback(
    (newPage: number) => {
      router.push(buildUrl({ page: String(newPage) }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  const handleSearch = useCallback(
    (query: string) => {
      router.push(buildUrl({ search: query }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  const handleStatusFilter = useCallback(
    (status: string) => {
      router.push(buildUrl({ status }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  const handleTypeFilter = useCallback(
    (typeId: string) => {
      router.push(buildUrl({ type: typeId }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  )

  return (
    <SubscriberTable
      initialRows={initialRows}
      totalCount={totalCount}
      page={page}
      perPage={perPage}
      newsletterTypes={newsletterTypes}
      onPageChange={handlePageChange}
      onSearch={handleSearch}
      onStatusFilter={handleStatusFilter}
      onTypeFilter={handleTypeFilter}
      currentSearch={currentSearch}
      currentStatus={currentStatus}
      currentType={currentType}
    />
  )
}
```

- [ ] **Step 5: Create subscribers/page.tsx**

Server component that gates on `is_org_admin || is_super_admin` (spec: PII-heavy page). Fetches from `newsletter_subscriptions` with joins to `newsletter_sends` for engagement data. Builds 365-day growth chart data, maps engagement dots per subscriber, and delegates to `SubscriberTableShell` for client-side filtering/pagination via URL search params.

```tsx
// apps/web/src/app/cms/(authed)/subscribers/page.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { SubscriberKpis } from './_components/subscriber-kpis'
import { GrowthChart, type GrowthDataPoint } from './_components/growth-chart'
import { SubscriberTableShell } from './_components/subscriber-table-shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    type?: string
  }>
}

export default async function SubscribersPage({ searchParams }: Props) {
  const params = await searchParams
  const ctx = await getSiteContext()
  const cookieStore = await cookies()

  // ── RBAC gate: only org_admin / super_admin may view subscriber PII ─────
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          list: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          for (const { name, value, options } of list)
            cookieStore.set(name, value, options)
        },
      },
    },
  )

  const { data: orgRole } = await userClient.rpc('org_role', {
    p_org_id: ctx.orgId,
  })
  const isSuperAdmin =
    orgRole === 'super_admin' || orgRole === 'org_admin'

  if (!isSuperAdmin) {
    redirect('/cms?error=insufficient_access')
  }
  // ── End RBAC gate ─────────────────────────────────────────────────────────

  const supabase = getSupabaseServiceClient()

  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const perPage = 50
  const offset = (page - 1) * perPage
  const search = params.search ?? ''
  const statusFilter = params.status ?? ''
  const typeFilter = params.type ?? ''

  // ── Fetch newsletter types for filter dropdown ────────────────────────────
  const { data: typesRaw } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('active', true)
    .order('sort_order')

  const newsletterTypes = (typesRaw ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: t.color as string | null,
  }))

  const typeMap = new Map(newsletterTypes.map((t) => [t.id, t]))

  // ── Fetch subscribers with pagination ─────────────────────────────────────
  let query = supabase
    .from('newsletter_subscriptions')
    .select(
      'id, email, status, newsletter_id, subscribed_at, confirmed_at, unsubscribed_at, tracking_consent',
      { count: 'exact' },
    )
    .eq('site_id', ctx.siteId)
    .order('subscribed_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (search) query = query.ilike('email', `%${search}%`)
  if (statusFilter) query = query.eq('status', statusFilter)
  if (typeFilter) query = query.eq('newsletter_id', typeFilter)

  const { data: subsRaw, count: totalCount } = await query

  // ── Fetch last 5 engagement dots per subscriber ───────────────────────────
  // NOTE: newsletter_sends uses subscriber_email (not a FK to newsletter_subscriptions.id),
  // so we join by email address instead.
  const subEmails = (subsRaw ?? []).map((s) => s.email as string).filter(Boolean)
  let sendsByEmail: Map<
    string,
    Array<{ status: string; opened_at: string | null; bounced_at: string | null; bounce_type: string | null }>
  > = new Map()

  if (subEmails.length > 0) {
    const { data: sendsRaw } = await supabase
      .from('newsletter_sends')
      .select('subscriber_email, status, opened_at, bounced_at, bounce_type, sent_at')
      .in('subscriber_email', subEmails)
      .order('sent_at', { ascending: false })
      .limit(subEmails.length * 5)

    type SendRow = {
      subscriber_email: string | null
      status: string | null
      opened_at: string | null
      bounced_at: string | null
      bounce_type: string | null
    }

    // Group by subscriber email (top 5 per subscriber)
    for (const send of (sendsRaw ?? []) as SendRow[]) {
      const email = send.subscriber_email
      if (!email) continue
      const arr = sendsByEmail.get(email) ?? []
      if (arr.length < 5) {
        arr.push({
          status: send.status ?? 'none',
          opened_at: send.opened_at,
          bounced_at: send.bounced_at,
          bounce_type: send.bounce_type,
        })
        sendsByEmail.set(email, arr)
      }
    }
  }

  // ── Build subscriber rows ─────────────────────────────────────────────────
  type DotStatus = 'opened' | 'clicked' | 'none' | 'bounced' | 'complained'

  function toDotStatus(send: {
    status: string
    opened_at: string | null
    bounced_at: string | null
    bounce_type: string | null
  }): DotStatus {
    if (send.status === 'complained') return 'complained'
    if (send.bounced_at) return 'bounced'
    if (send.status === 'clicked') return 'clicked'
    if (send.opened_at) return 'opened'
    return 'none'
  }

  function isAnonymized(email: string): boolean {
    return /^[a-f0-9]{8,}\.\.\.@anon$/.test(email)
  }

  const rows = (subsRaw ?? []).map((s) => {
    const sends = sendsByEmail.get(s.email as string) ?? []
    const dots: DotStatus[] = sends.map(toDotStatus)
    while (dots.length < 5) dots.push('none')
    const typeInfo = typeMap.get(s.newsletter_id as string)
    const anonymized = isAnonymized(s.email as string)
    return {
      id: s.id as string,
      email: s.email as string,
      status: s.status as DotStatus extends never ? never : 'confirmed' | 'pending' | 'bounced' | 'unsubscribed' | 'complained',
      newsletter_type_name: typeInfo?.name ?? 'Desconhecido',
      newsletter_type_color: typeInfo?.color ?? null,
      engagement_dots: dots,
      tracking_consent: s.tracking_consent as boolean ?? false,
      subscribed_at: s.subscribed_at as string,
      confirmed_at: s.confirmed_at as string | null,
      is_anonymized: anonymized,
    }
  })

  // ── Growth chart data (last 365 days, 1 row per day) ─────────────────────
  const oneYearAgo = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: newSubs } = await supabase
    .from('newsletter_subscriptions')
    .select('confirmed_at')
    .eq('site_id', ctx.siteId)
    .eq('status', 'confirmed')
    .gte('confirmed_at', oneYearAgo)
    .not('confirmed_at', 'is', null)

  const { data: churnedSubs } = await supabase
    .from('newsletter_subscriptions')
    .select('unsubscribed_at')
    .eq('site_id', ctx.siteId)
    .eq('status', 'unsubscribed')
    .gte('unsubscribed_at', oneYearAgo)
    .not('unsubscribed_at', 'is', null)

  // Aggregate by date
  const growthMap = new Map<string, { gain: number; loss: number }>()

  for (const s of newSubs ?? []) {
    const d = String(s.confirmed_at).slice(0, 10)
    const entry = growthMap.get(d) ?? { gain: 0, loss: 0 }
    entry.gain++
    growthMap.set(d, entry)
  }
  for (const s of churnedSubs ?? []) {
    const d = String(s.unsubscribed_at).slice(0, 10)
    const entry = growthMap.get(d) ?? { gain: 0, loss: 0 }
    entry.loss++
    growthMap.set(d, entry)
  }

  // Fill last 365 days (even days with no activity)
  const growthData: GrowthDataPoint[] = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const entry = growthMap.get(dateStr) ?? { gain: 0, loss: 0 }
    growthData.push({ date: dateStr, ...entry })
  }

  const isEmpty = (totalCount ?? 0) === 0 && !search && !statusFilter && !typeFilter

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Topbar */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--text)' }}
          >
            Assinantes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
            Visibilidade completa e gerenciamento de ciclo de vida
          </p>
        </div>
        <a
          href="/cms/newsletters"
          className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          ← Newsletters
        </a>
      </header>

      {/* KPIs */}
      <SubscriberKpis siteId={ctx.siteId} />

      {/* Growth chart — hidden on mobile/tablet per spec */}
      <div className="hidden lg:block">
        <GrowthChart data={growthData} />
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div
          className="rounded-lg border p-12 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          data-testid="subscribers-empty"
        >
          <div className="text-4xl mb-3">📭</div>
          <h2
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--text)' }}
          >
            Nenhum assinante ainda
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Adicione um formulário de newsletter ao seu site para começar a
            capturar assinantes.
          </p>
          <a
            href="/cms/newsletters"
            className="inline-block text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: 'var(--text)', color: 'var(--surface)' }}
          >
            Configurar newsletter
          </a>
        </div>
      ) : (
        <SubscriberTableShell
          initialRows={rows as Parameters<typeof SubscriberTableShell>[0]['initialRows']}
          totalCount={totalCount ?? 0}
          page={page}
          perPage={perPage}
          newsletterTypes={newsletterTypes}
          currentSearch={search}
          currentStatus={statusFilter}
          currentType={typeFilter}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 6: Write test**

```tsx
// apps/web/test/app/cms/subscribers.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Subscribers', () => {
  it('exports SubscriberKpis component', async () => {
    const mod = await import('@/app/cms/(authed)/subscribers/_components/subscriber-kpis')
    expect(mod.SubscriberKpis).toBeDefined()
  })

  it('exports SubscriberTable component', async () => {
    const mod = await import('@/app/cms/(authed)/subscribers/_components/subscriber-table')
    expect(mod.SubscriberTable).toBeDefined()
  })

  it('exports GrowthChart component', async () => {
    const mod = await import('@/app/cms/(authed)/subscribers/_components/growth-chart')
    expect(mod.GrowthChart).toBeDefined()
  })
})
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/subscribers/ apps/web/test/app/cms/subscribers.test.tsx
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
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
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

- [ ] **Step 3: Create AnalyticsTabs component**

Tab navigation (Overview/Newsletters/Campaigns/Content) with period selector. URL-driven state via `useSearchParams`.

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/analytics-tabs.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { OverviewTab } from './overview-tab'
import { NewslettersTab } from './newsletters-tab'
import { CampaignsTab } from './campaigns-tab'
import { ContentTab } from './content-tab'

const TABS = ['Overview', 'Newsletters', 'Campaigns', 'Content'] as const
type Tab = (typeof TABS)[number]

const PERIODS = ['7d', '30d', '90d', '12m'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
}

export function AnalyticsTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = (searchParams.get('tab') as Tab) ?? 'Overview'
  const period = (searchParams.get('period') as Period) ?? '30d'

  const navigate = useCallback(
    (newTab?: Tab, newPeriod?: Period) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newTab) params.set('tab', newTab)
      if (newPeriod) params.set('period', newPeriod)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="space-y-6">
      {/* Tab nav + period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex gap-1 p-1 rounded-[8px] w-fit"
          style={{ background: 'var(--cms-bg, #0f1117)' }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => navigate(t)}
              data-active={t === tab}
              className="px-3 py-1.5 rounded-[6px] text-sm font-medium transition-colors
                data-[active=true]:text-[var(--cms-text,#e4e4e7)]
                hover:text-[var(--cms-text,#e4e4e7)]"
              style={{
                color:
                  t === tab
                    ? 'var(--cms-text, #e4e4e7)'
                    : 'var(--cms-text-muted, #71717a)',
                background:
                  t === tab
                    ? 'var(--cms-surface, #1a1d27)'
                    : 'transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: 'var(--cms-text-dim, #52525b)' }}
          >
            {PERIOD_LABELS[period]}
          </span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => navigate(undefined, p)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border"
                style={{
                  borderColor:
                    p === period
                      ? 'var(--cms-accent, #6366f1)'
                      : 'var(--cms-border, #2a2d3a)',
                  color:
                    p === period
                      ? 'var(--cms-accent, #6366f1)'
                      : 'var(--cms-text-muted, #71717a)',
                  background:
                    p === period
                      ? 'var(--cms-accent-subtle, rgba(99,102,241,.12))'
                      : 'transparent',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'Overview' && <OverviewTab period={period} />}
      {tab === 'Newsletters' && <NewslettersTab period={period} />}
      {tab === 'Campaigns' && <CampaignsTab period={period} />}
      {tab === 'Content' && <ContentTab period={period} />}
    </div>
  )
}
```

- [ ] **Step 4: Create OverviewTab component**

Overview tab composes KPI cards + area chart + donut + funnel + top tables. Uses static placeholder data (replace with real fetches when wiring).

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/overview-tab.tsx
import { AreaChart } from './area-chart'
import { DonutChart } from './donut-chart'
import { DeliveryFunnel } from './delivery-funnel'

interface OverviewTabProps {
  period: string
}

// --- Static placeholder data shapes (replace with real fetches when wiring) ---

function buildEngagementSeries(period: string) {
  const count = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 52
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (count - 1 - i))
    return {
      label:
        count <= 30
          ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
          : `W${Math.ceil((i + 1) / 7)}`,
      values: [
        Math.round(Math.random() * 400 + 100),
        Math.round(Math.random() * 150 + 20),
        Math.round(Math.random() * 40),
      ],
    }
  })
}

const AUDIENCE_SEGMENTS = [
  { label: 'Main newsletter', value: 1842, color: '#22c55e' },
  { label: 'Code digest', value: 634, color: '#6366f1' },
  { label: 'Announcements', value: 298, color: '#f59e0b' },
]

const FUNNEL_STEPS = [
  { label: 'Sent', value: 8420, percentage: 100, color: '#6366f1' },
  { label: 'Delivered', value: 8201, percentage: 97, color: '#22c55e' },
  { label: 'Opened', value: 2542, percentage: 30, color: '#06b6d4' },
  { label: 'Clicked', value: 612, percentage: 7, color: '#8b5cf6' },
  { label: 'Bounced', value: 219, percentage: 3, color: '#ef4444' },
]

const TOP_POSTS = [
  { rank: 1, title: 'How I built my second brain in 2026', opens: 1240, clicks: 312 },
  { rank: 2, title: 'Supabase RLS patterns that scale', opens: 980, clicks: 201 },
  { rank: 3, title: 'Why I switched from Notion to Obsidian', opens: 876, clicks: 189 },
  { rank: 4, title: 'TypeScript generics in 10 minutes', opens: 740, clicks: 134 },
  { rank: 5, title: 'Building a newsletter CMS from scratch', opens: 620, clicks: 97 },
]

const TOP_CAMPAIGNS = [
  { rank: 1, title: 'React 19 Deep Dive', submissions: 843, rate: 12.4 },
  { rank: 2, title: 'Supabase Auth Checklist', submissions: 612, rate: 9.8 },
  { rank: 3, title: 'TypeScript Handbook 2026', submissions: 441, rate: 7.2 },
]

const RANK_STYLES: Record<number, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
}

export function OverviewTab({ period }: OverviewTabProps) {
  const engagementData = buildEngagementSeries(period)
  const todayIndex = engagementData.length - 1

  const kpis = [
    { label: 'Emails Delivered', value: '8,201', trend: '+5.2%', up: true, color: 'var(--cms-text, #e4e4e7)' },
    { label: 'Open Rate', value: '30.9%', trend: '+1.4pp', up: true, color: 'var(--cms-green, #22c55e)' },
    { label: 'Click Rate', value: '7.3%', trend: '+0.6pp', up: true, color: 'var(--cms-cyan, #06b6d4)' },
    { label: 'Campaign Leads', value: '1,896', trend: '+18%', up: true, color: 'var(--cms-text, #e4e4e7)' },
    { label: 'Bounce Rate', value: '2.6%', trend: '-0.3pp', up: false, color: 'var(--cms-amber, #f59e0b)' },
  ]

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] p-4 border"
            style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{kpi.label}</p>
            <p className="text-2xl font-semibold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-[11px] mt-1.5"
              style={{ color: kpi.up ? 'var(--cms-green, #22c55e)' : 'var(--cms-amber, #f59e0b)' }}>
              {kpi.trend} vs prior period
            </p>
          </div>
        ))}
      </div>

      {/* 2-column chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-[10px] p-4 border"
          style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Engagement Over Time</p>
          <AreaChart data={engagementData}
            series={[{ name: 'Opens', color: '#22c55e' }, { name: 'Clicks', color: '#06b6d4' }, { name: 'Bounces', color: '#ef4444' }]}
            height={180} todayIndex={todayIndex} />
        </div>
        <div className="lg:col-span-2 rounded-[10px] p-4 border"
          style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Audience by Newsletter</p>
          <DonutChart segments={AUDIENCE_SEGMENTS} centerLabel="subscribers" centerValue="2,774" size={120} />
        </div>
      </div>

      {/* Delivery funnel */}
      <div className="rounded-[10px] p-4 border"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Email Delivery Funnel</p>
        <DeliveryFunnel steps={FUNNEL_STEPS} />
      </div>

      {/* Top tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[10px] p-4 border"
          style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Top Posts by Engagement</p>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                <th className="text-left pb-2 pr-2">#</th>
                <th className="text-left pb-2 flex-1">Title</th>
                <th className="text-right pb-2 pl-2">Opens</th>
                <th className="text-right pb-2 pl-2">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {TOP_POSTS.map((p) => (
                <tr key={p.rank} style={{ color: 'var(--cms-text-muted, #71717a)' }}>
                  <td className="py-1.5 pr-2 text-base">{RANK_STYLES[p.rank] ?? p.rank}</td>
                  <td className="py-1.5 pr-2 max-w-0 truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{p.title}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{p.opens.toLocaleString()}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{p.clicks.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-[10px] p-4 border"
          style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Top Campaigns by Submissions</p>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                <th className="text-left pb-2 pr-2">#</th>
                <th className="text-left pb-2 flex-1">Campaign</th>
                <th className="text-right pb-2 pl-2">Leads</th>
                <th className="text-right pb-2 pl-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              {TOP_CAMPAIGNS.map((c) => (
                <tr key={c.rank} style={{ color: 'var(--cms-text-muted, #71717a)' }}>
                  <td className="py-1.5 pr-2 text-base">{RANK_STYLES[c.rank] ?? c.rank}</td>
                  <td className="py-1.5 pr-2" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{c.title}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{c.submissions.toLocaleString()}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: 'var(--cms-green, #22c55e)' }}>{c.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create remaining tabs (NewslettersTab, CampaignsTab, ContentTab)**

Each tab follows the pattern: KPI row + type-specific charts/tables with static placeholder data.

**NewslettersTab** -- Edition performance table + top clicked links:

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/newsletters-tab.tsx
interface NewslettersTabProps {
  period: string
}

const EDITION_PERFORMANCE = [
  { subject: 'Building with AI in 2026', sent_at: '2026-04-15', delivered: 8201, opens: 2542, clicks: 612, bounces: 56 },
  { subject: 'Supabase RLS deep dive', sent_at: '2026-04-08', delivered: 7980, opens: 2180, clicks: 498, bounces: 42 },
  { subject: 'TypeScript 5.6 what\'s new', sent_at: '2026-04-01', delivered: 8100, opens: 1940, clicks: 420, bounces: 38 },
  { subject: 'Next.js 15 stable release', sent_at: '2026-03-25', delivered: 7820, opens: 2310, clicks: 590, bounces: 61 },
]

const TOP_LINKS = [
  { url: 'https://github.com/TN-Figueiredo/cms', clicks: 312 },
  { url: 'https://bythiagofigueiredo.com/blog/supabase-rls', clicks: 241 },
  { url: 'https://bythiagofigueiredo.com/blog/typescript-5', clicks: 189 },
  { url: 'https://twitter.com/tnFigueiredo', clicks: 134 },
  { url: 'https://bythiagofigueiredo.com/campaigns/ai-handbook', clicks: 97 },
]

export function NewslettersTab({ period: _period }: NewslettersTabProps) {
  const kpis = [
    { label: 'Editions Sent', value: '12' },
    { label: 'Avg Delivered', value: '8,025' },
    { label: 'Avg Open Rate', value: '28.4%' },
    { label: 'Avg Click Rate', value: '6.9%' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] p-4 border"
            style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{kpi.label}</p>
            <p className="text-2xl font-semibold" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[10px] p-4 border"
          style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Edition Performance</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                  <th className="text-left pb-2 pr-3">Subject</th>
                  <th className="text-left pb-2 pr-3">Sent</th>
                  <th className="text-right pb-2 pr-3">Delivered</th>
                  <th className="text-right pb-2 pr-3">Opens</th>
                  <th className="text-right pb-2 pr-3">Clicks</th>
                  <th className="text-right pb-2">Bounces</th>
                </tr>
              </thead>
              <tbody>
                {EDITION_PERFORMANCE.map((e) => (
                  <tr key={e.subject} className="border-t" style={{ borderColor: 'var(--cms-border-subtle, #22252f)' }}>
                    <td className="py-2 pr-3 max-w-[180px] truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{e.subject}</td>
                    <td className="py-2 pr-3 tabular-nums" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{e.sent_at}</td>
                    <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{e.delivered.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-green, #22c55e)' }}>{e.opens.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-cyan, #06b6d4)' }}>{e.clicks.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums" style={{ color: 'var(--cms-red, #ef4444)' }}>{e.bounces.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-[10px] p-4 border"
          style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Top Clicked Links</p>
          <div className="space-y-2">
            {TOP_LINKS.map((link) => (
              <div key={link.url} className="flex items-center gap-2">
                <span className="flex-1 text-[11px] font-mono truncate" style={{ color: 'var(--cms-cyan, #06b6d4)' }}>{link.url}</span>
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{link.clicks}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**CampaignsTab** -- Ranked campaign table with locale split:

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/campaigns-tab.tsx
interface CampaignsTabProps {
  period: string
}

const CAMPAIGN_ROWS = [
  { rank: 1, title: 'React 19 Deep Dive', total: 843, rate: '12.4%',
    locales: [{ flag: '\u{1F1E7}\u{1F1F7}', code: 'pt-BR', pct: 62 }, { flag: '\u{1F1FA}\u{1F1F8}', code: 'en', pct: 38 }] },
  { rank: 2, title: 'Supabase Auth Checklist', total: 612, rate: '9.8%',
    locales: [{ flag: '\u{1F1E7}\u{1F1F7}', code: 'pt-BR', pct: 55 }, { flag: '\u{1F1FA}\u{1F1F8}', code: 'en', pct: 45 }] },
  { rank: 3, title: 'TypeScript Handbook 2026', total: 441, rate: '7.2%',
    locales: [{ flag: '\u{1F1E7}\u{1F1F7}', code: 'pt-BR', pct: 40 }, { flag: '\u{1F1FA}\u{1F1F8}', code: 'en', pct: 60 }] },
  { rank: 4, title: 'Next.js 15 Migration Guide', total: 318, rate: '5.1%',
    locales: [{ flag: '\u{1F1FA}\u{1F1F8}', code: 'en', pct: 72 }, { flag: '\u{1F1E7}\u{1F1F7}', code: 'pt-BR', pct: 28 }] },
]

export function CampaignsTab({ period: _period }: CampaignsTabProps) {
  const kpis = [
    { label: 'Total Submissions', value: '2,214' },
    { label: 'Avg Download Rate', value: '8.6%' },
    { label: 'Avg per Campaign', value: '554' },
    { label: 'Active Campaigns', value: '4' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] p-4 border"
            style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{kpi.label}</p>
            <p className="text-2xl font-semibold" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[10px] p-4 border"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Campaign Rankings</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                <th className="text-left pb-2 pr-3 w-8">#</th>
                <th className="text-left pb-2 pr-3">Campaign</th>
                <th className="text-right pb-2 pr-3">Submissions</th>
                <th className="text-right pb-2 pr-3">Rate</th>
                <th className="text-left pb-2">Locale split</th>
              </tr>
            </thead>
            <tbody>
              {CAMPAIGN_ROWS.map((c) => (
                <tr key={c.rank} className="border-t" style={{ borderColor: 'var(--cms-border-subtle, #22252f)' }}>
                  <td className="py-2 pr-3 font-semibold" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{c.rank}</td>
                  <td className="py-2 pr-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{c.title}</td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-amber, #f59e0b)' }}>{c.total.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-green, #22c55e)' }}>{c.rate}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {c.locales.map((l) => (
                        <span key={l.code} className="text-[11px]" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{l.flag} {l.code} {l.pct}%</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

**ContentTab** -- Publishing heatmap + author leaderboard:

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/content-tab.tsx
import { Heatmap } from './heatmap'

interface ContentTabProps {
  period: string
}

const AUTHOR_LEADERBOARD = [
  { rank: 1, name: 'Thiago Figueiredo', posts: 18, avg_reads: 1240, avg_clicks: 312 },
  { rank: 2, name: 'Guest -- Ana Lima', posts: 4, avg_reads: 820, avg_clicks: 189 },
  { rank: 3, name: 'Guest -- Bruno Costa', posts: 2, avg_reads: 610, avg_clicks: 134 },
]

function buildHeatmapCells(): Array<{ date: string; count: number }> {
  const cells: Array<{ date: string; count: number }> = []
  const today = new Date()
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dayOfWeek = d.getDay()
    const publishLikely = [1, 3, 5].includes(dayOfWeek)
    const count = Math.random() < (publishLikely ? 0.4 : 0.1) ? Math.random() < 0.3 ? 2 : 1 : 0
    cells.push({ date: d.toISOString().split('T')[0]!, count })
  }
  return cells
}

const HEATMAP_CELLS = buildHeatmapCells()

export function ContentTab({ period: _period }: ContentTabProps) {
  const kpis = [
    { label: 'Published (30d)', value: '6' },
    { label: 'In Queue', value: '3' },
    { label: 'Drafts', value: '11' },
    { label: 'Avg Time to Publish', value: '4.2d' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] p-4 border"
            style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{kpi.label}</p>
            <p className="text-2xl font-semibold" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[10px] p-4 border"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Publishing Activity</p>
        <Heatmap cells={HEATMAP_CELLS} weeks={12} label="posts published" />
      </div>
      <div className="rounded-[10px] p-4 border"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Author Leaderboard</p>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'var(--cms-text-dim, #52525b)' }}>
              <th className="text-left pb-2 pr-3 w-8">#</th>
              <th className="text-left pb-2 pr-3">Author</th>
              <th className="text-right pb-2 pr-3">Posts</th>
              <th className="text-right pb-2 pr-3">Avg Reads</th>
              <th className="text-right pb-2">Avg Clicks</th>
            </tr>
          </thead>
          <tbody>
            {AUTHOR_LEADERBOARD.map((a) => (
              <tr key={a.rank} className="border-t" style={{ borderColor: 'var(--cms-border-subtle, #22252f)' }}>
                <td className="py-2 pr-3 font-semibold" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{a.rank}</td>
                <td className="py-2 pr-3" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{a.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-accent, #6366f1)' }}>{a.posts}</td>
                <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{a.avg_reads.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: 'var(--cms-cyan, #06b6d4)' }}>{a.avg_clicks.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create AreaChart component**

Multi-series SVG area chart with grid lines, today marker, legend, and x-axis labels.

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/area-chart.tsx
'use client'

import { useMemo } from 'react'

interface DataPoint { label: string; values: number[] }
interface AreaChartSeries { name: string; color: string }
interface AreaChartProps { data: DataPoint[]; series: AreaChartSeries[]; height?: number; todayIndex?: number }

function normalise(points: number[], max: number, height: number, padding: number): string {
  if (points.length < 2) return ''
  const step = 100 / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = i * step
    const y = max > 0 ? padding + (1 - v / max) * (height - padding * 2) : height - padding
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return coords.join(' ')
}

function buildAreaPath(coordStr: string, height: number): string {
  if (!coordStr) return ''
  const firstX = coordStr.split(' ')[0]?.split(',')[0] ?? '0'
  const lastX = coordStr.split(' ').at(-1)?.split(',')[0] ?? '100'
  return `M ${firstX},${height} L ${coordStr} L ${lastX},${height} Z`
}

export function AreaChart({ data, series, height = 180, todayIndex }: AreaChartProps) {
  const PADDING = 20
  const GRID_LINES = 4

  const maxVal = useMemo(() => {
    let max = 0
    for (const point of data) for (const v of point.values) if (v > max) max = v
    return max || 1
  }, [data])

  const seriesCoords = useMemo(
    () => series.map((_, si) => normalise(data.map((d) => d.values[si] ?? 0), maxVal, height, PADDING)),
    [data, series, maxVal, height],
  )

  const gridYValues = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    PADDING + (i / GRID_LINES) * (height - PADDING * 2))

  const xLabels = data.length <= 12 ? data : data.filter((_, i) => i % Math.ceil(data.length / 6) === 0)

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full" aria-hidden="true">
        {gridYValues.map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--cms-border, #2a2d3a)" strokeWidth="0.3" />
        ))}
        {todayIndex !== undefined && data.length > 1 && (
          <line x1={((todayIndex / (data.length - 1)) * 100).toFixed(2)} y1={PADDING}
            x2={((todayIndex / (data.length - 1)) * 100).toFixed(2)} y2={height - PADDING}
            stroke="var(--cms-accent, #6366f1)" strokeWidth="0.5" strokeDasharray="2 1" />
        )}
        {[...series].reverse().map((s, ri) => {
          const si = series.length - 1 - ri; const coords = seriesCoords[si]
          if (!coords) return null
          return <path key={s.name + '-area'} d={buildAreaPath(coords, height)} fill={s.color} opacity={0.15} />
        })}
        {series.map((s, si) => {
          const coords = seriesCoords[si]; if (!coords) return null
          return <polyline key={s.name + '-line'} points={coords} fill="none" stroke={s.color}
            strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1" style={{ top: height - PADDING + 2 }}>
        {xLabels.map((d) => (
          <span key={d.label} className="text-[9px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{d.label}</span>
        ))}
      </div>
      {todayIndex !== undefined && data[todayIndex] && (
        <div className="absolute text-[9px] font-medium px-1"
          style={{ left: `${(todayIndex / (data.length - 1)) * 100}%`, top: PADDING - 14, transform: 'translateX(-50%)', color: 'var(--cms-accent, #6366f1)' }}>Today</div>
      )}
      <div className="absolute top-0 right-0 flex gap-3">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-[3px] rounded-full" style={{ background: s.color }} />
            <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create Heatmap component**

GitHub-style contribution heatmap with month labels, day labels, and opacity-based coloring.

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/heatmap.tsx
interface HeatmapCell { date: string; count: number }
interface HeatmapProps { cells: HeatmapCell[]; weeks?: number; label?: string }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cellOpacity(count: number, max: number): number {
  if (count === 0 || max === 0) return 0
  return Math.max(0.15, count / max)
}

export function Heatmap({ cells, weeks = 12, label = 'contributions' }: HeatmapProps) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const startDate = new Date(today); startDate.setDate(startDate.getDate() - (weeks * 7 - 1))

  const cellMap = new Map<string, number>()
  for (const c of cells) cellMap.set(c.date, c.count)

  const maxCount = cells.reduce((m, c) => Math.max(m, c.count), 1)
  const total = cells.reduce((sum, c) => sum + c.count, 0)

  const grid: Array<{ date: string; count: number; inFuture: boolean }[]> = []
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; count: number; inFuture: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(startDate); day.setDate(day.getDate() + w * 7 + d)
      const dateStr = day.toISOString().split('T')[0]!
      col.push({ date: dateStr, count: cellMap.get(dateStr) ?? 0, inFuture: day > today })
    }
    grid.push(col)
  }

  const monthLabels: { weekIndex: number; label: string }[] = []
  let lastMonth = -1
  for (let w = 0; w < weeks; w++) {
    const firstDay = grid[w]?.[0]; if (!firstDay) continue
    const month = new Date(firstDay.date).getMonth()
    if (month !== lastMonth) {
      monthLabels.push({ weekIndex: w, label: new Date(firstDay.date).toLocaleDateString('en', { month: 'short' }) })
      lastMonth = month
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--cms-text-muted, #71717a)' }}>
          {total} {label} in the last {weeks} weeks
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>Less</span>
          {[0, 0.2, 0.4, 0.7, 1].map((op) => (
            <span key={op} className="w-2.5 h-2.5 rounded-sm"
              style={{ background: op === 0 ? 'var(--cms-border, #2a2d3a)' : `rgba(34, 197, 94, ${op})` }} />
          ))}
          <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>More</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="flex flex-col gap-[3px] shrink-0 pt-5">
          {DAY_LABELS.map((dl, i) => (
            <span key={dl} className="text-[9px] h-[11px] flex items-center"
              style={{ color: 'var(--cms-text-dim, #52525b)', visibility: i % 2 === 0 ? 'visible' : 'hidden' }}>{dl}</span>
          ))}
        </div>
        <div className="flex flex-col gap-0 min-w-0">
          <div className="relative h-5 flex">
            {monthLabels.map((ml) => (
              <span key={ml.weekIndex + ml.label} className="absolute text-[10px]"
                style={{ left: `${(ml.weekIndex / weeks) * 100}%`, color: 'var(--cms-text-dim, #52525b)' }}>{ml.label}</span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {grid.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((cell) => (
                  <div key={cell.date} title={`${cell.date}: ${cell.count} ${label}`}
                    className="w-[11px] h-[11px] rounded-sm transition-all cursor-default"
                    style={{
                      background: cell.inFuture ? 'transparent' : cell.count === 0
                        ? 'var(--cms-border, #2a2d3a)' : `rgba(34, 197, 94, ${cellOpacity(cell.count, maxCount)})`,
                      border: cell.inFuture ? '1px dashed var(--cms-border-subtle, #22252f)' : 'none',
                    }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create analytics/page.tsx**

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

- [ ] **Step 9: Write analytics tests**

```tsx
// apps/web/test/app/cms/analytics.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Analytics', () => {
  it('exports AnalyticsTabs component', async () => {
    const mod = await import('@/app/cms/(authed)/analytics/_components/analytics-tabs')
    expect(mod.AnalyticsTabs).toBeDefined()
  })

  it('exports AreaChart component', async () => {
    const mod = await import('@/app/cms/(authed)/analytics/_components/area-chart')
    expect(mod.AreaChart).toBeDefined()
  })
})
```

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/analytics/ apps/web/test/app/cms/analytics.test.tsx
git commit -m "feat(cms): new Analytics page with 4 tabs, funnel, donut chart, heatmap, period selector"
```

---

### Task 11: Schedule Page (New)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/schedule/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/week-view.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/backlog-panel.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/quick-schedule-dialog.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/agenda-view.tsx`

Reference: spec section 4.9, mockup `09-schedule.html`.

- [ ] **Step 1: Create WeekView component**

CSS grid (8 columns: time label + 7 days), 3 slot rows. Calendar items color-coded (post=indigo, newsletter=green, campaign=amber). Empty slots as dashed. Overdue in red.

```tsx
// apps/web/src/app/cms/(authed)/schedule/_components/week-view.tsx
'use client'

import { Fragment, useMemo } from 'react'

interface CalendarItem {
  id: string; title: string; type: 'post' | 'newsletter' | 'campaign'
  status: string; date: string; slot: number; sendTime?: string; subscriberCount?: number
}

interface EmptySlot { date: string; slot: number; type: 'blog' | 'newsletter'; isOverdue: boolean }

interface WeekViewProps {
  startDate: Date; items: CalendarItem[]; emptySlots: EmptySlot[]
  onItemClick: (item: CalendarItem) => void; onSlotClick: (slot: EmptySlot) => void
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  post: { bg: 'rgba(99,102,241,.12)', text: 'var(--cms-accent, #6366f1)', border: 'var(--cms-accent, #6366f1)' },
  newsletter: { bg: 'rgba(34,197,94,.12)', text: 'var(--cms-green, #22c55e)', border: 'var(--cms-green, #22c55e)' },
  campaign: { bg: 'rgba(245,158,11,.12)', text: 'var(--cms-amber, #f59e0b)', border: 'var(--cms-amber, #f59e0b)' },
}
const TYPE_ICONS: Record<string, string> = { post: '\u{1F4DD}', newsletter: '\u{1F4F0}', campaign: '\u{1F4E2}' }

export function WeekView({ startDate, items, emptySlots, onItemClick, onSlotClick }: WeekViewProps) {
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate); d.setDate(d.getDate() + i); return d
    }), [startDate])

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="grid border rounded-[10px] overflow-hidden"
      style={{ gridTemplateColumns: '60px repeat(7, 1fr)', background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
      <div className="border-b" style={{ borderColor: 'var(--cms-border, #2a2d3a)' }} />
      {days.map((d) => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const isToday = dateStr === today
        return (
          <div key={dateStr} className="p-2 text-center border-b border-l" style={{ borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <div className="text-[11px] uppercase tracking-wide"
              style={{ color: isToday ? 'var(--cms-accent, #6366f1)' : 'var(--cms-text-dim, #52525b)' }}>
              {d.toLocaleDateString('en', { weekday: 'short' })}
            </div>
            <div className="mt-0.5 mx-auto flex items-center justify-center"
              style={{ width: 30, height: 30, borderRadius: isToday ? '50%' : undefined,
                background: isToday ? 'var(--cms-accent-subtle, rgba(99,102,241,.12))' : 'transparent',
                color: isToday ? 'var(--cms-accent, #6366f1)' : 'var(--cms-text, #e4e4e7)', fontWeight: 700, fontSize: 18 }}>
              {d.getDate()}
            </div>
          </div>
        )
      })}

      {/* 3 slot rows -- use Fragment with key to avoid React error */}
      {([1, 2, 3] as const).map((slot) => (
        <Fragment key={slot}>
          <div className="px-2 py-1 text-[9px] text-right border-r border-b flex items-start justify-end h-20"
            style={{ borderColor: 'var(--cms-border, #2a2d3a)', color: 'var(--cms-text-dim, #52525b)' }}>
            Slot {slot}
          </div>
          {days.map((d) => {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const isToday = dateStr === today
            const cellItems = items.filter((it) => it.date === dateStr && it.slot === slot)
            const cellSlots = emptySlots.filter((s) => s.date === dateStr && s.slot === slot)
            return (
              <div key={`${dateStr}-${slot}`} className="border-l border-b p-1 h-20 overflow-hidden"
                style={{ borderColor: 'var(--cms-border, #2a2d3a)', background: isToday ? 'rgba(99,102,241,.03)' : 'transparent' }}>
                {cellItems.map((item) => {
                  const itemStyle = TYPE_STYLES[item.type] ?? TYPE_STYLES.post
                  return (
                    <button key={item.id} onClick={() => onItemClick(item)}
                      className="w-full text-left px-2 py-1 rounded-md text-[11px] font-medium mb-0.5 border-l-[3px] cursor-pointer transition-all hover:brightness-110"
                      style={{ background: itemStyle.bg, color: itemStyle.text, borderLeftColor: itemStyle.border,
                        opacity: item.status === 'draft' ? 0.6 : 1 }}>
                      {TYPE_ICONS[item.type]} {item.title}
                    </button>
                  )
                })}
                {cellSlots.map((s, i) => (
                  <button key={i} onClick={() => onSlotClick(s)}
                    className="w-full text-center px-2 py-1 rounded-md text-[10px] mb-0.5 border border-dashed cursor-pointer transition-colors"
                    style={{ borderColor: s.isOverdue ? 'var(--cms-red, #ef4444)' : 'var(--cms-border, #2a2d3a)',
                      color: s.isOverdue ? 'var(--cms-red, #ef4444)' : 'var(--cms-text-dim, #52525b)',
                      background: s.isOverdue ? 'rgba(239,68,68,.06)' : 'transparent' }}>
                    + Empty {s.type} slot
                  </button>
                ))}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create BacklogPanel component**

Right panel with draggable backlog items, publishing cadence config rows, and "This Week" summary section.

```tsx
// apps/web/src/app/cms/(authed)/schedule/_components/backlog-panel.tsx
'use client'

import { useState } from 'react'

interface BacklogItem { id: string; title: string; type: 'post' | 'newsletter'; status: string; locale?: string }
interface CadenceRow { label: string; schedule: string; color: string }
interface WeekSummaryRow { label: string; value: number | string; accent?: string }

interface BacklogPanelProps {
  items: BacklogItem[]; cadence: CadenceRow[]; weekSummary: WeekSummaryRow[]
  onScheduleItem?: (item: BacklogItem) => void; onEditCadence?: () => void
}

const TYPE_DOT: Record<string, string> = { post: 'var(--cms-accent, #6366f1)', newsletter: 'var(--cms-green, #22c55e)' }
const STATUS_COLORS: Record<string, string> = { ready: 'var(--cms-accent, #6366f1)', draft: 'var(--cms-amber, #f59e0b)', queued: 'var(--cms-purple, #8b5cf6)' }

export function BacklogPanel({ items, cadence, weekSummary, onScheduleItem, onEditCadence }: BacklogPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <aside className="w-full flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
      {/* Backlog section */}
      <div className="rounded-[10px] border p-3"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--cms-text-dim, #52525b)' }}>Backlog</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'var(--cms-accent-subtle, rgba(99,102,241,.12))', color: 'var(--cms-accent, #6366f1)' }}>
            {items.length} ready</span>
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-center py-3" style={{ color: 'var(--cms-text-dim, #52525b)' }}>No items in backlog</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} draggable onDragStart={() => setDraggingId(item.id)} onDragEnd={() => setDraggingId(null)}
                onClick={() => onScheduleItem?.(item)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-colors group"
                style={{ background: draggingId === item.id ? 'var(--cms-surface-hover, #1f2330)' : 'transparent', opacity: draggingId === item.id ? 0.6 : 1 }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_DOT[item.type] ?? 'var(--cms-text-dim)' }} />
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{item.title}</span>
                <span className="text-[10px] px-1 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: STATUS_COLORS[item.status] ? `color-mix(in srgb, ${STATUS_COLORS[item.status]} 15%, transparent)` : 'var(--cms-border)',
                    color: STATUS_COLORS[item.status] ?? 'var(--cms-text-dim)' }}>{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Publishing cadence */}
      <div className="rounded-[10px] border p-3"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--cms-text-dim, #52525b)' }}>Publishing Cadence</span>
        {cadence.length === 0 ? (
          <p className="text-[11px] py-2" style={{ color: 'var(--cms-text-dim)' }}>No cadence configured</p>
        ) : (
          <ul className="space-y-1.5 mb-3">
            {cadence.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.color }} />
                <span className="flex-1 text-[11px]" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{row.label}</span>
                <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{row.schedule}</span>
              </li>
            ))}
          </ul>
        )}
        <button onClick={onEditCadence}
          className="w-full text-center text-[11px] py-1 rounded-md border transition-colors hover:text-[var(--cms-accent,#6366f1)] hover:border-[var(--cms-accent,#6366f1)]"
          style={{ borderColor: 'var(--cms-border, #2a2d3a)', color: 'var(--cms-text-muted, #71717a)' }}>Edit cadence</button>
      </div>

      {/* This Week summary */}
      <div className="rounded-[10px] border p-3"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--cms-text-dim, #52525b)' }}>This Week</span>
        <ul className="space-y-1.5">
          {weekSummary.map((row, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{row.label}</span>
              <span className="text-[12px] font-medium tabular-nums" style={{ color: row.accent ?? 'var(--cms-text, #e4e4e7)' }}>{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Create QuickScheduleDialog**

Modal with mini-calendar, slot indicators (green dots), "Schedule for [date]" CTA.

```tsx
// apps/web/src/app/cms/(authed)/schedule/_components/quick-schedule-dialog.tsx
'use client'

import { useState } from 'react'

interface SchedulableItem { id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string }

interface QuickScheduleDialogProps {
  item: SchedulableItem | null; slotDays?: string[]
  onSchedule: (item: SchedulableItem, date: string) => void; onClose: () => void
}

const TYPE_COLOR: Record<string, string> = { post: 'var(--cms-accent, #6366f1)', newsletter: 'var(--cms-green, #22c55e)', campaign: 'var(--cms-amber, #f59e0b)' }
const TYPE_LABEL: Record<string, string> = { post: 'Post', newsletter: 'Newsletter', campaign: 'Campaign' }

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function QuickScheduleDialog({ item, slotDays = [], onSchedule, onClose }: QuickScheduleDialogProps) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]!
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const slotSet = new Set(slotDays)
  const calDays = buildCalendarDays(calYear, calMonth)

  function prevMonth() { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) } else { setCalMonth((m) => m - 1) } }
  function nextMonth() { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) } else { setCalMonth((m) => m + 1) } }
  function dayToDateStr(day: number) { return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
  function isPast(day: number) { return dayToDateStr(day) < todayStr }

  if (!item) return null
  const typeColor = TYPE_COLOR[item.type] ?? 'var(--cms-text-muted, #71717a)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-[12px] border shadow-2xl w-full max-w-[420px]"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Schedule Item</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:opacity-70 text-lg leading-none"
            style={{ color: 'var(--cms-text-dim, #52525b)' }} aria-label="Close">x</button>
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3 rounded-[8px] p-3 border"
            style={{ borderColor: typeColor, background: `color-mix(in srgb, ${typeColor} 8%, transparent)` }}>
            <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: typeColor }} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: typeColor }}>{TYPE_LABEL[item.type]}</p>
              <p className="text-sm font-medium truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{item.title}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--cms-text-muted, #71717a)' }}>Status: {item.status}</p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded text-sm hover:opacity-70"
              style={{ color: 'var(--cms-text-muted)' }} aria-label="Previous month">&lsaquo;</button>
            <span className="text-[13px] font-medium" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{MONTH_NAMES[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded text-sm hover:opacity-70"
              style={{ color: 'var(--cms-text-muted)' }} aria-label="Next month">&rsaquo;</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{wd}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calDays.map((day, idx) => {
              if (day === null) return <div key={`blank-${idx}`} />
              const dateStr = dayToDateStr(day); const past = isPast(day)
              const isToday = dateStr === todayStr; const isSlot = slotSet.has(dateStr); const isSelected = selectedDate === dateStr
              return (
                <button key={dateStr} onClick={() => !past && setSelectedDate(dateStr)} disabled={past}
                  className="relative flex flex-col items-center justify-center h-8 rounded-md text-xs font-medium transition-colors"
                  style={{ background: isSelected ? 'var(--cms-accent)' : isToday ? 'var(--cms-accent-subtle)' : 'transparent',
                    color: isSelected ? '#fff' : past ? 'var(--cms-text-dim)' : isToday ? 'var(--cms-accent)' : 'var(--cms-text)',
                    cursor: past ? 'default' : 'pointer', opacity: past ? 0.35 : 1 }} aria-label={`Select ${dateStr}`}>
                  {day}
                  {isSlot && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--cms-green, #22c55e)' }} />
                  )}
                </button>
              )
            })}
          </div>
          {selectedDate && (
            <p className="text-[11px] mt-2 text-center"
              style={{ color: slotSet.has(selectedDate) ? 'var(--cms-green, #22c55e)' : 'var(--cms-text-muted, #71717a)' }}>
              {slotSet.has(selectedDate) ? 'Slot available on this day' : 'No cadence slot -- scheduling manually'}</p>
          )}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-[8px] text-sm border"
            style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }}>Cancel</button>
          <button onClick={() => { if (selectedDate) { onSchedule(item, selectedDate); onClose() } }} disabled={!selectedDate}
            className="flex-1 py-2 rounded-[8px] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: selectedDate ? 'var(--cms-accent)' : 'var(--cms-border)', color: '#fff' }}>
            {selectedDate ? `Schedule for ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}` : 'Pick a date'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create AgendaView (mobile)**

Date-grouped chronological feed for mobile. Each card shows type icon + title + locale + status badge. Empty slots inline as dashed cards.

```tsx
// apps/web/src/app/cms/(authed)/schedule/_components/agenda-view.tsx
interface AgendaItem { id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string; date: string; locale?: string; isOverdue?: boolean }
interface AgendaEmptySlot { date: string; type: 'blog' | 'newsletter'; isOverdue: boolean }
interface AgendaViewProps { items: AgendaItem[]; emptySlots: AgendaEmptySlot[]; onItemClick?: (item: AgendaItem) => void; onSlotClick?: (slot: AgendaEmptySlot) => void }

const TYPE_ICONS: Record<string, string> = { post: '\u{1F4DD}', newsletter: '\u{1F4F0}', campaign: '\u{1F4E2}' }
const TYPE_COLORS: Record<string, string> = { post: 'var(--cms-accent, #6366f1)', newsletter: 'var(--cms-green, #22c55e)', campaign: 'var(--cms-amber, #f59e0b)' }
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--cms-amber, #f59e0b)' }, ready: { label: 'Ready', color: 'var(--cms-accent, #6366f1)' },
  queued: { label: 'Queued', color: 'var(--cms-purple, #8b5cf6)' }, scheduled: { label: 'Scheduled', color: 'var(--cms-cyan, #06b6d4)' },
  published: { label: 'Published', color: 'var(--cms-green, #22c55e)' }, sent: { label: 'Sent', color: 'var(--cms-green, #22c55e)' },
}

function groupByDate(items: AgendaItem[], slots: AgendaEmptySlot[]) {
  const map = new Map<string, { items: AgendaItem[]; slots: AgendaEmptySlot[] }>()
  const ensure = (date: string) => { if (!map.has(date)) map.set(date, { items: [], slots: [] }); return map.get(date)! }
  for (const item of items) ensure(item.date).items.push(item)
  for (const slot of slots) ensure(slot.date).slots.push(slot)
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'; if (diffDays === 1) return 'Tomorrow'; if (diffDays === -1) return 'Yesterday'
  return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function AgendaView({ items, emptySlots, onItemClick, onSlotClick }: AgendaViewProps) {
  const grouped = groupByDate(items, emptySlots)
  if (grouped.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="agenda-empty">
        <span className="text-4xl mb-3">\u{1F4C5}</span>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--cms-text, #e4e4e7)' }}>No items scheduled</p>
        <p className="text-[12px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>Configure your cadence or assign backlog items to dates.</p>
      </div>
    )
  }
  return (
    <div className="space-y-6" data-testid="agenda-view">
      {[...grouped.entries()].map(([date, group]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{formatDateHeader(date)}</span>
            <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{date}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--cms-border-subtle, #22252f)' }} />
          </div>
          <div className="space-y-2">
            {group.items.map((item) => {
              const badge = STATUS_BADGE[item.status]; const typeColor = TYPE_COLORS[item.type] ?? 'var(--cms-text-muted)'
              return (
                <button key={item.id} onClick={() => onItemClick?.(item)}
                  className="w-full text-left rounded-[10px] border p-3 flex items-start gap-3 transition-colors group"
                  style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: item.isOverdue ? 'var(--cms-red, #ef4444)' : 'var(--cms-border, #2a2d3a)' }}>
                  <span className="text-xl leading-none shrink-0 mt-0.5">{TYPE_ICONS[item.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.locale && <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor }}>{item.locale}</span>}
                      {badge && <span className="text-[10px]" style={{ color: badge.color }}>{badge.label}</span>}
                      {item.isOverdue && <span className="text-[10px] font-medium" style={{ color: 'var(--cms-red, #ef4444)' }}>Overdue</span>}
                    </div>
                  </div>
                  <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--cms-text-dim)' }}>&rsaquo;</span>
                </button>
              )
            })}
            {group.slots.map((slot, i) => (
              <button key={i} onClick={() => onSlotClick?.(slot)}
                className="w-full text-center rounded-[10px] border border-dashed py-3 px-4 text-[12px] transition-colors"
                style={{ borderColor: slot.isOverdue ? 'var(--cms-red)' : 'var(--cms-border)', color: slot.isOverdue ? 'var(--cms-red)' : 'var(--cms-text-dim)',
                  background: slot.isOverdue ? 'rgba(239,68,68,.05)' : 'transparent' }}>
                + Empty {slot.type} slot{slot.isOverdue && ' (overdue)'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create ScheduleClient wrapper component**

Client component that orchestrates WeekView/AgendaView, BacklogPanel, QuickScheduleDialog, and toolbar (view toggle, week navigation, legend).

```tsx
// apps/web/src/app/cms/(authed)/schedule/_components/schedule-client.tsx
'use client'

import { useState, useMemo } from 'react'
import { WeekView } from './week-view'
import { AgendaView } from './agenda-view'
import { BacklogPanel } from './backlog-panel'
import { QuickScheduleDialog } from './quick-schedule-dialog'

interface BlogPostRow { id: string; slot_date: string | null; status: string
  blog_translations: Array<{ title: string; locale: string; reading_time_min?: number | null }> | null }
interface NewsletterEditionRow { id: string; subject: string; status: string; scheduled_at: string | null
  newsletter_types: { name: string } | null }
interface BlogCadenceRow { id?: string; locale: string; cadence_days: number; preferred_send_time?: string | null; cadence_paused?: boolean | null }
interface ScheduleClientProps { posts: BlogPostRow[]; editions: NewsletterEditionRow[]; cadence: BlogCadenceRow[]; backlog: BlogPostRow[] }

type ViewMode = 'week' | 'agenda'
interface CalendarItem { id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string; date: string; slot: number; sendTime?: string }

function getWeekStart(d: Date) { const s = new Date(d); s.setHours(0,0,0,0); s.setDate(s.getDate() - s.getDay()); return s }
function isoDate(d: Date) { return d.toISOString().split('T')[0]! }

function buildCalendarItems(posts: BlogPostRow[], editions: NewsletterEditionRow[]): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const p of posts) { if (!p.slot_date) continue; const t = p.blog_translations?.[0]
    items.push({ id: p.id, title: t?.title ?? 'Untitled', type: 'post', status: p.status, date: p.slot_date, slot: 1 }) }
  let si = 1
  for (const ed of editions) { const date = ed.scheduled_at?.split('T')[0]; if (!date) continue
    items.push({ id: ed.id, title: ed.subject ?? 'Newsletter', type: 'newsletter', status: ed.status, date, slot: (si % 3) + 1,
      sendTime: ed.scheduled_at ? new Date(ed.scheduled_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : undefined }); si++ }
  return items
}

export function ScheduleClient({ posts, editions, cadence, backlog }: ScheduleClientProps) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(today))
  const [dialogItem, setDialogItem] = useState<{ id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string } | null>(null)

  const weekEnd = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d }, [weekStart])
  const calendarItems = useMemo(() => buildCalendarItems(posts, editions), [posts, editions])
  const backlogItems = useMemo(() => backlog.map((p) => ({
    id: p.id, title: p.blog_translations?.[0]?.title ?? 'Untitled', type: 'post' as const, status: p.status, locale: p.blog_translations?.[0]?.locale })), [backlog])
  const cadenceRows = useMemo(() => cadence.map((c) => ({
    label: `Blog ${c.locale}`, schedule: `Every ${c.cadence_days}d${c.preferred_send_time ? ` @ ${c.preferred_send_time}` : ''}`,
    color: 'var(--cms-accent, #6366f1)' })), [cadence])
  const weekSummary = useMemo(() => {
    const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return isoDate(d) })
    const wi = calendarItems.filter((it) => weekDates.includes(it.date))
    return [
      { label: 'Posts scheduled', value: wi.filter((it) => it.type === 'post').length, accent: 'var(--cms-accent)' },
      { label: 'Newsletters queued', value: wi.filter((it) => it.type === 'newsletter').length, accent: 'var(--cms-green)' },
      { label: 'Campaigns active', value: 0, accent: 'var(--cms-amber)' },
      { label: 'Empty slots', value: Math.max(0, 21 - wi.length), accent: 'var(--cms-text-dim)' },
      { label: 'Overdue', value: wi.filter((it) => it.date < isoDate(today) && it.status !== 'published' && it.status !== 'sent').length, accent: 'var(--cms-text-dim)' },
    ]
  }, [calendarItems, weekStart, today])
  const agendaItems = useMemo(() => calendarItems.map((it) => ({
    ...it, isOverdue: it.date < isoDate(today) && it.status !== 'published' && it.status !== 'sent' })), [calendarItems, today])
  const slotDays = useMemo(() => {
    const days: string[] = []
    for (let i = 0; i < 28; i++) { const d = new Date(today); d.setDate(d.getDate() + i)
      if (cadence.some((c) => c.cadence_days <= 7)) days.push(isoDate(d)) }
    return days
  }, [cadence, today])

  const weekRangeLabel = `${weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })} -- ${weekEnd.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-[8px]" style={{ background: 'var(--cms-bg, #0f1117)' }}>
          {(['week', 'agenda'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setViewMode(v)} className="px-3 py-1 rounded-[6px] text-sm font-medium capitalize transition-colors"
              style={{ background: viewMode === v ? 'var(--cms-surface)' : 'transparent', color: viewMode === v ? 'var(--cms-text)' : 'var(--cms-text-muted)' }}>{v}</button>
          ))}
        </div>
        {viewMode === 'week' && (
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}
              className="w-7 h-7 flex items-center justify-center rounded-md border text-sm"
              style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }} aria-label="Previous week">&lsaquo;</button>
            <span className="text-sm font-medium min-w-[200px] text-center" style={{ color: 'var(--cms-text)' }}>{weekRangeLabel}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}
              className="w-7 h-7 flex items-center justify-center rounded-md border text-sm"
              style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }} aria-label="Next week">&rsaquo;</button>
            <button onClick={() => setWeekStart(getWeekStart(today))} className="px-2.5 py-1 text-[11px] rounded-md border"
              style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }}>Today</button>
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {[{ label: 'Post', color: 'var(--cms-accent)' }, { label: 'Newsletter', color: 'var(--cms-green)' }, { label: 'Campaign', color: 'var(--cms-amber)' }].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[11px]" style={{ color: 'var(--cms-text-dim)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-5">
        <div className="flex-1 min-w-0">
          {viewMode === 'week' ? (
            <WeekView startDate={weekStart} items={calendarItems} emptySlots={[]}
              onItemClick={(item) => setDialogItem({ id: item.id, title: item.title, type: item.type, status: item.status })} onSlotClick={() => {}} />
          ) : (
            <AgendaView items={agendaItems} emptySlots={[]}
              onItemClick={(item) => setDialogItem({ id: item.id, title: item.title, type: item.type, status: item.status })} />
          )}
        </div>
        <div className="hidden md:block w-[260px] shrink-0">
          <BacklogPanel items={backlogItems} cadence={cadenceRows} weekSummary={weekSummary}
            onScheduleItem={(item) => setDialogItem(item)} onEditCadence={() => { window.location.href = '/cms/newsletters/settings' }} />
        </div>
      </div>
      {dialogItem && (
        <QuickScheduleDialog item={dialogItem} slotDays={slotDays}
          onSchedule={(_item, _date) => { /* TODO: wire to server action */ }} onClose={() => setDialogItem(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create schedule/page.tsx**

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

- [ ] **Step 7: Write schedule test**

```tsx
// apps/web/test/app/cms/schedule.test.tsx
import { describe, it, expect } from 'vitest'

describe('CMS Schedule', () => {
  it('exports WeekView component', async () => {
    const mod = await import('@/app/cms/(authed)/schedule/_components/week-view')
    expect(mod.WeekView).toBeDefined()
  })

  it('exports BacklogPanel component', async () => {
    const mod = await import('@/app/cms/(authed)/schedule/_components/backlog-panel')
    expect(mod.BacklogPanel).toBeDefined()
  })
})
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/schedule/ apps/web/test/app/cms/schedule.test.tsx
git commit -m "feat(cms): new Schedule page with week/agenda views, backlog, cadence config"
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
git add apps/web/src/app/cms/\(authed\)/newsletters/subscribers/page.tsx apps/web/src/components/cms/cms-sidebar.tsx apps/web/src/components/cms/cms-shell.tsx
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
