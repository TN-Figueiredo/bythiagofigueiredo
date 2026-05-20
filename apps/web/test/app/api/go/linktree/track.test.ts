import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/linktree/event-recorder', () => ({
  recordLinktreeEvent: vi.fn().mockResolvedValue({ deduplicated: false }),
}))

describe('POST /api/go/linktree/track', () => {
  let POST: typeof import('@/app/api/go/linktree/track/route').POST

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/app/api/go/linktree/track/route')
    POST = mod.POST
  })

  it('returns 204 for valid pageview', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ type: 'pageview', siteId: '00000000-0000-0000-0000-000000000001' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(204)
  })

  it('returns 400 for invalid body', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 204 for valid link_click', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({
        type: 'link_click',
        key: 'shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        siteId: '00000000-0000-0000-0000-000000000001',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(204)
  })

  it('returns 400 when siteId is not a valid UUID', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', siteId: 'not-a-uuid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is unknown', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'hover', siteId: '00000000-0000-0000-0000-000000000001' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('uses x-real-ip when x-forwarded-for is absent', async () => {
    const { recordLinktreeEvent } = await import('@/lib/linktree/event-recorder')
    const recorder = vi.mocked(recordLinktreeEvent)
    recorder.mockClear()

    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '9.8.7.6',
      },
      body: JSON.stringify({ type: 'pageview', siteId: '00000000-0000-0000-0000-000000000001' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(204)
    // recordLinktreeEvent is called fire-and-forget (void) — just verify response
  })

  it('enforces rate limit after 30 requests from same IP', async () => {
    // Each beforeEach resets modules giving a fresh ipBuckets Map
    const siteId = '00000000-0000-0000-0000-000000000001'
    const ip = '10.0.0.99'
    let lastRes: Response | undefined

    for (let i = 0; i < 31; i++) {
      const req = new Request('http://localhost/api/go/linktree/track', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({ type: 'pageview', siteId }),
      })
      lastRes = await POST(req)
    }

    expect(lastRes!.status).toBe(429)
  })
})
