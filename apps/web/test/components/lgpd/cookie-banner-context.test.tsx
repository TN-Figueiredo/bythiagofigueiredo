import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import {
  CookieBannerProvider,
  useCookieConsent,
  type CookieConsent,
} from '../../../src/components/lgpd/cookie-banner-context'

// happy-dom sometimes ships localStorage as a frozen proxy without .clear;
// install an in-memory shim so every test starts from a clean slate.
function installLocalStorageShim() {
  const store = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  }
  Object.defineProperty(window, 'localStorage', { value: shim, writable: true, configurable: true })
}

function Reader({ onValue }: { onValue: (v: CookieConsent | null) => void }) {
  const ctx = useCookieConsent()
  useEffect(() => {
    onValue(ctx.consent)
  }, [ctx.consent, onValue])
  return null
}

describe('CookieBannerProvider', () => {
  beforeEach(() => {
    installLocalStorageShim()
    // Mock the anonymous-consent POST so we don't hit a real network.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
      ),
    )
  })

  it('starts with null consent when localStorage is empty', () => {
    const onValue = vi.fn()
    render(
      <CookieBannerProvider>
        <Reader onValue={onValue} />
      </CookieBannerProvider>,
    )
    expect(onValue).toHaveBeenCalledWith(null)
  })

  it('reads stored consent from localStorage on mount', () => {
    window.localStorage.setItem(
      'lgpd_consent_v1',
      JSON.stringify({
        functional: true,
        analytics: true,
        marketing: false,
        version: 1,
        anonymousId: 'abc',
      }),
    )
    const onValue = vi.fn()
    render(
      <CookieBannerProvider>
        <Reader onValue={onValue} />
      </CookieBannerProvider>,
    )
    expect(onValue).toHaveBeenCalledWith(
      expect.objectContaining({ functional: true, analytics: true, marketing: false }),
    )
  })

  it('setConsent persists to localStorage and mirrors analytics flag', () => {
    let api!: ReturnType<typeof useCookieConsent>
    function Capture() {
      api = useCookieConsent()
      return null
    }
    render(
      <CookieBannerProvider>
        <Capture />
      </CookieBannerProvider>,
    )
    act(() => {
      api.setConsent({ functional: true, analytics: true, marketing: false })
    })
    const stored = JSON.parse(window.localStorage.getItem('lgpd_consent_v1')!)
    expect(stored.analytics).toBe(true)
    expect(window.localStorage.getItem('cookie_analytics_consent')).toBe('true')
  })

  it('generates an anonymous_id UUID v4 on first consent', () => {
    let api!: ReturnType<typeof useCookieConsent>
    function Capture() {
      api = useCookieConsent()
      return null
    }
    render(
      <CookieBannerProvider>
        <Capture />
      </CookieBannerProvider>,
    )
    act(() => {
      api.setConsent({ functional: true, analytics: false, marketing: false })
    })
    const anon = window.localStorage.getItem('lgpd_anon_id')
    expect(anon).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('syncs state across tabs via storage event', () => {
    const onValue = vi.fn()
    render(
      <CookieBannerProvider>
        <Reader onValue={onValue} />
      </CookieBannerProvider>,
    )
    act(() => {
      window.localStorage.setItem(
        'lgpd_consent_v1',
        JSON.stringify({
          functional: true,
          analytics: true,
          marketing: true,
          version: 1,
          anonymousId: 'xyz',
        }),
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'lgpd_consent_v1',
          newValue: window.localStorage.getItem('lgpd_consent_v1'),
        }),
      )
    })
    const last = onValue.mock.calls.at(-1)?.[0]
    expect(last).toMatchObject({ functional: true, analytics: true, marketing: true })
  })
})
