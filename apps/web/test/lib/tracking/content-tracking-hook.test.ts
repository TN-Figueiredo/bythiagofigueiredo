/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true), webdriver: false })

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

vi.mock('@/components/lgpd/cookie-banner-context', () => ({
  useCookieConsent: () => ({
    consent: { analytics: false, anonymousId: 'anon-test-id' },
  }),
}))

import { useContentTracking } from '@/lib/tracking/use-content-tracking'

describe('useContentTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockStorage.clear()
    mockProgress = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not emit events when isPreview is true', () => {
    renderHook(() =>
      useContentTracking({
        siteId: 'site-1',
        resourceType: 'blog',
        resourceId: 'post-1',
        locale: 'en',
        isPreview: true,
      }),
    )
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('emits view event after 3 seconds', () => {
    renderHook(() =>
      useContentTracking({
        siteId: 'site-1',
        resourceType: 'blog',
        resourceId: 'post-1',
        locale: 'en',
      }),
    )
    act(() => { vi.advanceTimersByTime(3100) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].eventType).toBe('view')
  })

  it('skips when navigator.webdriver is true', () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, writable: true })
    renderHook(() =>
      useContentTracking({
        siteId: 'site-1',
        resourceType: 'blog',
        resourceId: 'post-1',
        locale: 'en',
      }),
    )
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'webdriver', { value: false, writable: true })
  })
})
