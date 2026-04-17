// Sprint 4 Epic 9 T72 — sanity test for captureServerActionError.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Sentry SDK before importing the helper — the helper imports
// `* as Sentry from '@sentry/nextjs'` and we want full control over the return
// value of `getClient()` + spy on `captureException`.
vi.mock('@sentry/nextjs', () => {
  return {
    getClient: vi.fn(() => undefined),
    captureException: vi.fn(),
  }
})

import * as Sentry from '@sentry/nextjs'
import { captureServerActionError } from '@/lib/sentry-wrap'

describe('captureServerActionError', () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear()
    vi.mocked(Sentry.getClient).mockReset()
  })

  it('is a no-op when Sentry has not been initialized (getClient returns undefined)', () => {
    vi.mocked(Sentry.getClient).mockReturnValue(undefined)
    captureServerActionError(new Error('boom'), { action: 'test_action' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('forwards the error with action + site_id tags when Sentry is initialized', () => {
    // Any truthy return signals "initialized" — the helper only checks for a
    // defined client, not its shape.
    vi.mocked(Sentry.getClient).mockReturnValue({} as never)

    const err = new Error('rpc failed')
    captureServerActionError(err, {
      action: 'accept_invitation',
      site_id: '00000000-0000-0000-0000-000000000001',
    })

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [capturedErr, opts] = vi.mocked(Sentry.captureException).mock.calls[0]!
    expect(capturedErr).toBe(err)
    expect(opts).toEqual({
      tags: {
        action: 'accept_invitation',
        site_id: '00000000-0000-0000-0000-000000000001',
      },
    })
  })

  it('does not swallow the original error — caller still controls flow', () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as never)

    // If Sentry itself throws, the helper must still return normally so the
    // caller's error-handling branch is reached.
    vi.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error('sentry transport crashed')
    })

    let reachedAfter = false
    expect(() => {
      captureServerActionError(new Error('original'), { action: 'x' })
      reachedAfter = true
    }).not.toThrow()
    expect(reachedAfter).toBe(true)
  })

  it('stringifies non-string tag values and drops huge payloads', () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as never)
    const bigString = 'x'.repeat(500)

    captureServerActionError(new Error('boom'), {
      action: 'save_campaign',
      campaign_id: 42 as unknown as string,
      huge: bigString,
    })

    const [, opts] = vi.mocked(Sentry.captureException).mock.calls[0]!
    expect((opts as { tags: Record<string, string> }).tags).toEqual({
      action: 'save_campaign',
      campaign_id: '42',
    })
  })
})
