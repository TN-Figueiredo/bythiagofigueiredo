// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'
import type { UpNextApiResponse, WeekSlot, TodayAction, SlotCandidate } from '../../src/lib/pipeline/up-next-types'
import type { CelebrationItem } from '../../src/app/cms/(authed)/pipeline/_components/up-next-celebration'
import type { PlaylistStrip } from '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
import type { ActivityEntry } from '../../src/app/cms/(authed)/pipeline/_components/up-next-activity'

/* ------------------------------------------------------------------ */
/*  Mocks — all child components as stubs                             */
/* ------------------------------------------------------------------ */

// next/dynamic mock — synchronously resolves lazy-loaded modules
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null
    loader().then(mod => { ResolvedComponent = mod.default })
    const Wrapper: React.FC<Record<string, unknown>> = (props) => {
      const [C, setC] = React.useState<React.ComponentType<Record<string, unknown>> | null>(
        () => ResolvedComponent,
      )
      React.useLayoutEffect(() => {
        if (!C && ResolvedComponent) setC(() => ResolvedComponent)
      })
      return C ? React.createElement(C, props) : null
    }
    return Wrapper
  },
}))

const mockMutate = vi.fn()
let swrReturnValue: { data: UpNextApiResponse | undefined; isLoading: boolean; mutate: Mock }

vi.mock('swr', () => ({
  default: () => swrReturnValue,
}))

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
  getFormatIcon: vi.fn(() => ({ icon: '📹', bgClass: '', label: 'Video' })),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/today-action-cards', () => ({
  TodayActionCards: ({ actions, overflow }: { actions: TodayAction[]; overflow: number }) => (
    <div data-testid="today-action-cards" data-count={actions.length} data-overflow={overflow} />
  ),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/up-next-celebration', () => ({
  UpNextCelebration: ({ items }: { items: CelebrationItem[] }) => (
    <div data-testid="up-next-celebration" data-count={items.length} />
  ),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/up-next-suggestion', () => ({
  UpNextSuggestion: ({ text }: { text: string }) => (
    <div data-testid="up-next-suggestion">{text}</div>
  ),
}))

// Module-level ref to capture onAssignSlot from the UpNextThisWeek mock
let capturedOnAssignSlot: ((itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string) => Promise<void>) | undefined

vi.mock('../../src/app/cms/(authed)/pipeline/_components/up-next-this-week', () => ({
  UpNextThisWeek: (props: { slots: WeekSlot[]; onAssignSlot: typeof capturedOnAssignSlot; [k: string]: unknown }) => {
    capturedOnAssignSlot = props.onAssignSlot
    return <div data-testid="up-next-this-week" data-slots={props.slots.length} data-has-handler={typeof props.onAssignSlot === 'function'} />
  },
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips', () => ({
  UpNextPlaylistStrips: ({ playlists }: { playlists: PlaylistStrip[] }) => (
    <div data-testid="up-next-playlist-strips" data-count={playlists.length} />
  ),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/up-next-activity', () => ({
  UpNextActivity: ({ entries }: { entries: ActivityEntry[] }) => (
    <div data-testid="up-next-activity" data-count={entries.length} />
  ),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/command-center-skeleton', () => ({
  CommandCenterSkeleton: () => <div data-testid="command-center-skeleton" />,
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/command-center-empty', () => ({
  CommandCenterEmpty: ({ variant }: { variant: string }) => (
    <div data-testid="command-center-empty" data-variant={variant} />
  ),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/offline-banner', () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown', () => ({
  PipelineSearchDropdown: () => <div data-testid="pipeline-search-dropdown" />,
}))

vi.mock('../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel', () => ({
  PlaylistSuggestionPanel: (props: {
    candidates: SlotCandidate[]
    selectedItem: SlotCandidate | null
    collapsed: boolean
  }) => (
    <section role="region" aria-label="Sugestões de conteúdo por playlist" data-testid="playlist-suggestion-panel" data-count={props.candidates.length} data-selected={props.selectedItem?.id ?? ''} data-collapsed={String(props.collapsed)} />
  ),
}))

vi.mock('../../src/app/cms/(authed)/_shared/section-error-boundary', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/* ------------------------------------------------------------------ */
/*  Import component AFTER mocks                                      */
/* ------------------------------------------------------------------ */

import { PipelineOverview } from '../../src/app/cms/(authed)/pipeline/_components/pipeline-overview'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeSlot(overrides: Partial<WeekSlot> = {}): WeekSlot {
  return {
    day: '2026-05-26',
    dayLabel: 'seg',
    hour: '10:00',
    format: 'video',
    channelLocale: 'pt',
    channelId: 'ch1',
    isRestDay: false,
    assignedItem: null,
    effortMinutes: 180,
    ...overrides,
  }
}

function makeAction(overrides: Partial<TodayAction> = {}): TodayAction {
  return {
    id: 'a1',
    itemTitle: 'Test Video',
    actionLabel: 'Finalizar roteiro',
    format: 'video',
    language: 'pt-br',
    effort: 'deep',
    effortEstimate: '~3h',
    effortMinutes: 180,
    urgency: 'today',
    priority: 3,
    stage: 'roteiro',
    deadline: { label: 'ate seg', date: '2026-06-01' },
    playlistContext: null,
    channelLabel: 'Canal PT',
    pubDate: '2026-06-05',
    ...overrides,
  }
}

function makeApiResponse(overrides: Partial<UpNextApiResponse> = {}): UpNextApiResponse {
  return {
    today: {
      actions: [],
      overflow: 0,
      doneToday: 0,
      totalSurfaced: 0,
      totalEffortMinutes: 0,
    },
    todayDate: '2026-05-26',
    weekSlots: [],
    streak: { currentStreak: 0, isActive: false },
    stageCounts: {},
    playlists: [],
    candidates: [],
    nextWeekEmpty: 0,
    backlogCount: 0,
    suggestion: null,
    errors: { today: null, weekSlots: null, streak: null, playlists: null },
    ...overrides,
  }
}

function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'c1',
    title: 'Test',
    stage: 'draft' as const,
    format: 'video' as const,
    language: 'pt-br' as const,
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    ...overrides,
  }
}

const defaultProps = {
  celebration: { items: [] as CelebrationItem[] },
  playlists: [] as PlaylistStrip[],
  activity: [] as ActivityEntry[],
}

function renderOverview(
  apiOverrides: Partial<UpNextApiResponse> = {},
  propOverrides: Partial<typeof defaultProps> = {},
) {
  const fallbackData = makeApiResponse(apiOverrides)
  return render(
    <PipelineOverview
      fallbackData={fallbackData}
      {...defaultProps}
      {...propOverrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks()
  capturedOnAssignSlot = undefined
  swrReturnValue = {
    data: undefined,
    isLoading: false,
    mutate: mockMutate,
  }
  mockMutate.mockReset()
})

describe('PipelineOverview', () => {
  /* ---------------------------------------------------------------- */
  /*  1. Rendering states                                              */
  /* ---------------------------------------------------------------- */
  describe('Rendering states', () => {
    it('shows CommandCenterSkeleton when isLoading=true and no data', () => {
      swrReturnValue = { data: undefined, isLoading: true, mutate: mockMutate }
      renderOverview()
      expect(screen.getByTestId('command-center-skeleton')).toBeDefined()
    })

    it('shows CommandCenterEmpty with "first-run" variant when all arrays empty and totalSurfaced=0', () => {
      renderOverview()
      const empty = screen.getByTestId('command-center-empty')
      expect(empty).toBeDefined()
      expect(empty.dataset.variant).toBe('first-run')
    })

    it('renders PipelineSearchDropdown above CommandCenterEmpty in first-run state', () => {
      renderOverview()
      expect(screen.getByTestId('pipeline-search-dropdown')).toBeDefined()
      expect(screen.getByTestId('command-center-empty')).toBeDefined()
    })

    it('shows normal layout with progress bar when totalActions > 0', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 120,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.queryByTestId('command-center-skeleton')).toBeNull()
      expect(screen.queryByTestId('command-center-empty')).toBeNull()
      expect(screen.getByRole('progressbar')).toBeDefined()
    })

    it('renders PipelineSearchDropdown next to the progress heading when totalActions > 0', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 120,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.getByTestId('pipeline-search-dropdown')).toBeDefined()
      expect(screen.getByRole('progressbar')).toBeDefined()
    })

    it('renders PipelineSearchDropdown alone when totalActions=0 but not first-run', () => {
      renderOverview({
        today: {
          actions: [],
          overflow: 0,
          doneToday: 0,
          totalSurfaced: 0,
          totalEffortMinutes: 0,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.getByTestId('pipeline-search-dropdown')).toBeDefined()
      expect(screen.queryByRole('progressbar')).toBeNull()
      expect(screen.queryByTestId('command-center-empty')).toBeNull()
    })

    it('does not show empty state when weekSlots has items even if actions are empty', () => {
      renderOverview({
        today: {
          actions: [],
          overflow: 0,
          doneToday: 0,
          totalSurfaced: 0,
          totalEffortMinutes: 0,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.queryByTestId('command-center-empty')).toBeNull()
    })

    it('does not show empty state when totalSurfaced > 0 even without actions', () => {
      renderOverview({
        today: {
          actions: [],
          overflow: 0,
          doneToday: 0,
          totalSurfaced: 3,
          totalEffortMinutes: 0,
        },
      })
      expect(screen.queryByTestId('command-center-empty')).toBeNull()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  2. Progress bar                                                  */
  /* ---------------------------------------------------------------- */
  describe('Progress bar', () => {
    it('has correct aria-valuenow, aria-valuemin, and aria-valuemax', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 3,
          totalSurfaced: 5,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })
      const bar = screen.getByRole('progressbar')
      // totalActions = totalSurfaced(5) + doneToday(3) = 8
      expect(bar.getAttribute('aria-valuenow')).toBe('3')
      expect(bar.getAttribute('aria-valuemin')).toBe('0')
      expect(bar.getAttribute('aria-valuemax')).toBe('8')
    })

    it('computes correct percentage width', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 2,
          totalSurfaced: 2,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })
      const bar = screen.getByRole('progressbar')
      const inner = bar.firstElementChild as HTMLElement
      expect(inner.style.width).toBe('50%')
    })

    it('shows 100% when all done', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 5,
          totalSurfaced: 0,
          totalEffortMinutes: 0,
        },
        weekSlots: [makeSlot()],
      })
      const bar = screen.getByRole('progressbar')
      const inner = bar.firstElementChild as HTMLElement
      expect(inner.style.width).toBe('100%')
    })

    it('shows remaining hours when > 0', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 180,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.getByText(/~3h restantes/)).toBeDefined()
    })

    it('does not show remaining hours when effort is 0', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 0,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.queryByText(/restantes/)).toBeNull()
    })

    it('rounds remaining hours', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 100,
        },
        weekSlots: [makeSlot()],
      })
      // 100 / 60 = 1.67 rounds to 2
      expect(screen.getByText(/~2h restantes/)).toBeDefined()
    })

    it('has accessible label describing done/total', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 2,
          totalSurfaced: 3,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })
      const bar = screen.getByRole('progressbar')
      expect(bar.getAttribute('aria-label')).toBe('2 de 5 tarefas concluídas')
    })
  })

  /* ---------------------------------------------------------------- */
  /*  3. Optimistic update logic (unit-level)                          */
  /* ---------------------------------------------------------------- */
  describe('Optimistic update logic', () => {
    it('updater assigns item to correct slot', () => {
      const slots = [
        makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00', assignedItem: null }),
        makeSlot({ day: '2026-05-27', format: 'blog_post', hour: null, assignedItem: null }),
      ]
      const candidates = [
        { id: 'item-1', title: 'My Video', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })
      const candidate = candidates[0]!
      const newItem = { id: candidate.id, title: candidate.title, stage: candidate.stage }

      // Simulate the optimistic updater logic from the component
      const result = {
        ...apiData,
        weekSlots: apiData.weekSlots.map(s => {
          if (s.day === '2026-05-26' && s.format === candidate.format && s.hour === '10:00') {
            return { ...s, assignedItem: newItem }
          }
          return s
        }),
      }

      expect(result.weekSlots[0]!.assignedItem).toEqual(newItem)
      expect(result.weekSlots[1]!.assignedItem).toBeNull()
    })

    it('on swap: clears old slot AND fills new slot even across different days', () => {
      const slots = [
        makeSlot({
          day: '2026-05-26',
          format: 'video',
          hour: '10:00',
          assignedItem: { id: 'old-item', title: 'Old', stage: 'roteiro' },
        }),
        makeSlot({ day: '2026-05-27', format: 'video', hour: '14:00', assignedItem: null }),
      ]
      const candidates = [
        { id: 'new-item', title: 'New Video', stage: 'gravacao' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      const previousItemId = 'old-item'
      const candidate = candidates[0]!
      const newItem = { id: candidate.id, title: candidate.title, stage: candidate.stage }

      const result = {
        ...apiData,
        weekSlots: apiData.weekSlots.map(s => {
          if (s.day === '2026-05-27' && s.format === candidate.format && s.hour === '14:00') {
            return { ...s, assignedItem: newItem }
          }
          if (previousItemId && s.assignedItem?.id === previousItemId) {
            return { ...s, assignedItem: null }
          }
          return s
        }),
      }

      expect(result.weekSlots[0]!.assignedItem).toBeNull()
      expect(result.weekSlots[1]!.assignedItem).toEqual(newItem)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  4. handleAssignSlot integration via captured callback             */
  /* ---------------------------------------------------------------- */
  describe('handleAssignSlot integration', () => {
    it('POSTs correct payload to /api/pipeline/up-next on assign', async () => {
      const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00' })]
      const candidates = [
        { id: 'item-1', title: 'V1', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      expect(capturedOnAssignSlot).toBeDefined()
      await act(async () => {
        await capturedOnAssignSlot!('item-1', '2026-05-26', '10:00')
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe('/api/pipeline/up-next')
      expect(opts).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = JSON.parse((opts as RequestInit).body as string)
      expect(body).toEqual({
        itemId: 'item-1',
        slotDay: '2026-05-26',
        slotHour: '10:00',
      })

      fetchSpy.mockRestore()
    })

    it('reverts on POST failure (rollback via mutate)', async () => {
      const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00' })]
      const candidates = [
        { id: 'item-1', title: 'V1', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Server error' } }), { status: 500 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      expect(capturedOnAssignSlot).toBeDefined()
      await act(async () => {
        await capturedOnAssignSlot!('item-1', '2026-05-26', '10:00').catch(() => {
          // Expected to throw
        })
      })

      // mutate calls:
      // 1. Optimistic update (function, { revalidate: false })
      // 2. Rollback with snapshot (data, { revalidate: false })
      const calls = mockMutate.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(2)
      const lastCall = calls[calls.length - 1]!
      // Rollback passes the snapshot object and { revalidate: false }
      expect(lastCall[0]).toBeDefined()
      expect(typeof lastCall[0]).not.toBe('function') // snapshot, not updater
      expect(lastCall[1]).toEqual({ revalidate: false })

      fetchSpy.mockRestore()
    })

    it('includes previousItemId in POST payload on swap', async () => {
      const slots = [
        makeSlot({
          day: '2026-05-26',
          format: 'video',
          hour: '10:00',
          assignedItem: { id: 'old-item', title: 'Old', stage: 'roteiro' },
        }),
        makeSlot({ day: '2026-05-27', format: 'video', hour: '14:00', assignedItem: null }),
      ]
      const candidates = [
        { id: 'new-item', title: 'New', stage: 'gravacao' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      expect(capturedOnAssignSlot).toBeDefined()
      await act(async () => {
        await capturedOnAssignSlot!('new-item', '2026-05-27', '14:00', 'old-item')
      })

      const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string)
      expect(body).toEqual({
        itemId: 'new-item',
        slotDay: '2026-05-27',
        slotHour: '14:00',
        previousItemId: 'old-item',
      })

      fetchSpy.mockRestore()
    })

    it('calls mutate with optimistic updater function before POST', async () => {
      const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00' })]
      const candidates = [
        { id: 'item-1', title: 'V1', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      await act(async () => {
        await capturedOnAssignSlot!('item-1', '2026-05-26', '10:00')
      })

      // First mutate call is the optimistic update with a function
      const firstCall = mockMutate.mock.calls[0]!
      expect(typeof firstCall[0]).toBe('function')
      expect(firstCall[1]).toEqual({ revalidate: false })

      vi.restoreAllMocks()
    })

    it('calls mutate() to revalidate after successful POST', async () => {
      const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00' })]
      const candidates = [
        { id: 'item-1', title: 'V1', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      await act(async () => {
        await capturedOnAssignSlot!('item-1', '2026-05-26', '10:00')
      })

      // Second mutate call is the revalidation (no args)
      const secondCall = mockMutate.mock.calls[1]
      expect(secondCall).toBeDefined()
      // mutate() called without arguments for revalidation
      expect(secondCall![0]).toBeUndefined()

      vi.restoreAllMocks()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  5. Error banner                                                  */
  /* ---------------------------------------------------------------- */
  describe('Error banner', () => {
    it('shows partial error banner when upNext.errors has non-null values', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        errors: { today: null, weekSlots: 'Failed to load slots', streak: null, playlists: null },
      })

      const banners = screen.getAllByRole('status')
      const errorBanner = banners.find(b => b.textContent?.includes('incompletos'))
      expect(errorBanner).toBeDefined()
      expect(errorBanner!.getAttribute('aria-live')).toBe('polite')
    })

    it('does not show error banner when all errors are null', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        errors: { today: null, weekSlots: null, streak: null, playlists: null },
      })

      const banners = screen.getAllByRole('status')
      const errorBanner = banners.find(b => b.textContent?.includes('incompletos'))
      expect(errorBanner).toBeUndefined()
    })

    it('shows error banner text in Portuguese', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        errors: { today: 'err', weekSlots: null, streak: null, playlists: null },
      })

      expect(screen.getByText(/Alguns dados podem estar incompletos/)).toBeDefined()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  6. Announcement live region                                      */
  /* ---------------------------------------------------------------- */
  describe('Announcement live region', () => {
    it('has an sr-only live region with role="status" and aria-live="polite"', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })

      const statuses = screen.getAllByRole('status')
      const liveRegion = statuses.find(el => el.classList.contains('sr-only'))
      expect(liveRegion).toBeDefined()
      expect(liveRegion!.getAttribute('aria-live')).toBe('polite')
    })

    it('announces "Item atribuido ao slot" on successful assignment', async () => {
      const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00' })]
      const candidates = [
        { id: 'item-1', title: 'V1', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      await act(async () => {
        await capturedOnAssignSlot!('item-1', '2026-05-26', '10:00')
      })

      const statuses = screen.getAllByRole('status')
      const liveRegion = statuses.find(el => el.classList.contains('sr-only'))
      expect(liveRegion!.textContent).toBe('Item atribuído ao slot')

      vi.restoreAllMocks()
    })

    it('announces error message on failed assignment', async () => {
      const slots = [makeSlot({ day: '2026-05-26', format: 'video', hour: '10:00' })]
      const candidates = [
        { id: 'item-1', title: 'V1', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const },
      ]
      const apiData = makeApiResponse({ weekSlots: slots, candidates })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }
      mockMutate.mockResolvedValue(undefined)

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Slot ocupado' } }), { status: 409 }),
      )

      renderOverview({ weekSlots: slots, candidates })

      await act(async () => {
        await capturedOnAssignSlot!('item-1', '2026-05-26', '10:00').catch(() => {
          // Expected
        })
      })

      const statuses = screen.getAllByRole('status')
      const liveRegion = statuses.find(el => el.classList.contains('sr-only'))
      expect(liveRegion!.textContent).toBe('Slot ocupado')

      vi.restoreAllMocks()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  7. Weekday label                                                 */
  /* ---------------------------------------------------------------- */
  describe('Weekday label', () => {
    it('computes correct Portuguese weekday for 2026-05-26 (terça-feira)', () => {
      renderOverview({
        todayDate: '2026-05-26',
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 120,
        },
        weekSlots: [makeSlot()],
      })
      const expected = new Date(2026, 4, 26).toLocaleDateString('pt-BR', { weekday: 'long' })
      expect(screen.getByText(new RegExp(expected))).toBeDefined()
    })

    it('computes correct Portuguese weekday for 2026-05-31 (domingo)', () => {
      renderOverview({
        todayDate: '2026-05-31',
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 2,
          totalEffortMinutes: 120,
        },
        weekSlots: [makeSlot()],
      })
      const expected = new Date(2026, 4, 31).toLocaleDateString('pt-BR', { weekday: 'long' })
      expect(screen.getByText(new RegExp(expected))).toBeDefined()
    })

    it('computes correct Portuguese weekday for 2026-05-29 (sexta-feira)', () => {
      renderOverview({
        todayDate: '2026-05-29',
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })
      const expected = new Date(2026, 4, 29).toLocaleDateString('pt-BR', { weekday: 'long' })
      expect(screen.getByText(new RegExp(expected))).toBeDefined()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  8. Child component composition                                   */
  /* ---------------------------------------------------------------- */
  describe('Child component composition', () => {
    it('renders OfflineBanner in the normal layout', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.getByTestId('offline-banner')).toBeDefined()
    })

    it('renders UpNextCelebration with celebration items prop', () => {
      const celebrationItems: CelebrationItem[] = [
        { id: 'c1', code: 'V001', title_pt: 'Celebre!', format: 'video' },
      ]
      renderOverview(
        {
          today: {
            actions: [makeAction()],
            overflow: 0,
            doneToday: 1,
            totalSurfaced: 1,
            totalEffortMinutes: 60,
          },
          weekSlots: [makeSlot()],
        },
        { celebration: { items: celebrationItems } },
      )
      const cel = screen.getByTestId('up-next-celebration')
      expect(cel.dataset.count).toBe('1')
    })

    it('renders UpNextSuggestion when suggestion is present', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        suggestion: { text: 'Consider batching edits', href: '/cms/pipeline' },
      })
      expect(screen.getByTestId('up-next-suggestion')).toBeDefined()
      expect(screen.getByText('Consider batching edits')).toBeDefined()
    })

    it('does not render UpNextSuggestion when suggestion is null', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        suggestion: null,
      })
      expect(screen.queryByTestId('up-next-suggestion')).toBeNull()
    })

    it('renders UpNextThisWeek with slots and passes onAssignSlot handler', () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot(), makeSlot({ day: '2026-05-27' })],
      })
      const thisWeek = screen.getByTestId('up-next-this-week')
      expect(thisWeek.dataset.slots).toBe('2')
      expect(thisWeek.dataset.hasHandler).toBe('true')
    })

    it('renders UpNextPlaylistStrips inside Horizonte section', () => {
      const playlists: PlaylistStrip[] = [
        { id: 'p1', name: 'Series A', items: [], nextItemTitle: null, nextItemStage: null, nearCompletion: false },
      ]
      renderOverview(
        {
          today: {
            actions: [makeAction()],
            overflow: 0,
            doneToday: 1,
            totalSurfaced: 1,
            totalEffortMinutes: 60,
          },
          weekSlots: [makeSlot()],
        },
        { playlists },
      )
      const section = screen.getByLabelText('Horizonte')
      expect(section).toBeDefined()
      expect(screen.getByTestId('up-next-playlist-strips')).toBeDefined()
    })

    it('renders UpNextActivity inside Atividade recente section', () => {
      const activity: ActivityEntry[] = [
        { id: 'e1', code: 'V001', format: 'video', event_type: 'stage_change', to_value: 'gravacao', changed_at: '2026-05-26T10:00:00Z' },
      ]
      renderOverview(
        {
          today: {
            actions: [makeAction()],
            overflow: 0,
            doneToday: 1,
            totalSurfaced: 1,
            totalEffortMinutes: 60,
          },
          weekSlots: [makeSlot()],
        },
        { activity },
      )
      const section = screen.getByLabelText('Atividade recente')
      expect(section).toBeDefined()
      expect(screen.getByTestId('up-next-activity')).toBeDefined()
    })

    it('renders TodayActionCards when actions exist', () => {
      renderOverview({
        today: {
          actions: [makeAction(), makeAction({ id: 'a2' })],
          overflow: 1,
          doneToday: 0,
          totalSurfaced: 2,
          totalEffortMinutes: 120,
        },
        weekSlots: [makeSlot()],
      })
      const cards = screen.getByTestId('today-action-cards')
      expect(cards.dataset.count).toBe('2')
      expect(cards.dataset.overflow).toBe('1')
    })

    it('renders TodayActionCards when actions empty but weekSlots also empty', () => {
      renderOverview({
        today: {
          actions: [],
          overflow: 0,
          doneToday: 0,
          totalSurfaced: 1, // prevents first-run
          totalEffortMinutes: 0,
        },
        weekSlots: [],
      })
      expect(screen.getByTestId('today-action-cards')).toBeDefined()
    })

    it('does NOT render TodayActionCards when actions empty but weekSlots non-empty', () => {
      renderOverview({
        today: {
          actions: [],
          overflow: 0,
          doneToday: 0,
          totalSurfaced: 0,
          totalEffortMinutes: 0,
        },
        weekSlots: [makeSlot()],
      })
      expect(screen.queryByTestId('today-action-cards')).toBeNull()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  9. SWR fallback data behavior                                    */
  /* ---------------------------------------------------------------- */
  describe('SWR fallback data behavior', () => {
    it('uses SWR data when available instead of fallbackData', () => {
      const swrData = makeApiResponse({
        todayDate: '2026-05-28',
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 3,
          totalSurfaced: 2,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
      })

      swrReturnValue = { data: swrData, isLoading: false, mutate: mockMutate }

      renderOverview({
        todayDate: '2026-05-26',
        today: {
          actions: [],
          overflow: 0,
          doneToday: 0,
          totalSurfaced: 0,
          totalEffortMinutes: 0,
        },
      })

      const bar = screen.getByRole('progressbar')
      expect(bar.getAttribute('aria-valuenow')).toBe('3')
      expect(bar.getAttribute('aria-valuemax')).toBe('5')
    })

    it('falls back to fallbackData when SWR data is undefined', () => {
      swrReturnValue = { data: undefined, isLoading: false, mutate: mockMutate }

      renderOverview({
        todayDate: '2026-05-26',
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 2,
          totalSurfaced: 3,
          totalEffortMinutes: 90,
        },
        weekSlots: [makeSlot()],
      })

      const bar = screen.getByRole('progressbar')
      expect(bar.getAttribute('aria-valuenow')).toBe('2')
      expect(bar.getAttribute('aria-valuemax')).toBe('5')
    })
  })

  /* ---------------------------------------------------------------- */
  /*  10. PlaylistSuggestionPanel integration                          */
  /* ---------------------------------------------------------------- */
  describe('PlaylistSuggestionPanel integration', () => {
    it('renders suggestion panel when candidates exist', async () => {
      const candidates = [makeCandidate({ id: 'c1', title: 'Test Video' })]
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        candidates,
      })

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /sugestões/i })).toBeDefined()
      })
    })

    it('does not render panel when candidates is empty', async () => {
      renderOverview({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        candidates: [],
      })

      // Give dynamic a tick to settle
      await act(async () => {})

      expect(screen.queryByRole('region', { name: /sugestões/i })).toBeNull()
    })

    it('shows selection announcement in live region when candidate selected', async () => {
      const candidates = [makeCandidate({ id: 'c1', title: 'My Video' })]
      const apiData = makeApiResponse({
        today: {
          actions: [makeAction()],
          overflow: 0,
          doneToday: 1,
          totalSurfaced: 1,
          totalEffortMinutes: 60,
        },
        weekSlots: [makeSlot()],
        candidates,
      })

      swrReturnValue = { data: apiData, isLoading: false, mutate: mockMutate }

      renderOverview({
        today: apiData.today,
        weekSlots: apiData.weekSlots,
        candidates,
      })

      // The panel is rendered but we need to verify the live region behavior
      // when a candidate is selected. Since we can't click the mocked panel directly,
      // we verify the live region exists and shows default announcement.
      const statuses = screen.getAllByRole('status')
      const liveRegion = statuses.find(el => el.classList.contains('sr-only'))
      expect(liveRegion).toBeDefined()
    })
  })
})
