import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = 'site-1'

const MOCK_REFS = [
  { key: 'personal-profile', title: 'Profile', content: '# Profile', ref_group: 'pessoal', sort_order: 10, version: 1, updated_at: '2026-01-01' },
  { key: 'writer-voice-guide', title: 'Voice', content: '# Voice', ref_group: 'craft', sort_order: 10, version: 1, updated_at: '2026-01-01' },
  { key: '_system/groups', title: 'Groups', content: { groups: [] }, ref_group: 'sistema', sort_order: 0, version: 1, updated_at: '2026-01-01' },
  { key: '_system/skill-mappings', title: 'Mappings', content: { writer: ['personal-profile', 'writer-voice-guide'] }, ref_group: 'sistema', sort_order: 1, version: 1, updated_at: '2026-01-01' },
]

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/pipeline/helpers', () => ({
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: 'site-1',
    permissions: ['read', 'write'],
    keyHash: 'abc',
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn((_err: unknown, _auth: unknown) =>
    new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }), { status: 500 }),
  ),
}))

vi.mock('@/lib/pipeline/services/utilities', () => ({
  listContext: vi.fn(),
}))

import { authenticatePipeline } from '@/lib/pipeline/auth'
import { serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listContext } from '@/lib/pipeline/services/utilities'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function mockAuth() {
  vi.mocked(authenticatePipeline).mockResolvedValue({
    ok: true as const,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'abc' },
  })
}

function makeReq(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/pipeline/context${params}`)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/pipeline/context', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth()
    const mod = await import('@/app/api/pipeline/context/route')
    GET = mod.GET
  })

  it('excludes _system/ entries by default', async () => {
    // Service returns already-filtered list (no _system/ entries)
    const filtered = MOCK_REFS.filter(r => !r.key.startsWith('_system/'))
    vi.mocked(listContext).mockResolvedValue(filtered as any)

    const res = await GET(makeReq())
    const json = await res.json()
    const keys = json.data.map((d: { key: string }) => d.key)
    expect(keys).not.toContain('_system/groups')
    expect(keys).not.toContain('_system/skill-mappings')
  })

  it('filters by ?group=pessoal', async () => {
    const filtered = MOCK_REFS.filter(r => r.ref_group === 'pessoal')
    vi.mocked(listContext).mockResolvedValue(filtered as any)

    const res = await GET(makeReq('?group=pessoal'))
    const json = await res.json()
    for (const item of json.data) {
      expect(item.ref_group).toBe('pessoal')
    }
  })

  it('returns _system/ entries when ?group=sistema', async () => {
    const filtered = MOCK_REFS.filter(r => r.ref_group === 'sistema')
    vi.mocked(listContext).mockResolvedValue(filtered as any)

    const res = await GET(makeReq('?group=sistema'))
    const json = await res.json()
    expect(json.data.some((d: { key: string }) => d.key.startsWith('_system/'))).toBe(true)
  })

  it('filters by ?skill=writer', async () => {
    const filtered = MOCK_REFS.filter(r => ['personal-profile', 'writer-voice-guide'].includes(r.key))
    vi.mocked(listContext).mockResolvedValue(filtered as any)

    const res = await GET(makeReq('?skill=writer'))
    const json = await res.json()
    const keys = json.data.map((d: { key: string }) => d.key)
    expect(keys).toContain('personal-profile')
    expect(keys).toContain('writer-voice-guide')
    expect(keys).not.toContain('_system/groups')
    expect(keys).not.toContain('_system/skill-mappings')
  })

  it('returns content_md when ?format=md', async () => {
    const filtered = MOCK_REFS.filter(r => !r.key.startsWith('_system/'))
    vi.mocked(listContext).mockResolvedValue(filtered as any)

    const res = await GET(makeReq('?format=md'))
    const json = await res.json()
    const item = json.data.find((d: { key: string }) => d.key === 'personal-profile')
    expect(item).toBeDefined()
    expect(item.content).toBe('# Profile')
  })

  it('returns 400 for invalid format parameter', async () => {
    const error = new PipelineServiceError('INVALID_PARAM', 'format must be "md" or "compact"', 400)
    vi.mocked(listContext).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'INVALID_PARAM', message: 'format must be "md" or "compact"' } }), { status: 400 }),
    )

    const res = await GET(makeReq('?format=xml'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PARAM')
  })

  it('returns 400 for invalid group format', async () => {
    const error = new PipelineServiceError('INVALID_PARAM', 'Invalid group id format', 400)
    vi.mocked(listContext).mockRejectedValue(error)
    vi.mocked(serviceErrorToResponse).mockReturnValue(
      new Response(JSON.stringify({ error: { code: 'INVALID_PARAM', message: 'Invalid group id format' } }), { status: 400 }),
    )

    const res = await GET(makeReq('?group=_INVALID'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_PARAM')
  })
})
