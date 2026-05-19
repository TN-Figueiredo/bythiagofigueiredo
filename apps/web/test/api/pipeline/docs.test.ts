import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: () => ({ ok: true, auth: { siteId: 's1', permissions: ['read'], source: 'api_key', keyHash: 'k' } }),
  buildRateLimitHeaders: () => ({}),
  requirePermission: () => true,
}))

import { GET } from '@/app/api/pipeline/docs/[domain]/route'

function makeReq() { return new NextRequest('http://localhost/api/pipeline/docs/utilities') }

describe('GET /api/pipeline/docs/[domain]', () => {
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
})
