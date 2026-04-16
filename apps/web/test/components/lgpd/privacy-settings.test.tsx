import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacySettings } from '../../../src/components/lgpd/privacy-settings'

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

describe('PrivacySettings', () => {
  beforeEach(() => {
    installLocalStorageShim()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
    )
  })

  it('renders a "Privacidade" heading', () => {
    render(<PrivacySettings consents={[]} requests={[]} userEmail="u@example.com" />)
    expect(screen.getByRole('heading', { name: /privacidade/i })).toBeTruthy()
  })

  it('renders the consents panel with passed consents', () => {
    render(
      <PrivacySettings
        userEmail="u@example.com"
        consents={[
          {
            id: 'c1',
            category: 'analytics',
            granted: true,
            grantedAt: '2026-04-10T10:00:00Z',
            version: 1,
          },
        ]}
        requests={[]}
      />,
    )
    expect(screen.getByRole('button', { name: /revogar analytics/i })).toBeTruthy()
  })

  it('renders per-request status cards', () => {
    render(
      <PrivacySettings
        userEmail="u@example.com"
        consents={[]}
        requests={[
          {
            id: 'req-42',
            type: 'data_export',
            status: 'completed',
            completedAt: '2026-04-11T10:00:00Z',
          },
        ]}
      />,
    )
    expect(screen.getByText(/req-42/)).toBeTruthy()
  })

  it('includes a "re-open cookie banner" entry for anonymous revocation', () => {
    render(<PrivacySettings userEmail="u@example.com" consents={[]} requests={[]} />)
    expect(screen.getByRole('button', { name: /cookie/i })).toBeTruthy()
  })
})
