import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(() => true),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

// Re-export real implementation — avoids `@/` alias resolution failure in
// the node test environment when the route file imports this module directly.
vi.mock('@/lib/pipeline/sections', async () => {
  const actual = await import('../../src/lib/pipeline/sections')
  return actual
})

import { GET, PATCH } from '../../src/app/api/pipeline/items/[id]/sections/[section]/route'
import { authenticatePipeline } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }
const mockItem = {
  id: '00000000-0000-0000-0000-000000000001',
  format: 'video',
  language: 'both',
  version: 3,
  sections: {
    roteiro_en: { rev: 2, source: 'producer', edited: false, content: 'beat content', updated_at: '2026-05-10T00:00:00Z' },
  },
}

function makeRequest(method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  const hdrs = new Headers(headers)
  if (body) hdrs.set('Content-Type', 'application/json')
  const init: RequestInit = { method, headers: hdrs, body: body ? JSON.stringify(body) : undefined }
  return new NextRequest('http://localhost/api/pipeline/items/test-id/sections/roteiro?lang=en', init)
}

describe('GET /api/pipeline/items/[id]/sections/[section]', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
  })

  it('returns section data for a valid section key', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await GET(makeRequest('GET') as any, { params })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.rev).toBe(2)
    expect(json.data.content).toBe('beat content')
  })

  it('returns 200 with data: null for a section that does not exist yet', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'publish' })
    const res = await GET(makeRequest('GET') as any, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeNull()
    expect(json.meta.exists).toBe(false)
  })

  it('returns 400 for invalid item UUID', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)

    const params = Promise.resolve({ id: 'not-a-uuid', section: 'roteiro' })
    const res = await GET(makeRequest('GET') as any, { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found in DB', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await GET(makeRequest('GET') as any, { params })
    expect(res.status).toBe(404)
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await GET(makeRequest('GET') as any, { params })
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/pipeline/items/[id]/sections/[section]', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
  })

  it('returns 400 without If-Match header', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await PATCH(makeRequest('PATCH', { content: 'new', rev: 2 }) as any, { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid item UUID', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)

    const params = Promise.resolve({ id: 'bad-uuid', section: 'roteiro' })
    const res = await PATCH(makeRequest('PATCH', { content: 'new', rev: 2 }) as any, { params })
    expect(res.status).toBe(400)
  })

  it('successfully patches a section and returns updated data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ data: mockItem, error: null })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockFetch,
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate }),
    } as any)

    const req = makeRequest('PATCH', { content: 'updated content', rev: 2 }, { 'If-Match': '3' })
    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await PATCH(req as any, { params })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.rev).toBe(3)
    expect(json.data.content).toBe('updated content')
    expect(json.meta.section_key).toBe('roteiro_en')
    expect(json.meta.item_version).toBe(4)
  })

  it('returns 409 on version mismatch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ data: mockItem, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockFetch,
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as any)

    // If-Match: 99 — version mismatch with item.version=3
    const req = makeRequest('PATCH', { content: 'x', rev: 2 }, { 'If-Match': '99' })
    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await PATCH(req as any, { params })
    expect(res.status).toBe(409)
  })

  it('returns 409 on section revision mismatch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ data: mockItem, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockFetch,
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as any)

    // section rev is 2, but we send rev: 0 — mismatch
    const req = makeRequest('PATCH', { content: 'x', rev: 0 }, { 'If-Match': '3' })
    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await PATCH(req as any, { params })
    expect(res.status).toBe(409)
  })

  it('returns 409 when concurrent update detected by DB', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ data: mockItem, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockFetch,
        }),
      }),
    })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'concurrent update' } }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate }),
    } as any)

    const req = makeRequest('PATCH', { content: 'updated', rev: 2 }, { 'If-Match': '3' })
    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await PATCH(req as any, { params })
    expect(res.status).toBe(409)
  })

  it('uses shared key for shared section types', async () => {
    const itemWithIdeia = {
      ...mockItem,
      sections: {
        ideia_shared: { rev: 1, source: 'user', edited: true, content: 'shared idea', updated_at: '2026-05-10T00:00:00Z' },
      },
    }
    const mockFetch = vi.fn().mockResolvedValue({ data: itemWithIdeia, error: null })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockFetch,
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate }),
    } as any)

    // 'ideia' is a shared section — key should be ideia_shared regardless of lang
    const reqWithIdeiaSection = new NextRequest(
      'http://localhost/api/pipeline/items/test-id/sections/ideia?lang=en',
      { method: 'PATCH', body: JSON.stringify({ content: 'new idea', rev: 1 }), headers: { 'Content-Type': 'application/json', 'If-Match': '3' } }
    )
    const params = Promise.resolve({ id: mockItem.id, section: 'ideia' })
    const res = await PATCH(reqWithIdeiaSection as any, { params })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.meta.section_key).toBe('ideia_shared')
  })
})
