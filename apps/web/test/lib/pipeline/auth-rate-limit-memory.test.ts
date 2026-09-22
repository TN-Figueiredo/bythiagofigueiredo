import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

// The key lookup always misses: the point of these tests is the work that happens
// *before* the lookup, which is exactly what an unauthenticated caller can reach.
const single = vi.fn(async () => ({ data: null, error: null }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ single }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn(async () => { throw new Error('no session') }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: false })) }))

import { authenticatePipeline, getRateLimitHeaders, RATE_LIMIT_MAX_ENTRIES } from '@/lib/pipeline/auth'

function req(key: string): NextRequest {
  return { headers: new Headers({ 'X-Pipeline-Key': key }) } as unknown as NextRequest
}
const hash = (key: string) => createHash('sha256').update(key).digest('hex')

/** Rotate the header the way an anonymous flooder would: a new bucket every request. */
async function flood(count: number, prefix: string): Promise<void> {
  for (let i = 0; i < count; i++) await authenticatePipeline(req(`${prefix}-${i}`))
}

describe('pipeline rate limiter — bounded memory under header rotation', () => {
  beforeEach(() => {
    single.mockClear()
  })

  it('is capped: a flood of fresh hashes evicts earlier buckets instead of growing forever', async () => {
    const sentinel = `legit-${Math.random()}`
    for (let i = 0; i < 5; i++) await authenticatePipeline(req(sentinel))
    expect(getRateLimitHeaders(hash(sentinel))['X-RateLimit-Remaining']).toBe('95')

    // Every one of these mints a brand-new, non-expired entry — the expired-only sweep
    // could never reclaim them, so without a hard ceiling the map just kept growing.
    await flood(RATE_LIMIT_MAX_ENTRIES + 1, 'flood')

    const after = getRateLimitHeaders(hash(sentinel))
    expect(after['X-RateLimit-Remaining']).toBe('100')
    expect(after['X-RateLimit-Reset']).toBe('0')
  })

  it('never denies a legitimate caller: it keeps serving right through the flood', async () => {
    const sentinel = `legit-${Math.random()}`
    await flood(RATE_LIMIT_MAX_ENTRIES + 1, 'flood2')
    // 401 = the request got past the rate limiter and reached the (missing) key lookup.
    // 429 would mean the flood had consumed this caller's quota.
    const res = await authenticatePipeline(req(sentinel))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(401)
  })

  it('still enforces the per-key limit — the ceiling is not a bypass', async () => {
    const key = `busy-${Math.random()}`
    for (let i = 0; i < 100; i++) await authenticatePipeline(req(key))
    const res = await authenticatePipeline(req(key))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(429)
  })
})
