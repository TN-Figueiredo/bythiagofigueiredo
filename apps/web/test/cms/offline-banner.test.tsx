// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((c: string, p: number) => `rgba(0,0,0,${p / 100})`),
  getFormatIcon: vi.fn(() => ({ icon: '📹', bgClass: '', label: 'Video' })),
}))

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

import { OfflineBanner } from '../../src/app/cms/(authed)/pipeline/_components/offline-banner'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

let onlineListeners: Array<() => void> = []
let offlineListeners: Array<() => void> = []

function mockNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value,
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  onlineListeners = []
  offlineListeners = []

  vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'online') onlineListeners.push(handler as () => void)
    if (event === 'offline') offlineListeners.push(handler as () => void)
  })

  vi.spyOn(window, 'removeEventListener').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('OfflineBanner', () => {
  it('renders nothing when online (default state)', () => {
    mockNavigatorOnLine(true)
    render(<OfflineBanner />)

    const status = screen.getByRole('status')
    expect(status).toBeTruthy()
    // The inner banner text should not be present
    expect(screen.queryByText(/Sem conexão/)).toBeNull()
  })

  it('shows banner when navigator.onLine is false', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)

    expect(screen.getByText(/Sem conexão/)).toBeTruthy()
    expect(screen.getByText(/dados podem estar desatualizados/)).toBeTruthy()
  })

  it('uses aria-live="polite"', () => {
    mockNavigatorOnLine(true)
    render(<OfflineBanner />)

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  it('shows banner when going offline via event', () => {
    mockNavigatorOnLine(true)
    render(<OfflineBanner />)

    expect(screen.queryByText(/Sem conexão/)).toBeNull()

    // Simulate going offline
    act(() => {
      offlineListeners.forEach((fn) => fn())
    })

    expect(screen.getByText(/Sem conexão/)).toBeTruthy()
  })

  it('hides banner when coming back online via event', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)

    expect(screen.getByText(/Sem conexão/)).toBeTruthy()

    // Simulate coming back online
    act(() => {
      onlineListeners.forEach((fn) => fn())
    })

    expect(screen.queryByText(/Sem conexão/)).toBeNull()
  })
})
