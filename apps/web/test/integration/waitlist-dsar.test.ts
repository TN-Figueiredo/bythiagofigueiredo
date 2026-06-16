// apps/web/test/integration/waitlist-dsar.test.ts
// Unit test for the Fase 1 inert DSAR stub — no DB needed.
// Guarantees: status 200 (never 404/500) + data:[] for all token shapes.

import { describe, it, expect } from 'vitest'
import { GET } from '../../src/app/api/waitlists/dsar/[token]/route'

interface Ctx { params: Promise<{ token: string }> }

function ctx(token: string): Ctx {
  return { params: Promise.resolve({ token }) }
}

describe('GET /api/waitlists/dsar/[token] — Fase 1 inert stub', () => {
  it('returns 200 + data:[] for a token shorter than 16 chars', async () => {
    const res = await GET(new Request('http://localhost/api/waitlists/dsar/short'), ctx('short'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 200 + data:[] for an unknown 40-char token', async () => {
    const token = 'a'.repeat(40)
    const res = await GET(new Request(`http://localhost/api/waitlists/dsar/${token}`), ctx(token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 200 + data:[] for an empty string token', async () => {
    const res = await GET(new Request('http://localhost/api/waitlists/dsar/'), ctx(''))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 200 + data:[] for a 16-char token (minimum valid length boundary)', async () => {
    const token = 'b'.repeat(16)
    const res = await GET(new Request(`http://localhost/api/waitlists/dsar/${token}`), ctx(token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})
