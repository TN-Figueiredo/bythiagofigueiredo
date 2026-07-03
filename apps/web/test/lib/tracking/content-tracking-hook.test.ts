/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
const mockBeacon = vi.fn(() => true)
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('navigator', { sendBeacon: mockBeacon, webdriver: false })

const mockStorage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
})
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => mockStorage.get('ss_' + k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set('ss_' + k, v),
  removeItem: (k: string) => mockStorage.delete('ss_' + k),
})

let mockProgress = 0
vi.mock('@/components/blog/scroll-context', () => ({
  useScrollState: () => ({ progress: mockProgress, activeSection: null, sectionProgress: new Map(), visible: true }),
}))

// Mutable consent so each test can flip the analytics opt-in.
let mockConsent: { analytics: boolean; anonymousId: string } | null = {
  analytics: true,
  anonymousId: 'anon-test-id',
}
vi.mock('@/components/lgpd/cookie-banner-context', () => ({
  useCookieConsent: () => ({ consent: mockConsent }),
}))

import { useContentTracking } from '@/lib/tracking/use-content-tracking'

const baseConfig = {
  siteId: 'site-1',
  resourceType: 'blog' as const,
  resourceId: 'post-1',
  locale: 'en',
}

describe('useContentTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockStorage.clear()
    mockProgress = 0
    mockConsent = { analytics: true, anonymousId: 'anon-test-id' }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not emit events when isPreview is true', () => {
    renderHook(() => useContentTracking({ ...baseConfig, isPreview: true }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('emits view event after 3 seconds when analytics consent granted', () => {
    renderHook(() => useContentTracking(baseConfig))
    act(() => { vi.advanceTimersByTime(3100) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].eventType).toBe('view')
    expect(body.events[0].hasConsent).toBe(true)
  })

  it('skips when navigator.webdriver is true', () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, writable: true })
    renderHook(() => useContentTracking(baseConfig))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'webdriver', { value: false, writable: true })
  })

  // BTF-095 — LGPD Art. 7 I / Art. 8: zero analytics without explicit opt-in.
  describe('consent gate (BTF-095)', () => {
    it('emits NO view event when analytics consent is false', () => {
      mockConsent = { analytics: false, anonymousId: 'anon-test-id' }
      renderHook(() => useContentTracking(baseConfig))
      act(() => { vi.advanceTimersByTime(5000) })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('emits NO view event when consent is null (never decided)', () => {
      mockConsent = null
      renderHook(() => useContentTracking(baseConfig))
      act(() => { vi.advanceTimersByTime(5000) })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('emits NO read_complete beacon when analytics consent is false', () => {
      mockConsent = { analytics: false, anonymousId: 'anon-test-id' }
      mockProgress = 1 // 100% scroll → would normally trigger read_complete
      renderHook(() => useContentTracking(baseConfig))
      act(() => { vi.advanceTimersByTime(5000) })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('sends read_complete when analytics consent is true and scrolled to end', () => {
      mockProgress = 1
      renderHook(() => useContentTracking(baseConfig))
      act(() => { vi.advanceTimersByTime(3100) })
      const readComplete = mockFetch.mock.calls
        .map((c) => JSON.parse(c[1]?.body as string).events[0])
        .find((e) => e.eventType === 'read_complete')
      expect(readComplete).toBeDefined()
      expect(readComplete.hasConsent).toBe(true)
    })

    it('does NOT beacon read_progress on page-hide when consent is false', () => {
      mockConsent = { analytics: false, anonymousId: 'anon-test-id' }
      renderHook(() => useContentTracking(baseConfig))
      act(() => {
        window.dispatchEvent(new Event('pagehide'))
      })
      expect(mockBeacon).not.toHaveBeenCalled()
    })

    it('beacons read_progress on page-hide when consent is true', () => {
      renderHook(() => useContentTracking(baseConfig))
      act(() => {
        window.dispatchEvent(new Event('pagehide'))
      })
      expect(mockBeacon).toHaveBeenCalledTimes(1)
    })
  })
})
