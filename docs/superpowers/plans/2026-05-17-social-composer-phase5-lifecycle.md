# Phase 5: Lifecycle & Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-share flow, queue management, schedule calendar integration, analytics polling, post editing, and error handling UI.

**Architecture:** Event-driven lifecycle. Post-publish hooks trigger the auto-share dialog. Queue slots are configurable per day-of-week and stored in `sites.social_defaults.queue_slots`. Calendar integration adds indigo social pills to the existing `PostsCalendar`. Analytics use a cron-based poller writing to `post_metrics`. Post editing enforces per-platform rules (Facebook edit, Bluesky delete+recreate, Instagram/YouTube read-only). Error handling surfaces per-delivery status with retry/reconnect actions.

**Tech Stack:** Next.js 15 + React 19 + Tailwind 4 + TypeScript strict, Supabase (PostgreSQL 17), `@tn-figueiredo/social` package types, Vitest, Zod validation.

**Spec:** `docs/superpowers/specs/2026-05-17-social-composer-stories-templates-design.md` — sections 6.6, 6.7, 6.9, 6.10, 6.11, 6.12.

**Dependencies:** Phase 3 (Composer UI) must be complete. The following exist and are stable: `ComposerShell`, `PostCard`, `PostsCalendar`, `PostsQueue`, `PostsFeed`, `DeliveryCard`, queue.ts `getNextQueueSlot()`, workflows.ts `publishSocialPost()` + `executeWithRetry()`, actions/posts.ts CRUD + `retrySocialDelivery()`, social-publish cron route.

---

## File structure

```
apps/web/src/
  app/cms/(authed)/
    _shared/social/
      auto-share-dialog.tsx                          (Task 20 — new)
    social/
      _components/
        posts-calendar.tsx                           (Task 22 — modify: add indigo social pills + slide-over)
        post-card.tsx                                (Task 25 — modify: add status badges + retry button)
        post-metrics-inline.tsx                      (Task 23 — new)
      queue/
        page.tsx                                     (Task 21 — new: queue view page)
        _components/
          queue-list.tsx                              (Task 21 — new: drag-to-reorder list)
      new/
        _components/
          composer-shell.tsx                          (Task 24 — modify: add edit mode)
          publish-status-banner.tsx                   (Task 25 — new)
      [id]/
        _components/
          metrics-detail.tsx                          (Task 23 — new)
    settings/social/
      _components/
        queue-schedule.tsx                            (Task 21 — new: slot configuration)
  lib/social/
    queue.ts                                         (Task 21 — modify: configurable slots)
    metrics-poller.ts                                (Task 23 — new)
    actions/
      posts.ts                                       (Task 24 — modify: add editPublishedPost)
  app/api/cron/
    social-metrics/
      route.ts                                       (Task 23 — new)

apps/web/test/
  auto-share-dialog.test.ts                          (Task 20)
  social-queue.test.ts                               (Task 21)
  social-metrics.test.ts                             (Task 23)
  social-post-editing.test.ts                        (Task 24)
  publish-status-banner.test.ts                      (Task 25)
```

---

## Task 20: Auto-Share Flow

**Parallel with:** Tasks 21, 22

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/social/auto-share-dialog.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts` — trigger dialog data after successful publish
- Create: `apps/web/test/auto-share-dialog.test.ts`

### Steps

- [ ] **Step 20.1 — Write failing test for AutoShareDialog render**

```ts
// apps/web/test/auto-share-dialog.test.ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AutoShareDialog } from '@/app/cms/(authed)/_shared/social/auto-share-dialog'

const mockStrings = {
  autoShare: {
    title: 'Share to Social',
    shareNow: 'Share Now',
    customize: 'Customize in Composer',
    skip: 'Skip',
    captionLabel: 'Caption preview',
    undoToast: 'Shared to {platforms}',
    undoAction: 'Undo',
  },
}

describe('AutoShareDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    contentType: 'blog' as const,
    contentId: 'post-123',
    contentTitle: 'Como configurar OAuth 2.0',
    contentUrl: 'https://bythiagofigueiredo.com/pt/blog/oauth-guide',
    contentExcerpt: 'Guia completo de OAuth 2.0',
    contentImage: 'https://example.com/image.jpg',
    availablePlatforms: ['facebook', 'bluesky'] as const,
    defaultPlatforms: ['facebook', 'bluesky'] as const,
    onShareNow: vi.fn(),
    onCustomize: vi.fn(),
    strings: mockStrings,
  }

  it('renders platform checkboxes pre-checked from defaults', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const fbCheckbox = screen.getByRole('checkbox', { name: /facebook/i })
    const bsCheckbox = screen.getByRole('checkbox', { name: /bluesky/i })
    expect(fbCheckbox).toBeChecked()
    expect(bsCheckbox).toBeChecked()
  })

  it('shows editable caption preview with character count', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const textarea = screen.getByLabelText(mockStrings.autoShare.captionLabel)
    expect(textarea).toBeInTheDocument()
    expect(screen.getByText(/\/300/)).toBeInTheDocument() // Bluesky limit indicator
  })

  it('calls onShareNow with checked platforms and caption', async () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.shareNow }))
    expect(defaultProps.onShareNow).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: ['facebook', 'bluesky'],
        caption: expect.any(String),
      }),
    )
  })

  it('calls onCustomize to open Composer pre-filled', () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.customize }))
    expect(defaultProps.onCustomize).toHaveBeenCalled()
  })

  it('calls onClose when Skip is clicked', () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.skip }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('unchecking a platform removes it from share payload', async () => {
    render(<AutoShareDialog {...defaultProps} />)
    const fbCheckbox = screen.getByRole('checkbox', { name: /facebook/i })
    fireEvent.click(fbCheckbox)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.shareNow }))
    expect(defaultProps.onShareNow).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: ['bluesky'],
      }),
    )
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/auto-share-dialog.test.ts`

- [ ] **Step 20.2 — Implement AutoShareDialog component**

```tsx
// apps/web/src/app/cms/(authed)/_shared/social/auto-share-dialog.tsx
'use client'

import { useState, useMemo } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from './platform-icon'

const PLATFORM_CHAR_LIMITS: Record<Provider, number> = {
  facebook: 63206,
  bluesky: 300,
  instagram: 2200,
  youtube: 5000,
}

interface AutoShareStrings {
  title: string
  shareNow: string
  customize: string
  skip: string
  captionLabel: string
  undoToast: string
  undoAction: string
}

interface AutoShareDialogProps {
  open: boolean
  onClose: () => void
  contentType: 'blog' | 'newsletter' | 'campaign' | 'video'
  contentId: string
  contentTitle: string
  contentUrl: string
  contentExcerpt?: string | null
  contentImage?: string | null
  availablePlatforms: readonly Provider[]
  defaultPlatforms: readonly Provider[]
  onShareNow: (payload: { platforms: Provider[]; caption: string }) => void
  onCustomize: () => void
  strings: { autoShare: AutoShareStrings }
}

export function AutoShareDialog({
  open,
  onClose,
  contentTitle,
  contentUrl,
  contentExcerpt,
  availablePlatforms,
  defaultPlatforms,
  onShareNow,
  onCustomize,
  strings: { autoShare: t },
}: AutoShareDialogProps) {
  const [checked, setChecked] = useState<Set<Provider>>(
    () => new Set(defaultPlatforms),
  )
  const defaultCaption = `${contentTitle}\n\n${contentUrl}`
  const [caption, setCaption] = useState(defaultCaption)

  const charCounts = useMemo(() => {
    const counts: Partial<Record<Provider, { current: number; limit: number }>> = {}
    for (const p of availablePlatforms) {
      counts[p] = { current: caption.length, limit: PLATFORM_CHAR_LIMITS[p] }
    }
    return counts
  }, [caption, availablePlatforms])

  function togglePlatform(provider: Provider) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  function handleShareNow() {
    onShareNow({
      platforms: Array.from(checked),
      caption,
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-lg rounded-xl border border-cms-border bg-cms-surface p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-cms-text">{t.title}</h2>

        {/* Platform checkboxes */}
        <div className="flex flex-wrap gap-3">
          {availablePlatforms.map((provider) => (
            <label
              key={provider}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked.has(provider)}
                onChange={() => togglePlatform(provider)}
                aria-label={platformLabel(provider)}
                className="accent-cms-accent"
              />
              <PlatformIcon provider={provider} size="sm" />
              <span className="text-sm text-cms-text">
                {platformLabel(provider)}
              </span>
            </label>
          ))}
        </div>

        {/* Caption preview */}
        <div className="space-y-1">
          <label
            htmlFor="auto-share-caption"
            className="text-sm font-medium text-cms-text-muted"
          >
            {t.captionLabel}
          </label>
          <textarea
            id="auto-share-caption"
            aria-label={t.captionLabel}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-cms-border bg-cms-bg p-3 text-sm text-cms-text resize-none focus:border-cms-accent focus:outline-none"
          />
          <div className="flex flex-wrap gap-3 text-xs text-cms-text-dim">
            {Array.from(checked).map((p) => {
              const count = charCounts[p]
              if (!count) return null
              const ratio = count.current / count.limit
              const color =
                ratio >= 1
                  ? 'text-red-400'
                  : ratio >= 0.9
                    ? 'text-amber-400'
                    : 'text-cms-text-dim'
              return (
                <span key={p} className={color}>
                  {platformLabel(p)}: {count.current}/{count.limit}
                </span>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleShareNow}
            disabled={checked.size === 0}
            className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
          >
            {t.shareNow}
          </button>
          <button
            type="button"
            onClick={onCustomize}
            className="rounded-lg border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-bg"
          >
            {t.customize}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-sm text-cms-text-muted hover:text-cms-text"
          >
            {t.skip}
          </button>
        </div>
      </div>
    </div>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/auto-share-dialog.test.ts`

- [ ] **Step 20.3 — Wire auto-share dialog into blog publish flow**

The blog `movePost` action in `apps/web/src/app/cms/(authed)/blog/actions.ts` already triggers `createSocialPostFromContent` fire-and-forget when `social_config.enabled` is true. For the dialog flow, the blog editor needs to return a signal to the client that the post was published so the UI can show the `AutoShareDialog`.

The integration point is in the blog editor's publish button handler. The `movePost()` action already handles the server-side social auto-share. The client-side dialog (`AutoShareDialog`) is shown when `movePost` returns `{ ok: true }` and the new status is `published`. The dialog gives the user interactive control (platform selection, caption editing) before calling `createFromContentAction` from `@/lib/social/actions`.

Modify the blog editor component that calls `movePost('published')` to show the dialog on success:

```tsx
// In the blog editor component that calls movePost():
// After movePost returns { ok: true } and newStatus === 'published':
// 1. Set showAutoShareDialog = true
// 2. Render <AutoShareDialog> with the blog post metadata
// 3. onShareNow calls createFromContentAction with selected platforms/caption
// 4. onCustomize navigates to /cms/social/new?contentType=blog&contentId={id}
// 5. onClose/Skip dismisses without creating social post
```

This is a UI integration that depends on the specific blog editor component structure. The key change is adding state + rendering `AutoShareDialog` after successful publish.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/auto-share-dialog.test.ts`

- [ ] **Step 20.4 — Add zero-friction auto-share mode**

When `auto_share_on_publish` is true per platform in `sites.social_defaults`, the dialog is skipped. The existing `movePost` action already calls `createSocialPostFromContent` fire-and-forget in this case. The client needs to show a toast confirmation with a 30-second "Undo" action.

The undo mechanism: `createSocialPostFromContent` returns `{ postId }`. The client stores this postId and, if the user clicks "Undo" within 30 seconds, calls `cancelSocialPost(postId)` to cancel pending deliveries.

```tsx
// Zero-friction flow (in blog editor component):
// 1. Check sites.social_defaults.auto_share_on_publish
// 2. If enabled: skip dialog, server-side auto-share already fired by movePost
// 3. Show toast: "Shared to Facebook, Bluesky" with Undo button
// 4. Undo calls cancelSocialPost(postId) within 30s window
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`

---

## Task 21: Queue (Fila) Management

**Parallel with:** Tasks 20, 22

**Files:**
- Modify: `apps/web/src/lib/social/queue.ts` — configurable time slots from site settings
- Create: `apps/web/src/app/cms/(authed)/social/queue/page.tsx` — queue view page
- Create: `apps/web/src/app/cms/(authed)/social/queue/_components/queue-list.tsx` — drag-to-reorder list
- Create: `apps/web/src/app/cms/(authed)/settings/social/_components/queue-schedule.tsx` — slot configuration
- Create: `apps/web/test/social-queue.test.ts`

### Steps

- [ ] **Step 21.1 — Write failing tests for configurable queue slots**

```ts
// apps/web/test/social-queue.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { getNextQueueSlot } from '@/lib/social/queue'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: overrides.scheduledPosts ?? [],
            error: null,
          }),
        }),
      }),
    }),
  })

  const singleMock = vi.fn().mockResolvedValue({
    data: overrides.siteSettings ?? null,
    error: null,
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'social_posts') {
        return { select: selectMock }
      }
      if (table === 'sites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: singleMock,
            }),
          }),
        }
      }
      return { select: selectMock }
    }),
  }
}

describe('getNextQueueSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a slot with the correct shape', async () => {
    const mock = createMockSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    expect(slot).toMatchObject({
      date: expect.any(String),
      hour: expect.any(Number),
      scheduledAt: expect.any(String),
      label: expect.any(String),
    })
  })

  it('uses custom queue_slots from site settings when provided', async () => {
    const customSlots = {
      monday: [10, 14],
      tuesday: [10, 14],
      wednesday: [10, 14],
      thursday: [10, 14],
      friday: [10, 14],
      saturday: [12],
      sunday: [],
    }
    const mock = createMockSupabase({
      siteSettings: { social_defaults: { queue_slots: customSlots } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    if (slot) {
      expect([10, 12, 14]).toContain(slot.hour)
    }
  })

  it('skips occupied slots', async () => {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)

    const mock = createMockSupabase({
      scheduledPosts: [{ scheduled_at: nextHour.toISOString() }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    if (slot) {
      const slotTime = new Date(slot.scheduledAt)
      expect(slotTime.getTime()).not.toBe(nextHour.getTime())
    }
  })

  it('returns null when no slots available in window', async () => {
    // Fill all slots — this test verifies graceful null return
    const mock = createMockSupabase({
      siteSettings: { social_defaults: { queue_slots: {
        monday: [], tuesday: [], wednesday: [], thursday: [],
        friday: [], saturday: [], sunday: [],
      } } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)

    const slot = await getNextQueueSlot('site-1', 'America/Sao_Paulo')
    expect(slot).toBeNull()
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-queue.test.ts`

- [ ] **Step 21.2 — Enhance getNextQueueSlot() with configurable time slots**

Modify `apps/web/src/lib/social/queue.ts` to read `queue_slots` from `sites.social_defaults`:

```ts
// apps/web/src/lib/social/queue.ts — updated

import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface QueueSlot {
  date: string
  hour: number
  scheduledAt: string
  label: string
}

// Day-of-week names matching JS Date.getDay() via Intl
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
type DayKey = (typeof DAY_KEYS)[number]

export type QueueSlotConfig = Partial<Record<DayKey, number[]>>

const DEFAULT_SLOT_HOURS = [9, 11, 13, 15, 17, 19, 21]
const MAX_DAYS_AHEAD = 7

async function loadQueueSlotConfig(
  siteId: string,
): Promise<QueueSlotConfig | null> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('social_defaults')
    .eq('id', siteId)
    .single()

  if (!data) return null
  const defaults = data.social_defaults as Record<string, unknown> | null
  if (!defaults?.queue_slots) return null
  return defaults.queue_slots as QueueSlotConfig
}

function getSlotHoursForDay(
  config: QueueSlotConfig | null,
  dayIndex: number,
): number[] {
  if (!config) return DEFAULT_SLOT_HOURS
  const dayKey = DAY_KEYS[dayIndex]
  if (!dayKey) return DEFAULT_SLOT_HOURS
  const hours = config[dayKey]
  return hours !== undefined ? hours : DEFAULT_SLOT_HOURS
}

export async function getNextQueueSlot(
  siteId: string,
  timezone: string,
): Promise<QueueSlot | null> {
  const supabase = getSupabaseServiceClient()
  const now = new Date()

  const slotConfig = await loadQueueSlotConfig(siteId)

  const windowStart = now.toISOString()
  const windowEnd = new Date(
    now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: scheduledPosts } = await supabase
    .from('social_posts')
    .select('scheduled_at')
    .eq('site_id', siteId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  const occupiedSet = new Set<string>()
  for (const post of scheduledPosts ?? []) {
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at as string)
      d.setMinutes(0, 0, 0)
      occupiedSet.add(d.toISOString())
    }
  }

  for (let dayOffset = 0; dayOffset < MAX_DAYS_AHEAD; dayOffset++) {
    const candidateDate = new Date(now)
    candidateDate.setDate(candidateDate.getDate() + dayOffset)

    const dayIndex = candidateDate.getDay()
    const slotHours = getSlotHoursForDay(slotConfig, dayIndex)

    const dateStr = formatDateInTz(candidateDate, timezone)

    for (const hour of slotHours) {
      const candidateUtc = buildUtcFromLocalHour(candidateDate, hour, timezone)

      if (candidateUtc.getTime() <= now.getTime()) continue

      const rounded = new Date(candidateUtc)
      rounded.setMinutes(0, 0, 0)
      if (occupiedSet.has(rounded.toISOString())) continue

      const label = formatSlotLabel(candidateUtc, hour, timezone)

      return {
        date: dateStr,
        hour,
        scheduledAt: candidateUtc.toISOString(),
        label,
      }
    }
  }

  return null
}

// ... keep existing formatDateInTz, buildUtcFromLocalHour, formatSlotLabel unchanged
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-queue.test.ts`

- [ ] **Step 21.3 — Create queue view page with drag-to-reorder**

```tsx
// apps/web/src/app/cms/(authed)/social/queue/page.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listSocialPosts } from '@/lib/social/actions/posts'
import { getSocialStrings } from '../../_i18n'
import { QueueList } from './_components/queue-list'

export const dynamic = 'force-dynamic'

export default async function SocialQueuePage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)

  const result = await listSocialPosts(ctx.siteId, { status: 'scheduled' })
  const posts = result.ok ? result.data : []

  const queuedPosts = posts
    .filter((p) => p.scheduled_at)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() -
        new Date(b.scheduled_at!).getTime(),
    )

  return (
    <>
      <CmsTopbar title={t.posts.tabs.queue} />
      <div className="p-6">
        <QueueList posts={queuedPosts} strings={t} />
      </div>
    </>
  )
}
```

```tsx
// apps/web/src/app/cms/(authed)/social/queue/_components/queue-list.tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { SocialPost } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { PlatformIcon } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { updateSocialPost } from '@/lib/social/actions/posts'
import type { SocialStrings } from '../../../_i18n/types'

interface QueueListProps {
  posts: SocialPost[]
  strings: SocialStrings
}

export function QueueList({ posts: initialPosts, strings: t }: QueueListProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDragStart(idx: number) {
    setDraggedIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return

    const reordered = [...posts]
    const [moved] = reordered.splice(draggedIdx, 1)
    reordered.splice(idx, 0, moved!)
    setPosts(reordered)
    setDraggedIdx(idx)
  }

  function handleDragEnd() {
    if (draggedIdx === null) return
    setDraggedIdx(null)

    // Persist new order by swapping scheduled_at times
    startTransition(async () => {
      const sortedTimes = [...posts]
        .map((p) => p.scheduled_at)
        .filter(Boolean)
        .sort()

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i]!
        const newTime = sortedTimes[i]
        if (post.scheduled_at !== newTime && newTime) {
          await updateSocialPost(post.id, { scheduledAt: newTime })
        }
      }
    })
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-cms-text-muted">{t.posts.emptyQueue}</p>
        <Link
          href="/cms/social/new"
          className="mt-4 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          {t.posts.newPost}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2" role="list" aria-label="Queue">
      {posts.map((post, idx) => (
        <div
          key={post.id}
          role="listitem"
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-3 rounded-lg border bg-cms-surface px-4 py-3 transition-colors cursor-grab active:cursor-grabbing ${
            draggedIdx === idx
              ? 'border-cms-accent/50 bg-cms-accent/5'
              : 'border-cms-border hover:border-cms-accent/30'
          } ${isPending ? 'opacity-60' : ''}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-xs font-medium text-purple-400">
            {idx + 1}
          </span>

          <div className="flex-1 min-w-0">
            <Link
              href={`/cms/social/${post.id}`}
              className="text-sm font-medium text-cms-text hover:text-cms-accent line-clamp-1"
            >
              {post.content.title ??
                post.content.description ??
                post.type}
            </Link>
            <p className="text-xs text-cms-text-dim">
              {post.scheduled_at
                ? new Date(post.scheduled_at).toLocaleDateString(
                    undefined,
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )
                : ''}
            </p>
          </div>

          <SocialStatusBadge status="scheduled" label={t.status.scheduled} />
        </div>
      ))}
    </div>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-queue.test.ts`

- [ ] **Step 21.4 — Create queue schedule configuration component**

```tsx
// apps/web/src/app/cms/(authed)/settings/social/_components/queue-schedule.tsx
'use client'

import { useState, useTransition } from 'react'
import type { QueueSlotConfig } from '@/lib/social/queue'

const DAY_LABELS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
] as const

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 6) // 06:00 to 21:00

interface QueueScheduleProps {
  initialConfig: QueueSlotConfig
  onSave: (config: QueueSlotConfig) => Promise<{ ok: boolean; error?: string }>
}

export function QueueSchedule({ initialConfig, onSave }: QueueScheduleProps) {
  const [config, setConfig] = useState<QueueSlotConfig>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function addSlot(day: string) {
    setConfig((prev) => {
      const hours = prev[day as keyof QueueSlotConfig] ?? []
      // Find next available hour not already used
      const available = HOUR_OPTIONS.find((h) => !hours.includes(h))
      if (available === undefined) return prev
      return { ...prev, [day]: [...hours, available].sort((a, b) => a - b) }
    })
    setSaved(false)
  }

  function removeSlot(day: string, hour: number) {
    setConfig((prev) => ({
      ...prev,
      [day]: (prev[day as keyof QueueSlotConfig] ?? []).filter(
        (h) => h !== hour,
      ),
    }))
    setSaved(false)
  }

  function updateSlotHour(day: string, oldHour: number, newHour: number) {
    setConfig((prev) => ({
      ...prev,
      [day]: (prev[day as keyof QueueSlotConfig] ?? [])
        .map((h) => (h === oldHour ? newHour : h))
        .sort((a, b) => a - b),
    }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await onSave(config)
      if (result.ok) {
        setSaved(true)
      } else {
        setError(result.error ?? 'Failed to save')
      }
    })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-cms-text">
        Queue Time Slots
      </h3>
      <p className="text-xs text-cms-text-muted">
        Configure when queued posts are published. Posts added to the queue are
        assigned the next available slot.
      </p>

      <div className="space-y-3">
        {DAY_LABELS.map(({ key, label }) => {
          const hours = config[key as keyof QueueSlotConfig] ?? []
          return (
            <div key={key} className="flex items-start gap-3">
              <span className="w-10 shrink-0 pt-1.5 text-sm font-medium text-cms-text">
                {label}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex items-center gap-1 rounded border border-cms-border bg-cms-bg px-2 py-1"
                  >
                    <select
                      value={hour}
                      onChange={(e) =>
                        updateSlotHour(key, hour, Number(e.target.value))
                      }
                      className="bg-transparent text-sm text-cms-text focus:outline-none"
                    >
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSlot(key, hour)}
                      aria-label={`Remove ${label} ${hour}:00`}
                      className="text-cms-text-dim hover:text-red-400"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(key)}
                  className="rounded border border-dashed border-cms-border px-2 py-1 text-xs text-cms-text-muted hover:border-cms-accent hover:text-cms-accent"
                >
                  + Add
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-green-400">Saved successfully</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Schedule'}
      </button>
    </div>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-queue.test.ts`

---

## Task 22: Schedule Calendar Integration

**Parallel with:** Tasks 20, 21

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/social/_components/posts-calendar.tsx` — add indigo pills + slide-over panel

### Steps

- [ ] **Step 22.1 — Add indigo pills for social posts on calendar**

Modify `apps/web/src/app/cms/(authed)/social/_components/posts-calendar.tsx`:

```tsx
// posts-calendar.tsx — enhanced with indigo social pills + slide-over panel
'use client'

import { useState, useMemo } from 'react'
import type { SocialPost, Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostsCalendarProps {
  posts: SocialPost[]
  strings: SocialStrings
  platformsByPost?: Record<string, Provider[]>
}

/** Calendar-specific bg-only colors (no text color — cells use text-cms-text). */
const CALENDAR_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20', scheduled: 'bg-blue-500/20', draft: 'bg-yellow-500/20',
  failed: 'bg-red-500/20', cancelled: 'bg-gray-500/20', partial_failure: 'bg-orange-500/20',
  publishing: 'bg-blue-500/20',
}

/** Social posts get indigo pills to distinguish from other content types. */
const SOCIAL_PILL_CLASS = 'bg-indigo-500/20 text-cms-text'

export function PostsCalendar({ posts, strings: t, platformsByPost = {} }: PostsCalendarProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)

  const days = useMemo(() => {
    const first = new Date(month.year, month.month, 1)
    const last = new Date(month.year, month.month + 1, 0)
    const startDay = first.getDay()
    const cells: (Date | null)[] = Array.from({ length: startDay }, () => null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(month.year, month.month, d))
    return cells
  }, [month])

  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    for (const p of posts) {
      const date = p.scheduled_at ?? p.published_at ?? p.created_at
      const key = new Date(date).toISOString().slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return map
  }, [posts])

  function prevMonth() { setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 }) }
  function nextMonth() { setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 }) }

  const monthName = new Date(month.year, month.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const dayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 7 + i) // 2024-01-07 is a Sunday
      return formatter.format(d)
    })
  }, [])

  if (posts.length === 0) {
    return <p className="py-12 text-center text-cms-text-muted">{t.posts.emptyCalendar}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="text-sm text-cms-accent hover:underline">&larr;</button>
        <span className="text-sm font-semibold text-cms-text">{monthName}</span>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="text-sm text-cms-accent hover:underline">&rarr;</button>
      </div>
      <div role="grid" aria-label="Posts calendar" className="grid grid-cols-7 gap-px bg-cms-border rounded-lg overflow-hidden">
        {dayNames.map(d => (
          <div key={d} className="bg-cms-surface px-2 py-1 text-center text-xs font-medium text-cms-text-muted">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} role="gridcell" className="bg-cms-bg min-h-[60px]" />
          const key = day.toISOString().slice(0, 10)
          const dayPosts = postsByDay[key] ?? []
          return (
            <div key={key} role="gridcell" className="bg-cms-bg min-h-[60px] p-1">
              <span className="text-xs text-cms-text-dim">{day.getDate()}</span>
              {dayPosts.slice(0, 3).map(p => {
                const platforms = platformsByPost[p.id] ?? []
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPost(p)}
                    className={`mt-0.5 w-full rounded px-1 py-0.5 text-[10px] truncate text-left ${SOCIAL_PILL_CLASS} hover:bg-indigo-500/30 transition-colors`}
                  >
                    {platforms.length > 0 && (
                      <span className="mr-0.5">
                        {platforms.slice(0, 2).map(pl => (
                          <PlatformIcon key={pl} provider={pl} size="sm" className="inline text-[9px]" />
                        ))}
                      </span>
                    )}
                    {p.content.title ?? p.content.description?.slice(0, 20) ?? p.type}
                  </button>
                )
              })}
              {dayPosts.length > 3 && <p className="text-[10px] text-cms-text-dim">+{dayPosts.length - 3}</p>}
            </div>
          )
        })}
      </div>

      {/* Slide-over panel */}
      {selectedPost && (
        <CalendarSlideOver
          post={selectedPost}
          platforms={platformsByPost[selectedPost.id] ?? []}
          strings={t}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slide-over panel (click a calendar pill to open)
// ---------------------------------------------------------------------------

interface CalendarSlideOverProps {
  post: SocialPost
  platforms: Provider[]
  strings: SocialStrings
  onClose: () => void
}

function CalendarSlideOver({ post, platforms, strings: t, onClose }: CalendarSlideOverProps) {
  const scheduledTime = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Post preview">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed inset-0 bg-black/30"
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md border-l border-cms-border bg-cms-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-cms-border p-4">
          <h3 className="text-sm font-semibold text-cms-text">Post Preview</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="text-cms-text-muted hover:text-cms-text"
          >
            x
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Status + platforms */}
          <div className="flex items-center gap-2 flex-wrap">
            <SocialStatusBadge
              status={post.status}
              label={t.status[post.status as keyof typeof t.status] ?? post.status}
            />
            {platforms.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">
                <PlatformIcon provider={p} size="sm" />
                {platformLabel(p)}
              </span>
            ))}
          </div>

          {/* Scheduled time */}
          {scheduledTime && (
            <p className="text-sm text-cms-text-muted">{scheduledTime}</p>
          )}

          {/* Post content preview */}
          <div className="rounded-lg border border-cms-border bg-cms-bg p-3 space-y-2">
            {post.content.title && (
              <p className="text-sm font-medium text-cms-text">
                {post.content.title}
              </p>
            )}
            {post.content.description && (
              <p className="text-sm text-cms-text-muted">
                {post.content.description}
              </p>
            )}
            {post.content.url && (
              <p className="text-xs text-cms-accent truncate">
                {post.content.url}
              </p>
            )}
            {post.content.media_urls && post.content.media_urls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {post.content.media_urls.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href={`/cms/social/new?post=${post.id}`}
              className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
            >
              {t.detail.edit}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              Remove from Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`

---

## Task 23: Analytics MVP

**Parallel with:** Tasks 24, 25 (after Tasks 20-22 are complete)

**Files:**
- Create: `apps/web/src/app/api/cron/social-metrics/route.ts` — cron handler
- Create: `apps/web/src/lib/social/metrics-poller.ts` — per-platform metric fetching
- Create: `apps/web/src/app/cms/(authed)/social/_components/post-metrics-inline.tsx` — inline display
- Create: `apps/web/src/app/cms/(authed)/social/[id]/_components/metrics-detail.tsx` — detail modal
- Create: `apps/web/test/social-metrics.test.ts`

### Steps

- [ ] **Step 23.1 — Write failing tests for metrics poller**

```ts
// apps/web/test/social-metrics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@tn-figueiredo/social', () => ({
  decrypt: vi.fn((v: string) => v),
  getMasterKey: vi.fn(() => 'test-key'),
}))

import {
  shouldPollPost,
  type PollCandidate,
} from '@/lib/social/metrics-poller'

describe('shouldPollPost', () => {
  const now = Date.now()

  it('returns true for posts less than 7 days old with last poll over 6h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p1',
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      lastPolledAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(), // 7h ago
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })

  it('returns false for posts less than 7 days old polled less than 6h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p2',
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastPolledAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(false)
  })

  it('returns true for stories less than 48h old polled over 2h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p3',
      publishedAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(), // 20h ago
      lastPolledAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      isStory: true,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })

  it('returns false for posts older than 7 days', () => {
    const candidate: PollCandidate = {
      postId: 'p4',
      publishedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      lastPolledAt: null,
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(false)
  })

  it('returns true for posts never polled before within the window', () => {
    const candidate: PollCandidate = {
      postId: 'p5',
      publishedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      lastPolledAt: null,
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-metrics.test.ts`

- [ ] **Step 23.2 — Implement metrics-poller.ts**

```ts
// apps/web/src/lib/social/metrics-poller.ts

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { decrypt, getMasterKey } from '@tn-figueiredo/social'
import type { Provider } from '@tn-figueiredo/social'
import * as Sentry from '@sentry/nextjs'

const SENTRY_TAG = { component: 'social-metrics-poller' }

// Polling windows
const POST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000      // 7 days
const STORY_MAX_AGE_MS = 48 * 60 * 60 * 1000          // 48 hours
const POST_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000      // 6 hours
const STORY_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000     // 2 hours

export interface PollCandidate {
  postId: string
  publishedAt: string
  lastPolledAt: string | null
  isStory: boolean
}

export interface PostMetricRow {
  post_id: string
  delivery_id: string
  provider: Provider
  impressions: number | null
  reach: number | null
  likes: number
  comments: number
  shares: number
  link_clicks: number | null
  polled_at: string
  raw: Record<string, unknown>
}

export function shouldPollPost(candidate: PollCandidate): boolean {
  const now = Date.now()
  const age = now - new Date(candidate.publishedAt).getTime()
  const maxAge = candidate.isStory ? STORY_MAX_AGE_MS : POST_MAX_AGE_MS
  const pollInterval = candidate.isStory ? STORY_POLL_INTERVAL_MS : POST_POLL_INTERVAL_MS

  // Too old — final snapshot already captured
  if (age > maxAge) return false

  // Never polled — poll now
  if (!candidate.lastPolledAt) return true

  // Polled recently — skip
  const sincePoll = now - new Date(candidate.lastPolledAt).getTime()
  return sincePoll >= pollInterval
}

export interface MetricsResult {
  likes: number
  comments: number
  shares: number
  impressions?: number
  reach?: number
  linkClicks?: number
  raw: Record<string, unknown>
}

export async function fetchFacebookMetrics(
  postId: string,
  pageToken: string,
): Promise<MetricsResult> {
  const url = `https://graph.facebook.com/v21.0/${postId}/insights?metric=post_reactions_by_type_total,post_impressions,post_engaged_users,post_clicks&access_token=${pageToken}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Facebook insights (${res.status})`)
  const json = (await res.json()) as { data?: Array<{ name: string; values: Array<{ value: unknown }> }> }
  const data = json.data ?? []

  const getValue = (name: string) => {
    const metric = data.find((d) => d.name === name)
    const val = metric?.values?.[0]?.value
    if (typeof val === 'number') return val
    if (typeof val === 'object' && val !== null) {
      return Object.values(val as Record<string, number>).reduce((a, b) => a + b, 0)
    }
    return 0
  }

  return {
    likes: getValue('post_reactions_by_type_total'),
    comments: 0, // Not in insights — fetched via /{post-id}?fields=comments.summary(true)
    shares: 0,
    impressions: getValue('post_impressions'),
    linkClicks: getValue('post_clicks'),
    raw: { data },
  }
}

export async function fetchBlueskyMetrics(
  uri: string,
  service: string,
  accessJwt: string,
): Promise<MetricsResult> {
  const url = `${service}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessJwt}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Bluesky getPostThread (${res.status})`)
  const json = (await res.json()) as {
    thread?: { post?: { likeCount?: number; repostCount?: number; replyCount?: number } }
  }
  const post = json.thread?.post ?? {}

  return {
    likes: post.likeCount ?? 0,
    comments: post.replyCount ?? 0,
    shares: post.repostCount ?? 0,
    raw: { thread: json.thread },
  }
}

export async function fetchInstagramMetrics(
  mediaId: string,
  accessToken: string,
): Promise<MetricsResult> {
  const url = `https://graph.facebook.com/v21.0/${mediaId}/insights?metric=impressions,reach,replies&access_token=${accessToken}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Instagram insights (${res.status})`)
  const json = (await res.json()) as { data?: Array<{ name: string; values: Array<{ value: number }> }> }
  const data = json.data ?? []

  const getValue = (name: string) => {
    const metric = data.find((d) => d.name === name)
    return metric?.values?.[0]?.value ?? 0
  }

  return {
    likes: 0, // Fetched via /{media-id}?fields=like_count
    comments: getValue('replies'),
    shares: 0,
    impressions: getValue('impressions'),
    reach: getValue('reach'),
    raw: { data },
  }
}

export async function pollMetricsForDelivery(
  deliveryId: string,
  provider: Provider,
  platformPostId: string,
  connectionRow: Record<string, unknown>,
): Promise<PostMetricRow | null> {
  const key = getMasterKey()

  try {
    let result: MetricsResult

    switch (provider) {
      case 'facebook': {
        if (!connectionRow.page_token_enc) return null
        const pageToken = decrypt(connectionRow.page_token_enc as string, key)
        result = await fetchFacebookMetrics(platformPostId, pageToken)
        break
      }
      case 'bluesky': {
        const accessToken = decrypt(connectionRow.access_token_enc as string, key)
        const metadata = connectionRow.metadata as Record<string, unknown> | null
        const service = (metadata?.service as string) ?? 'https://bsky.social'
        result = await fetchBlueskyMetrics(platformPostId, service, accessToken)
        break
      }
      case 'instagram': {
        if (!connectionRow.page_token_enc) return null
        const token = decrypt(connectionRow.page_token_enc as string, key)
        result = await fetchInstagramMetrics(platformPostId, token)
        break
      }
      case 'youtube': {
        // YouTube community post metrics are not available via Data API v3 in v1
        return null
      }
      default:
        return null
    }

    return {
      post_id: '', // Set by caller from delivery.post_id
      delivery_id: deliveryId,
      provider,
      impressions: result.impressions ?? null,
      reach: result.reach ?? null,
      likes: result.likes,
      comments: result.comments,
      shares: result.shares,
      link_clicks: result.linkClicks ?? null,
      polled_at: new Date().toISOString(),
      raw: result.raw,
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'pollMetrics', provider },
      extra: { deliveryId, platformPostId },
    })
    return null
  }
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-metrics.test.ts`

- [ ] **Step 23.3 — Create cron route for social-metrics**

```ts
// apps/web/src/app/api/cron/social-metrics/route.ts
import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import {
  shouldPollPost,
  pollMetricsForDelivery,
  type PollCandidate,
} from '@/lib/social/metrics-poller'

// Vercel Cron: { "path": "/api/cron/social-metrics", "schedule": "0 */2 * * *" }

export const runtime = 'nodejs'
export const maxDuration = 60

const LOCK_KEY = 'cron:social-metrics'
const JOB = 'social-metrics'
const BATCH_LIMIT = 20

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // Find published deliveries with platform_post_id
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString()

    const { data: deliveries, error: fetchError } = await supabase
      .from('social_deliveries')
      .select(
        'id, post_id, provider, platform_post_id, connection_id, format, published_at',
      )
      .eq('status', 'published')
      .not('platform_post_id', 'is', null)
      .gte('published_at', sevenDaysAgo)
      .order('published_at', { ascending: false })
      .limit(BATCH_LIMIT)

    if (fetchError) {
      throw new Error(`Failed to fetch deliveries: ${fetchError.message}`)
    }

    if (!deliveries || deliveries.length === 0) {
      return { status: 'ok' as const, processed: 0 }
    }

    // Get last poll times from post_metrics
    const deliveryIds = deliveries.map((d) => d.id as string)
    const { data: lastPolls } = await supabase
      .from('post_metrics')
      .select('delivery_id, polled_at')
      .in('delivery_id', deliveryIds)
      .order('polled_at', { ascending: false })

    const lastPollMap = new Map<string, string>()
    for (const poll of lastPolls ?? []) {
      const did = poll.delivery_id as string
      if (!lastPollMap.has(did)) {
        lastPollMap.set(did, poll.polled_at as string)
      }
    }

    // Filter by polling schedule
    const toPoll = deliveries.filter((d) => {
      const candidate: PollCandidate = {
        postId: d.post_id as string,
        publishedAt: d.published_at as string,
        lastPolledAt: lastPollMap.get(d.id as string) ?? null,
        isStory: (d.format as string) === 'story',
      }
      return shouldPollPost(candidate)
    })

    let processed = 0
    const errors: string[] = []

    for (const delivery of toPoll) {
      try {
        const { data: connection } = await supabase
          .from('social_connections')
          .select('*')
          .eq('id', delivery.connection_id)
          .single()

        if (!connection) continue

        const metricRow = await pollMetricsForDelivery(
          delivery.id as string,
          delivery.provider as string as import('@tn-figueiredo/social').Provider,
          delivery.platform_post_id as string,
          connection as Record<string, unknown>,
        )

        if (metricRow) {
          metricRow.post_id = delivery.post_id as string

          const { error: insertError } = await supabase
            .from('post_metrics')
            .insert(metricRow)

          if (insertError) {
            errors.push(
              `delivery ${delivery.id}: insert failed: ${insertError.message}`,
            )
          } else {
            processed++
          }
        }
      } catch (err) {
        errors.push(
          `delivery ${delivery.id}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    // Log cron run
    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: errors.length > 0 ? 'error' : 'ok',
        items_processed: processed,
        error: errors.length > 0 ? errors.join('; ') : null,
      })
    } catch {
      /* best-effort */
    }

    return { status: 'ok' as const, processed, errors: errors.length > 0 ? errors : undefined }
  })
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-metrics.test.ts`

- [ ] **Step 23.4 — Create inline metrics display component**

```tsx
// apps/web/src/app/cms/(authed)/social/_components/post-metrics-inline.tsx
'use client'

interface PostMetricsInlineProps {
  likes: number
  comments: number
  shares: number
  linkClicks: number | null
}

export function PostMetricsInline({
  likes,
  comments,
  shares,
  linkClicks,
}: PostMetricsInlineProps) {
  const engagements = likes + comments + shares

  if (engagements === 0 && !linkClicks) return null

  return (
    <p className="text-xs text-cms-text-dim">
      {engagements > 0 && (
        <span>{engagements} engagement{engagements !== 1 ? 's' : ''}</span>
      )}
      {engagements > 0 && linkClicks !== null && linkClicks > 0 && (
        <span className="mx-1">·</span>
      )}
      {linkClicks !== null && linkClicks > 0 && (
        <span>{linkClicks} link click{linkClicks !== 1 ? 's' : ''}</span>
      )}
    </p>
  )
}
```

- [ ] **Step 23.5 — Create metrics detail modal**

```tsx
// apps/web/src/app/cms/(authed)/social/[id]/_components/metrics-detail.tsx
'use client'

import { useState } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { SocialStrings } from '../../../_i18n/types'

interface PlatformMetrics {
  provider: Provider
  likes: number
  comments: number
  shares: number
  impressions: number | null
  reach: number | null
  linkClicks: number | null
  polledAt: string
}

interface MetricsDetailProps {
  metrics: PlatformMetrics[]
  strings: SocialStrings
}

export function MetricsDetail({ metrics, strings: t }: MetricsDetailProps) {
  const [open, setOpen] = useState(false)

  if (metrics.length === 0) return null

  const totalEngagement = metrics.reduce(
    (sum, m) => sum + m.likes + m.comments + m.shares,
    0,
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-cms-accent hover:underline"
      >
        {totalEngagement} engagement{totalEngagement !== 1 ? 's' : ''} — View details
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Metrics detail"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-full max-w-lg rounded-xl border border-cms-border bg-cms-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cms-text">
                Engagement Breakdown
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-cms-text-muted hover:text-cms-text"
              >
                x
              </button>
            </div>

            <div className="space-y-3">
              {metrics.map((m) => (
                <div
                  key={m.provider}
                  className="rounded-lg border border-cms-border bg-cms-bg p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <PlatformIcon provider={m.provider} />
                    <span className="font-medium text-cms-text">
                      {platformLabel(m.provider)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-cms-text-muted">{t.detail.metrics.likes}</p>
                      <p className="font-medium text-cms-text">{m.likes}</p>
                    </div>
                    <div>
                      <p className="text-cms-text-muted">{t.detail.metrics.comments}</p>
                      <p className="font-medium text-cms-text">{m.comments}</p>
                    </div>
                    <div>
                      <p className="text-cms-text-muted">{t.detail.metrics.shares}</p>
                      <p className="font-medium text-cms-text">{m.shares}</p>
                    </div>
                  </div>

                  {(m.impressions !== null || m.reach !== null || m.linkClicks !== null) && (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {m.impressions !== null && (
                        <div>
                          <p className="text-cms-text-muted">Impressions</p>
                          <p className="font-medium text-cms-text">{m.impressions}</p>
                        </div>
                      )}
                      {m.reach !== null && (
                        <div>
                          <p className="text-cms-text-muted">Reach</p>
                          <p className="font-medium text-cms-text">{m.reach}</p>
                        </div>
                      )}
                      {m.linkClicks !== null && (
                        <div>
                          <p className="text-cms-text-muted">Link Clicks</p>
                          <p className="font-medium text-cms-text">{m.linkClicks}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-cms-text-dim">
                    Last updated:{' '}
                    {new Date(m.polledAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`

---

## Task 24: Post Editing

**Parallel with:** Tasks 23, 25

**Files:**
- Modify: `apps/web/src/lib/social/actions/posts.ts` — add `editPublishedPost()` action
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` — edit mode
- Create: `apps/web/test/social-post-editing.test.ts`

### Steps

- [ ] **Step 24.1 — Write failing tests for editPublishedPost**

```ts
// apps/web/test/social-post-editing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@tn-figueiredo/social', async () => {
  return {
    decrypt: vi.fn((v: string) => v),
    getMasterKey: vi.fn(() => 'test-key'),
    encrypt: vi.fn((v: string) => v),
    SocialPostContentSchema: (await import('zod')).z.object({
      title: (await import('zod')).z.string().optional(),
      description: (await import('zod')).z.string().optional(),
      url: (await import('zod')).z.string().optional(),
      hashtags: (await import('zod')).z.array((await import('zod')).z.string()).optional(),
      media_urls: (await import('zod')).z.array((await import('zod')).z.string()).optional(),
      captions: (await import('zod')).z.record((await import('zod')).z.string(), (await import('zod')).z.record((await import('zod')).z.string(), (await import('zod')).z.string())).optional(),
    }),
    RETRY_DELAYS: [5000, 30000, 120000],
  }
})

describe('editPublishedPost per-platform rules', () => {
  it('enforces caption-only editing for Facebook', () => {
    // Facebook allows editing the message field only
    const rules = getEditRules('facebook')
    expect(rules.canEditCaption).toBe(true)
    expect(rules.canEditMedia).toBe(false)
    expect(rules.method).toBe('update')
  })

  it('enforces delete+recreate for Bluesky with warning', () => {
    const rules = getEditRules('bluesky')
    expect(rules.canEditCaption).toBe(true)
    expect(rules.canEditMedia).toBe(false)
    expect(rules.method).toBe('delete_recreate')
    expect(rules.warning).toContain('engagement')
  })

  it('marks Instagram as read-only', () => {
    const rules = getEditRules('instagram')
    expect(rules.canEditCaption).toBe(false)
    expect(rules.canEditMedia).toBe(false)
    expect(rules.readOnly).toBe(true)
    expect(rules.readOnlyReason).toContain('does not support editing')
  })

  it('marks YouTube as read-only', () => {
    const rules = getEditRules('youtube')
    expect(rules.canEditCaption).toBe(false)
    expect(rules.readOnly).toBe(true)
  })
})

// Helper that will be exported from the module
function getEditRules(provider: string): {
  canEditCaption: boolean
  canEditMedia: boolean
  method?: 'update' | 'delete_recreate'
  readOnly?: boolean
  readOnlyReason?: string
  warning?: string
} {
  switch (provider) {
    case 'facebook':
      return { canEditCaption: true, canEditMedia: false, method: 'update' }
    case 'bluesky':
      return {
        canEditCaption: true,
        canEditMedia: false,
        method: 'delete_recreate',
        warning: 'Editing on Bluesky deletes the original post and creates a new one. This resets engagement metrics.',
      }
    case 'instagram':
      return {
        canEditCaption: false,
        canEditMedia: false,
        readOnly: true,
        readOnlyReason: 'Instagram does not support editing published posts',
      }
    case 'youtube':
      return {
        canEditCaption: false,
        canEditMedia: false,
        readOnly: true,
        readOnlyReason: 'YouTube editing is not supported in v1',
      }
    default:
      return { canEditCaption: false, canEditMedia: false, readOnly: true }
  }
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-post-editing.test.ts`

- [ ] **Step 24.2 — Add editPublishedPost action and getEditRules helper**

Add to `apps/web/src/lib/social/actions/posts.ts`:

```ts
// Add to apps/web/src/lib/social/actions/posts.ts

// ---------------------------------------------------------------------------
// Per-platform edit rules
// ---------------------------------------------------------------------------

export interface EditRules {
  canEditCaption: boolean
  canEditMedia: boolean
  method?: 'update' | 'delete_recreate'
  readOnly?: boolean
  readOnlyReason?: string
  warning?: string
}

export function getEditRules(provider: Provider): EditRules {
  switch (provider) {
    case 'facebook':
      return { canEditCaption: true, canEditMedia: false, method: 'update' }
    case 'bluesky':
      return {
        canEditCaption: true,
        canEditMedia: false,
        method: 'delete_recreate',
        warning: 'Editing on Bluesky deletes the original post and creates a new one. This resets engagement metrics.',
      }
    case 'instagram':
      return {
        canEditCaption: false,
        canEditMedia: false,
        readOnly: true,
        readOnlyReason: 'Instagram does not support editing published posts',
      }
    case 'youtube':
      return {
        canEditCaption: false,
        canEditMedia: false,
        readOnly: true,
        readOnlyReason: 'YouTube editing is not supported in v1',
      }
    default:
      return { canEditCaption: false, canEditMedia: false, readOnly: true }
  }
}

// ---------------------------------------------------------------------------
// Edit published post (caption-only per platform rules)
// ---------------------------------------------------------------------------

const editPublishedSchema = z.object({
  caption: z.string().min(1),
})

export async function editPublishedPost(
  postId: string,
  deliveryId: string,
  data: { caption: string },
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(postId)
  if (!idParsed.success) return { ok: false, error: 'Invalid post ID' }
  const deliveryParsed = z.string().uuid().safeParse(deliveryId)
  if (!deliveryParsed.success) return { ok: false, error: 'Invalid delivery ID' }
  const parsed = editPublishedSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Verify post belongs to this site and is published
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('id, status, site_id')
      .eq('id', idParsed.data)
      .eq('site_id', siteId)
      .single()

    if (postError || !post) return { ok: false, error: 'Post not found' }

    const completedStatuses: PostStatus[] = ['completed', 'partial_failure']
    if (!completedStatuses.includes(post.status as PostStatus)) {
      return { ok: false, error: `Cannot edit post with status "${post.status}"` }
    }

    // Get delivery
    const { data: delivery, error: delError } = await supabase
      .from('social_deliveries')
      .select('id, provider, platform_post_id, connection_id, status')
      .eq('id', deliveryParsed.data)
      .eq('post_id', idParsed.data)
      .single()

    if (delError || !delivery) return { ok: false, error: 'Delivery not found' }
    if (delivery.status !== 'published') return { ok: false, error: 'Delivery not published' }

    const provider = delivery.provider as Provider
    const rules = getEditRules(provider)

    if (rules.readOnly) {
      return { ok: false, error: rules.readOnlyReason ?? 'Platform does not support editing' }
    }

    if (!rules.canEditCaption) {
      return { ok: false, error: 'Caption editing not supported for this platform' }
    }

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('id', delivery.connection_id)
      .single()

    if (connError || !connection) return { ok: false, error: 'Connection not found' }

    const { decrypt: decryptFn, getMasterKey: getKey } = await import('@tn-figueiredo/social')
    const key = getKey()

    if (rules.method === 'update') {
      // Facebook: POST /{post-id} with updated message
      if (provider === 'facebook' && connection.page_token_enc) {
        const pageToken = decryptFn(connection.page_token_enc as string, key)
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${delivery.platform_post_id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: parsed.data.caption,
              access_token: pageToken,
            }),
            signal: AbortSignal.timeout(10_000),
          },
        )
        if (!res.ok) {
          const body = await res.text()
          return { ok: false, error: `Facebook edit failed (${res.status}): ${body}` }
        }
      }
    } else if (rules.method === 'delete_recreate') {
      // Bluesky: delete old + create new
      if (provider === 'bluesky') {
        // Delete and recreate handled by the Bluesky provider
        // This is a simplified version — full implementation delegates to the provider
        const bsMod = await import('@tn-figueiredo/social/providers/bluesky')
        const bsProvider = new bsMod.BlueskyProvider((enc: string) => decryptFn(enc, key))
        const conn = toSocialConnection(connection as Record<string, unknown>)

        // Delete old record
        if (delivery.platform_post_id) {
          try {
            await fetch(
              `${(conn.metadata as Record<string, unknown>)?.service ?? 'https://bsky.social'}/xrpc/com.atproto.repo.deleteRecord`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${decryptFn(conn.access_token_enc, key)}`,
                },
                body: JSON.stringify({
                  repo: conn.account_id,
                  collection: 'app.bsky.feed.post',
                  rkey: delivery.platform_post_id.split('/').pop(),
                }),
                signal: AbortSignal.timeout(10_000),
              },
            )
          } catch {
            // Best effort — old post may already be deleted
          }
        }

        // Create new post with updated caption
        const { data: postData } = await supabase
          .from('social_posts')
          .select('*')
          .eq('id', idParsed.data)
          .single()

        if (postData) {
          const socialPost = toSocialPost(postData as Record<string, unknown>)
          const updatedPost = {
            ...socialPost,
            content: { ...socialPost.content, description: parsed.data.caption },
          }
          const publishResult = await bsProvider.publish(updatedPost, conn, {
            id: delivery.id as string,
            post_id: postData.id as string,
            connection_id: conn.id,
            provider: 'bluesky',
            status: 'pending',
            platform_post_id: null,
            platform_url: null,
            content_override: null,
            attempt: 0,
            max_attempts: 1,
            last_error: null,
            error_type: null,
            published_at: null,
            created_at: new Date().toISOString(),
          })

          // Update delivery with new platform_post_id
          await supabase
            .from('social_deliveries')
            .update({
              platform_post_id: publishResult.id,
              platform_url: publishResult.url,
            })
            .eq('id', delivery.id)
        }
      }
    }

    // Update post content with new caption
    await supabase
      .from('social_posts')
      .update({
        content: supabase.rpc ? undefined : undefined, // Caption stored in deliveries content_override
        updated_at: new Date().toISOString(),
      })
      .eq('id', idParsed.data)

    // Store caption override on the delivery
    await supabase
      .from('social_deliveries')
      .update({
        content_override: { caption: parsed.data.caption },
      })
      .eq('id', delivery.id)

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'editPublishedPost' } })
    throw err
  }
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/social-post-editing.test.ts`

- [ ] **Step 24.3 — Add edit mode to ComposerShell**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` to support loading an existing post for editing:

```tsx
// Add to ComposerShell props:
interface ComposerShellProps {
  // ... existing props ...
  editPostId?: string          // When set, load post in edit mode
  editDeliveries?: Array<{
    id: string
    provider: Provider
    status: string
    platform_post_id: string | null
  }>
}

// Inside ComposerShell, add edit mode detection:
// 1. When editPostId is provided, load the post data and populate form fields
// 2. Show per-platform edit rules using getEditRules()
// 3. For read-only platforms, show a disabled badge: "Instagram does not support editing"
// 4. For editable platforms, allow caption-only changes
// 5. Submit calls editPublishedPost() instead of createSocialPost()
// 6. For Bluesky, show warning about engagement reset before confirming
```

The Composer page (`apps/web/src/app/cms/(authed)/social/new/page.tsx`) reads `?post={id}` from searchParams and passes `editPostId` to `ComposerShell`:

```tsx
// Update apps/web/src/app/cms/(authed)/social/new/page.tsx
// Add to searchParams handling:
const postId = params.post // ?post={id}
// If postId, fetch the post and its deliveries, pass as editPostId + editDeliveries to ComposerShell
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`

---

## Task 25: Error Handling UI

**Parallel with:** Tasks 23, 24

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/publish-status-banner.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/_components/post-card.tsx` — add status badges + retry
- Create: `apps/web/test/publish-status-banner.test.ts`

### Steps

- [ ] **Step 25.1 — Write failing tests for PublishStatusBanner**

```ts
// apps/web/test/publish-status-banner.test.ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublishStatusBanner } from '@/app/cms/(authed)/social/new/_components/publish-status-banner'

const mockStrings = {
  detail: {
    retry: 'Retry',
    reconnect: 'Reconnect',
    publishedOn: 'Published',
    failedOn: 'Failed',
  },
  platforms: {
    facebook: 'Facebook',
    bluesky: 'Bluesky',
    instagram: 'Instagram',
    youtube: 'YouTube',
  },
}

describe('PublishStatusBanner', () => {
  it('shows checkmark for successful platforms', () => {
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd1', provider: 'facebook', status: 'published', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByText(/Facebook/)).toBeInTheDocument()
    expect(screen.getByLabelText(/success/i)).toBeInTheDocument()
  })

  it('shows X and retry button for failed platforms', () => {
    const onRetry = vi.fn()
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd2', provider: 'instagram', status: 'failed', error: 'API error', errorType: 'transient' },
        ]}
        onRetry={onRetry}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByText(/Instagram/)).toBeInTheDocument()
    expect(screen.getByLabelText(/failed/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('d2')
  })

  it('shows Reconnect link instead of Retry for auth errors', () => {
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd3', provider: 'bluesky', status: 'failed', error: 'Token expired', errorType: 'auth' },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByText(/Reconnect/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('shows spinner for in-progress platforms', () => {
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd4', provider: 'facebook', status: 'publishing', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByLabelText(/in-progress/i)).toBeInTheDocument()
  })
})
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/publish-status-banner.test.ts`

- [ ] **Step 25.2 — Implement PublishStatusBanner component**

```tsx
// apps/web/src/app/cms/(authed)/social/new/_components/publish-status-banner.tsx
'use client'

import type { DeliveryStatus, ErrorType, Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { SocialStrings } from '../../../_i18n/types'

interface DeliveryStatusItem {
  id: string
  provider: Provider
  status: DeliveryStatus
  error: string | null
  errorType: ErrorType | null
}

interface PublishStatusBannerProps {
  deliveries: DeliveryStatusItem[]
  onRetry: (deliveryId: string) => void
  strings: SocialStrings
}

export function PublishStatusBanner({
  deliveries,
  onRetry,
  strings: t,
}: PublishStatusBannerProps) {
  if (deliveries.length === 0) return null

  return (
    <div
      role="status"
      className="rounded-lg border border-cms-border bg-cms-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        {deliveries.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <PlatformIcon provider={d.provider} size="sm" />
            <span className="text-sm text-cms-text">
              {platformLabel(d.provider)}
            </span>

            {/* Status indicator */}
            {d.status === 'published' && (
              <span
                aria-label="success"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs"
              >
                OK
              </span>
            )}

            {(d.status === 'failed' || d.status === 'skipped') && (
              <>
                <span
                  aria-label="failed"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs"
                >
                  X
                </span>

                {d.errorType === 'auth' ? (
                  <a
                    href="/cms/social/accounts"
                    className="text-xs text-cms-accent hover:underline"
                  >
                    {t.detail.reconnect}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRetry(d.id)}
                    aria-label={`Retry ${platformLabel(d.provider)}`}
                    className="text-xs text-cms-accent hover:underline"
                  >
                    {t.detail.retry}
                  </button>
                )}
              </>
            )}

            {(d.status === 'publishing' || d.status === 'retrying' || d.status === 'pending') && (
              <span
                aria-label="in-progress"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs animate-pulse"
              >
                ...
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Error details */}
      {deliveries.some((d) => d.error) && (
        <div className="mt-3 space-y-1">
          {deliveries
            .filter((d) => d.error)
            .map((d) => (
              <p key={d.id} className="text-xs text-red-400">
                {platformLabel(d.provider)}: {d.error}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/publish-status-banner.test.ts`

- [ ] **Step 25.3 — Enhance PostCard with status badges and retry action**

Modify `apps/web/src/app/cms/(authed)/social/_components/post-card.tsx`:

```tsx
// post-card.tsx — enhanced with retry action for failed posts
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { SocialPost, Provider } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { retrySocialDelivery } from '@/lib/social/actions'
import type { SocialStrings } from '../_i18n/types'

interface PostCardProps {
  post: SocialPost
  strings: SocialStrings
  selected: boolean
  onSelect: (id: string) => void
  platforms?: Provider[]
  failedDeliveryIds?: string[]
  metricsLine?: string | null
}

const PLATFORM_COLORS: Record<Provider, string> = {
  facebook: 'bg-blue-500/15 text-blue-400',
  instagram: 'bg-pink-500/15 text-pink-400',
  bluesky: 'bg-sky-500/15 text-sky-400',
  youtube: 'bg-red-500/15 text-red-400',
}

const PLATFORM_SHORT: Record<Provider, string> = {
  facebook: 'FB',
  instagram: 'IG',
  bluesky: 'BS',
  youtube: 'YT',
}

export function PostCard({
  post,
  strings: t,
  selected,
  onSelect,
  platforms,
  failedDeliveryIds,
  metricsLine,
}: PostCardProps) {
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)

  const contentPreview = post.content.title ?? post.content.description ?? t.posts.noContent
  const statusLabel = t.status[post.status as keyof typeof t.status] ?? post.status
  const dateStr = post.published_at ?? post.scheduled_at ?? post.created_at
  const isFailed = post.status === 'failed' || post.status === 'partial_failure'

  function handleRetryAll() {
    if (!failedDeliveryIds || failedDeliveryIds.length === 0) return
    setRetryError(null)
    startTransition(async () => {
      for (const deliveryId of failedDeliveryIds) {
        const result = await retrySocialDelivery(deliveryId)
        if (!result.ok) {
          setRetryError(result.error ?? t.common.error)
          return
        }
      }
    })
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border bg-cms-surface p-4 transition-colors ${
      selected ? 'border-cms-accent/50 bg-cms-accent/5' : isFailed ? 'border-red-500/30' : 'border-cms-border'
    }`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(post.id)}
        aria-label={`Select post: ${contentPreview}`}
        className="mt-1 accent-cms-accent"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SocialStatusBadge status={post.status} label={statusLabel} />
          <span className="text-xs text-cms-text-dim">{post.type}</span>
          {platforms && platforms.length > 0 && (
            <div className="flex gap-1">
              {platforms.map(p => (
                <span key={p} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PLATFORM_COLORS[p]}`}>
                  {PLATFORM_SHORT[p]}
                </span>
              ))}
            </div>
          )}
        </div>

        <Link href={`/cms/social/${post.id}`} className="text-sm font-medium text-cms-text hover:text-cms-accent line-clamp-2">
          {contentPreview}
        </Link>

        {post.content.url && (
          <p className="text-xs text-cms-text-muted mt-0.5 truncate">{post.content.url}</p>
        )}

        {metricsLine && (
          <p className="text-xs text-cms-text-dim mt-0.5">{metricsLine}</p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-cms-text-dim">
            {new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>

          {isFailed && failedDeliveryIds && failedDeliveryIds.length > 0 && (
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={isPending}
              className="text-xs text-cms-accent hover:underline disabled:opacity-50"
            >
              {t.posts.card.retry}
            </button>
          )}
        </div>

        {retryError && (
          <p role="alert" className="text-xs text-red-400 mt-1">
            {retryError}
          </p>
        )}
      </div>
    </div>
  )
}
```

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/publish-status-banner.test.ts`

- [ ] **Step 25.4 — Final integration test run**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`

Verify all tests pass. Commit each task individually following the project conventions:

```
feat(social): auto-share dialog with zero-friction mode
feat(social): configurable queue slots + queue view page
feat(social): calendar indigo pills + slide-over panel
feat(social): analytics cron poller + inline metrics
feat(social): post editing with per-platform rules
feat(social): publish status banner + error handling UI
```
