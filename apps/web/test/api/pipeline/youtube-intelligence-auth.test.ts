import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
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

it('403s a session on the claim route — a session has no worker to hand the task to', async () => {
  vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' } })
  const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
  const res = await POST(new Request('http://localhost/x', { method: 'POST', body: '{"channel_ids":["11111111-1111-4111-8111-111111111111"]}', headers: { 'content-type': 'application/json' } }) as never)
  expect(res.status).toBe(403)
  expect((await res.json()).error.code).toBe('FORBIDDEN')
})

describe('POST .../intelligence/task/:id/fail — auth', () => {
  const failUrl = 'http://localhost/api/pipeline/youtube/intelligence/task/22222222-2222-4222-8222-222222222222/fail'
  function postFail() {
    return new Request(failUrl, { method: 'POST', body: '{"reason":"x"}', headers: { 'content-type': 'application/json' } }) as never
  }

  it('403s a {read} key without touching youtube_intelligence_tasks', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(postFail(), { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('403s a session — a session has no worker to close the task on behalf of', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' } })
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(postFail(), { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/pipeline/youtube/intelligence — snapshot needs intelligence, not read', () => {
  const url = 'http://localhost/api/pipeline/youtube/intelligence?channel_id=11111111-1111-4111-8111-111111111111'

  it('403s a key that holds only {read} — this is what lets the forja key drop `read`', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/route')
    const res = await GET(new Request(url) as never)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  it('403s a {read} session too — no scope escapes the gate', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'session' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/route')
    const res = await GET(new Request(url) as never)
    expect(res.status).toBe(403)
  })

  it('lets the forja key past the gate with {intelligence} alone', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['intelligence'], source: 'api_key', keyHash: 'h', keyId: 'k' } })
    const { GET } = await import('@/app/api/pipeline/youtube/intelligence/route')
    // It reaches the service (which explodes on the mocked db client) instead of 403ing:
    // proof the gate passed, without needing a live snapshot.
    const res = await GET(new NextRequest(url) as never)
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(401)
  })

  it('still lets a cms session (read+write) and an admin key read the snapshot', async () => {
    for (const auth of [
      { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const },
      { siteId: 'site-1', permissions: ['admin'], source: 'api_key' as const, keyHash: 'h', keyId: 'k' },
    ]) {
      vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth })
      const { GET } = await import('@/app/api/pipeline/youtube/intelligence/route')
      const res = await GET(new NextRequest(url) as never)
      expect(res.status).not.toBe(403)
    }
  })
})
