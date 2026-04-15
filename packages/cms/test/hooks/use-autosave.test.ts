import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutosave } from '../../src/hooks/use-autosave'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  const mock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k)
    },
    setItem: (k, v) => {
      store.set(k, String(v))
    },
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: mock,
  })
  return mock
}

describe('useAutosave', () => {
  beforeEach(() => {
    installLocalStorageMock()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('persists the value to localStorage after the debounce window', () => {
    const { rerender } = renderHook(
      ({ value }) => useAutosave('post-draft:test', value, { debounceMs: 1000 }),
      { initialProps: { value: { title: 'a' } } },
    )

    // Before debounce: nothing written
    expect(window.localStorage.getItem('post-draft:test')).toBe(null)

    rerender({ value: { title: 'hello' } })
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(window.localStorage.getItem('post-draft:test')).toBe(null)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(window.localStorage.getItem('post-draft:test')).toBe(
      JSON.stringify({ title: 'hello' }),
    )
  })

  it('skips persist when value is unchanged (referential or value-equal)', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const { rerender } = renderHook(
      ({ value }) => useAutosave('post-draft:skip', value, { debounceMs: 500 }),
      { initialProps: { value: { a: 1 } } },
    )

    // First effect run establishes baseline
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const firstCount = setItemSpy.mock.calls.length

    // Rerender with value-equal object — should NOT re-persist.
    rerender({ value: { a: 1 } })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(setItemSpy.mock.calls.length).toBe(firstCount)
    setItemSpy.mockRestore()
  })

  it('exposes hasDraft=true when storage already has a draft on mount', () => {
    window.localStorage.setItem(
      'post-draft:existing',
      JSON.stringify({ title: 'prior' }),
    )
    const { result } = renderHook(() =>
      useAutosave('post-draft:existing', { title: 'current' }),
    )

    // effect runs after mount
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.hasDraft).toBe(true)
    expect(result.current.draft).toEqual({ title: 'prior' })
  })

  it('restore() returns the snapshot and clears hasDraft', () => {
    window.localStorage.setItem('post-draft:r', JSON.stringify({ body: 'old' }))
    const { result } = renderHook(() =>
      useAutosave('post-draft:r', { body: 'new' }),
    )
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.hasDraft).toBe(true)

    let snap: unknown
    act(() => {
      snap = result.current.restore()
    })
    expect(snap).toEqual({ body: 'old' })
    expect(result.current.hasDraft).toBe(false)
  })

  it('discard() removes the storage key and clears hasDraft', () => {
    window.localStorage.setItem('post-draft:d', JSON.stringify({ body: 'old' }))
    const { result } = renderHook(() =>
      useAutosave('post-draft:d', { body: 'new' }),
    )
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.hasDraft).toBe(true)

    act(() => {
      result.current.discard()
    })
    expect(window.localStorage.getItem('post-draft:d')).toBe(null)
    expect(result.current.hasDraft).toBe(false)
  })

  it('does not persist when enabled=false', () => {
    const { rerender } = renderHook(
      ({ value }) =>
        useAutosave('post-draft:off', value, { debounceMs: 100, enabled: false }),
      { initialProps: { value: { x: 1 } } },
    )
    rerender({ value: { x: 2 } })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(window.localStorage.getItem('post-draft:off')).toBe(null)
  })

  it('is SSR-safe: does not throw when window is undefined', async () => {
    // Simulate SSR by temporarily hiding window. We import fresh and call the
    // body without touching localStorage — the hook internals guard on
    // typeof window. Here we just assert the guards exist by invoking the
    // internal helpers with the symbol missing.
    const { __autosaveInternals } = await import('../../src/hooks/use-autosave')
    const originalWindow = globalThis.window
    // @ts-expect-error – intentionally deleting for SSR simulation
    delete globalThis.window
    expect(() => __autosaveInternals.readDraft('x')).not.toThrow()
    expect(__autosaveInternals.readDraft('x')).toBe(null)
    expect(() => __autosaveInternals.writeDraft('x', { a: 1 })).not.toThrow()
    expect(() => __autosaveInternals.removeDraft('x')).not.toThrow()
    globalThis.window = originalWindow
  })
})
