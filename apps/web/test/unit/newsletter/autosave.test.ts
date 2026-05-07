import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '@/app/cms/(authed)/_shared/editor/use-autosave'

const LS_KEY = 'editor-draft-ed-1'

// happy-dom's localStorage may be incomplete; provide a minimal shim
const store = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  get length() { return store.size },
  key: (index: number) => [...store.keys()][index] ?? null,
}

describe('useAutosave hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true })
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    store.clear()
  })

  function setup(
    saveFn = vi.fn().mockResolvedValue({ ok: true }),
    opts: Partial<{ debounceMs: number; maxRetries: number; enabled: boolean; mode: 'auto' | 'manual' | 'guarded'; getPayload: () => Record<string, unknown> }> = {},
  ) {
    const result = renderHook(() =>
      useAutosave({
        editionId: 'ed-1',
        saveFn,
        debounceMs: opts.debounceMs ?? 3000,
        maxRetries: opts.maxRetries ?? 3,
        enabled: opts.enabled ?? true,
        mode: opts.mode,
        getPayload: opts.getPayload,
      }),
    )
    return { ...result, saveFn }
  }

  // ── Initial state ─────────────────────────────────────────────────────────
  it('initial state is saved', () => {
    const { result } = setup()
    expect(result.current.state).toBe('saved')
    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(result.current.lastSavedAt).toBeNull()
  })

  // ── scheduleSave marks dirty ──────────────────────────────────────────────
  it('scheduleSave changes state to unsaved', () => {
    const { result } = setup()
    act(() => {
      result.current.scheduleSave({ subject: 'Draft' })
    })
    expect(result.current.state).toBe('unsaved')
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  // ── Debounce fires saveFn ─────────────────────────────────────────────────
  it('calls saveFn after debounce period', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn)

    act(() => {
      result.current.scheduleSave({ subject: 'Draft' })
    })
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Draft' })
  })

  // ── Saving state ──────────────────────────────────────────────────────────
  it('transitions through saving state', async () => {
    let resolveSave!: (v: { ok: boolean }) => void
    const saveFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve }),
    )
    const { result } = setup(saveFn)

    act(() => {
      result.current.scheduleSave({ subject: 'Draft' })
    })

    // Trigger debounce -- saveFn is called but not resolved yet
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.state).toBe('saving')

    // Resolve the save
    await act(async () => {
      resolveSave({ ok: true })
    })
    expect(result.current.state).toBe('saved')
    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(result.current.lastSavedAt).toBeInstanceOf(Date)
  })

  // ── Debounce resets on rapid scheduleSave calls ───────────────────────────
  it('debounces multiple rapid scheduleSave calls', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn)

    act(() => {
      result.current.scheduleSave({ subject: 'A' })
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      result.current.scheduleSave({ subject: 'B' })
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      result.current.scheduleSave({ subject: 'C' })
    })

    // Not yet -- debounce restarted each time
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ subject: 'C' })
  })

  // ── saveNow triggers immediate save ───────────────────────────────────────
  it('saveNow bypasses debounce and triggers immediately', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn)

    act(() => {
      result.current.scheduleSave({ subject: 'Debounced' })
    })
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => {
      result.current.saveNow({ subject: 'Immediate' })
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Immediate' })

    // Advance past original debounce -- should NOT fire again (cancelled)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  // ── Error and retry ───────────────────────────────────────────────────────
  it('retries with exponential delay on save failure', async () => {
    const saveFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce({ ok: true })
    const { result } = setup(saveFn, { maxRetries: 3 })

    act(() => {
      result.current.scheduleSave({ subject: 'Retry' })
    })

    // Trigger initial save via debounce
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe('error')

    // First retry after 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(saveFn).toHaveBeenCalledTimes(2)
    expect(result.current.state).toBe('error')

    // Second retry after 4000ms
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    expect(saveFn).toHaveBeenCalledTimes(3)
    expect(result.current.state).toBe('saved')
  })

  // ── Max retries exhausted persists to localStorage ────────────────────────
  it('stores to localStorage after max retries exhausted', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: false, error: 'fail' })
    const { result } = setup(saveFn, { maxRetries: 3 })

    act(() => {
      result.current.scheduleSave({ subject: 'Lost' })
    })

    // Initial save (attempt 0)
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    // Retry 1 after 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    // Retry 2 after 4000ms
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    // Retry 3 after 8000ms
    await act(async () => {
      vi.advanceTimersByTime(8000)
    })

    expect(saveFn).toHaveBeenCalledTimes(4) // initial + 3 retries
    expect(result.current.state).toBe('error')
    const stored = localStorage.getItem(LS_KEY)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toEqual({ subject: 'Lost' })
  })

  // ── Offline detection ─────────────────────────────────────────────────────
  it('goes offline when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn)

    act(() => {
      result.current.scheduleSave({ subject: 'Offline' })
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.state).toBe('offline')
    const stored = localStorage.getItem(LS_KEY)
    expect(stored).not.toBeNull()
  })

  // ── Restores from localStorage on mount ───────────────────────────────────
  it('restores unsaved state from localStorage on mount', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ subject: 'Recovered' }))
    const { result } = setup()
    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.state).toBe('unsaved')
  })

  // ── enabled=false disables saving ─────────────────────────────────────────
  it('does not save when enabled=false', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { enabled: false })

    act(() => {
      result.current.scheduleSave({ subject: 'Disabled' })
    })
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(saveFn).not.toHaveBeenCalled()
  })

  // ── Manual mode: scheduleSave does not fire ───────────────────────────────
  it('manual mode: scheduleSave marks dirty but does not fire', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'manual' })

    act(() => {
      result.current.scheduleSave({ subject: 'Manual' })
    })
    expect(result.current.state).toBe('unsaved')
    expect(result.current.hasUnsavedChanges).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(saveFn).not.toHaveBeenCalled()
  })

  // ── Manual mode: saveNow fires immediately ────────────────────────────────
  it('manual mode: saveNow fires immediately', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'manual' })

    act(() => {
      result.current.scheduleSave({ subject: 'Dirty' })
    })

    await act(async () => {
      result.current.saveNow({ subject: 'Now' })
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Now' })
    expect(result.current.state).toBe('saved')
  })

  // ── Guarded mode: saveNow sets needsConfirmation ──────────────────────────
  it('guarded mode: saveNow sets needsConfirmation instead of firing', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'guarded' })

    act(() => {
      result.current.saveNow({ subject: 'Guarded' })
    })
    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.needsConfirmation).toBe(true)
  })

  // ── Guarded mode: confirmSave fires with fresh payload ────────────────────
  it('guarded mode: confirmSave fires using getPayload', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const getPayload = vi.fn().mockReturnValue({ subject: 'Fresh' })
    const { result } = setup(saveFn, { mode: 'guarded', getPayload })

    act(() => {
      result.current.saveNow({ subject: 'Stale' })
    })
    expect(result.current.needsConfirmation).toBe(true)

    await act(async () => {
      result.current.confirmSave()
    })
    expect(getPayload).toHaveBeenCalled()
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Fresh' })
    expect(result.current.needsConfirmation).toBe(false)
    expect(result.current.state).toBe('saved')
  })

  // ── Guarded mode: cancelSave resets confirmation ──────────────────────────
  it('guarded mode: cancelSave clears needsConfirmation', () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'guarded' })

    act(() => {
      result.current.saveNow({ subject: 'X' })
    })
    expect(result.current.needsConfirmation).toBe(true)

    act(() => {
      result.current.cancelSave()
    })
    expect(result.current.needsConfirmation).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  // ── forceSave bypasses guarded mode ───────────────────────────────────────
  it('forceSave bypasses guarded mode and fires immediately', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'guarded' })

    await act(async () => {
      await result.current.forceSave({ subject: 'Force' })
    })
    expect(saveFn).toHaveBeenCalledWith({ subject: 'Force' })
    expect(result.current.needsConfirmation).toBe(false)
  })

  // ── Manual mode: online recovery only marks dirty ─────────────────────────
  it('manual mode: localStorage recovery marks dirty but does not auto-save', () => {
    localStorage.setItem('editor-draft-ed-1', JSON.stringify({ subject: 'Recovered' }))
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = setup(saveFn, { mode: 'manual' })

    expect(result.current.hasUnsavedChanges).toBe(true)
    expect(result.current.state).toBe('unsaved')
    expect(saveFn).not.toHaveBeenCalled()
  })

  // ── mode exposes current mode ─────────────────────────────────────────────
  it('exposes current mode in return value', () => {
    const { result } = setup(vi.fn().mockResolvedValue({ ok: true }), { mode: 'manual' })
    expect(result.current.mode).toBe('manual')
  })

  it('defaults mode to auto', () => {
    const { result } = setup()
    expect(result.current.mode).toBe('auto')
  })
})
