import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '../../../src/app/api/adsense/disconnect/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe('POST /api/adsense/disconnect', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('clears adsense fields and returns 200', async () => {
    const eqFinal = vi.fn().mockResolvedValue({ error: null })
    const updateChain = vi.fn().mockReturnValue({ eq: eqFinal })
    const rpcMock = vi.fn().mockResolvedValue({ data: 'org-uuid', error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({ update: updateChain })),
      rpc: rpcMock,
    } as never)

    const res = await POST(new Request('http://localhost/api/adsense/disconnect', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        adsense_refresh_token_enc: null,
        adsense_publisher_id: null,
        adsense_sync_status: 'disconnected',
      }),
    )
  })

  it('returns 500 when DB update fails', async () => {
    const eqFinal = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const updateChain = vi.fn().mockReturnValue({ eq: eqFinal })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({ update: updateChain })),
      rpc: vi.fn().mockResolvedValue({ data: 'org-uuid', error: null }),
    } as never)

    const res = await POST(new Request('http://localhost/api/adsense/disconnect', { method: 'POST' }))
    expect(res.status).toBe(500)
  })
})
