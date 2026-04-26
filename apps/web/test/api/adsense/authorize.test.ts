import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

import { GET } from '../../../src/app/api/adsense/authorize/route'

describe('GET /api/adsense/authorize', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com'
    vi.clearAllMocks()
  })

  it('redirects to Google OAuth2 authorization URL', async () => {
    const req = new Request('http://localhost/api/adsense/authorize')
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('accounts.google.com/o/oauth2/v2/auth')
    expect(location).toContain('client_id=test-client-id')
    expect(location).toContain('adsense.readonly')
    expect(location).toContain('redirect_uri=')
  })

  it('returns 503 when GOOGLE_CLIENT_ID is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const req = new Request('http://localhost/api/adsense/authorize')
    const res = await GET(req)
    expect(res.status).toBe(503)
  })
})
