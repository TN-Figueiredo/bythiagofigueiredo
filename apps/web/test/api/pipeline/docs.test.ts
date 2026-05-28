import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = 'site-1'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  serviceErrorToResponse: vi.fn((_err: unknown, _auth: unknown) =>
    new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }), { status: 500 }),
  ),
}))

vi.mock('@/lib/pipeline/services/utilities', () => ({
  getDomainDocs: vi.fn(),
}))

import { authenticateRead } from '@/lib/pipeline/helpers'
import { serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getDomainDocs } from '@/lib/pipeline/services/utilities'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function mockAuthSuccess() {
  vi.mocked(authenticateRead).mockResolvedValue({
    ok: true, auth: { siteId: MOCK_SITE_ID, permissions: ['read'], source: 'api_key' as const, keyHash: 'k' },
  } as any)
}

function mockAuthFail() {
  vi.mocked(authenticateRead).mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }), { status: 401 }),
  )
}

function makeReq(domain = 'utilities') {
  return new NextRequest(`http://localhost/api/pipeline/docs/${domain}`)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/pipeline/docs/[domain]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ domain: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/pipeline/docs/[domain]/route')
    GET = mod.GET
  })

  it('returns 404 for unknown domain', async () => {
    mockAuthSuccess()
    const error = new PipelineServiceError(
      'DOC_NOT_FOUND',
      'Domain "nonexistent" not found. Available: items-and-sections, utilities',
      404,
    )
    vi.mocked(getDomainDocs).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'DOC_NOT_FOUND', message: error.message } }), { status: 404 }),
    )

    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('DOC_NOT_FOUND')
  })

  it('returns guide for valid domain', async () => {
    mockAuthSuccess()
    vi.mocked(getDomainDocs).mockResolvedValue({
      domain: 'utilities',
      name: 'Utilities',
      description: 'Utility endpoints',
      guide: '# Utilities Guide\nDocumentation here.',
    } as any)

    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'utilities' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.domain).toBe('utilities')
    expect(json.data.guide).toContain('#')
  })

  it('returns markdown content with substantial length for valid domain', async () => {
    mockAuthSuccess()
    const longGuide = '# Items and Sections Guide\n\n' + 'This is a detailed guide. '.repeat(20)
    vi.mocked(getDomainDocs).mockResolvedValue({
      domain: 'items-and-sections',
      name: 'Items & Sections',
      description: 'Manage pipeline items and sections',
      guide: longGuide,
    } as any)

    const res = await GET(makeReq('items-and-sections'), { params: Promise.resolve({ domain: 'items-and-sections' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.guide.length).toBeGreaterThan(100)
  })

  it('returns 401 when auth fails', async () => {
    mockAuthFail()
    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'utilities' }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
