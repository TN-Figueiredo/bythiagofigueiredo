import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { GET } from '../../../src/app/api/adsense/status/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe('GET /api/adsense/status', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns connected=true when publisher_id is set', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        adsense_publisher_id: 'ca-pub-123',
        adsense_sync_status: 'ok',
        adsense_connected_at: '2026-04-26T00:00:00Z',
        adsense_last_sync_at: '2026-04-26T06:00:00Z',
        adsense_refresh_token_enc: 'enc:token',
      },
      error: null,
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleMock }),
        }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: 'org-uuid', error: null }),
    } as never)

    const res = await GET(new Request('http://localhost/api/adsense/status'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.connected).toBe(true)
    expect(body.publisherId).toBe('ca-pub-123')
    expect(body.syncStatus).toBe('ok')
    expect(body).not.toHaveProperty('refreshTokenEnc')
  })

  it('returns connected=false when publisher_id is null', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        adsense_publisher_id: null,
        adsense_sync_status: 'disconnected',
        adsense_connected_at: null,
        adsense_last_sync_at: null,
        adsense_refresh_token_enc: null,
      },
      error: null,
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleMock }),
        }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: 'org-uuid', error: null }),
    } as never)

    const res = await GET(new Request('http://localhost/api/adsense/status'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.connected).toBe(false)
  })
})
