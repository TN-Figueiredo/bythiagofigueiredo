/**
 * One-click unsubscribe (RFC 8058) lifecycle pinning tests.
 *
 * Pins the mutation contract of /api/newsletters/unsubscribe:
 *  - POST is the ONLY mutating verb (one-click): token hashed sha256 → RPC
 *  - POST is idempotent (already-used token still returns ok)
 *  - GET NEVER mutates — mail scanners / link prefetchers issuing GETs must
 *    not unsubscribe anyone; GET only redirects to the confirm page
 *
 * Complements test/api/newsletters/unsubscribe.test.ts (basic 400/500 paths).
 * DB-side flip semantics (unsubscribed + unsubscribed_at + email anonymization)
 * are pinned by the DB-gated test/integration/rpc-unsubscribe.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const rpcMock = vi.fn()
vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ rpc: rpcMock }),
}))

import { GET, POST } from '../../../src/app/api/newsletters/unsubscribe/route'

const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const TOKEN_SHA256 = createHash('sha256').update(TOKEN).digest('hex')
const BASE = `http://localhost/api/newsletters/unsubscribe?token=${TOKEN}`

function oneClickPost(url = BASE): Request {
  // Mail providers POST `List-Unsubscribe=One-Click` per RFC 8058.
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('one-click unsubscribe — POST mutates', () => {
  it('hashes the raw token (sha256) before calling unsubscribe_via_token', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, sub_count: 1 }, error: null })

    const res = await POST(oneClickPost())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith('unsubscribe_via_token', {
      p_token_hash: TOKEN_SHA256,
    })
    // Raw token never reaches the DB layer.
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain(`"${TOKEN}"`)
  })

  it('works without a form body — token is read from the query string only', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })
    const res = await POST(new Request(BASE, { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('is idempotent: repeat POST with an already-used token still returns ok', async () => {
    // First click: flips to unsubscribed.
    rpcMock.mockResolvedValueOnce({ data: { ok: true, sub_count: 1 }, error: null })
    const first = await POST(oneClickPost())
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ ok: true })

    // Second click: RPC reports already-used; route still answers ok (200).
    rpcMock.mockResolvedValueOnce({ data: { ok: true, already: true }, error: null })
    const second = await POST(oneClickPost())
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true })
  })

  it('unknown token: 200 with ok:false (no 5xx, no oracle beyond ok flag)', async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, error: 'not_found' }, error: null })
    const res = await POST(oneClickPost())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false })
  })
})

describe('one-click unsubscribe — GET never mutates (mail-scanner safety)', () => {
  it('GET with a valid token redirects to the confirm page WITHOUT calling the unsubscribe RPC', async () => {
    const res = await GET(new Request(BASE))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      `http://localhost/unsubscribe/${encodeURIComponent(TOKEN)}`,
    )
    // The load-bearing pin: a scanner GET must not flip anyone to unsubscribed.
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('GET with extra one-click-looking params still performs zero mutations', async () => {
    const res = await GET(new Request(`${BASE}&List-Unsubscribe=One-Click`))
    expect(res.status).toBe(302)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('GET with malformed token returns 400 and no RPC call', async () => {
    const res = await GET(new Request('http://localhost/api/newsletters/unsubscribe?token=..%2Fadmin'))
    expect(res.status).toBe(400)
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
