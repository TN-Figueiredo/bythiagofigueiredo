// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockMutate = vi.fn()

vi.mock('swr', () => ({
  default: vi.fn(() => ({ data: undefined, mutate: mockMutate })),
}))

import useSWR from 'swr'
import { useCoworkSync } from './use-cowork-sync'
import type { UseCoworkSyncOptions } from './use-cowork-sync'

const mockUseSWR = vi.mocked(useSWR)

function makeOptions(overrides: Partial<UseCoworkSyncOptions<string>> = {}): UseCoworkSyncOptions<string> {
  return {
    key: null,
    fetcher: vi.fn().mockResolvedValue('result'),
    ...overrides,
  }
}

describe('useCoworkSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseSWR.mockReturnValue({ data: undefined, mutate: mockMutate } as ReturnType<typeof useSWR>)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns syncState idle when key is null', () => {
    const { result } = renderHook(() => useCoworkSync(makeOptions({ key: null })))

    expect(result.current.syncState).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('returns syncState polling when key is set but no data yet', () => {
    const { result } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key' })),
    )

    expect(result.current.syncState).toBe('polling')
  })

  it('returns syncState received when data is available', () => {
    mockUseSWR.mockReturnValue({ data: 'fetched-data', mutate: mockMutate } as ReturnType<typeof useSWR>)

    const { result } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key' })),
    )

    expect(result.current.syncState).toBe('received')
    expect(result.current.data).toBe('fetched-data')
  })

  it('returns syncState timeout after pollTimeout elapses', () => {
    const { result } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key', pollTimeout: 5_000 })),
    )

    expect(result.current.syncState).toBe('polling')

    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    expect(result.current.syncState).toBe('timeout')
  })

  it('retryPolling resets timeout state back to polling', () => {
    const { result } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key', pollTimeout: 5_000 })),
    )

    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    expect(result.current.syncState).toBe('timeout')

    act(() => {
      result.current.retryPolling()
    })

    expect(result.current.syncState).toBe('polling')
  })

  it('passes revalidateOnFocus true to SWR', () => {
    renderHook(() => useCoworkSync(makeOptions({ key: 'test-key' })))

    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    const swrOptions = lastCall[2] as Record<string, unknown>
    expect(swrOptions.revalidateOnFocus).toBe(true)
  })

  it('passes correct refreshInterval and dedupingInterval to SWR', () => {
    renderHook(() =>
      useCoworkSync(makeOptions({
        key: 'test-key',
        refreshInterval: 3_000,
        dedupingInterval: 2_900,
      })),
    )

    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    const swrOptions = lastCall[2] as Record<string, unknown>
    expect(swrOptions.refreshInterval).toBe(3_000)
    expect(swrOptions.dedupingInterval).toBe(2_900)
  })

  it('uses default values when optional params omitted', () => {
    renderHook(() => useCoworkSync(makeOptions({ key: 'test-key' })))

    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    const swrOptions = lastCall[2] as Record<string, unknown>
    expect(swrOptions.refreshInterval).toBe(5_000)
    expect(swrOptions.dedupingInterval).toBe(4_900)
  })

  it('stops polling by passing null key to SWR when timed out', () => {
    const { result } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key', pollTimeout: 5_000 })),
    )

    const callBeforeTimeout = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    expect(callBeforeTimeout[0]).toBe('test-key')

    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    const callAfterTimeout = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    expect(callAfterTimeout[0]).toBeNull()

    expect(result.current.syncState).toBe('timeout')
  })

  it('key change triggers new polling (key-a → key-b resets to polling)', () => {
    let key = 'key-a'
    mockUseSWR.mockReturnValue({ data: 'old-data', mutate: mockMutate } as ReturnType<typeof useSWR>)

    const { result, rerender } = renderHook(() =>
      useCoworkSync(makeOptions({ key })),
    )

    expect(result.current.syncState).toBe('received')

    // Change key and clear data so SWR returns undefined for the new key
    key = 'key-b'
    mockUseSWR.mockReturnValue({ data: undefined, mutate: mockMutate } as ReturnType<typeof useSWR>)
    rerender()

    expect(result.current.syncState).toBe('polling')
    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    expect(lastCall[0]).toBe('key-b')
  })

  it('key change resets polling timeout (key-a partial timeout does not carry over to key-b)', () => {
    let key = 'key-a'
    const pollTimeout = 10_000
    mockUseSWR.mockReturnValue({ data: undefined, mutate: mockMutate } as ReturnType<typeof useSWR>)

    const { result, rerender } = renderHook(() =>
      useCoworkSync(makeOptions({ key, pollTimeout })),
    )

    expect(result.current.syncState).toBe('polling')

    // Advance 8s of the 10s timeout on key-a
    act(() => {
      vi.advanceTimersByTime(8_000)
    })
    expect(result.current.syncState).toBe('polling')

    // Switch to key-b — timeout should reset, giving a fresh 10s window
    key = 'key-b'
    rerender()

    expect(result.current.syncState).toBe('polling')

    // Advance another 8s — would have exceeded 10s if old start carried over,
    // but since timeout reset, we should still be polling
    act(() => {
      vi.advanceTimersByTime(8_000)
    })
    expect(result.current.syncState).toBe('polling')

    // Advance 3 more seconds (total 11s on key-b) — NOW it should timeout
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(result.current.syncState).toBe('timeout')
  })

  it('key change clears timed-out state from previous key', () => {
    let key = 'key-a'
    const pollTimeout = 5_000
    mockUseSWR.mockReturnValue({ data: undefined, mutate: mockMutate } as ReturnType<typeof useSWR>)

    const { result, rerender } = renderHook(() =>
      useCoworkSync(makeOptions({ key, pollTimeout })),
    )

    // Timeout on key-a
    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(result.current.syncState).toBe('timeout')

    // Switch directly to key-b (no null transition) — should reset to polling
    key = 'key-b'
    rerender()

    expect(result.current.syncState).toBe('polling')
    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    expect(lastCall[0]).toBe('key-b')
  })

  it('key set to null stops polling and returns to idle', () => {
    let key: string | null = 'active-key'

    const { result, rerender } = renderHook(() =>
      useCoworkSync(makeOptions({ key })),
    )

    expect(result.current.syncState).toBe('polling')

    key = null
    rerender()

    expect(result.current.syncState).toBe('idle')
    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    expect(lastCall[0]).toBeNull()
  })

  it('fallbackData is passed through to SWR config', () => {
    renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key', fallbackData: 'fallback-value' })),
    )

    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    const swrOptions = lastCall[2] as Record<string, unknown>
    expect(swrOptions.fallbackData).toBe('fallback-value')
  })

  it('custom intervals override defaults', () => {
    renderHook(() =>
      useCoworkSync(makeOptions({
        key: 'test-key',
        refreshInterval: 10_000,
        dedupingInterval: 9_500,
      })),
    )

    const lastCall = mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]
    const swrOptions = lastCall[2] as Record<string, unknown>
    expect(swrOptions.refreshInterval).toBe(10_000)
    expect(swrOptions.dedupingInterval).toBe(9_500)
  })

  it('multiple retryPolling calls do not break the state machine', () => {
    const { result } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key', pollTimeout: 5_000 })),
    )

    // Timeout first
    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(result.current.syncState).toBe('timeout')

    // First retry
    act(() => {
      result.current.retryPolling()
    })
    expect(result.current.syncState).toBe('polling')

    // Timeout again
    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(result.current.syncState).toBe('timeout')

    // Second retry
    act(() => {
      result.current.retryPolling()
    })
    expect(result.current.syncState).toBe('polling')

    // Third retry immediately (no timeout in between)
    act(() => {
      result.current.retryPolling()
    })
    expect(result.current.syncState).toBe('polling')
  })

  it('unmount during polling does not cause state updates (no memory leaks)', () => {
    const { result, unmount } = renderHook(() =>
      useCoworkSync(makeOptions({ key: 'test-key', pollTimeout: 5_000 })),
    )

    expect(result.current.syncState).toBe('polling')

    // Unmount while polling is active
    unmount()

    // Advance timers past the timeout — should not throw or warn
    // about updating state on an unmounted component
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    // State remains as it was at unmount time (no post-unmount updates)
    expect(result.current.syncState).toBe('polling')
  })
})
