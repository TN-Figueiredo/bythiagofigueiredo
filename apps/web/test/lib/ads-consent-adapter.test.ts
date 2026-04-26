import { describe, it, expect, vi, beforeEach } from 'vitest'

const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
  get length() { return Object.keys(store).length },
  key: vi.fn((_i: number) => null),
}
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('createConsentAdapter', () => {
  async function loadFresh() {
    vi.resetModules()
    const mod = await import('../../src/lib/ads/consent-adapter')
    return mod.createConsentAdapter()
  }

  it('returns loaded:false when localStorage has no key', async () => {
    const adapter = await loadFresh()
    const result = adapter.getConsent()
    expect(result.loaded).toBe(false)
    expect(result.marketing).toBe(false)
    expect(result.analytics).toBe(false)
  })

  it('returns loaded:true with marketing+analytics when stored in lgpd_consent_v1', async () => {
    store['lgpd_consent_v1'] = JSON.stringify({
      cookie_marketing: true,
      cookie_analytics: true,
    })
    const adapter = await loadFresh()
    const result = adapter.getConsent()
    expect(result.loaded).toBe(true)
    expect(result.marketing).toBe(true)
    expect(result.analytics).toBe(true)
  })

  it('returns marketing:false when cookie_marketing is false', async () => {
    store['lgpd_consent_v1'] = JSON.stringify({
      cookie_marketing: false,
      cookie_analytics: true,
    })
    const adapter = await loadFresh()
    const result = adapter.getConsent()
    expect(result.marketing).toBe(false)
    expect(result.analytics).toBe(true)
  })

  it('returns loaded:false and false values when JSON is malformed', async () => {
    store['lgpd_consent_v1'] = 'not-json{'
    const adapter = await loadFresh()
    expect(() => adapter.getConsent()).not.toThrow()
    const result = adapter.getConsent()
    expect(result.loaded).toBe(false)
  })

  it('subscribe registers and returns an unsubscribe function', async () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener')
    const removeSpy = vi.spyOn(globalThis, 'removeEventListener')
    const adapter = await loadFresh()
    const unsub = adapter.subscribe(() => {})
    expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    unsub()
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
  })

  it('subscribe callback fires when lgpd_consent_v1 key changes', async () => {
    const adapter = await loadFresh()
    const callback = vi.fn()
    adapter.subscribe(callback)

    store['lgpd_consent_v1'] = JSON.stringify({ cookie_marketing: true, cookie_analytics: false })

    const event = new StorageEvent('storage', { key: 'lgpd_consent_v1' })
    globalThis.dispatchEvent(event)

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ marketing: true, analytics: false }),
    )
  })

  it('subscribe callback does not fire for unrelated storage keys', async () => {
    const adapter = await loadFresh()
    const callback = vi.fn()
    adapter.subscribe(callback)

    const event = new StorageEvent('storage', { key: 'other_key' })
    globalThis.dispatchEvent(event)

    expect(callback).not.toHaveBeenCalled()
  })
})
