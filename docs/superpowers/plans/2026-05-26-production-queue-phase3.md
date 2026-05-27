# Production Queue Phase 3 — Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pinned queue for daily focus items, deadline notification digest emails, sidebar badge integration, mobile tab layout, and week grid conditional collapse.

**Architecture:** New `working_today` DB table with RLS + RPCs for pin/unpin, daily cron email digest via SES with `sent_emails` dedup, extend sidebar badge system with pipeline urgency, add responsive tab navigation for mobile, and auto-collapse week grid based on buffer health.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Vitest, Supabase, @tn-figueiredo/email (SES), React Email

**Depends on:** Phase 1 (urgency formula, buffer depth) + Phase 2 (WIP limits, velocity)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/TIMESTAMP_working_today_pinned_queue.sql` | working_today table + RLS + pin/unpin RPCs |
| `supabase/migrations/TIMESTAMP_pipeline_digest_dedup_index.sql` | Partial unique index on sent_emails for digest dedup |
| `apps/web/src/app/cms/(authed)/pipeline/working-today-actions.ts` | Server actions for pin/unpin/get pins |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pinned-queue.tsx` | Pinned queue UI component |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-tabs.tsx` | Mobile tab layout component |
| `apps/web/src/emails/pipeline-deadline-digest.tsx` | Deadline notification email template |
| `apps/web/src/app/api/cron/pipeline-deadline-digest/route.ts` | Daily cron endpoint for digest emails |
| `apps/web/test/cms/working-today-actions.test.ts` | Tests for pin/unpin server actions |
| `apps/web/test/cms/pinned-queue.test.tsx` | Tests for pinned queue UI component |
| `apps/web/test/cms/pipeline-tabs.test.tsx` | Tests for mobile tab layout |
| `apps/web/test/cms/pipeline-deadline-digest.test.ts` | Tests for cron endpoint logic |
| `apps/web/test/cms/pipeline-deadline-email.test.tsx` | Tests for email template render |
| `apps/web/test/cms/sidebar-badges-pipeline.test.ts` | Tests for pipeline badge data fetching |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/lib/cms/sidebar-badges.ts` | Add `pipeline` field to `SidebarBadgeData`, add pipeline deadline query |
| `apps/web/src/components/cms/sidebar-badges.tsx` | Add `BadgePortal` for `/cms/pipeline` with urgency tooltip |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` | Add PinnedQueue section, wrap sections in PipelineTabs on mobile, add grid collapse |
| `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx` | Add collapsible wrapper with auto-collapse logic |
| `apps/web/src/lib/pipeline/up-next-types.ts` | Add `WorkingTodayPin` type, extend `UpNextApiResponse` with `pins` field |
| `apps/web/src/lib/pipeline/up-next-fetcher.ts` | Add pins query to parallel fetch |
| `apps/web/src/app/api/pipeline/up-next/route.ts` | Pass pins through API response |
| `apps/web/test/cms/sidebar-badges.test.ts` | Add pipeline badge tests |
| `apps/web/test/cms/sidebar-badges-component.test.tsx` | Add pipeline portal tests |
| `apps/web/test/cms/pipeline-overview.test.tsx` | Add pinned queue mock + tab mock |

---

## Task 1: working_today Migration

**Files:**
- Create: `supabase/migrations/TIMESTAMP_working_today_pinned_queue.sql` (via `npm run db:new`)

- [ ] **Step 1: Generate migration file**

Run: `npm run db:new working_today_pinned_queue`

This creates a timestamped file in `supabase/migrations/`.

- [ ] **Step 2: Write migration SQL**

Open the generated file and write:

```sql
-- =============================================================================
-- MIGRATION: working_today pinned queue table + RLS + RPCs
-- =============================================================================

-- Table: daily pinned queue (user-scoped focus items)
CREATE TABLE IF NOT EXISTS public.working_today (
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_item_id uuid        NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  pinned_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pipeline_item_id)
);

-- Index for fast user-scoped lookups
CREATE INDEX IF NOT EXISTS idx_working_today_user
  ON public.working_today(user_id);

-- RLS
ALTER TABLE public.working_today ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS working_today_select_own ON public.working_today;
CREATE POLICY working_today_select_own ON public.working_today
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS working_today_insert_own ON public.working_today;
CREATE POLICY working_today_insert_own ON public.working_today
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_staff());

DROP POLICY IF EXISTS working_today_delete_own ON public.working_today;
CREATE POLICY working_today_delete_own ON public.working_today
  FOR DELETE USING (user_id = auth.uid());

-- RPC: pin_working_today
-- Purges stale pins (>24h old), checks cap, idempotent insert
DROP FUNCTION IF EXISTS pin_working_today(uuid, integer);
CREATE OR REPLACE FUNCTION pin_working_today(
  p_item_id uuid,
  p_max     integer DEFAULT 3
)
RETURNS json AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Purge stale pins (older than 24 hours)
  DELETE FROM public.working_today
  WHERE user_id = v_uid
    AND pinned_at < now() - interval '24 hours';

  -- Check if already pinned (idempotent)
  IF EXISTS (
    SELECT 1 FROM public.working_today
    WHERE user_id = v_uid AND pipeline_item_id = p_item_id
  ) THEN
    RETURN json_build_object('status', 'already_pinned');
  END IF;

  -- Check cap
  SELECT count(*) INTO v_count
  FROM public.working_today
  WHERE user_id = v_uid;

  IF v_count >= p_max THEN
    RETURN json_build_object('status', 'cap_reached', 'current', v_count, 'max', p_max);
  END IF;

  -- Insert
  INSERT INTO public.working_today (user_id, pipeline_item_id)
  VALUES (v_uid, p_item_id);

  RETURN json_build_object('status', 'pinned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

-- RPC: unpin_working_today
DROP FUNCTION IF EXISTS unpin_working_today(uuid);
CREATE OR REPLACE FUNCTION unpin_working_today(
  p_item_id uuid
)
RETURNS json AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  DELETE FROM public.working_today
  WHERE user_id = v_uid AND pipeline_item_id = p_item_id;

  RETURN json_build_object('status', 'unpinned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';
```

- [ ] **Step 3: Verify migration applies cleanly**

Run: `npm run db:push:prod` (when ready for production) or test locally with `npm run db:reset`.

Commit: `feat(pipeline): add working_today table with RLS and pin/unpin RPCs`

---

## Task 2: Pin/Unpin Server Actions

**Files:**
- Create: `apps/web/test/cms/working-today-actions.test.ts`
- Create: `apps/web/src/app/cms/(authed)/pipeline/working-today-actions.ts`

- [ ] **Step 1: Write tests first**

Create `apps/web/test/cms/working-today-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// Mock requireSiteScope
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

// Mock getSiteContext
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

// Mock revalidateTag
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

// Mock supabase service client
const mockRpc = vi.fn()
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

import { pinWorkingToday, unpinWorkingToday, getWorkingTodayPins } from
  '../../src/app/cms/(authed)/pipeline/working-today-actions'

describe('pinWorkingToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls pin_working_today RPC with item id', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'pinned' }, error: null })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: true, data: { status: 'pinned' } })
    expect(mockRpc).toHaveBeenCalledWith('pin_working_today', { p_item_id: 'item-1', p_max: 3 })
  })

  it('returns ok:true when already pinned (idempotent)', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'already_pinned' }, error: null })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: true, data: { status: 'already_pinned' } })
  })

  it('returns ok:false when cap reached', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'cap_reached', current: 3, max: 3 }, error: null })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: false, error: 'Pin limit reached (3/3)' })
  })

  it('returns ok:false on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission_denied' } })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: false, error: 'permission_denied' })
  })
})

describe('unpinWorkingToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls unpin_working_today RPC with item id', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'unpinned' }, error: null })
    const result = await unpinWorkingToday('item-1')
    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith('unpin_working_today', { p_item_id: 'item-1' })
  })

  it('returns ok:false on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_found' } })
    const result = await unpinWorkingToday('item-1')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('getWorkingTodayPins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns pinned items joined with pipeline data', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              pipeline_item_id: 'item-1',
              pinned_at: '2026-05-26T10:00:00Z',
              content_pipeline: {
                id: 'item-1',
                title_pt: 'Video 1',
                stage: 'roteiro',
                format: 'video',
                priority: 4,
              },
            },
          ],
          error: null,
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: selectMock })

    const result = await getWorkingTodayPins()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      itemId: 'item-1',
      title: 'Video 1',
      stage: 'roteiro',
      format: 'video',
    })
  })

  it('returns empty array when no pins', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })
    mockFrom.mockReturnValue({ select: selectMock })

    const result = await getWorkingTodayPins()
    expect(result).toEqual([])
  })
})
```

Run: `npm run test:web -- --run apps/web/test/cms/working-today-actions.test.ts`

Expect: All tests fail (module not found).

- [ ] **Step 2: Implement server actions**

Create `apps/web/src/app/cms/(authed)/pipeline/working-today-actions.ts`:

```typescript
'use server'

import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string }

export interface WorkingTodayPin {
  itemId: string
  title: string
  stage: string
  format: string
  priority: number
  pinnedAt: string
}

async function requireEditAccess() {
  const { siteId, timezone } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, timezone }
}

export async function pinWorkingToday(itemId: string): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase.rpc('pin_working_today', {
    p_item_id: itemId,
    p_max: 3,
  })

  if (error) return { ok: false, error: error.message }

  const result = data as { status: string; current?: number; max?: number }
  if (result.status === 'cap_reached') {
    return { ok: false, error: `Pin limit reached (${result.current}/${result.max})` }
  }

  revalidateTag('working-today')
  return { ok: true, data: result }
}

export async function unpinWorkingToday(itemId: string): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase.rpc('unpin_working_today', {
    p_item_id: itemId,
  })

  if (error) return { ok: false, error: error.message }

  revalidateTag('working-today')
  return { ok: true }
}

export async function getWorkingTodayPins(): Promise<WorkingTodayPin[]> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('working_today')
    .select(`
      pipeline_item_id,
      pinned_at,
      content_pipeline(id, title_pt, title_en, stage, format, priority)
    `)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .order('pinned_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: Record<string, unknown>) => {
    const item = row.content_pipeline as Record<string, unknown>
    return {
      itemId: item.id as string,
      title: (item.title_pt as string || item.title_en as string) ?? 'Untitled',
      stage: item.stage as string,
      format: item.format as string,
      priority: (item.priority as number) ?? 0,
      pinnedAt: row.pinned_at as string,
    }
  })
}
```

- [ ] **Step 3: Run tests and verify**

Run: `npm run test:web -- --run apps/web/test/cms/working-today-actions.test.ts`

Expect: All tests pass.

Commit: `feat(pipeline): add pin/unpin server actions for working_today`

---

## Task 3: Pinned Queue UI Component

**Files:**
- Create: `apps/web/test/cms/pinned-queue.test.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pinned-queue.tsx`

- [ ] **Step 1: Write tests first**

Create `apps/web/test/cms/pinned-queue.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
  getPriorityConfig: vi.fn(() => ({
    accent: '#6366f1', accentDim: 'rgba(99,102,241,0.1)',
    accentBorder: 'rgba(99,102,241,0.3)', label: 'P3', className: 'priority-3',
  })),
  getFormatIcon: vi.fn(() => ({ icon: '🎬', bgClass: 'bg-red-500/10', label: 'Video' })),
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-accent)', text: 'var(--gem-muted)', border: 'var(--gem-border)' },
    blog_post: { accent: '#f59e0b', text: '#92400e', border: '#f59e0b' },
    newsletter: { accent: '#818cf8', text: '#4338ca', border: '#818cf8' },
  },
}))

import type { WorkingTodayPin } from '../../src/app/cms/(authed)/pipeline/working-today-actions'

// Import after mocks
const { PinnedQueue } = await import(
  '../../src/app/cms/(authed)/pipeline/_components/pinned-queue'
)

const PIN: WorkingTodayPin = {
  itemId: 'item-1',
  title: 'Como gravar vlog',
  stage: 'roteiro',
  format: 'video',
  priority: 4,
  pinnedAt: '2026-05-26T10:00:00Z',
}

describe('PinnedQueue', () => {
  it('renders nothing when pins is empty and showGhosts is false', () => {
    const { container } = render(
      <PinnedQueue pins={[]} onUnpin={vi.fn()} showGhosts={false} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders pinned items with title and stage', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    expect(screen.getByText('Como gravar vlog')).toBeTruthy()
    expect(screen.getByText(/roteiro/i)).toBeTruthy()
  })

  it('renders section heading', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy()
  })

  it('calls onUnpin when unpin button is clicked', () => {
    const onUnpin = vi.fn()
    render(<PinnedQueue pins={[PIN]} onUnpin={onUnpin} showGhosts={false} />)
    const unpinBtn = screen.getByRole('button', { name: /desafixar/i })
    fireEvent.click(unpinBtn)
    expect(onUnpin).toHaveBeenCalledWith('item-1')
  })

  it('renders ghost suggestion cards when showGhosts is true and pins < 3', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={true} />)
    const ghosts = screen.getAllByTestId('ghost-suggestion')
    expect(ghosts.length).toBe(2)
  })

  it('does not render ghosts when pins equals cap', () => {
    const pins = [
      PIN,
      { ...PIN, itemId: 'item-2', title: 'Item 2' },
      { ...PIN, itemId: 'item-3', title: 'Item 3' },
    ]
    render(<PinnedQueue pins={pins} onUnpin={vi.fn()} showGhosts={true} />)
    expect(screen.queryByTestId('ghost-suggestion')).toBeNull()
  })

  it('renders item link pointing to detail page', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    const link = screen.getByRole('link', { name: /Como gravar vlog/i })
    expect(link.getAttribute('href')).toBe('/cms/pipeline/items/item-1')
  })

  it('has accessible section label', () => {
    render(<PinnedQueue pins={[PIN]} onUnpin={vi.fn()} showGhosts={false} />)
    const section = screen.getByRole('region', { name: /foco/i })
    expect(section).toBeTruthy()
  })
})
```

Run: `npm run test:web -- --run apps/web/test/cms/pinned-queue.test.tsx`

Expect: All tests fail (module not found).

- [ ] **Step 2: Implement PinnedQueue component**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/pinned-queue.tsx`:

```typescript
'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Pin, X } from 'lucide-react'
import { gemMix } from '@/lib/pipeline/gem-design'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import type { WorkingTodayPin } from '../working-today-actions'

const MAX_PINS = 3

const STAGE_SHORT: Record<string, string> = {
  idea: 'ideia', outline: 'roteiro', draft: 'rascunho', roteiro: 'roteiro',
  gravacao: 'gravacao', edicao: 'edicao', pos_producao: 'pos',
  ready: 'pronto', scheduled: 'agendado',
}

interface PinnedQueueProps {
  pins: WorkingTodayPin[]
  onUnpin: (itemId: string) => void
  showGhosts: boolean
}

export const PinnedQueue = memo(function PinnedQueue({ pins, onUnpin, showGhosts }: PinnedQueueProps) {
  if (pins.length === 0 && !showGhosts) return null

  const ghostCount = showGhosts ? Math.max(0, MAX_PINS - pins.length) : 0

  return (
    <section aria-label="Foco de hoje" role="region">
      <h3
        className="flex items-center gap-1.5 text-xs font-semibold mb-2"
        style={{ color: 'var(--gem-muted)' }}
      >
        <Pin size={12} aria-hidden="true" />
        Foco de hoje
        <span className="text-[10px] font-normal" style={{ color: 'var(--gem-dim)' }}>
          ({pins.length}/{MAX_PINS})
        </span>
      </h3>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {pins.map((pin) => {
          const colors = FORMAT_COLORS[pin.format] ?? {
            accent: 'var(--gem-accent)',
            text: 'var(--gem-muted)',
            border: 'var(--gem-border)',
          }

          return (
            <li key={pin.itemId} className="relative group">
              <Link
                href={`/cms/pipeline/items/${pin.itemId}`}
                className="flex items-stretch gap-2 rounded-lg border p-2.5 cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{
                  background: 'var(--gem-surface)',
                  borderColor: 'var(--gem-border)',
                }}
                aria-label={`${pin.title}. ${STAGE_SHORT[pin.stage] ?? pin.stage}.`}
              >
                <div
                  className="w-[3px] shrink-0 rounded-full"
                  style={{ background: colors.accent }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: 'var(--gem-text)' }}
                  >
                    {pin.title}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: 'var(--gem-dim)' }}
                  >
                    {STAGE_SHORT[pin.stage] ?? pin.stage}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onUnpin(pin.itemId)}
                className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{ color: 'var(--gem-dim)' }}
                aria-label={`Desafixar ${pin.title}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          )
        })}

        {Array.from({ length: ghostCount }).map((_, i) => (
          <li
            key={`ghost-${i}`}
            data-testid="ghost-suggestion"
            className="flex items-center justify-center rounded-lg border border-dashed p-4"
            style={{
              borderColor: gemMix('--gem-border', 40),
              background: gemMix('--gem-surface', 30),
            }}
          >
            <span
              className="text-[10px]"
              style={{ color: gemMix('--gem-dim', 50) }}
            >
              Fixe um item da fila
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
})
```

- [ ] **Step 3: Run tests and verify**

Run: `npm run test:web -- --run apps/web/test/cms/pinned-queue.test.tsx`

Expect: All tests pass.

Commit: `feat(pipeline): add PinnedQueue component with ghost suggestions`

---

## Task 4: Extend UpNextApiResponse + Integrate Pinned Queue

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts`
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`
- Modify: `apps/web/test/cms/pipeline-overview.test.tsx`

- [ ] **Step 1: Add WorkingTodayPin to up-next-types.ts**

In `apps/web/src/lib/pipeline/up-next-types.ts`, add:

```typescript
export interface WorkingTodayPinRow {
  itemId: string
  title: string
  stage: Stage
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  priority: number
  pinnedAt: string
}
```

And extend `UpNextApiResponse`:

```typescript
export interface UpNextApiResponse {
  // ... existing fields ...
  pins: WorkingTodayPinRow[]
}
```

- [ ] **Step 2: Fetch pins in up-next-fetcher.ts**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`, add a pins query to the parallel `Promise.all` block. The service client bypasses RLS, so filter by a GUC or pass the user:

Since the up-next API is called with site auth (not user auth), and pins are per-user, we need to handle this differently. The pins will be fetched client-side or from page.tsx server component (which has user context). Add a `pins` field defaulting to `[]` in the fetcher response:

```typescript
// At the end of fetchUpNextData, before the return:
// Pins are user-scoped — fetched separately by page.tsx/client, not here
const pins: WorkingTodayPinRow[] = []
```

And include `pins` in the returned object.

- [ ] **Step 3: Update pipeline-overview.tsx to accept and render PinnedQueue**

Add `PinnedQueue` import and render it between the progress bar and TodayActionCards:

```typescript
import { PinnedQueue } from './pinned-queue'
import type { WorkingTodayPin } from '../working-today-actions'
```

Add `pins` and `onUnpin` to `PipelineOverviewProps`:

```typescript
interface PipelineOverviewProps {
  fallbackData: UpNextApiResponse
  celebration: { items: CelebrationItem[] }
  activity: ActivityEntry[]
  pins: WorkingTodayPin[]
  onUnpin: (itemId: string) => void
}
```

Insert PinnedQueue after the progress bar section, before TodayActionCards:

```tsx
{pins.length > 0 || upNext.today.actions.length > 0 ? (
  <SectionErrorBoundary>
    <PinnedQueue
      pins={pins}
      onUnpin={onUnpin}
      showGhosts={upNext.today.actions.length > 0}
    />
  </SectionErrorBoundary>
) : null}
```

- [ ] **Step 4: Update pipeline-overview.test.tsx mocks**

Add mock for PinnedQueue:

```typescript
vi.mock('../../src/app/cms/(authed)/pipeline/_components/pinned-queue', () => ({
  PinnedQueue: ({ pins }: { pins: unknown[] }) => (
    <div data-testid="pinned-queue" data-count={pins.length} />
  ),
}))
```

Update `defaultProps` to include `pins: []` and `onUnpin: vi.fn()`.

- [ ] **Step 5: Run all affected tests**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-overview.test.tsx`

Expect: All tests pass with updated mocks.

Commit: `feat(pipeline): integrate PinnedQueue into pipeline overview`

---

## Task 5: Deadline Notification Email Template

**Files:**
- Create: `apps/web/test/cms/pipeline-deadline-email.test.tsx`
- Create: `apps/web/src/emails/pipeline-deadline-digest.tsx`

- [ ] **Step 1: Write tests first**

Create `apps/web/test/cms/pipeline-deadline-email.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { PipelineDeadlineDigest, type DeadlineItem } from '../../src/emails/pipeline-deadline-digest'

const OVERDUE: DeadlineItem = {
  title: 'Video atrasado',
  stage: 'roteiro',
  format: 'video',
  deadlineDate: '2026-05-24',
  pubDate: '2026-05-28',
  daysUntilDeadline: -2,
}

const DUE_TOMORROW: DeadlineItem = {
  title: 'Blog post amanha',
  stage: 'draft',
  format: 'blog_post',
  deadlineDate: '2026-05-27',
  pubDate: '2026-05-31',
  daysUntilDeadline: 1,
}

const DUE_IN_3: DeadlineItem = {
  title: 'Newsletter em breve',
  stage: 'draft',
  format: 'newsletter',
  deadlineDate: '2026-05-29',
  pubDate: '2026-06-02',
  daysUntilDeadline: 3,
}

describe('PipelineDeadlineDigest', () => {
  it('renders overdue section when overdue items exist', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[OVERDUE]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Video atrasado')
    expect(html).toContain('Atrasado')
  })

  it('renders due-tomorrow section', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[DUE_TOMORROW]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Blog post amanha')
  })

  it('renders upcoming section for items due in 3 days', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[DUE_IN_3]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Newsletter em breve')
  })

  it('renders all three sections together', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[OVERDUE, DUE_TOMORROW, DUE_IN_3]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Video atrasado')
    expect(html).toContain('Blog post amanha')
    expect(html).toContain('Newsletter em breve')
  })

  it('renders English copy when locale is en', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="en"
        items={[OVERDUE]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Overdue')
  })

  it('includes dashboard link', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[OVERDUE]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('https://bythiagofigueiredo.com/cms/pipeline')
  })
})
```

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-deadline-email.test.tsx`

Expect: All tests fail (module not found).

- [ ] **Step 2: Implement email template**

Create `apps/web/src/emails/pipeline-deadline-digest.tsx`:

```tsx
import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailButton } from './components/email-button'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EmailFooter } from './components/email-footer'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

export interface DeadlineItem {
  title: string
  stage: string
  format: string
  deadlineDate: string
  pubDate: string
  daysUntilDeadline: number
}

const COPY = {
  'pt-BR': {
    preheader: 'Itens do pipeline com prazo se aproximando',
    heading: 'Pipeline: Prazos',
    overdueLabel: 'Atrasado',
    tomorrowLabel: 'Amanha',
    upcomingLabel: 'Proximos 3 dias',
    overdueHeading: 'Atrasados',
    tomorrowHeading: 'Amanha',
    upcomingHeading: 'Em breve',
    button: 'Abrir Pipeline',
    footer: 'Este email e enviado automaticamente quando voce tem prazos se aproximando.',
    pubPrefix: 'pub:',
    stagePrefix: 'etapa:',
  },
  en: {
    preheader: 'Pipeline items with approaching deadlines',
    heading: 'Pipeline: Deadlines',
    overdueLabel: 'Overdue',
    tomorrowLabel: 'Tomorrow',
    upcomingLabel: 'Next 3 days',
    overdueHeading: 'Overdue',
    tomorrowHeading: 'Tomorrow',
    upcomingHeading: 'Coming up',
    button: 'Open Pipeline',
    footer: 'This email is sent automatically when you have approaching deadlines.',
    pubPrefix: 'pub:',
    stagePrefix: 'stage:',
  },
} as const

const URGENCY_COLORS = {
  overdue: '#ef4444',
  tomorrow: '#f59e0b',
  upcoming: '#6366f1',
}

interface PipelineDeadlineDigestProps {
  locale: string
  items: DeadlineItem[]
  dashboardUrl: string
}

function bucketItems(items: DeadlineItem[]) {
  const overdue: DeadlineItem[] = []
  const tomorrow: DeadlineItem[] = []
  const upcoming: DeadlineItem[] = []

  for (const item of items) {
    if (item.daysUntilDeadline < 0) overdue.push(item)
    else if (item.daysUntilDeadline <= 1) tomorrow.push(item)
    else upcoming.push(item)
  }

  return { overdue, tomorrow, upcoming }
}

function ItemRow({ item, label, color }: { item: DeadlineItem; label: string; color: string }) {
  return (
    <Section style={{
      borderLeft: `3px solid ${color}`,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      margin: '0 0 8px',
    }}>
      <Text className="email-ink" style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 15,
        fontWeight: 500,
        color: EMAIL_COLORS.ink,
        margin: 0,
        lineHeight: '1.3',
      }}>
        {item.title}
      </Text>
      <Text className="email-muted" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 12,
        color: EMAIL_COLORS.muted,
        margin: '2px 0 0',
        lineHeight: '1.4',
      }}>
        {item.stage} &middot; {item.format} &middot; {label}
      </Text>
    </Section>
  )
}

function SectionHeading({ text, color }: { text: string; color: string }) {
  return (
    <Text className="email-ink" style={{
      fontFamily: EMAIL_FONTS.sans,
      fontSize: 11,
      fontWeight: 700,
      color,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      margin: '20px 0 8px',
    }}>
      {text}
    </Text>
  )
}

export function PipelineDeadlineDigest({ locale, items, dashboardUrl }: PipelineDeadlineDigestProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en
  const { overdue, tomorrow, upcoming } = bucketItems(items)

  return (
    <EmailShell preheader={c.preheader} lang={locale}>
      <EmailMonogram />
      <EmailDivider />

      <Section style={{ padding: '40px 48px 44px' }}>
        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 26,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          margin: '0 0 8px',
          letterSpacing: '-0.02em',
          lineHeight: '1.2',
        }}>
          {c.heading}
        </Text>

        {overdue.length > 0 && (
          <>
            <SectionHeading text={c.overdueHeading} color={URGENCY_COLORS.overdue} />
            {overdue.map((item, i) => (
              <ItemRow key={i} item={item} label={c.overdueLabel} color={URGENCY_COLORS.overdue} />
            ))}
          </>
        )}

        {tomorrow.length > 0 && (
          <>
            <SectionHeading text={c.tomorrowHeading} color={URGENCY_COLORS.tomorrow} />
            {tomorrow.map((item, i) => (
              <ItemRow key={i} item={item} label={c.tomorrowLabel} color={URGENCY_COLORS.tomorrow} />
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <SectionHeading text={c.upcomingHeading} color={URGENCY_COLORS.upcoming} />
            {upcoming.map((item, i) => (
              <ItemRow key={i} item={item} label={c.upcomingLabel} color={URGENCY_COLORS.upcoming} />
            ))}
          </>
        )}

        <EmailButton href={dashboardUrl}>{c.button}</EmailButton>

        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 12,
          color: EMAIL_COLORS.faint,
          margin: '28px 0 0',
          lineHeight: '1.5',
        }}>
          {c.footer}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
      <EmailFooter locale={locale} showPrefs={false} />
    </EmailShell>
  )
}
```

- [ ] **Step 3: Run tests and verify**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-deadline-email.test.tsx`

Expect: All tests pass.

Commit: `feat(pipeline): add pipeline-deadline-digest email template`

---

## Task 6: Dedup Index Migration for sent_emails

**Files:**
- Create: `supabase/migrations/TIMESTAMP_pipeline_digest_dedup_index.sql` (via `npm run db:new`)

- [ ] **Step 1: Generate migration file**

Run: `npm run db:new pipeline_digest_dedup_index`

- [ ] **Step 2: Write migration SQL**

```sql
-- =============================================================================
-- MIGRATION: Dedup index for pipeline-deadline-digest in sent_emails
-- =============================================================================
-- Prevents sending more than one digest per user per day.
-- Matches the existing pattern from contact-received dedup index.

CREATE UNIQUE INDEX IF NOT EXISTS sent_emails_pipeline_digest_daily
  ON public.sent_emails (site_id, to_email, template_name, (date(sent_at AT TIME ZONE 'UTC')))
  WHERE template_name = 'pipeline-deadline-digest';
```

Commit: `feat(pipeline): add dedup index for pipeline-deadline-digest emails`

---

## Task 7: Deadline Notification Cron Endpoint

**Files:**
- Create: `apps/web/test/cms/pipeline-deadline-digest.test.ts`
- Create: `apps/web/src/app/api/cron/pipeline-deadline-digest/route.ts`

- [ ] **Step 1: Write tests first**

Create `apps/web/test/cms/pipeline-deadline-digest.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSupabase = {
  rpc: mockRpc,
  from: mockFrom,
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>digest</html>'),
}))

vi.mock('@/lib/email/service', () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  }),
}))

vi.mock('@/lib/pipeline/get-production-deadline', () => ({
  getProductionDeadline: vi.fn((pubDate: string, stage: string) => {
    if (stage === 'roteiro') return '2026-05-24'
    if (stage === 'draft') return '2026-05-24'
    return undefined
  }),
}))

// Import helper functions after mocks (we'll test the bucketing logic)
import { getProductionDeadline } from '@/lib/pipeline/get-production-deadline'

describe('pipeline-deadline-digest logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getProductionDeadline returns deadline for active stages', () => {
    expect(getProductionDeadline('2026-05-28', 'roteiro')).toBe('2026-05-24')
  })

  it('getProductionDeadline returns undefined for published stage', () => {
    expect(getProductionDeadline('2026-05-28', 'published')).toBeUndefined()
  })

  describe('bucketing', () => {
    function bucket(daysUntil: number): 'overdue' | 'tomorrow' | 'upcoming' | 'skip' {
      if (daysUntil < 0) return 'overdue'
      if (daysUntil <= 1) return 'tomorrow'
      if (daysUntil <= 3) return 'upcoming'
      return 'skip'
    }

    it('buckets past deadlines as overdue', () => {
      expect(bucket(-2)).toBe('overdue')
    })

    it('buckets today/tomorrow as tomorrow', () => {
      expect(bucket(0)).toBe('tomorrow')
      expect(bucket(1)).toBe('tomorrow')
    })

    it('buckets 2-3 days as upcoming', () => {
      expect(bucket(2)).toBe('upcoming')
      expect(bucket(3)).toBe('upcoming')
    })

    it('skips items beyond 3 days', () => {
      expect(bucket(4)).toBe('skip')
    })
  })
})
```

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-deadline-digest.test.ts`

Expect: All tests pass.

- [ ] **Step 2: Implement cron route**

Create `apps/web/src/app/api/cron/pipeline-deadline-digest/route.ts`:

```typescript
import { render } from '@react-email/render'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getEmailService } from '@/lib/email/service'
import { getProductionDeadline } from '@/lib/pipeline/get-production-deadline'
import { PipelineDeadlineDigest, type DeadlineItem } from '@/src/emails/pipeline-deadline-digest'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const maxDuration = 30

const TEMPLATE_NAME = 'pipeline-deadline-digest'
const MAX_DAYS_AHEAD = 3

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Fetch active pipeline items with scheduled_at (have a pub date)
  const { data: items, error: itemsErr } = await supabase
    .from('content_pipeline')
    .select('id, title_pt, title_en, stage, format, scheduled_at, site_id')
    .eq('is_archived', false)
    .not('stage', 'in', '("published","scheduled")')
    .not('scheduled_at', 'is', null)

  if (itemsErr || !items?.length) {
    return Response.json({ status: 'ok', sent: 0, reason: itemsErr ? 'query_error' : 'no_items' })
  }

  // Derive deadlines and bucket items
  const deadlineItems: (DeadlineItem & { siteId: string })[] = []
  for (const item of items) {
    const pubDate = (item.scheduled_at as string).slice(0, 10)
    const deadline = getProductionDeadline(pubDate, item.stage as Stage)
    if (!deadline) continue

    const deadlineMs = new Date(deadline + 'T00:00:00Z').getTime()
    const todayMs = new Date(todayStr + 'T00:00:00Z').getTime()
    const daysUntil = Math.round((deadlineMs - todayMs) / 86_400_000)

    // Only include items within range: overdue (any) or up to MAX_DAYS_AHEAD
    if (daysUntil > MAX_DAYS_AHEAD) continue

    deadlineItems.push({
      title: (item.title_pt as string || item.title_en as string) ?? 'Untitled',
      stage: item.stage as string,
      format: item.format as string,
      deadlineDate: deadline,
      pubDate,
      daysUntilDeadline: daysUntil,
      siteId: item.site_id as string,
    })
  }

  if (deadlineItems.length === 0) {
    return Response.json({ status: 'ok', sent: 0, reason: 'no_deadlines' })
  }

  // Group by site_id
  const bySite = new Map<string, typeof deadlineItems>()
  for (const item of deadlineItems) {
    const group = bySite.get(item.siteId) ?? []
    group.push(item)
    bySite.set(item.siteId, group)
  }

  let sentCount = 0
  let errorCount = 0

  for (const [siteId, siteItems] of bySite) {
    // Get staff users for this site
    const { data: members } = await supabase
      .from('site_users')
      .select('user_id, users:auth_user_id(email)')
      .eq('site_id', siteId)
      .in('role', ['super_admin', 'org_admin', 'editor'])

    if (!members?.length) continue

    for (const member of members) {
      const email = (member as Record<string, unknown>).users as Record<string, string> | null
      const toEmail = email?.email
      if (!toEmail) continue

      // Dedup check: already sent today?
      const { count } = await supabase
        .from('sent_emails')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('to_email', toEmail)
        .eq('template_name', TEMPLATE_NAME)
        .gte('sent_at', `${todayStr}T00:00:00Z`)

      if (count && count > 0) continue

      try {
        const html = await render(
          PipelineDeadlineDigest({
            locale: 'pt-BR',
            items: siteItems,
            dashboardUrl: `${appUrl}/cms/pipeline`,
          })
        )

        const subject = siteItems.some(i => i.daysUntilDeadline < 0)
          ? 'Pipeline: itens atrasados'
          : 'Pipeline: prazos se aproximando'

        await getEmailService().send({
          from: { name: 'Pipeline CMS', email: `no-reply@${domain}` },
          to: toEmail,
          subject,
          html,
        })

        // Record in sent_emails
        await supabase.from('sent_emails').insert({
          site_id: siteId,
          template_name: TEMPLATE_NAME,
          to_email: toEmail,
          subject,
          provider: 'ses',
          status: 'sent',
        })

        sentCount++
      } catch (err) {
        errorCount++
        Sentry.captureException(err, { tags: { cron: TEMPLATE_NAME } })
      }
    }
  }

  return Response.json({ status: 'ok', sent: sentCount, errors: errorCount })
}
```

- [ ] **Step 3: Add cron schedule to vercel.json**

If a `vercel.json` exists, add the cron entry. If not, the schedule is configured via Vercel dashboard or a separate cron config. Add to the `crons` array:

```json
{ "path": "/api/cron/pipeline-deadline-digest", "schedule": "0 10 * * *" }
```

This runs daily at 10:00 UTC (7:00 AM BRT).

Note: The project currently has no `vercel.json` at the root. Check if cron schedules are configured in `apps/web/vercel.json` or another location. If cron schedules are defined in the Vercel dashboard, document the schedule for manual configuration.

- [ ] **Step 4: Run tests and verify**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-deadline-digest.test.ts`

Expect: All tests pass.

Commit: `feat(pipeline): add daily deadline digest cron endpoint`

---

## Task 8: Sidebar Badge Integration for Pipeline

**Files:**
- Create: `apps/web/test/cms/sidebar-badges-pipeline.test.ts`
- Modify: `apps/web/lib/cms/sidebar-badges.ts`
- Modify: `apps/web/src/components/cms/sidebar-badges.tsx`
- Modify: `apps/web/test/cms/sidebar-badges.test.ts`
- Modify: `apps/web/test/cms/sidebar-badges-component.test.tsx`

- [ ] **Step 1: Write tests for pipeline badge data**

Create `apps/web/test/cms/sidebar-badges-pipeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeUrgencyColor, computeUrgencyBadge } from '@/lib/cms/sidebar-badges'

describe('pipeline urgency in sidebar badges', () => {
  it('computes red for pipeline items due within 4 days', () => {
    expect(computeUrgencyColor(2)).toBe('red')
  })

  it('computes orange for pipeline items due within 5-9 days', () => {
    expect(computeUrgencyColor(7)).toBe('orange')
  })

  it('computes yellow for pipeline items due within 10-15 days', () => {
    expect(computeUrgencyColor(12)).toBe('yellow')
  })

  it('returns null for pipeline items with no approaching deadline', () => {
    expect(computeUrgencyColor(20)).toBeNull()
  })

  it('builds urgency badge for pipeline items', () => {
    const result = computeUrgencyBadge([
      { typeName: 'Video', typeColor: '#ef4444', slotDate: '2026-05-28', daysUntil: 2 },
      { typeName: 'Blog', typeColor: '#f59e0b', slotDate: '2026-06-01', daysUntil: 6 },
    ])
    expect(result).not.toBeNull()
    expect(result!.count).toBe(2)
    expect(result!.color).toBe('red')
  })
})
```

Run: `npm run test:web -- --run apps/web/test/cms/sidebar-badges-pipeline.test.ts`

Expect: All tests pass (reusing existing pure functions).

- [ ] **Step 2: Extend SidebarBadgeData with pipeline field**

In `apps/web/lib/cms/sidebar-badges.ts`, add `pipeline` to the `SidebarBadgeData` interface:

```typescript
export interface SidebarBadgeData {
  posts: { wip: number }
  newsletters: {
    wip: number
    wipDraft: number
    wipReady: number
    urgency: UrgencyBadge | null
  }
  pipeline: {
    urgency: UrgencyBadge | null
  }
}
```

In `fetchSidebarBadgesInner`, add a parallel query for pipeline items with production deadlines within 15 days. Add to the existing `Promise.all`:

```typescript
// Add to Promise.all destructuring:
// const [postsRes, editionsWipRes, typesRes, filledEditionsRes, pipelineRes] = await Promise.all([
//   ... existing queries ...,
    supabase
      .from('content_pipeline')
      .select('id, title_pt, stage, format, scheduled_at')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .not('stage', 'in', '("published","scheduled")')
      .not('scheduled_at', 'is', null),
// ])
```

After the existing urgency calculation, add pipeline urgency computation:

```typescript
// Import getProductionDeadline at the top
import { getProductionDeadline } from '@/lib/pipeline/get-production-deadline'
import type { Stage } from '@/lib/pipeline/up-next-constants'

// After newsletter urgency, compute pipeline urgency:
const pipelineUrgencySlots: UrgencySlot[] = []
for (const item of pipelineRes.data ?? []) {
  if (!item.scheduled_at) continue
  const pubDate = (item.scheduled_at as string).slice(0, 10)
  const deadline = getProductionDeadline(pubDate, item.stage as Stage)
  if (!deadline) continue

  const deadlineMs = new Date(deadline + 'T00:00:00Z').getTime()
  const daysUntil = Math.round((deadlineMs - todayMs) / 86_400_000)

  if (daysUntil >= 0 && daysUntil <= 15) {
    pipelineUrgencySlots.push({
      typeName: (item.title_pt as string) ?? 'Pipeline item',
      typeColor: '#818cf8', // gem accent
      slotDate: deadline,
      daysUntil,
    })
  }
}
```

Add to the return:

```typescript
return {
  posts: { wip: postsWip },
  newsletters: { /* existing */ },
  pipeline: {
    urgency: computeUrgencyBadge(pipelineUrgencySlots),
  },
}
```

- [ ] **Step 3: Add BadgePortal for /cms/pipeline in sidebar-badges.tsx**

In `apps/web/src/components/cms/sidebar-badges.tsx`, extend the `SidebarBadges` component to include a pipeline badge portal:

After the newsletters portal, add:

```typescript
const plHasUrgency = data.pipeline.urgency !== null
```

Update the null check:

```typescript
if (!postsHasBadge && !nlHasWip && !nlHasUrgency && !plHasUrgency) return null
```

Add collapsed dot for pipeline:

```typescript
{plHasUrgency && (
  <CollapsedDot href="/cms/pipeline" color={data.pipeline.urgency!.color} />
)}
```

Add expanded badge portal:

```typescript
{plHasUrgency && (
  <BadgePortal href="/cms/pipeline">
    <span className="ml-auto flex items-center gap-1">
      <Pill
        count={data.pipeline.urgency!.count}
        color={data.pipeline.urgency!.color}
        ariaLabel={`${data.pipeline.urgency!.count} pipeline items with approaching deadlines`}
        tooltipContent={
          <PipelineUrgencyTooltip slots={data.pipeline.urgency!.slots} />
        }
      />
    </span>
  </BadgePortal>
)}
```

Add the `PipelineUrgencyTooltip` component (similar to `UrgencyTooltip`):

```typescript
function PipelineUrgencyTooltip({ slots }: { slots: UrgencySlot[] }) {
  return (
    <>
      <span className="block text-[11px] text-slate-400 font-semibold mb-1">
        Pipeline deadlines (next 15 days)
      </span>
      {slots.map((s, i) => (
        <span key={i} className="flex items-center gap-2 text-[12px] text-slate-200">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[computeUrgencyColor(s.daysUntil) ?? 'yellow']}`}
          />
          <span className="flex-1 truncate">{s.typeName}</span>
          <span className={`text-[11px] ${COLOR_CLASSES[computeUrgencyColor(s.daysUntil) ?? 'yellow'].text}`}>
            {formatSlotDate(s.slotDate)}
          </span>
        </span>
      ))}
    </>
  )
}
```

- [ ] **Step 4: Update existing sidebar badge tests**

In `apps/web/test/cms/sidebar-badges-component.test.tsx`, update `EMPTY_DATA` to include `pipeline`:

```typescript
const EMPTY_DATA: SidebarBadgeData = {
  posts: { wip: 0 },
  newsletters: { wip: 0, wipDraft: 0, wipReady: 0, urgency: null },
  pipeline: { urgency: null },
}
```

Add a test:

```typescript
it('renders collapsed dot for pipeline when sidebar is collapsed and urgency exists', async () => {
  mockIsExpanded = false
  document.body.innerHTML = '<div data-area="cms"><a href="/cms/pipeline">Pipeline</a></div>'
  const SidebarBadges = await importComponent()
  const data: SidebarBadgeData = {
    ...EMPTY_DATA,
    pipeline: {
      urgency: { count: 2, color: 'orange', slots: [] },
    },
  }
  const { container } = render(<SidebarBadges data={data} />)
  const dot = container.querySelector('.bg-orange-400')
  expect(dot).toBeTruthy()
})
```

- [ ] **Step 5: Run all sidebar badge tests**

Run: `npm run test:web -- --run apps/web/test/cms/sidebar-badges.test.ts apps/web/test/cms/sidebar-badges-component.test.tsx apps/web/test/cms/sidebar-badges-pipeline.test.ts`

Expect: All tests pass.

Commit: `feat(pipeline): add sidebar badge for pipeline deadline urgency`

---

## Task 9: Mobile Tab Layout Component

**Files:**
- Create: `apps/web/test/cms/pipeline-tabs.test.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-tabs.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`

- [ ] **Step 1: Write tests first**

Create `apps/web/test/cms/pipeline-tabs.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
}))

import { PipelineTabs, type TabId } from
  '../../src/app/cms/(authed)/pipeline/_components/pipeline-tabs'

describe('PipelineTabs', () => {
  const children = {
    queue: <div data-testid="queue-content">Queue</div>,
    grid: <div data-testid="grid-content">Grid</div>,
    health: <div data-testid="health-content">Health</div>,
  }

  it('renders three tab buttons', () => {
    render(<PipelineTabs activeTab="queue" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByRole('tab', { name: /fila/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /grade/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /saude/i })).toBeTruthy()
  })

  it('shows queue content when queue tab is active', () => {
    render(<PipelineTabs activeTab="queue" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByTestId('queue-content')).toBeTruthy()
    expect(screen.queryByTestId('grid-content')).toBeNull()
  })

  it('shows grid content when grid tab is active', () => {
    render(<PipelineTabs activeTab="grid" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByTestId('grid-content')).toBeTruthy()
    expect(screen.queryByTestId('queue-content')).toBeNull()
  })

  it('calls onTabChange when clicking a tab', () => {
    const onTabChange = vi.fn()
    render(<PipelineTabs activeTab="queue" onTabChange={onTabChange}>{children}</PipelineTabs>)
    fireEvent.click(screen.getByRole('tab', { name: /grade/i }))
    expect(onTabChange).toHaveBeenCalledWith('grid')
  })

  it('marks active tab with aria-selected', () => {
    render(<PipelineTabs activeTab="grid" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    const gridTab = screen.getByRole('tab', { name: /grade/i })
    expect(gridTab.getAttribute('aria-selected')).toBe('true')
    const queueTab = screen.getByRole('tab', { name: /fila/i })
    expect(queueTab.getAttribute('aria-selected')).toBe('false')
  })

  it('has correct tabpanel role on content area', () => {
    render(<PipelineTabs activeTab="queue" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })
})
```

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-tabs.test.tsx`

Expect: All tests fail (module not found).

- [ ] **Step 2: Implement PipelineTabs component**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-tabs.tsx`:

```typescript
'use client'

import { memo, type ReactNode } from 'react'
import { ListChecks, CalendarDays, Activity } from 'lucide-react'
import { gemMix } from '@/lib/pipeline/gem-design'

export type TabId = 'queue' | 'grid' | 'health'

interface TabDef {
  id: TabId
  label: string
  icon: typeof ListChecks
}

const TABS: TabDef[] = [
  { id: 'queue', label: 'Fila', icon: ListChecks },
  { id: 'grid', label: 'Grade', icon: CalendarDays },
  { id: 'health', label: 'Saude', icon: Activity },
]

interface PipelineTabsProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: Record<TabId, ReactNode>
}

export const PipelineTabs = memo(function PipelineTabs({
  activeTab,
  onTabChange,
  children,
}: PipelineTabsProps) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Pipeline sections"
        className="flex gap-0.5 p-0.5 rounded-lg mb-4"
        style={{ background: gemMix('--gem-well', 60) }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium min-h-[44px] motion-safe:transition-all focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none ${
                isActive ? 'shadow-sm' : 'hover:opacity-80'
              }`}
              style={{
                background: isActive ? 'var(--gem-surface)' : 'transparent',
                color: isActive ? 'var(--gem-text)' : 'var(--gem-dim)',
              }}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {children[activeTab]}
      </div>
    </div>
  )
})
```

- [ ] **Step 3: Integrate into pipeline-overview.tsx**

In `pipeline-overview.tsx`, add mobile tab support. Import PipelineTabs and wrap the mobile view:

```typescript
import { PipelineTabs, type TabId } from './pipeline-tabs'
```

Add state:

```typescript
const [mobileTab, setMobileTab] = useState<TabId>('queue')
```

Wrap sections conditionally. On screens `< lg` (< 1024px), show PipelineTabs. On `>= lg`, show the existing linear layout. Use CSS `hidden lg:block` / `lg:hidden` to toggle:

```tsx
{/* Desktop: linear layout (existing) */}
<div className="hidden lg:contents">
  {/* ... existing sections unchanged ... */}
</div>

{/* Mobile: tabbed layout */}
<div className="lg:hidden">
  <PipelineTabs activeTab={mobileTab} onTabChange={setMobileTab}>
    {{
      queue: (
        <>
          <SectionErrorBoundary>
            <PinnedQueue pins={pins} onUnpin={onUnpin} showGhosts={...} />
          </SectionErrorBoundary>
          <SectionErrorBoundary>
            <TodayActionCards actions={upNext.today.actions} overflow={upNext.today.overflow} />
          </SectionErrorBoundary>
        </>
      ),
      grid: (
        <SectionErrorBoundary>
          <UpNextThisWeek ... />
        </SectionErrorBoundary>
      ),
      health: (
        <section aria-label="Atividade recente">
          <UpNextActivity entries={activity} />
        </section>
      ),
    }}
  </PipelineTabs>
</div>
```

- [ ] **Step 4: Run tests and verify**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-tabs.test.tsx apps/web/test/cms/pipeline-overview.test.tsx`

Expect: All tests pass.

Commit: `feat(pipeline): add mobile tab layout for pipeline sections`

---

## Task 10: Week Grid Conditional Collapse

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`
- Modify: `apps/web/test/cms/pipeline-overview.test.tsx`

- [ ] **Step 1: Add collapse logic to UpNextThisWeek**

In `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`, add a collapsible wrapper around the grid. The component already receives `slots` -- compute buffer health from the slots:

Add state and auto-collapse logic at the top of the component:

```typescript
import { ChevronDown, ChevronUp } from 'lucide-react'

// Inside the component:
const filledCount = slots.filter(s => s.assignedItem !== null && !s.isRestDay).length
const totalSlots = slots.filter(s => !s.isRestDay).length
const bufferCoverage = totalSlots > 0 ? filledCount / totalSlots : 0
const shouldAutoCollapse = bufferCoverage >= 0.8

const [collapsed, setCollapsed] = useState(shouldAutoCollapse)

// Update collapsed state when buffer changes
useEffect(() => {
  setCollapsed(shouldAutoCollapse)
}, [shouldAutoCollapse])
```

Wrap the grid content with a collapsible container:

```tsx
<section ref={gridRef} aria-label="Grade da semana">
  <button
    type="button"
    onClick={() => setCollapsed(c => !c)}
    className="flex items-center justify-between w-full text-left mb-2 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none rounded px-1 py-0.5"
    aria-expanded={!collapsed}
  >
    <h2 className="text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>
      Esta semana
      {bufferCoverage >= 0.8 && (
        <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--gem-done)' }}>
          {Math.round(bufferCoverage * 100)}% preenchido
        </span>
      )}
    </h2>
    {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
  </button>

  {!collapsed && (
    <div className="motion-safe:animate-[fade-in_0.2s_ease-out]">
      {/* ... existing grid content ... */}
    </div>
  )}
</section>
```

- [ ] **Step 2: Update tests**

In `apps/web/test/cms/pipeline-overview.test.tsx`, verify that the UpNextThisWeek mock still works (it's already a stub). No changes needed if the mock captures all props.

Add a targeted unit test for collapse behavior if `up-next-this-week` gets its own test file. For now, the component test via pipeline-overview is sufficient since the mock captures the `slots` prop.

- [ ] **Step 3: Run tests and verify**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-overview.test.tsx`

Expect: All tests pass.

Commit: `feat(pipeline): auto-collapse week grid when buffer >= 80%`

---

## Verification Checklist

After all tasks are complete:

- [ ] Run `npm run test:web` — all tests pass
- [ ] Run `npm run build:packages` — workspace packages build
- [ ] Verify migrations are sequential (timestamps after `20260526000001`)
- [ ] Verify `sidebar-badges.ts` return type matches `SidebarBadgeData` (includes `pipeline`)
- [ ] Verify email template renders correctly (run test with `@react-email/render`)
- [ ] Verify cron route auth matches pattern (`Bearer ${process.env.CRON_SECRET}`)
- [ ] Verify mobile tabs only show on `< lg` (1024px) breakpoint
- [ ] Verify week grid auto-collapses at 80% buffer coverage
- [ ] Verify pin cap is enforced at 3 items
- [ ] Verify stale pins are purged after 24 hours (in RPC)

## Dependency Graph

```
Task 1 (migration) ──────────────┐
                                  ├──> Task 2 (server actions)
                                  │          │
                                  │          ├──> Task 3 (pinned queue UI)
                                  │          │           │
                                  │          └──> Task 4 (integrate into overview)◄──┤
                                  │                                                  │
Task 5 (email template) ─────────┤                                                  │
                                  ├──> Task 7 (cron endpoint)                       │
Task 6 (dedup index migration) ──┘                                                  │
                                                                                     │
Task 8 (sidebar badges) ──── independent ────────────────────────────────────────────┘
Task 9 (mobile tabs) ──── depends on Task 4
Task 10 (grid collapse) ──── independent
```

Parallel groups:
- **Group A** (can run in parallel): Task 1, Task 5, Task 6, Task 8 (data layer + email template)
- **Group B** (after Group A): Task 2, Task 7
- **Group C** (after Group B): Task 3, Task 4, Task 10
- **Group D** (after Group C): Task 9

## Estimated Effort

| Task | Estimate |
|------|----------|
| Task 1: working_today migration | 1h |
| Task 2: Pin/unpin server actions | 1.5h |
| Task 3: Pinned queue UI | 2h |
| Task 4: Integrate into overview | 1.5h |
| Task 5: Email template | 2h |
| Task 6: Dedup index migration | 0.5h |
| Task 7: Cron endpoint | 2h |
| Task 8: Sidebar badges | 2h |
| Task 9: Mobile tab layout | 2h |
| Task 10: Grid collapse | 1h |
| **Total** | **~15.5h** |
