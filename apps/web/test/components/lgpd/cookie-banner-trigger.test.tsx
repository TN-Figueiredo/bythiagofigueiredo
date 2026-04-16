import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { CookieBannerTrigger } from '../../../src/components/lgpd/cookie-banner-trigger'
import { CookieBannerProvider, useCookieConsent } from '../../../src/components/lgpd/cookie-banner-context'

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

function OpenProbe({ onState }: { onState: (open: boolean) => void }) {
  const ctx = useCookieConsent()
  onState(ctx.isOpen)
  return null
}

describe('CookieBannerTrigger', () => {
  beforeEach(() => {
    installLocalStorageShim()
  })

  it('renders a labelled button', () => {
    render(
      <CookieBannerProvider>
        <CookieBannerTrigger />
      </CookieBannerProvider>,
    )
    const btn = screen.getByRole('button', { name: /cookie/i })
    expect(btn).toBeTruthy()
  })

  it('opens the banner when clicked (post-dismissal re-open path)', () => {
    const states: boolean[] = []
    render(
      <CookieBannerProvider initialOpen={false}>
        <OpenProbe onState={(s) => states.push(s)} />
        <CookieBannerTrigger />
      </CookieBannerProvider>,
    )
    expect(states[states.length - 1]).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /cookie/i }))
    expect(states[states.length - 1]).toBe(true)
  })

  it('uses English label when localeOverride is en', () => {
    render(
      <CookieBannerProvider>
        <CookieBannerTrigger localeOverride="en" />
      </CookieBannerProvider>,
    )
    expect(screen.getByRole('button', { name: /cookie settings/i })).toBeTruthy()
  })
})
