// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { encrypt } from '@tn-figueiredo/social/vault'

const CRON_SECRET = 'test-cron-secret'
// DEVIATION (plan bug, mesma correção da Tarefa 12): o plano usa
// `access_token: 'v1:cifrado'` como fixture literal — não é um ciphertext
// AES-256-GCM válido, então `readAccessToken` (implementação real, não
// mockada aqui) devolve `{ token: null }` para TODA conta default. Corrigido
// cifrando de verdade com a MESMA chave que o `beforeEach` stuba em
// SOCIAL_MASTER_KEY.
const VAULT_KEY_HEX = '0'.repeat(64)
const VAULT_KEY = Buffer.from(VAULT_KEY_HEX, 'hex')
function encToken(plain = 'IGAAplaintoken'): string {
  return `v1:${encrypt(plain, VAULT_KEY)}`
}

const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: string, _runId: string, _tag: string, fn: () => Promise<unknown>) =>
      fn().then((r: unknown) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'test-run-id'),
}))
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), setTag: vi.fn(),
}))
const mockRefresh = vi.fn()
vi.mock('@/lib/instagram/api-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/api-client')>()),
  refreshAccessToken: (...a: unknown[]) => mockRefresh(...a),
}))
const mockSweep = vi.fn()
const mockMark = vi.fn()
const mockStreak = vi.fn()
const mockProbe = vi.fn()
vi.mock('@/lib/instagram/token', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/token')>()),
  sweepTokenAlerts: (...a: unknown[]) => mockSweep(...a),
  markTokenInvalid: (...a: unknown[]) => mockMark(...a),
  evaluateTransientStreak: (...a: unknown[]) => mockStreak(...a),
  probeToken: (...a: unknown[]) => mockProbe(...a),
}))
const mockNtfy = vi.fn()
const mockHeartbeat = vi.fn()
vi.mock('@/lib/ops/ntfy', async (orig) => ({
  ...(await orig<typeof import('@/lib/ops/ntfy')>()),
  sendNtfyAlert: (...a: unknown[]) => mockNtfy(...a),
  sendNtfyHeartbeat: (...a: unknown[]) => mockHeartbeat(...a),
}))
const mockFanOut = vi.fn()
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  NO_SITE_ADMINS_ERROR: 'no site admins to email',
  fanOutToSiteAdminsDetailed: (...a: unknown[]) => mockFanOut(...a),
}))
vi.mock('@/lib/instagram/deletion', () => ({
  DELETION_BLOB_BUDGET_MS: 45_000,
  resumeStuckDeletionRequest: vi.fn(() => Promise.resolve(false)),
  runDeletionEffects: vi.fn(),
}))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: vi.fn(() => Promise.resolve('log-1')),
  closeSyncRow: vi.fn(() => Promise.resolve()),
}))
const mockSync = vi.fn()
const mockImgHealth = vi.fn()
vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: (...a: unknown[]) => mockSync(...a),
  checkImageCacheHealth: (...a: unknown[]) => mockImgHealth(...a),
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
}))
const listMock = vi.fn()
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a), del: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { GET, maxDuration } from '@/app/api/cron/instagram-sync/route'
import { closeSyncRow } from '@/lib/instagram/sync-log'
import { resumeStuckDeletionRequest } from '@/lib/instagram/deletion'
import { revalidateTag } from 'next/cache'

/** Harness: um mock de `from` que serve todas as tabelas do cron. */
function harness(opts: {
  accounts?: Array<Record<string, unknown>>
  selectError?: { message: string } | null
  claims?: Record<string, boolean>
  stamps?: Record<string, string>
  deadEmails?: number
} = {}) {
  const claims = opts.claims ?? {}
  const stamps = opts.stamps ?? {}
  const claimed: string[] = []
  const released: string[] = []
  const updates: Array<Record<string, unknown>> = []

  mockRpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn === 'ops_alert_claim') {
      const key = String(args.p_key)
      claimed.push(key)
      return Promise.resolve({ data: claims[key] ?? true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'instagram_accounts') {
      const rows = opts.accounts ?? []
      const terminal = Promise.resolve({ data: rows, error: opts.selectError ?? null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, or: () => chain, eq: () => chain,
        in: () => chain, order: () => terminal, then: terminal.then.bind(terminal),
        update: (patch: Record<string, unknown>) => { updates.push(patch); return chain },
      }
      return chain
    }
    if (table === 'ops_alert_state') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        delete: () => ({
          eq: (_col: string, key: string) => { released.push(key); return Promise.resolve({ error: null }) },
          like: () => ({ lt: () => Promise.resolve({ error: null }) }),
        }),
        upsert: () => Promise.resolve({ error: null }),
      }
    }
    if (table === 'notification_deliveries') {
      return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: opts.deadEmails ?? 0, error: null }) }) }) }) }
    }
    if (table === 'sites') {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 'site-1', slug: 'bythiagofigueiredo' }], error: null }) }) }
    }
    const settled = Promise.resolve({ data: [], error: null, count: 0 })
    const generic: Record<string, unknown> = {
      select: () => generic, eq: () => generic, in: () => generic, is: () => generic,
      lt: () => generic, gt: () => generic, like: () => generic, order: () => generic,
      limit: () => settled,
      delete: () => generic, update: () => generic,
      insert: () => Promise.resolve({ error: null }),
      then: settled.then.bind(settled),
    }
    return generic
  })
  void stamps
  return { claimed, released, updates }
}

function req(auth = `Bearer ${CRON_SECRET}`, params: Record<string, string> = {}): NextRequest {
  const headers = new Headers({ authorization: auth })
  const url = new URL('http://x/api/cron/instagram-sync')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { headers, nextUrl: url } as unknown as NextRequest
}

function account(over: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: 'thiago.figueiredo',
    ig_user_id: '17841400000000000', access_token: encToken(),
    token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    token_refreshed_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    token_error: null, token_error_at: null, token_error_mode: null,
    token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
    ig_professional_id: null, ig_user_id_source: 'oauth',
    sync_enabled: true, display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null, section_subtitle_pt: null,
    section_subtitle_en: null, last_synced_at: null, created_at: '', updated_at: '',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', CRON_SECRET)
  vi.stubEnv('NTFY_URL', 'https://ntfy.example/t')
  vi.stubEnv('SOCIAL_MASTER_KEY', '0'.repeat(64))
  vi.stubEnv('VERCEL_ENV', 'development')
  mockSweep.mockResolvedValue([])
  mockNtfy.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
  mockHeartbeat.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
  mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  mockStreak.mockResolvedValue(false)
  // Ver DEVIATION na Tarefa 12: `vi.clearAllMocks()` não reseta implementação.
  vi.mocked(resumeStuckDeletionRequest).mockResolvedValue(false)
  mockMark.mockResolvedValue(undefined)
  listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined })
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe('cron do sync — configuração', () => {
  it('maxDuration === 180', () => { expect(maxDuration).toBe(180) })
})

describe('probes: TODA conta com token, isentas de orçamento', () => {
  beforeEach(() => { mockProbe.mockResolvedValue({ ok: true }); mockSync.mockResolvedValue({
    postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
  }) })

  it('conta com sync_enabled=false ainda recebe /me', async () => {
    harness({ accounts: [account({ sync_enabled: false })] })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(1)
    expect(mockSync).not.toHaveBeenCalled()
    expect(body.probed).toBe(1)
  })

  it('conta em deferred na fase de syncs AINDA foi probada', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T13:00:00Z'), toFake: ['Date'] })
    mockSync.mockImplementation(async () => { vi.advanceTimersByTime(101_000); return {
      postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0 } })
    harness({ accounts: [account({ id: 'a' }), account({ id: 'b' })] })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(2)
    expect(body.deferred).toBe(1)
  })

  it('30 s de relógio falso nos passos 0-3 => todas as contas ainda probadas e a varredura entrega', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T13:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(30_000); return false
    })
    harness({ accounts: [account({ id: 'a' }), account({ id: 'b' }), account({ id: 'c' })] })
    await GET(req())
    expect(mockProbe).toHaveBeenCalledTimes(3)
    expect(mockSweep).toHaveBeenCalledTimes(1)
  })

  it('probe que estoura 10 s vira FALHA CLASSIFICADA, nunca probe pulado', async () => {
    const abort = new Error('The operation was aborted'); abort.name = 'TimeoutError'
    mockProbe.mockResolvedValue({ ok: false, error: abort })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_transient).toBe(1)
    expect(mockStreak).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'daily')
  })

  it('6 contas com token => 6 probes, nenhum deferred e NENHUM probe_starved', async () => {
    const h = harness({ accounts: Array.from({ length: 6 }, (_, i) => account({ id: `a${i}`, sync_enabled: false })) })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(6)
    expect(body.deferred).toBe(0)
    expect(h.claimed).not.toContain('probe_starved')
  })

  it('7 contas => 6 probes + deferred da 7ª + captureMessage 1×/dia', async () => {
    const h = harness({ accounts: Array.from({ length: 7 }, (_, i) => account({ id: `a${i}`, sync_enabled: false })) })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(6)
    expect(body.deferred).toBe(1)
    expect(h.claimed).toContain('probe_starved')
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram probe fleet exceeds design point', 'warning')
  })

  it('probe com OAuthException 400 => permanent + alerta no MESMO run', async () => {
    mockProbe.mockResolvedValue({ ok: false, error: Object.assign(new Error('Invalid OAuth access token'),
      { code: 190, type: 'OAuthException', httpStatus: 400 }) })
    mockSweep.mockResolvedValue([{ siteId: 'site-1', identityKey: 'o:1', notifications: 1, ntfy: 'sent' }])
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_permanent).toBe(1)
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), expect.anything(),
      expect.stringContaining('Invalid OAuth access token'), { fatal: true })
    expect(mockSweep).toHaveBeenCalledTimes(1)
    expect(body.alert_channels.alerts).toEqual(['sent'])
  })
})

describe('por conta', () => {
  it('access_token nulo => 1 linha/semana never_connected, SEM alerta', async () => {
    const h = harness({ accounts: [account({ access_token: null })] })
    const body = await (await GET(req())).json()
    expect(h.claimed).toContain('never_connected:acc-1')
    expect(body.never_connected).toBe(1)
    expect(mockProbe).not.toHaveBeenCalled()
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('Instagram token'))).toBe(false)
  })

  it('token_error presente => linha token_invalid: <motivo> e o probe AINDA roda', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    harness({ accounts: [account({ token_error: 'expired', token_error_at: new Date().toISOString() })] })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(1)
    expect(body.token_invalid).toBe(1)
    expect(vi.mocked(closeSyncRow).mock.calls.some(([, , , m]) => String(m).startsWith('token_invalid: '))).toBe(true)
  })

  it('sync transitório => streak com modo daily', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockRejectedValue(Object.assign(new Error('rate limit'), { code: 4 }))
    harness({ accounts: [account()] })
    await GET(req())
    expect(mockStreak).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'daily')
  })

  it('23505 => infra: sem streak e sem markTokenInvalid', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint "instagram_posts_ig_media_id_key"', details: null, hint: null })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_infra).toBe(1)
    expect(mockStreak).not.toHaveBeenCalled()
    expect(mockMark).not.toHaveBeenCalled()
    expect(body.step_errors).toBe(0)
  })

  it('checkImageCacheHealth é chamado depois de cada sync concluído', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockResolvedValue({ postsFound: 1, postsInserted: 1, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 1 })
    harness({ accounts: [account()] })
    await GET(req())
    expect(mockImgHealth).toHaveBeenCalledWith(expect.anything(), 'acc-1')
  })

  it('mediaFailed > 0 entra no error_message via closeSyncRow (result completo)', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    const result = { postsFound: 1, postsInserted: 1, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 2 }
    mockSync.mockResolvedValue(result)
    harness({ accounts: [account()] })
    await GET(req())
    expect(vi.mocked(closeSyncRow)).toHaveBeenCalledWith(expect.anything(), 'log-1', result)
  })

  it('revalidateTag só com posts novos ou atualizados', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockResolvedValue({ postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0 })
    harness({ accounts: [account()] })
    await GET(req())
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
  })
})

describe('censo de Blob semanal (veio de §3.3)', () => {
  it('> 400 MB => 1 push low com tag package e Click', async () => {
    listMock.mockResolvedValue({ blobs: [{ size: 500 * 1024 * 1024 }], hasMore: false, cursor: undefined })
    harness({ accounts: [] })
    await GET(req())
    const push = mockNtfy.mock.calls.find(([a]) => String(a.title).includes('blob store'))![0]
    expect(push.priority).toBe('low')
    expect(push.tags).toEqual(['package'])
    expect(push.click).toBeTruthy()
    expect(`${push.title} ${push.body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
  })

  it('abaixo da linha => nenhum push de censo', async () => {
    listMock.mockResolvedValue({ blobs: [{ size: 1024 }], hasMore: false, cursor: undefined })
    harness({ accounts: [] })
    await GET(req())
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('blob'))).toBe(false)
  })

  it('teto de 10 páginas => push de TRUNCAMENTO e NENHUMA comparação com o limiar', async () => {
    listMock.mockResolvedValue({ blobs: Array.from({ length: 1000 }, () => ({ size: 1 })), hasMore: true, cursor: 'c' })
    harness({ accounts: [] })
    await GET(req())
    expect(listMock).toHaveBeenCalledTimes(10)
    const push = mockNtfy.mock.calls.find(([a]) => String(a.title).includes('truncated'))![0]
    expect(push.title).toMatch(/^Instagram blob census truncated at \d+ objects$/)
    expect(push.tags).toEqual(['package'])
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('blob store at'))).toBe(false)
  })

  it('elapsed > 8 s => censo pulado e chave blobsize LIBERADA', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T13:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(9_000); return false
    })
    const h = harness({ accounts: [] })
    await GET(req())
    expect(listMock).not.toHaveBeenCalled()
    expect(h.released).toContain('blobsize')
  })
})

describe('canal neste cron', () => {
  it('emite a SONDA (chave compartilhada) e NUNCA o heartbeat de 5 dias', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_probe_due')
    expect(h.claimed).not.toContain('ntfy_heartbeat_due')
    expect(mockHeartbeat).not.toHaveBeenCalled()
  })

  it('vigilância do carimbo: D-9 => error', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const stampIso = new Date(Date.now() - 9 * 86_400_000).toISOString()
    mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: (_c: string, k: string) => ({ maybeSingle: () => Promise.resolve({ data: k === 'ntfy_heartbeat_ok' ? { last_at: stampIso } : null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          upsert: () => Promise.resolve({ error: null }),
        }
      }
      if (table === 'notification_deliveries') {
        return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
      }
      const t = Promise.resolve({ data: [], error: null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
        lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
        update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
      }
      return chain
    })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('no heartbeat accepted')
  })

  it('as chaves de episódio e de step_errors são POR CRON', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_transient:instagram-sync')
    expect(h.claimed).not.toContain('ntfy_transient:instagram-token-refresh')
  })

  it('refresh às 11:00 e sync às 13:00 são DOIS episódios independentes (chaves diferentes, 2 h)', async () => {
    // Prova de forma: as chaves são distintas, então nenhum claim do sync
    // encontra o carimbo do refresh e nenhum run vira "persistente" por isso.
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
    const h = harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('ok')
    expect(h.claimed.filter((k) => k.startsWith('ntfy_transient:'))).toEqual(['ntfy_transient:instagram-sync'])
  })

  it('a retenção de ops_alert_state (ddpage:%/sigreq:%) também roda AQUI', async () => {
    const deleted: string[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
            like: (_c: string, pattern: string) => { deleted.push(pattern); return { lt: () => Promise.resolve({ error: null }) } },
          }),
          upsert: () => Promise.resolve({ error: null }),
        }
      }
      if (table === 'notification_deliveries') {
        return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
      }
      const t = Promise.resolve({ data: [], error: null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
        lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
        update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
      }
      return chain
    })
    mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
    await GET(req())
    expect(deleted).toContain('ddpage:%')
    expect(deleted).toContain('sigreq:%')
  })
})

describe('refresh + sync no mesmo dia', () => {
  it('a varredura dedupa: uma notificação e um push por perfil', async () => {
    mockSweep.mockResolvedValue([{ siteId: 'site-1', identityKey: 'o:1', notifications: 1, ntfy: 'sent' }])
    harness({ accounts: [account({ token_error: 'expired', token_error_at: new Date().toISOString() })] })
    const body = await (await GET(req())).json()
    expect(body.alert_channels.alerts).toEqual(['sent'])
    expect(mockSweep).toHaveBeenCalledTimes(1)
  })
})
