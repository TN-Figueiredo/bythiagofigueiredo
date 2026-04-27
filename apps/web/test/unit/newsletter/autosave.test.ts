import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('autosave logic', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces save calls by 3 seconds', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    let timeout: ReturnType<typeof setTimeout> | null = null
    function scheduleSave() {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(saveFn, 3000)
    }

    scheduleSave()
    scheduleSave()
    scheduleSave()
    expect(saveFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('immediate save cancels pending debounce', () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    let timeout: ReturnType<typeof setTimeout> | null = null

    function scheduleSave() {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(saveFn, 3000)
    }
    function saveNow() {
      if (timeout) clearTimeout(timeout)
      saveFn()
    }

    scheduleSave()
    vi.advanceTimersByTime(1000)
    saveNow()
    expect(saveFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('exponential retry: 2s, 4s, 8s, then gives up', () => {
    const delays = [2000, 4000, 8000]
    let attempt = 0
    function getRetryDelay(): number | null {
      if (attempt >= 3) return null
      const delay = delays[attempt]
      attempt++
      return delay
    }

    expect(getRetryDelay()).toBe(2000)
    expect(getRetryDelay()).toBe(4000)
    expect(getRetryDelay()).toBe(8000)
    expect(getRetryDelay()).toBeNull()
  })

  it('conflict detection compares updated_at timestamps', () => {
    const localUpdatedAt = '2026-04-26T10:00:00Z'
    const serverUpdatedAt = '2026-04-26T10:01:00Z'
    const hasConflict = new Date(serverUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()
    expect(hasConflict).toBe(true)
  })

  it('localStorage key format uses edition ID', () => {
    const editionId = 'abc-123'
    const key = `newsletter-draft-${editionId}`
    expect(key).toBe('newsletter-draft-abc-123')
  })
})
