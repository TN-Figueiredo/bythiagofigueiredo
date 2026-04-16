import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, within, act } from '@testing-library/react'
import { CookieBanner } from '../../../src/components/lgpd/cookie-banner'
import { CookieBannerProvider } from '../../../src/components/lgpd/cookie-banner-context'

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

function setup(locale?: string) {
  if (locale) {
    Object.defineProperty(navigator, 'language', { value: locale, configurable: true })
  }
  return render(
    <CookieBannerProvider initialOpen>
      <CookieBanner />
    </CookieBannerProvider>,
  )
}

describe('CookieBanner', () => {
  beforeEach(() => {
    installLocalStorageShim()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))),
    )
  })

  it('renders as an ARIA dialog with accessible name', () => {
    setup('pt-BR')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
  })

  it('Accept and Reject buttons have equal visual prominence', () => {
    setup('pt-BR')
    const accept = screen.getByRole('button', { name: /aceitar todos/i })
    const reject = screen.getByRole('button', { name: /rejeitar todos/i })
    // LGPD rule: equal-prominence → same CSS class on both (no primary/secondary).
    expect(accept.className).toBe(reject.className)
  })

  it('Functional toggle is always on and disabled (locked)', () => {
    setup('pt-BR')
    fireEvent.click(screen.getByRole('button', { name: /personalizar/i }))
    const functional = screen.getByRole('checkbox', { name: /funcionais/i }) as HTMLInputElement
    expect(functional.checked).toBe(true)
    expect(functional.disabled).toBe(true)
  })

  it('Analytics and Marketing default OFF (opt-in only)', () => {
    setup('pt-BR')
    fireEvent.click(screen.getByRole('button', { name: /personalizar/i }))
    const analytics = screen.getByRole('checkbox', { name: /analytics|anal[íi]tica/i }) as HTMLInputElement
    const marketing = screen.getByRole('checkbox', { name: /marketing/i }) as HTMLInputElement
    expect(analytics.checked).toBe(false)
    expect(marketing.checked).toBe(false)
  })

  it('Reject all persists functional-only consent', async () => {
    setup('pt-BR')
    fireEvent.click(screen.getByRole('button', { name: /rejeitar todos/i }))
    await act(async () => {})
    const stored = JSON.parse(window.localStorage.getItem('lgpd_consent_v1')!)
    expect(stored).toMatchObject({ analytics: false, marketing: false })
  })

  it('Accept all persists analytics + marketing true', async () => {
    setup('pt-BR')
    fireEvent.click(screen.getByRole('button', { name: /aceitar todos/i }))
    await act(async () => {})
    const stored = JSON.parse(window.localStorage.getItem('lgpd_consent_v1')!)
    expect(stored).toMatchObject({ analytics: true, marketing: true })
  })

  it('Custom save with only marketing on persists selective consent', async () => {
    setup('pt-BR')
    fireEvent.click(screen.getByRole('button', { name: /personalizar/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /marketing/i }))
    fireEvent.click(screen.getByRole('button', { name: /salvar prefer/i }))
    await act(async () => {})
    const stored = JSON.parse(window.localStorage.getItem('lgpd_consent_v1')!)
    expect(stored).toMatchObject({ analytics: false, marketing: true })
  })

  it('Escape key closes the banner', () => {
    setup('pt-BR')
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    // Dialog should unmount or hide.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('negotiates Portuguese strings when navigator.language is pt-BR', () => {
    setup('pt-BR')
    expect(screen.getByRole('heading', { name: /cookies e privacidade/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /aceitar todos/i })).toBeTruthy()
  })

  it('negotiates English strings when navigator.language is en-US', () => {
    setup('en-US')
    expect(screen.getByRole('button', { name: /accept all/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /reject all/i })).toBeTruthy()
  })

  it('auto-focuses the primary actionable element when opened', () => {
    setup('pt-BR')
    const dialog = screen.getByRole('dialog')
    const focused = within(dialog).getByRole('button', { name: /aceitar todos/i })
    // Focus moves to the dialog's first focusable on mount.
    expect(document.activeElement === focused || dialog.contains(document.activeElement)).toBe(true)
  })
})
