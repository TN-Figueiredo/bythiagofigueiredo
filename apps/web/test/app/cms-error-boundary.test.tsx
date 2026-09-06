// @vitest-environment jsdom
// Error boundary for /cms — the stale-client (deploy skew) failure must offer a
// full reload, not just a client re-render (see src/app/cms/error.tsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import CmsError from '../../src/app/cms/error'

describe('CmsError boundary', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('reports the error to Sentry with cms tags and the digest', () => {
    const error = Object.assign(new Error('router state header'), { digest: '123456' })
    render(<CmsError error={error} reset={() => {}} />)
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { component: 'cms', boundary: 'error' },
      extra: { digest: '123456' },
    })
  })

  it('primary action is a full document reload (recovers a stale client bundle)', () => {
    const reset = vi.fn()
    const { getByRole } = render(<CmsError error={new Error('x')} reset={reset} />)
    fireEvent.click(getByRole('button', { name: /reload page/i }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('secondary action calls reset() without reloading', () => {
    const reset = vi.fn()
    const { getByRole } = render(<CmsError error={new Error('x')} reset={reset} />)
    fireEvent.click(getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows the digest as a support reference when present', () => {
    const error = Object.assign(new Error('x'), { digest: '592435423' })
    const { getByText, queryByText, rerender } = render(<CmsError error={error} reset={() => {}} />)
    expect(getByText(/ref 592435423/)).toBeTruthy()
    rerender(<CmsError error={new Error('no digest')} reset={() => {}} />)
    expect(queryByText(/^ref /)).toBeNull()
  })
})
