// apps/web/test/integration/waitlist-dsar.test.ts
// No-DB unit test for the LIVE DSAR access route (Fase 2): proves the no-oracle guarantee —
// status 200 + data:[] for every short/empty/unknown token shape (never 404/500), with the
// token lookup stubbed to "not found". The full happy-path (valid token → data, post-erasure
// emptiness) is covered DB-gated in waitlist-dsar-rights.test.ts.

import { describe, it, expect, vi } from 'vitest'

// Stub the service client so an unknown token resolves to no row → NEUTRAL.
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}))

import { GET } from '../../src/app/api/waitlists/dsar/[token]/route'

interface Ctx { params: Promise<{ token: string }> }
function ctx(token: string): Ctx {
  return { params: Promise.resolve({ token }) }
}

describe('GET /api/waitlists/dsar/[token] — no-oracle (live route)', () => {
  it('returns 200 + data:[] for a token shorter than 16 chars', async () => {
    const res = await GET(new Request('http://localhost/api/waitlists/dsar/short'), ctx('short'))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])
  })

  it('returns 200 + data:[] for an unknown 40-char token', async () => {
    const token = 'a'.repeat(40)
    const res = await GET(new Request(`http://localhost/api/waitlists/dsar/${token}`), ctx(token))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])
  })

  it('returns 200 + data:[] for an empty string token', async () => {
    const res = await GET(new Request('http://localhost/api/waitlists/dsar/'), ctx(''))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])
  })

  it('returns 200 + data:[] for an unknown 16-char token (min valid length, not found)', async () => {
    const token = 'b'.repeat(16)
    const res = await GET(new Request(`http://localhost/api/waitlists/dsar/${token}`), ctx(token))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])
  })
})
