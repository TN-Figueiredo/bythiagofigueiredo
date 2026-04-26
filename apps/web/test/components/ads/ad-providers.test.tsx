import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AdProviders, AdConsentContext } from '../../../src/components/ads/ad-providers'
import { useContext } from 'react'

// Mock next/script to render a plain <script> tag so we can assert presence
vi.mock('next/script', () => ({
  default: function MockScript(props: Record<string, unknown>) {
    return <script data-testid="mock-script" {...props} />
  },
}))

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
  Object.defineProperty(window, 'localStorage', {
    value: shim,
    writable: true,
    configurable: true,
  })
  return store
}

describe('AdProviders', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installLocalStorageShim()
  })

  it('renders children', () => {
    render(
      <AdProviders googleEnabled={false} publisherId={null}>
        <p>child content</p>
      </AdProviders>,
    )
    expect(screen.getByText('child content')).toBeTruthy()
  })

  it('does NOT render AdSense script when googleEnabled is false', () => {
    store.set(
      'lgpd_consent_v1',
      JSON.stringify({ cookie_marketing: true, cookie_analytics: true }),
    )
    render(
      <AdProviders googleEnabled={false} publisherId="ca-pub-123">
        <p>content</p>
      </AdProviders>,
    )
    expect(screen.queryByTestId('mock-script')).toBeNull()
  })

  it('does NOT render AdSense script when publisherId is null', () => {
    store.set(
      'lgpd_consent_v1',
      JSON.stringify({ cookie_marketing: true, cookie_analytics: true }),
    )
    render(
      <AdProviders googleEnabled={true} publisherId={null}>
        <p>content</p>
      </AdProviders>,
    )
    expect(screen.queryByTestId('mock-script')).toBeNull()
  })

  it('does NOT render AdSense script when marketing consent is not granted', async () => {
    store.set(
      'lgpd_consent_v1',
      JSON.stringify({ cookie_marketing: false, cookie_analytics: true }),
    )
    await act(async () => {
      render(
        <AdProviders googleEnabled={true} publisherId="ca-pub-123">
          <p>content</p>
        </AdProviders>,
      )
    })
    expect(screen.queryByTestId('mock-script')).toBeNull()
  })

  it('renders AdSense script when all conditions met', async () => {
    store.set(
      'lgpd_consent_v1',
      JSON.stringify({ cookie_marketing: true, cookie_analytics: true }),
    )
    await act(async () => {
      render(
        <AdProviders googleEnabled={true} publisherId="ca-pub-123">
          <p>content</p>
        </AdProviders>,
      )
    })
    const script = screen.getByTestId('mock-script')
    expect(script).toBeTruthy()
    expect(script.getAttribute('src')).toContain('ca-pub-123')
    expect(script.getAttribute('src')).toContain('pagead2.googlesyndication.com')
  })

  it('provides AdConsentContext to children', async () => {
    function ConsumerProbe() {
      const ctx = useContext(AdConsentContext)
      return <p data-testid="ctx-probe">{ctx ? 'has-context' : 'no-context'}</p>
    }

    await act(async () => {
      render(
        <AdProviders googleEnabled={false} publisherId={null}>
          <ConsumerProbe />
        </AdProviders>,
      )
    })
    expect(screen.getByTestId('ctx-probe').textContent).toBe('has-context')
  })
})
