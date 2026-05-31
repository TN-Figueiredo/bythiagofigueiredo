import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn(),
}))

import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { ensureFreshToken } from '@/lib/social/token-refresh'

describe('preflightTokenCheck', () => {
  it('returns ok when token is valid and API responds 200', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'valid-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true })

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(true)
    expect(result.accessToken).toBe('valid-token')
  })

  it('returns not ok when API responds 403', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'bad-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockResolvedValue({ status: 403, ok: false })

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('403')
  })

  it('returns not ok when API responds 401', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'expired-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false })

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('401')
  })

  it('returns not ok when ensureFreshToken throws', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('No connection found'),
    )

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('No connection found')
  })

  it('returns not ok on HTTP 500 (server error)', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'valid-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false })

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('500')
  })

  it('returns not ok on network timeout (AbortError)', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'valid-token',
      connectionId: 'conn-1',
    })
    const abortErr = new DOMException('The operation was aborted', 'AbortError')
    global.fetch = vi.fn().mockRejectedValue(abortErr)

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('aborted')
  })

  it('returns not ok on network error (ECONNREFUSED)', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'valid-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('fetch failed')
  })
})
