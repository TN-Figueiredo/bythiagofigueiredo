// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import type { UpNextApiResponse, WeekSlot } from '@/lib/pipeline/up-next-types'

import { useSlotAssignment } from '../../src/app/cms/(authed)/pipeline/_components/use-slot-assignment'

// ── Fixtures ────────────────────────────────────────────────────────────────

const ITEM_A = { id: 'aaa-111', title: 'Video A', stage: 'roteiro' as const }
const ITEM_B = { id: 'bbb-222', title: 'Video B', stage: 'gravacao' as const }

function makeSlot(overrides: Partial<WeekSlot> = {}): WeekSlot {
  return {
    day: '2026-05-26',
    dayLabel: 'seg 26',
    hour: '10:00',
    format: 'video',
    channelLocale: 'pt',
    channelId: 'ch-1',
    isRestDay: false,
    assignedItem: null,
    effortMinutes: 60,
    ...overrides,
  }
}

function makeSnapshot(weekSlots: WeekSlot[], candidates: UpNextApiResponse['candidates'] = []): UpNextApiResponse {
  return {
    today: { actions: [], overflow: 0, doneToday: 0, totalSurfaced: 0, totalEffortMinutes: 0 },
    todayDate: '2026-05-26',
    weekSlots,
    streak: { currentStreak: 3, isActive: true },
    stageCounts: {},
    playlists: [],
    candidates,
    nextWeekEmpty: 0,
    backlogCount: 0,
    suggestion: null,
    errors: { today: null, weekSlots: null, streak: null, playlists: null },
  }
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('useSlotAssignment', () => {
  let mockMutate: ReturnType<typeof vi.fn>
  let dataRef: { current: UpNextApiResponse | undefined }

  beforeEach(() => {
    vi.restoreAllMocks()
    mockMutate = vi.fn()
    dataRef = { current: undefined }
    // Default: fetch succeeds
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: ITEM_A.id } }),
    }))
  })

  // ── 1. Optimistic update assigns item to correct empty slot ──────────

  it('optimistic update assigns item to correct empty slot', async () => {
    const emptySlot = makeSlot({ day: '2026-05-26', hour: '10:00', format: 'video' })
    const snapshot = makeSnapshot(
      [emptySlot],
      [{ id: ITEM_A.id, title: ITEM_A.title, stage: ITEM_A.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00')
    })

    // mutate called first with optimistic updater function, then again for revalidation
    expect(mockMutate).toHaveBeenCalledTimes(2)

    // First call: optimistic update function
    const optimisticCall = mockMutate.mock.calls[0]
    const updaterFn = optimisticCall[0]
    expect(typeof updaterFn).toBe('function')

    // Invoke the updater function to check it produces correct data
    const updated = updaterFn(snapshot)
    expect(updated.weekSlots[0].assignedItem).toEqual({
      id: ITEM_A.id,
      title: ITEM_A.title,
      stage: ITEM_A.stage,
    })
    expect(optimisticCall[1]).toEqual({ revalidate: false })
  })

  // ── 2. Swap clears old slot on different day ─────────────────────────

  it('swap clears old slot and fills new slot', async () => {
    const oldSlot = makeSlot({ day: '2026-05-25', hour: '14:00', format: 'video', assignedItem: ITEM_B })
    const newSlot = makeSlot({ day: '2026-05-26', hour: '10:00', format: 'video', assignedItem: null })
    const snapshot = makeSnapshot(
      [oldSlot, newSlot],
      [{ id: ITEM_B.id, title: ITEM_B.title, stage: ITEM_B.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      await result.current.handleAssignSlot(ITEM_B.id, '2026-05-26', '10:00', ITEM_B.id)
    })

    const updaterFn = mockMutate.mock.calls[0][0]
    const updated = updaterFn(snapshot)

    // Old slot cleared
    expect(updated.weekSlots[0].assignedItem).toBeNull()
    // New slot filled
    expect(updated.weekSlots[1].assignedItem).toEqual({
      id: ITEM_B.id,
      title: ITEM_B.title,
      stage: ITEM_B.stage,
    })
  })

  // ── 3. Rollback on POST failure ──────────────────────────────────────

  it('rollback on POST failure restores snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const slot = makeSlot({ format: 'video' })
    const snapshot = makeSnapshot(
      [slot],
      [{ id: ITEM_A.id, title: ITEM_A.title, stage: ITEM_A.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      try {
        await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00')
      } catch {
        // expected
      }
    })

    // Last mutate call should be the rollback with the original snapshot
    const lastCall = mockMutate.mock.calls[mockMutate.mock.calls.length - 1]
    expect(lastCall[0]).toBe(snapshot)
    expect(lastCall[1]).toEqual({ revalidate: true })
  })

  // ── 4. Candidate not found skips optimistic but still POSTs ──────────

  it('candidate not found skips optimistic but still POSTs', async () => {
    const slot = makeSlot({ format: 'video' })
    const snapshot = makeSnapshot([slot], []) // no candidates
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      await result.current.handleAssignSlot('unknown-id', '2026-05-26', '10:00')
    })

    // No optimistic mutate call (first mutate is the revalidation call)
    // mutate should be called once: just the final revalidation mutate()
    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith() // bare revalidation

    // fetch still called
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  // ── 5. Announcement set on success ───────────────────────────────────

  it('announcement set on success', async () => {
    const slot = makeSlot({ format: 'video' })
    const snapshot = makeSnapshot(
      [slot],
      [{ id: ITEM_A.id, title: ITEM_A.title, stage: ITEM_A.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00')
    })

    expect(result.current.announcement).toBe('Item atribuído ao slot')
  })

  // ── 6. Announcement set on error ─────────────────────────────────────

  it('announcement set on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Server exploded')))

    const slot = makeSlot({ format: 'video' })
    const snapshot = makeSnapshot(
      [slot],
      [{ id: ITEM_A.id, title: ITEM_A.title, stage: ITEM_A.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      try {
        await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00')
      } catch {
        // expected
      }
    })

    expect(result.current.announcement).toBe('Server exploded')
  })

  // ── 7. POST payload is correct ───────────────────────────────────────

  it('POST payload is correct', async () => {
    const slot = makeSlot({ format: 'video' })
    const snapshot = makeSnapshot(
      [slot],
      [{ id: ITEM_A.id, title: ITEM_A.title, stage: ITEM_A.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00', 'prev-id')
    })

    expect(fetch).toHaveBeenCalledWith('/api/pipeline/up-next', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: ITEM_A.id,
        slotDay: '2026-05-26',
        slotHour: '10:00',
        previousItemId: 'prev-id',
      }),
    }))
  })

  // ── Edge: no snapshot → early return ─────────────────────────────────

  it('does nothing when snapshot is undefined', async () => {
    dataRef.current = undefined

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00')
    })

    expect(mockMutate).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  // ── Edge: non-ok response sets announcement from error body ──────────

  it('non-ok HTTP response triggers rollback with error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Slot conflict' } }),
    }))

    const slot = makeSlot({ format: 'video' })
    const snapshot = makeSnapshot(
      [slot],
      [{ id: ITEM_A.id, title: ITEM_A.title, stage: ITEM_A.stage, format: 'video', language: 'pt-br' }],
    )
    dataRef.current = snapshot

    const { result } = renderHook(() => useSlotAssignment(mockMutate, dataRef))

    await act(async () => {
      try {
        await result.current.handleAssignSlot(ITEM_A.id, '2026-05-26', '10:00')
      } catch {
        // expected
      }
    })

    expect(result.current.announcement).toBe('Slot conflict')
    // Rollback called
    const lastCall = mockMutate.mock.calls[mockMutate.mock.calls.length - 1]
    expect(lastCall[0]).toBe(snapshot)
  })
})
