// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const APP_SECRET = 'ig-app-secret'
const IG_ID = '17841400000000000'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/ops/ntfy', () => ({ sendNtfyAlert: vi.fn(async () => ({ alerted: true })) }))
vi.mock('@/lib/instagram/token', async () => {
  // `identityKeyOf` fica REAL (nao mockada): a asserção de sweep abaixo deriva a
  // chave a partir da LINHA, em vez de hardcodar `o:${IG_ID}` — o que não
  // distinguiria a implementação certa (identityKeyOf(row)) de uma errada
  // (`o:${payload.user_id}`) quando os dois ids coincidem no fixture.
  const actual = await vi.importActual<typeof import('@/lib/instagram/token')>('@/lib/instagram/token')
  return {
    ...actual,
    markTokenInvalid: vi.fn(async () => undefined),
    sweepTokenAlerts: vi.fn(async () => undefined),
  }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { __resetSignatureAlertGuard } from '@/lib/instagram/signed-request'
import { GET, POST, maxDuration } from '@/app/api/instagram/deauthorize/route'

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signedRequest(payload: Record<string, unknown>, secret = APP_SECRET): string {
  const encoded = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', secret).update(encoded).digest()
  return `${b64url(sig)}.${encoded}`
}

function validPayload(over: Record<string, unknown> = {}) {
  return {
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000),
    user_id: IG_ID,
    ...over,
  }
}

function post(sr: string, headers: Record<string, string> = {}) {
  const body = new URLSearchParams({ signed_request: sr }).toString()
  return new Request('https://bythiagofigueiredo.com/api/instagram/deauthorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body,
  })
}

const rpc = vi.fn()
const updateSpy = vi.fn()
const insertSpy = vi.fn()

/**
 * `ops_alert_claim` é um RATE LIMITER com janela — o dobro do mesmo `p_key`
 * dentro da janela devolve `false`. O mock reproduz isso para as chaves
 * `signature_alert:` (janela de 1 dia), senão o teste "1 claim => 1 emissão"
 * seria satisfeito por qualquer implementação.
 */
function makeRpc(claim: boolean | null) {
  const seenAlertKeys = new Set<string>()
  return vi.fn(async (fn: string, args: { p_key: string }) => {
    if (fn === 'ops_alert_claim' && args.p_key.startsWith('signature_alert:')) {
      if (seenAlertKeys.has(args.p_key)) return { data: false, error: null }
      seenAlertKeys.add(args.p_key)
      return { data: true, error: null }
    }
    return { data: claim, error: null }
  })
}

function mockDb(accounts: Record<string, unknown>[], claim: boolean | null = true) {
  updateSpy.mockReset(); insertSpy.mockReset()
  rpc.mockReset()
  rpc.mockImplementation(makeRpc(claim))
  insertSpy.mockResolvedValue({ error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'instagram_sync_log') return { insert: insertSpy }
      return {
        select: vi.fn(() => ({
          or: vi.fn(() => ({ eq: vi.fn(async () => ({ data: accounts, error: null })) })),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updateSpy(patch)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
        delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  } as never)
}

const ACCOUNT = {
  id: 'acc-1', site_id: 'site-1', handle: 'thiago.figueiredo',
  ig_user_id: IG_ID, ig_professional_id: '9988776655', ig_user_id_source: 'oauth' as const,
  access_token: 'v1:x', locale: 'pt',
}

describe('POST /api/instagram/deauthorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    // DESVIO do plano: a guarda de 60 s de `alertSignatureMismatch` é estado de
    // MÓDULO. Sem zerá-la entre casos, o teste das "50 assinaturas ruins" herda
    // a guarda ligada por um caso anterior e passa com ZERO alertas — um teste
    // que não pode falhar. `__resetSignatureAlertGuard` é o mesmo padrão de
    // `__resetSiteDomainsCache` (commit B, src/lib/oauth/origin.ts).
    __resetSignatureAlertGuard()
    process.env.INSTAGRAM_APP_SECRET = APP_SECRET
    delete process.env.META_APP_SECRET
    delete process.env.INSTAGRAM_ALLOW_META_SECRET_FALLBACK
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    mockDb([ACCOUNT])
  })

  it('declares maxDuration = 60 and answers 405 to GET', async () => {
    expect(maxDuration).toBe(60)
    expect((await GET()).status).toBe(405)
  })

  it('clears the token, logs the mode and sweeps the alerts of that identity', async () => {
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
    expect(markTokenInvalid).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ id: 'acc-1' }), 'deauthorized',
      { fatal: true, forceReason: true },
    )
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ access_token: null, token_expires_at: null }))
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ mode: 'deauthorize' }))
    expect(sweepTokenAlerts).toHaveBeenCalledWith(expect.anything(), { identityKey: identityKeyOf(ACCOUNT) })
  })

  it('matches ig_user_id OR ig_professional_id, and only oauth rows', async () => {
    const orSpy = vi.fn()
    const eqSpy = vi.fn(async () => ({ data: [ACCOUNT], error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      rpc: rpc.mockImplementation(makeRpc(true)),
      from: vi.fn((t: string) => t === 'instagram_sync_log'
        ? { insert: insertSpy.mockResolvedValue({ error: null }) }
        : {
            select: vi.fn(() => ({ or: (f: string) => { orSpy(f); return { eq: eqSpy } } })),
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          }),
    } as never)
    await POST(post(signedRequest(validPayload())))
    expect(orSpy).toHaveBeenCalledWith(`ig_user_id.eq.${IG_ID},ig_professional_id.eq.${IG_ID}`)
    expect(eqSpy).toHaveBeenCalledWith('ig_user_id_source', 'oauth')
  })

  it('answers 200 with no effects and warns when nothing matched', async () => {
    mockDb([])
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(200)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram deauthorize matched 0 accounts', 'warning')
  })

  it('rejects a body larger than 8192 bytes declared by content-length, without parsing', async () => {
    const res = await POST(post(signedRequest(validPayload()), { 'content-length': '9000' }))
    expect(res.status).toBe(400)
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('streams and aborts a chunked body over the cap', async () => {
    const cancel = vi.fn(async () => undefined)
    const big = 'x'.repeat(9000)
    let sent = false
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent) { c.close(); return }
        sent = true
        c.enqueue(new TextEncoder().encode(big))
      },
      cancel,
    })
    const req = new Request('https://bythiagofigueiredo.com/api/instagram/deauthorize', {
      method: 'POST', body, duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    // DESVIO do plano: `req.body` PODE ser o mesmo objeto de `body`, e o
    // `getReader` do plano chamava a si mesmo (RangeError: Maximum call stack).
    // Guardamos o original antes de sobrescrever e espionamos o `cancel`.
    const stream = req.body as ReadableStream<Uint8Array>
    const originalGetReader = stream.getReader.bind(stream)
    Object.defineProperty(stream, 'getReader', {
      value: () => {
        const r = originalGetReader()
        return { read: () => r.read(), cancel }
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(cancel).toHaveBeenCalled()
  })

  it('accepts a chunked body under the cap with no content-length', async () => {
    const sr = signedRequest(validPayload())
    const req = new Request('https://bythiagofigueiredo.com/api/instagram/deauthorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ signed_request: sr }).toString(),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('rejects a missing signed_request, a wrong algorithm, a 31-byte signature and a non-JSON payload', async () => {
    const noSr = new Request('https://x/api/instagram/deauthorize', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=b',
    })
    expect((await POST(noSr)).status).toBe(400)
    expect((await POST(post(signedRequest(validPayload({ algorithm: 'HMAC-SHA1' }))))).status).toBe(400)

    const encoded = Buffer.from(JSON.stringify(validPayload())).toString('base64url')
    const short = `${Buffer.alloc(31).toString('base64url')}.${encoded}`
    expect((await POST(post(short))).status).toBe(400)

    const notJson = `${Buffer.alloc(32).toString('base64url')}.${Buffer.from('not-json').toString('base64url')}`
    expect((await POST(post(notJson))).status).toBe(400)
  })

  it('rejects a stale issued_at and an already-expired payload, with Sentry but no ntfy', async () => {
    const stale = validPayload({ issued_at: Math.floor(Date.now() / 1000) - 25 * 3600 })
    expect((await POST(post(signedRequest(stale)))).status).toBe(400)
    expect(sendNtfyAlert).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('ops_alert_claim', expect.objectContaining({ p_key: expect.stringContaining('sigreq:') }))

    const expired = validPayload({ expires: Math.floor(Date.now() / 1000) - 10 })
    expect((await POST(post(signedRequest(expired)))).status).toBe(400)
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('answers 200 with no effects for a malformed user_id', async () => {
    const res = await POST(post(signedRequest(validPayload({ user_id: 'not-numeric' }))))
    expect(res.status).toBe(200)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('alerts at most once per 60 s and at most once per claim over 50 bad signatures', async () => {
    const bad = signedRequest(validPayload(), 'wrong-secret')
    for (let i = 0; i < 50; i++) expect((await POST(post(bad))).status).toBe(400)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.filter(
      (c) => c[0] === 'signed_request signature mismatch').length).toBe(1)
    expect(sendNtfyAlert).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls.filter((c) => c[0] === 'ops_alert_claim' &&
      (c[1] as { p_key: string }).p_key === 'signature_alert:deauthorize').length).toBeLessThanOrEqual(1)
  })

  it('claims a second time only after the 60 s in-memory guard', async () => {
    const bad = signedRequest(validPayload(), 'wrong-secret')
    const t0 = Date.parse('2026-09-06T10:00:00Z')
    vi.useFakeTimers({ now: t0, toFake: ['Date'] })
    await POST(post(bad))
    vi.setSystemTime(t0 + 61_000)
    await POST(post(bad))
    expect(rpc.mock.calls.filter((c) => c[0] === 'ops_alert_claim' &&
      (c[1] as { p_key: string }).p_key === 'signature_alert:deauthorize').length).toBe(2)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.filter(
      (c) => c[0] === 'signed_request signature mismatch').length).toBe(1)   // 1 claim => 1 emissão
    vi.useRealTimers()
  })

  it('accepts META_APP_SECRET only behind the flag and before the deadline', async () => {
    process.env.META_APP_SECRET = 'meta-secret'
    const sr = signedRequest(validPayload(), 'meta-secret')
    expect((await POST(post(sr))).status).toBe(400)          // flag off

    process.env.INSTAGRAM_ALLOW_META_SECRET_FALLBACK = '1'
    vi.useFakeTimers({ now: Date.parse('2026-09-20T00:00:00Z'), toFake: ['Date'] })
    const before = signedRequest(validPayload({ issued_at: Math.floor(Date.parse('2026-09-20T00:00:00Z') / 1000) }), 'meta-secret')
    expect((await POST(post(before))).status).toBe(200)

    vi.setSystemTime(Date.parse('2026-10-07T00:00:00Z'))
    const after = signedRequest(validPayload({ issued_at: Math.floor(Date.parse('2026-10-07T00:00:00Z') / 1000) }), 'meta-secret')
    expect((await POST(post(after))).status).toBe(400)
    vi.useRealTimers()
  })

  it('answers 500 (never 200) when the anti-replay claim itself errors', async () => {
    // `claimAlert` LANÇA quando a RPC devolve `error`; a chamada está dentro do
    // `try`, então o throw cai no `catch` => captureException + 500 e a Meta
    // re-tenta. Se a rota lesse só `data`, isto viraria 200 {} sem efeito nenhum.
    mockDb([ACCOUNT])
    rpc.mockResolvedValue({ data: null, error: { message: 'PGRST202 not found' } })
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(500)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('replays are 200 {} with no effects and the sigreq claim is not released', async () => {
    mockDb([ACCOUNT], false)     // ops_alert_claim => false (já visto)
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('releases the sigreq claim and answers 500 when an effect throws', async () => {
    vi.mocked(markTokenInvalid).mockRejectedValueOnce(new Error('db down'))
    const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      rpc: rpc.mockImplementation(makeRpc(true)),
      from: vi.fn((t: string) => t === 'ops_alert_state'
        ? { delete: del }
        : t === 'instagram_sync_log'
          ? { insert: insertSpy.mockResolvedValue({ error: null }) }
          : {
              select: vi.fn(() => ({ or: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [ACCOUNT], error: null })) })) })),
              update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
            }),
    } as never)
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(500)
    expect(del).toHaveBeenCalled()
  })
})
