# CMS Sidebar Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale sidebar badges with smart WIP counts (draft+ready) and newsletter cadence urgency indicators color-coded by proximity.

**Architecture:** Server-rendered `fetchSidebarBadges()` cached 60s computes WIP counts and cadence urgency, passed to a client `SidebarBadges` component that renders pills via portal (expanded) or dots (collapsed) into `CmsShell`'s sidebar DOM. `CmsShell.badges` prop reserved for simple badges (Contacts) since the package only supports `Record<string, number>`.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, `unstable_cache`, existing `generateCadenceSlots` from `lib/newsletter/cadence-slots.ts`

**Spec:** `docs/superpowers/specs/2026-05-03-cms-sidebar-badges-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| NEW | `apps/web/lib/cms/sidebar-badges.ts` | `fetchSidebarBadges()`, urgency computation, types |
| NEW | `apps/web/src/components/cms/sidebar-badges.tsx` | Client component: portal pills + collapsed dots + tooltips |
| MOD | `apps/web/src/components/cms/sidebar-alert-badge.tsx` | Delete (replaced by sidebar-badges.tsx) |
| MOD | `apps/web/src/app/cms/(authed)/layout.tsx` | Wire fetchSidebarBadges, split CmsShell.badges |
| MOD | `apps/web/src/app/cms/(authed)/layout-helpers.ts` | Add badgeKey for Newsletters |
| MOD | `apps/web/src/app/cms/(authed)/blog/actions.ts` | Add `revalidateTag('sidebar-badges')` to `revalidateBlogHub` |
| MOD | `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | Add `revalidateTag('sidebar-badges')` to `revalidateNewsletterHub` |
| NEW | `apps/web/test/cms/sidebar-badges.test.ts` | Unit tests for urgency computation + color thresholds |

---

### Task 1: Create `fetchSidebarBadges` with types and urgency computation

**Files:**
- Create: `apps/web/lib/cms/sidebar-badges.ts`
- Create: `apps/web/test/cms/sidebar-badges.test.ts`

This task builds the pure logic: types, urgency color computation, and the cached data-fetching function.

- [ ] **Step 1: Write test file with urgency color threshold tests**

```typescript
// apps/web/test/cms/sidebar-badges.test.ts
import { describe, it, expect } from 'vitest'
import { computeUrgencyColor, computeUrgencyBadge } from '@/lib/cms/sidebar-badges'

describe('computeUrgencyColor', () => {
  it('returns red for 0 days (today)', () => {
    expect(computeUrgencyColor(0)).toBe('red')
  })

  it('returns red for 4 days', () => {
    expect(computeUrgencyColor(4)).toBe('red')
  })

  it('returns orange for 5 days', () => {
    expect(computeUrgencyColor(5)).toBe('orange')
  })

  it('returns orange for 9 days', () => {
    expect(computeUrgencyColor(9)).toBe('orange')
  })

  it('returns yellow for 10 days', () => {
    expect(computeUrgencyColor(10)).toBe('yellow')
  })

  it('returns yellow for 15 days', () => {
    expect(computeUrgencyColor(15)).toBe('yellow')
  })

  it('returns null for >15 days', () => {
    expect(computeUrgencyColor(16)).toBeNull()
  })

  it('returns null for negative days (past slots excluded)', () => {
    expect(computeUrgencyColor(-1)).toBeNull()
  })
})

describe('computeUrgencyBadge', () => {
  it('returns null when no unfilled slots', () => {
    expect(computeUrgencyBadge([])).toBeNull()
  })

  it('returns count and red for single slot at 3 days', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Weekly', typeColor: '#ef4444', slotDate: '2026-05-06', daysUntil: 3 },
    ])
    expect(result).toEqual({
      count: 1,
      color: 'red',
      slots: [{ typeName: 'Weekly', typeColor: '#ef4444', slotDate: '2026-05-06', daysUntil: 3 }],
    })
  })

  it('uses worst (nearest) color when multiple slots span tiers', () => {
    const result = computeUrgencyBadge([
      { typeName: 'A', typeColor: '#aaa', slotDate: '2026-05-15', daysUntil: 12 },
      { typeName: 'B', typeColor: '#bbb', slotDate: '2026-05-08', daysUntil: 5 },
    ])
    expect(result!.color).toBe('orange')
    expect(result!.count).toBe(2)
  })

  it('filters out slots beyond 15 days', () => {
    const result = computeUrgencyBadge([
      { typeName: 'A', typeColor: '#aaa', slotDate: '2026-05-20', daysUntil: 17 },
    ])
    expect(result).toBeNull()
  })

  it('includes today (daysUntil=0) as red', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Today', typeColor: '#000', slotDate: '2026-05-03', daysUntil: 0 },
    ])
    expect(result!.color).toBe('red')
    expect(result!.count).toBe(1)
  })

  it('counts per-slot not per-type', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Same', typeColor: '#aaa', slotDate: '2026-05-06', daysUntil: 3 },
      { typeName: 'Same', typeColor: '#aaa', slotDate: '2026-05-13', daysUntil: 10 },
      { typeName: 'Other', typeColor: '#bbb', slotDate: '2026-05-08', daysUntil: 5 },
    ])
    expect(result!.count).toBe(3)
    expect(result!.color).toBe('red')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/test/cms/sidebar-badges.test.ts`
Expected: FAIL — module `@/lib/cms/sidebar-badges` not found.

- [ ] **Step 3: Create sidebar-badges.ts with types and pure functions**

```typescript
// apps/web/lib/cms/sidebar-badges.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { generateCadenceSlots } from '@/lib/newsletter/cadence-slots'
import type { CadencePattern } from '@/lib/newsletter/cadence-pattern'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UrgencySlot {
  typeName: string
  typeColor: string
  slotDate: string
  daysUntil: number
}

export type UrgencyColor = 'yellow' | 'orange' | 'red'

export interface UrgencyBadge {
  count: number
  color: UrgencyColor
  slots: UrgencySlot[]
}

export interface SidebarBadgeData {
  posts: { wip: number }
  newsletters: {
    wip: number
    wipDraft: number
    wipReady: number
    urgency: UrgencyBadge | null
  }
}

// ── Pure functions ───────────────────────────────────────────────────────────

export function computeUrgencyColor(daysUntil: number): UrgencyColor | null {
  if (daysUntil < 0) return null
  if (daysUntil <= 4) return 'red'
  if (daysUntil <= 9) return 'orange'
  if (daysUntil <= 15) return 'yellow'
  return null
}

export function computeUrgencyBadge(slots: UrgencySlot[]): UrgencyBadge | null {
  const validSlots = slots.filter((s) => s.daysUntil >= 0 && s.daysUntil <= 15)
  if (validSlots.length === 0) return null

  const minDays = Math.min(...validSlots.map((s) => s.daysUntil))
  const color = computeUrgencyColor(minDays)!

  return { count: validSlots.length, color, slots: validSlots }
}

// ── Cached data fetcher ──────────────────────────────────────────────────────

export const fetchSidebarBadges = unstable_cache(
  async (siteId: string): Promise<SidebarBadgeData> => {
    const supabase = getSupabaseServiceClient()
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayMs = new Date(todayStr + 'T00:00:00Z').getTime()

    const [postsRes, editionsWipRes, typesRes, filledEditionsRes] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('status', ['draft', 'ready']),
      supabase
        .from('newsletter_editions')
        .select('status', { count: 'exact' })
        .eq('site_id', siteId)
        .in('status', ['draft', 'ready']),
      supabase
        .from('newsletter_types')
        .select('id, name, color, cadence_pattern, cadence_paused')
        .eq('site_id', siteId)
        .eq('active', true),
      supabase
        .from('newsletter_editions')
        .select('newsletter_type_id, slot_date')
        .eq('site_id', siteId)
        .in('status', ['ready', 'scheduled', 'queued', 'sending', 'sent'])
        .not('slot_date', 'is', null)
        .gte('slot_date', todayStr),
    ])

    // Posts WIP
    const postsWip = postsRes.count ?? 0

    // Newsletter WIP breakdown
    const wipRows = editionsWipRes.data ?? []
    const wipDraft = wipRows.filter((r) => r.status === 'draft').length
    const wipReady = wipRows.filter((r) => r.status === 'ready').length
    const newsletterWip = (editionsWipRes.count ?? 0)

    // Urgency: find unfilled cadence slots in next 15 days
    const fifteenDaysStr = new Date(todayMs + 15 * 86_400_000).toISOString().slice(0, 10)
    const filledSlots = new Set(
      (filledEditionsRes.data ?? []).map((e) => `${e.newsletter_type_id}:${e.slot_date}`),
    )

    const urgencySlots: UrgencySlot[] = []
    for (const t of typesRes.data ?? []) {
      if (t.cadence_paused || !t.cadence_pattern) continue
      const pattern = t.cadence_pattern as CadencePattern
      const slots = generateCadenceSlots(pattern, { from: todayStr, maxSlots: 30 })
      for (const slotDate of slots) {
        if (slotDate > fifteenDaysStr) break
        const key = `${t.id}:${slotDate}`
        if (!filledSlots.has(key)) {
          const daysUntil = Math.round(
            (new Date(slotDate + 'T00:00:00Z').getTime() - todayMs) / 86_400_000,
          )
          urgencySlots.push({
            typeName: t.name as string,
            typeColor: (t.color as string) ?? '#6366f1',
            slotDate,
            daysUntil,
          })
        }
      }
    }

    return {
      posts: { wip: postsWip },
      newsletters: {
        wip: newsletterWip,
        wipDraft,
        wipReady,
        urgency: computeUrgencyBadge(urgencySlots),
      },
    }
  },
  ['sidebar-badges'],
  { tags: ['sidebar-badges'], revalidate: 60 },
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/test/cms/sidebar-badges.test.ts`
Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/cms/sidebar-badges.ts apps/web/test/cms/sidebar-badges.test.ts
git commit -m "feat(cms): add fetchSidebarBadges with urgency computation and tests"
```

---

### Task 2: Create `SidebarBadges` client component

**Files:**
- Create: `apps/web/src/components/cms/sidebar-badges.tsx`

This task builds the UI rendering: portal-based pills in expanded mode, dots in collapsed mode, tooltips on hover.

- [ ] **Step 1: Create the SidebarBadges component**

```tsx
// apps/web/src/components/cms/sidebar-badges.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSidebar } from '@tn-figueiredo/cms-ui/client'
import type { SidebarBadgeData, UrgencySlot, UrgencyColor } from '@/lib/cms/sidebar-badges'

const COLOR_CLASSES: Record<UrgencyColor | 'yellow', { bg: string; text: string }> = {
  yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  red:    { bg: 'bg-red-500/15',    text: 'text-red-400' },
}

const DOT_COLORS: Record<UrgencyColor | 'yellow', string> = {
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  red:    'bg-red-400',
}

function formatCount(n: number): string {
  return n > 99 ? '99+' : String(n)
}

function formatSlotDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

interface PillProps {
  count: number
  color: UrgencyColor | 'yellow'
  ariaLabel: string
  tooltipContent?: React.ReactNode
}

function Pill({ count, color, ariaLabel, tooltipContent }: PillProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const { bg, text } = COLOR_CLASSES[color]

  return (
    <span
      className={`relative text-[11px] px-1.5 py-px rounded-full font-medium ${bg} ${text} cursor-default`}
      aria-label={ariaLabel}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {formatCount(count)}
      {showTooltip && tooltipContent && (
        <span className="absolute top-full right-0 mt-2 z-50 pointer-events-none">
          <span className="block bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
            {tooltipContent}
          </span>
        </span>
      )}
    </span>
  )
}

interface BadgePortalProps {
  href: string
  children: React.ReactNode
}

function BadgePortal({ href, children }: BadgePortalProps) {
  const { isExpanded } = useSidebar()
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-area="cms"] a[href="${href}"]`)
      setTarget(el)
    })
    return () => cancelAnimationFrame(raf)
  }, [href, isExpanded])

  if (!target) return null
  return createPortal(children, target)
}

function WipTooltip({ draft, ready, label }: { draft: number; ready: number; label: string }) {
  return (
    <>
      <span className="block text-[11px] text-slate-400 font-semibold mb-1">Work in progress</span>
      {draft > 0 && <span className="block text-[12px] text-slate-200">{draft} draft {label}</span>}
      {ready > 0 && <span className="block text-[12px] text-slate-200">{ready} ready {label}</span>}
    </>
  )
}

function UrgencyTooltip({ slots }: { slots: UrgencySlot[] }) {
  return (
    <>
      <span className="block text-[11px] text-slate-400 font-semibold mb-1">Unfilled slots (next 15 days)</span>
      {slots.map((s, i) => (
        <span key={i} className="flex items-center gap-2 text-[12px] text-slate-200">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.typeColor }} />
          <span className="flex-1 truncate">{s.typeName}</span>
          <span className={`text-[11px] ${COLOR_CLASSES[computeSlotColor(s.daysUntil)].text}`}>
            {formatSlotDate(s.slotDate)}
          </span>
        </span>
      ))}
    </>
  )
}

function computeSlotColor(daysUntil: number): UrgencyColor {
  if (daysUntil <= 4) return 'red'
  if (daysUntil <= 9) return 'orange'
  return 'yellow'
}

function CollapsedDot({ href, color }: { href: string; color: UrgencyColor | 'yellow' }) {
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-area="cms"] a[href="${href}"]`)
      setTarget(el)
    })
    return () => cancelAnimationFrame(raf)
  }, [href])

  if (!target) return null

  return createPortal(
    <span
      className={`absolute top-1 right-1 w-2 h-2 rounded-full ${DOT_COLORS[color]} border-2 border-[#0f1729]`}
      aria-hidden="true"
    />,
    target,
  )
}

export function SidebarBadges({ data }: { data: SidebarBadgeData }) {
  const { isExpanded } = useSidebar()

  const postsHasBadge = data.posts.wip > 0
  const nlHasWip = data.newsletters.wip > 0
  const nlHasUrgency = data.newsletters.urgency !== null

  if (!postsHasBadge && !nlHasWip && !nlHasUrgency) return null

  if (!isExpanded) {
    return (
      <>
        {postsHasBadge && <CollapsedDot href="/cms/blog" color="yellow" />}
        {(nlHasWip || nlHasUrgency) && (
          <CollapsedDot
            href="/cms/newsletters"
            color={data.newsletters.urgency?.color ?? 'yellow'}
          />
        )}
      </>
    )
  }

  return (
    <>
      {postsHasBadge && (
        <BadgePortal href="/cms/blog">
          <span className="ml-auto flex items-center gap-1">
            <Pill
              count={data.posts.wip}
              color="yellow"
              ariaLabel={`${data.posts.wip} draft and ready posts`}
            />
          </span>
        </BadgePortal>
      )}

      {(nlHasWip || nlHasUrgency) && (
        <BadgePortal href="/cms/newsletters">
          <span className="ml-auto flex items-center gap-1">
            {nlHasWip && (
              <Pill
                count={data.newsletters.wip}
                color="yellow"
                ariaLabel={`${data.newsletters.wip} draft and ready editions`}
                tooltipContent={
                  <WipTooltip
                    draft={data.newsletters.wipDraft}
                    ready={data.newsletters.wipReady}
                    label="editions"
                  />
                }
              />
            )}
            {nlHasUrgency && (
              <Pill
                count={data.newsletters.urgency!.count}
                color={data.newsletters.urgency!.color}
                ariaLabel={`${data.newsletters.urgency!.count} unfilled newsletter slots within ${Math.min(...data.newsletters.urgency!.slots.map((s) => s.daysUntil))} days`}
                tooltipContent={<UrgencyTooltip slots={data.newsletters.urgency!.slots} />}
              />
            )}
          </span>
        </BadgePortal>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep sidebar-badges`
Expected: No errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/cms/sidebar-badges.tsx
git commit -m "feat(cms): add SidebarBadges component with pills, dots, and tooltips"
```

---

### Task 3: Wire layout.tsx and update layout-helpers.ts

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`
- Modify: `apps/web/src/app/cms/(authed)/layout-helpers.ts`

- [ ] **Step 1: Add badgeKey for Newsletters in layout-helpers.ts**

In `apps/web/src/app/cms/(authed)/layout-helpers.ts`, change the Newsletters item:

```typescript
// Find this line:
      { label: 'Newsletters', href: '/cms/newsletters' },
// Replace with:
      { label: 'Newsletters', href: '/cms/newsletters', badgeKey: '/cms/newsletters' },
```

- [ ] **Step 2: Update layout.tsx to use fetchSidebarBadges**

In `apps/web/src/app/cms/(authed)/layout.tsx`, make these changes:

Add imports at top:
```typescript
import { fetchSidebarBadges } from '@/lib/cms/sidebar-badges'
import { SidebarBadges } from '@/components/cms/sidebar-badges'
```

Replace the badge computation block (lines 53-65):
```typescript
  // Old code to remove:
  // const svc = getSupabaseServiceClient()
  // const [draftsRes, subsRes, pendingContactsRes] = await Promise.all([
  //   svc.from('blog_posts').select('id', { count: 'exact', head: true })
  //     .eq('site_id', currentSiteId).eq('status', 'draft'),
  //   svc.from('newsletter_subscriptions').select('id', { count: 'exact', head: true })
  //     .eq('site_id', currentSiteId).eq('status', 'confirmed'),
  //   svc.from('contact_submissions').select('id', { count: 'exact', head: true })
  //     .eq('site_id', currentSiteId).is('replied_at', null).is('anonymized_at', null),
  // ])
  // const badges: Record<string, number> = {}
  // if (draftsRes.count) badges['/cms/blog'] = draftsRes.count
  // if (subsRes.count) badges['/cms/subscribers'] = subsRes.count
  // if (pendingContactsRes.count) badges['/cms/contacts'] = pendingContactsRes.count

  // New code:
  const svc = getSupabaseServiceClient()
  const [badgeData, pendingContactsRes] = await Promise.all([
    fetchSidebarBadges(currentSiteId),
    svc.from('contact_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).is('replied_at', null).is('anonymized_at', null),
  ])
  const badges: Record<string, number> = {}
  if (pendingContactsRes.count) badges['/cms/contacts'] = pendingContactsRes.count
```

Inside the `<CmsShell>` children, add `<SidebarBadges>`:
```tsx
        <CmsShell
          siteName={currentSite?.site_name ?? 'OneCMS'}
          siteInitials={currentSite?.site_name?.slice(0, 2).toUpperCase() ?? 'CM'}
          userDisplayName={userDisplayName}
          userRole={userRole}
          siteSwitcher={<CmsSiteSwitcherSlot sites={rawSites} />}
          badges={badges}
        >
          <SidebarBadges data={badgeData} />
          {children}
        </CmsShell>
```

- [ ] **Step 3: Remove old SidebarAlertBadge if unused elsewhere**

Run: `grep -r "SidebarAlertBadge\|sidebar-alert-badge" apps/web/src/ --include="*.tsx" --include="*.ts" -l`

If only imported in the file itself, delete `apps/web/src/components/cms/sidebar-alert-badge.tsx`.

- [ ] **Step 4: Verify the build compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -5`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/layout.tsx apps/web/src/app/cms/'(authed)'/layout-helpers.ts
# If sidebar-alert-badge.tsx was deleted:
git add apps/web/src/components/cms/sidebar-alert-badge.tsx
git commit -m "feat(cms): wire SidebarBadges into CMS layout, remove old badge"
```

---

### Task 4: Add cache invalidation to server actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts` (line ~166, `revalidateBlogHub`)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts` (line ~904, `revalidateNewsletterHub`)

- [ ] **Step 1: Add sidebar-badges tag to revalidateBlogHub**

In `apps/web/src/app/cms/(authed)/blog/actions.ts`, find `revalidateBlogHub` (line 166):

```typescript
// Current:
function revalidateBlogHub(siteId?: string): void {
  revalidateTag('blog-hub')
  revalidatePath('/cms/blog')
  if (siteId) revalidateTag(`sitemap:${siteId}`)
}

// Updated:
function revalidateBlogHub(siteId?: string): void {
  revalidateTag('blog-hub')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/blog')
  if (siteId) revalidateTag(`sitemap:${siteId}`)
}
```

- [ ] **Step 2: Add sidebar-badges tag to revalidateNewsletterHub**

In `apps/web/src/app/cms/(authed)/newsletters/actions.ts`, find `revalidateNewsletterHub` (line 904):

```typescript
// Current:
function revalidateNewsletterHub() {
  revalidatePath('/cms/newsletters')
  revalidateTag('newsletter-hub')
  revalidateTag('newsletter-suggestions')
}

// Updated:
function revalidateNewsletterHub() {
  revalidatePath('/cms/newsletters')
  revalidateTag('newsletter-hub')
  revalidateTag('newsletter-suggestions')
  revalidateTag('sidebar-badges')
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/actions.ts apps/web/src/app/cms/'(authed)'/newsletters/actions.ts
git commit -m "feat(cms): invalidate sidebar-badges cache on blog/newsletter mutations"
```

---

### Task 5: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run the full web test suite**

Run: `npm run test:web`
Expected: All tests pass (2247+ tests). The new sidebar-badges tests should appear in the output.

- [ ] **Step 2: Run TypeScript type checking**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No type errors.

- [ ] **Step 3: Verify dev server renders badges**

Run: `npm run dev -w apps/web` and navigate to `http://localhost:3000/cms`. Check:
1. Posts sidebar item shows yellow pill with draft+ready count
2. Newsletters sidebar item shows WIP pill (yellow) and urgency pill (if unfilled cadence slots exist)
3. Collapse sidebar — dots appear instead of pills
4. Hover pills — tooltips show breakdown

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(cms): sidebar badges polish after manual testing"
```
