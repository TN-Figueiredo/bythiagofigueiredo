import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/ads/crypto', () => ({
  encrypt: vi.fn((val: string) => `enc:${val}`),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { GET } from '../../../src/app/api/adsense/callback/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe('GET /api/adsense/callback', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com'
    process.env.ADSENSE_TOKEN_KEY = 'a'.repeat(64)
    vi.clearAllMocks()
  })

  it('returns 400 when code is missing', async () => {
    const req = new Request('http://localhost/api/adsense/callback')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('exchanges code for tokens and stores encrypted refresh token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'access',
        refresh_token: 'refresh-token-value',
        token_type: 'Bearer',
      }),
    })

    const eqFinal = vi.fn().mockResolvedValue({ error: null })
    const updateChain = vi.fn().mockReturnValue({ eq: eqFinal })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({ update: updateChain })),
      rpc: vi.fn().mockResolvedValue({ data: 'org-uuid', error: null }),
    } as never)

    const req = new Request('http://localhost/api/adsense/callback?code=auth-code-123')
    const res = await GET(req)
    expect([302, 200]).toContain(res.status)
  })

  it('returns 500 when Google token exchange fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'invalid_grant' }) })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: 'org-uuid', error: null }),
    } as never)

    const req = new Request('http://localhost/api/adsense/callback?code=bad-code')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
