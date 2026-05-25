import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuthenticatePipeline = vi.fn()

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: (...args: unknown[]) => mockAuthenticatePipeline(...args),
  buildRateLimitHeaders: () => ({}),
  requirePermission: () => true,
}))

import { GET } from '@/app/api/pipeline/docs/[domain]/route'

function makeReq(domain = 'utilities') {
  return new NextRequest(`http://localhost/api/pipeline/docs/${domain}`)
}

describe('GET /api/pipeline/docs/[domain]', () => {
  beforeEach(() => {
    mockAuthenticatePipeline.mockReturnValue({
      ok: true,
      auth: { siteId: 's1', permissions: ['read'], source: 'api_key', keyHash: 'k' },
    })
  })

  it('returns 404 for unknown domain', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('DOC_NOT_FOUND')
  })

  it('returns guide for valid domain', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'utilities' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.domain).toBe('utilities')
    expect(json.data.guide).toContain('#')
  })

  it('returns markdown content with substantial length for valid domain', async () => {
    const res = await GET(makeReq('items-and-sections'), { params: Promise.resolve({ domain: 'items-and-sections' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.guide.length).toBeGreaterThan(100)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthenticatePipeline.mockReturnValue({ ok: false, error: 'Unauthorized', status: 401 })
    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'utilities' }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
