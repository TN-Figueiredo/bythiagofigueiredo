// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const APP_SECRET = 'ig-app-secret'
const IG_ID = '17841400000000000'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/ops/ntfy', () => ({ sendNtfyAlert: vi.fn(async () => ({ alerted: true })) }))
vi.mock('@/lib/instagram/token', async () => {
  // `identityKeyOf` fica REAL (nao mockada) — mesma razão do teste de deauthorize:
  // a asserção deriva a chave da LINHA em vez de hardcodar `o:${IG_ID}`.
  const actual = await vi.importActual<typeof import('@/lib/instagram/token')>('@/lib/instagram/token')
  return {
    ...actual,
    markTokenInvalid: vi.fn(async () => undefined),
    sweepTokenAlerts: vi.fn(async () => []),
  }
})
vi.mock('@/lib/instagram/deletion', () => ({
  DELETION_BLOB_BUDGET_MS: 45_000,
  runDeletionEffects: vi.fn(async () => undefined),
}))
// MUST: a rota usa `claimAlert` (C2) para o anti-replay, nunca `supabase.rpc`
// cru — um `error` da RPC tem de LANÇAR e virar 500, nunca "já processado".
vi.mock('@/lib/ops/alert-state', () => ({ claimAlert: vi.fn(async () => true) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { runDeletionEffects } from '@/lib/instagram/deletion'
import { claimAlert } from '@/lib/ops/alert-state'
import { GET, POST, maxDuration } from '@/app/api/instagram/data-deletion/route'

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function signedRequest(payload: Record<string, unknown>, secret = APP_SECRET): string {
  const encoded = b64url(JSON.stringify(payload))
  return `${b64url(createHmac('sha256', secret).update(encoded).digest())}.${encoded}`
}
function post(over: Record<string, unknown> = {}) {
  const sr = signedRequest({
    algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: IG_ID, ...over,
  })
  return new Request('https://bythiagofigueiredo.com/api/instagram/data-deletion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ signed_request: sr }).toString(),
  })
}

const OAUTH_ROW = {
  id: 'acc-1', site_id: 'site-1', handle: 'thiago.figueiredo', locale: 'pt',
  ig_user_id: IG_ID, ig_professional_id: '9988776655', ig_user_id_source: 'oauth' as const,
  access_token: 'v1:x', created_at: '2026-01-01T00:00:00Z',
}

const rpc = vi.fn()
const requestInsert = vi.fn()
const accountUpdate = vi.fn()
const opsDelete = vi.fn()
const orSpy = vi.fn()
const sourceSpy = vi.fn()

function mockDb(opts: {
  oauthRows?: Record<string, unknown>[]
  legacyRows?: Record<string, unknown>[]
  claim?: boolean
  lastRequest?: { id: string; confirmation_code: string; requested_at: string; completed_at: string | null } | null
  sigreqLastAt?: string | null
}) {
  rpc.mockReset(); requestInsert.mockReset(); accountUpdate.mockReset()
  opsDelete.mockReset(); orSpy.mockReset(); sourceSpy.mockReset()
  // O anti-replay do sigreq passa por `claimAlert` (mockado acima), não por
  // `rpc` cru — só o claim do push `ddmismatch:` (23h) ainda usa `rpc` direto.
  vi.mocked(claimAlert).mockReset()
  vi.mocked(claimAlert).mockResolvedValue(opts.claim ?? true)
  rpc.mockImplementation(async () => ({ data: true, error: null }))
  requestInsert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: 'req-new' }, error: null }) }),
  })

  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'instagram_deletion_requests') {
        return {
          insert: requestInsert,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: opts.lastRequest ?? null, error: null })),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'ops_alert_state') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: opts.sigreqLastAt ? { last_at: opts.sigreqLastAt } : null, error: null,
              })),
            })),
          })),
          delete: vi.fn(() => ({ eq: vi.fn(async () => { opsDelete(); return { error: null } }) })),
        }
      }
      // instagram_accounts
      return {
        select: vi.fn(() => ({
          or: vi.fn((filter: string) => {
            orSpy(filter)
            return {
              eq: vi.fn(async (col: string, val: string) => {
                sourceSpy(col, val)
                return {
                  data: val === 'oauth' ? (opts.oauthRows ?? [OAUTH_ROW]) : (opts.legacyRows ?? []),
                  error: null,
                }
              }),
            }
          }),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          accountUpdate(patch)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
      }
    }),
  } as never)
}

describe('POST /api/instagram/data-deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    process.env.INSTAGRAM_APP_SECRET = APP_SECRET
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    mockDb({})
  })

  it('declares maxDuration = 60 and answers 405 to GET', async () => {
    expect(maxDuration).toBe(60)
    expect((await GET()).status).toBe(405)
  })

  it('inserts the request, clears the tokens, sweeps BEFORE anonymising and delegates (d)-(h)', async () => {
    const res = await POST(post())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; confirmation_code: string }
    expect(body.confirmation_code).toMatch(/^[0-9a-f]{32}$/)
    expect(body.url).toBe(`https://bythiagofigueiredo.com/data-deletion?code=${body.confirmation_code}`)

    expect(requestInsert).toHaveBeenCalledWith(expect.objectContaining({
      ig_user_id: IG_ID, site_id: 'site-1', completed_at: null,
    }))
    expect(markTokenInvalid).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ id: 'acc-1' }), 'data_deletion_requested',
      { fatal: true, forceReason: true },
    )
    expect(accountUpdate).toHaveBeenCalledWith(expect.objectContaining({
      access_token: null, token_expires_at: null,
    }))
    // (c) a varredura corre ANTES de (e): a anonimização é feita por
    // `runDeletionEffects`, e depois dela o grupo não casaria mais.
    expect(vi.mocked(sweepTokenAlerts).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(runDeletionEffects).mock.invocationCallOrder[0] ?? Infinity)
    expect(sweepTokenAlerts).toHaveBeenCalledWith(expect.anything(), { identityKey: identityKeyOf(OAUTH_ROW) })
    expect(runDeletionEffects).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'req-new', ig_user_id: IG_ID },
      expect.any(Number),
    )
  })

  it('matches ig_user_id OR ig_professional_id, and only oauth rows', async () => {
    await POST(post())
    expect(orSpy).toHaveBeenCalledWith(`ig_user_id.eq.${IG_ID},ig_professional_id.eq.${IG_ID}`)
    expect(sourceSpy).toHaveBeenCalledWith('ig_user_id_source', 'oauth')
  })

  it('answers 200 with url + code and a null site_id when nothing matched', async () => {
    mockDb({ oauthRows: [] })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(((await res.json()) as { confirmation_code: string }).confirmation_code).toMatch(/^[0-9a-f]{32}$/)
    expect(requestInsert).toHaveBeenCalledWith(expect.objectContaining({
      site_id: null, completed_at: expect.any(String),
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram data-deletion matched 0 accounts', 'warning')
    expect(runDeletionEffects).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(sendNtfyAlert).not.toHaveBeenCalled()
  })

  it('pushes an ID-space suspicion when a legacy row carries the same id — and touches nothing', async () => {
    mockDb({ oauthRows: [], legacyRows: [{ id: 'legacy-1', ig_user_id: IG_ID, ig_user_id_source: 'legacy' }] })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(sendNtfyAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Instagram deletion request matched no account',
      body: 'possible ID-space mismatch — see the runbook',
      priority: 'default',
      tags: ['warning'],
    }))
    const push = vi.mocked(sendNtfyAlert).mock.calls[0]?.[0]
    expect(`${push?.title} ${push?.body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${push?.title} ${push?.body}`).not.toMatch(/[0-9]{6,}/)
    expect(accountUpdate).not.toHaveBeenCalled()
    expect(runDeletionEffects).not.toHaveBeenCalled()
  })

  it('matches a row by ig_professional_id and refuses a legacy row with the same id', async () => {
    mockDb({ oauthRows: [{ ...OAUTH_ROW, ig_user_id: '11112222', ig_professional_id: IG_ID }] })
    expect((await POST(post())).status).toBe(200)
    expect(markTokenInvalid).toHaveBeenCalled()

    mockDb({ oauthRows: [], legacyRows: [{ id: 'legacy-1', ig_professional_id: IG_ID, ig_user_id_source: 'legacy' }] })
    vi.mocked(markTokenInvalid).mockClear()
    expect((await POST(post())).status).toBe(200)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram data-deletion matched 0 accounts', 'warning')
  })

  it('returns the same confirmation_code on a completed replay, with no destructive call', async () => {
    mockDb({
      claim: false,
      lastRequest: { id: 'req-1', confirmation_code: 'f'.repeat(32), requested_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-01T00:01:00Z' },
    })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(((await res.json()) as { confirmation_code: string }).confirmation_code).toBe('f'.repeat(32))
    expect(runDeletionEffects).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('answers 202 with no body while a fresh unfinished request is in flight', async () => {
    mockDb({
      claim: false,
      lastRequest: {
        id: 'req-1', confirmation_code: 'f'.repeat(32),
        requested_at: new Date(Date.now() - 30_000).toISOString(), completed_at: null,
      },
    })
    const res = await POST(post())
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
    expect(runDeletionEffects).not.toHaveBeenCalled()
  })

  it('resumes (d)-(h) for a stalled request older than 90 s and keeps the original code', async () => {
    mockDb({
      claim: false,
      lastRequest: {
        id: 'req-1', confirmation_code: 'f'.repeat(32),
        requested_at: new Date(Date.now() - 100_000).toISOString(), completed_at: null,
      },
    })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(((await res.json()) as { confirmation_code: string }).confirmation_code).toBe('f'.repeat(32))
    expect(runDeletionEffects).toHaveBeenCalledWith(
      expect.anything(), { id: 'req-1', ig_user_id: IG_ID }, expect.any(Number),
    )
    // (a) NÃO se repete: a linha já existe e o `confirmation_code` é o dela.
    expect(requestInsert).not.toHaveBeenCalled()
  })

  it('resumes (b) and (c) too: a run interrupted before the token loop leaves no token behind', async () => {
    // O run anterior morreu ENTRE a inserção da linha e o laço de tokens: a
    // linha existe com completed_at NULL e a conta ainda tem `access_token`.
    mockDb({
      claim: false,
      oauthRows: [{ ...OAUTH_ROW, access_token: 'v1:still-live' }],
      lastRequest: {
        id: 'req-1', confirmation_code: 'f'.repeat(32),
        requested_at: new Date(Date.now() - 100_000).toISOString(), completed_at: null,
      },
    })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(markTokenInvalid).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ id: 'acc-1' }), 'data_deletion_requested',
      { fatal: true, forceReason: true },
    )
    expect(accountUpdate).toHaveBeenCalledWith(expect.objectContaining({
      access_token: null, token_expires_at: null,
    }))
    expect(sweepTokenAlerts).toHaveBeenCalledWith(expect.anything(), { identityKey: identityKeyOf(OAUTH_ROW) })
    // E a limpeza continua vindo ANTES dos efeitos que anonimizam.
    expect(vi.mocked(sweepTokenAlerts).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(runDeletionEffects).mock.invocationCallOrder[0] ?? Infinity)
  })

  it('answers 500 with NO confirmation code when the request row fails to persist', async () => {
    mockDb({})
    requestInsert.mockReturnValue({
      select: () => ({ single: async () => ({ data: null, error: { message: '23505 duplicate key' } }) }),
    })
    const res = await POST(post())
    expect(res.status).toBe(500)
    expect(await res.text()).not.toMatch(/[0-9a-f]{32}/)
    expect(runDeletionEffects).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(opsDelete).toHaveBeenCalled()   // claim liberado: a re-tentativa da Meta recomeça
  })

  it('answers 500 with no code when the zero-match row fails to persist', async () => {
    mockDb({ oauthRows: [] })
    requestInsert.mockResolvedValue({ error: { message: 'db down' } })
    const res = await POST(post())
    expect(res.status).toBe(500)
    expect(await res.text()).not.toMatch(/[0-9a-f]{32}/)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('with no row: a fresh sigreq claim answers 202, a 100 s old one is released and processed', async () => {
    mockDb({ claim: false, lastRequest: null, sigreqLastAt: new Date(Date.now() - 30_000).toISOString() })
    expect((await POST(post())).status).toBe(202)
    expect(opsDelete).not.toHaveBeenCalled()

    mockDb({ claim: false, lastRequest: null, sigreqLastAt: new Date(Date.now() - 100_000).toISOString() })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(opsDelete).toHaveBeenCalled()
    expect(requestInsert).toHaveBeenCalled()
  })

  it('passes a deadline of runStart + DELETION_BLOB_BUDGET_MS so a truncated run keeps completed_at null', async () => {
    const t0 = Date.parse('2026-09-06T10:00:00Z')
    vi.useFakeTimers({ now: t0, toFake: ['Date'] })
    await POST(post({ issued_at: Math.floor(t0 / 1000) }))
    const deadline = vi.mocked(runDeletionEffects).mock.calls[0]?.[2] as number
    expect(deadline).toBe(t0 + 45_000)
    vi.useRealTimers()
  })

  it('releases the sigreq claim and answers 500 when an effect throws', async () => {
    vi.mocked(markTokenInvalid).mockRejectedValueOnce(new Error('db down'))
    const res = await POST(post())
    expect(res.status).toBe(500)
    expect(opsDelete).toHaveBeenCalled()
  })

  it('answers 500 (never 200/202) when the anti-replay claim itself errors', async () => {
    // `claimAlert` LANÇA quando a RPC devolve `error`; a chamada está dentro do
    // `try`, então o throw cai no `catch` => captureException + 500 e a Meta
    // re-tenta. Sem isto, um banco fora do ar viraria "já processado" e a
    // exclusão se perderia em silêncio (mesma classe de bug do `deauthorize`).
    vi.mocked(claimAlert).mockRejectedValueOnce(new Error('ops_alert_claim(key) failed: PGRST202 not found'))
    const res = await POST(post())
    expect(res.status).toBe(500)
    expect(requestInsert).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
