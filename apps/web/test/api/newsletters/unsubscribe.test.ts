import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ rpc: rpcMock }),
}))

import { GET, POST } from '../../../src/app/api/newsletters/unsubscribe/route'

describe('newsletter unsubscribe endpoint', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POST (RFC 8058 one-click) calls unsubscribe RPC', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })
    const req = new Request('http://localhost/api/newsletters/unsubscribe?token=abc123def456ghi789jkl012', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('unsubscribe_via_token', expect.objectContaining({
      p_token_hash: expect.any(String),
    }))
  })

  it('GET redirects to unsubscribe page', async () => {
    const req = new Request('http://localhost/api/newsletters/unsubscribe?token=abc123def456ghi789jkl012')
    const res = await GET(req)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/unsubscribe/abc123def456ghi789jkl012')
  })

  it('returns 400 without token', async () => {
    const req = new Request('http://localhost/api/newsletters/unsubscribe', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('GET without token returns 400', async () => {
    const res = await GET(new Request('http://localhost/api/newsletters/unsubscribe'))
    expect(res.status).toBe(400)
  })

  it('POST with RPC failure returns 500', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'db error' } })
    const req = new Request('http://localhost/api/newsletters/unsubscribe?token=abc123def456ghi789jkl012', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'rpc_failed' })
  })

  it('POST with invalid token format returns 400 (path traversal guard)', async () => {
    const req = new Request('http://localhost/api/newsletters/unsubscribe?token=../admin', {
      method: 'POST',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
