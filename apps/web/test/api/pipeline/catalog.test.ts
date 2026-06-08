import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_DIRECTIVES = [
  { key: '_system/skill-mappings', content_compact: { writer: ['personal-profile', 'writer-voice-guide'] }, version: 1 },
  { key: '_system/groups', content_compact: { groups: [] }, version: 2 },
]

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          like: () => Promise.resolve({ data: MOCK_DIRECTIVES, error: null }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(() => ({
    ok: true,
    auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'api_key', keyHash: 'abc' },
  })),
  buildRateLimitHeaders: () => ({}),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockRejectedValue(new Error('no site context')),
}))

import { GET } from '@/app/api/pipeline/route'
import { authenticatePipeline } from '@/lib/pipeline/auth'

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/pipeline')
}

describe('GET /api/pipeline (catalog)', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockReturnValue({
      ok: true,
      auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'api_key', keyHash: 'abc' },
    } as ReturnType<typeof authenticatePipeline>)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticatePipeline).mockReturnValueOnce({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    } as ReturnType<typeof authenticatePipeline>)

    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns version 2.0.0 in data envelope', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.version).toBe('2.0.0')
  })

  it('returns 8 capability domains in data.capabilities', async () => {
    const res = await GET(makeReq())
    const json = await res.json()
    expect(json.data.capabilities).toHaveLength(8)
    const domains = json.data.capabilities.map((c: { domain: string }) => c.domain)
    expect(domains).toContain('items-and-sections')
    expect(domains).toContain('utilities')
    expect(domains).toContain('youtube')
  })

  it('includes directives object in data', async () => {
    const res = await GET(makeReq())
    const json = await res.json()
    expect(json.data.directives).toBeDefined()
    expect(typeof json.data.directives).toBe('object')
    expect(json.data.directives['skill-mappings']).toBeDefined()
    expect(json.data.directives['skill-mappings'].version).toBe(1)
  })

  it('includes cross_domain_workflows in data', async () => {
    const res = await GET(makeReq())
    const json = await res.json()
    expect(Array.isArray(json.data.cross_domain_workflows)).toBe(true)
    expect(json.data.cross_domain_workflows.length).toBeGreaterThan(0)
    const first = json.data.cross_domain_workflows[0]
    expect(first.name).toBeTruthy()
    expect(Array.isArray(first.domains)).toBe(true)
    expect(Array.isArray(first.steps)).toBe(true)
  })

  it('includes context filters docs in data', async () => {
    const res = await GET(makeReq())
    const json = await res.json()
    expect(json.data.context).toBeDefined()
    expect(json.data.context.endpoint).toBe('/api/pipeline/context')
    expect(json.data.context.filters).toBeDefined()
    expect(json.data.context.filters.group).toBeTruthy()
    expect(json.data.context.filters.skill).toBeTruthy()
    expect(json.data.context.filters.format).toBeTruthy()
  })
})
