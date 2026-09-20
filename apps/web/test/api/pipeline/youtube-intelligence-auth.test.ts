import { describe, it, expect, vi } from 'vitest'
import { requirePermission, type PipelineAuth } from '@/lib/pipeline/auth'

vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  authenticatePipeline: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => { throw new Error('db must not be reached') }) }))

import { authenticatePipeline } from '@/lib/pipeline/auth'

function get(url = 'http://localhost/api/pipeline/youtube/intelligence/task') {
  return new Request(url) as never
}

function auth(permissions: string[]): PipelineAuth {
  return { siteId: 'site-1', permissions, source: 'api_key', keyHash: 'h', keyId: 'k' }
}

describe('requirePermission — intelligence', () => {
  it('rejects intelligence for a read-only key', () => {
    expect(requirePermission(auth(['read']), 'intelligence')).toBe(false)
  })

  it('accepts intelligence for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'intelligence')).toBe(true)
  })

  it('rejects write for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'write')).toBe(false)
  })

  it('accepts intelligence for write and for admin', () => {
    expect(requirePermission(auth(['read', 'write']), 'intelligence')).toBe(true)
    expect(requirePermission(auth(['admin']), 'intelligence')).toBe(true)
  })

  it('keeps read working for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'read')).toBe(true)
  })
})

describe('GET /api/pipeline/youtube/intelligence/task — legacy claim needs write', () => {
  it('403s a {read} key without touching the queue', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/task/route')
    const res = await GET(get())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('403s a {read,intelligence} key — the narrow key claims only via POST', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/task/route')
    const res = await GET(get())
    expect(res.status).toBe(403)
  })
})
