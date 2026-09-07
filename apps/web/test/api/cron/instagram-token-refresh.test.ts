// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { encrypt } from '@tn-figueiredo/social/vault'

const CRON_SECRET = 'test-cron-secret'
// DEVIATION (plan bug): o plano usa `access_token: 'v1:cifrado'` como fixture
// literal — não é um ciphertext AES-256-GCM válido, então `readAccessToken`
// (implementação real, não mockada aqui) devolve `{ token: null }` para TODA
// conta default, e o cron toma o ramo `decrypt_failed` em vez dos ramos que os
// testes abaixo pretendem exercitar. Corrigido cifrando de verdade com a MESMA
// chave (`'0'.repeat(64)`) que o `beforeEach` stuba em SOCIAL_MASTER_KEY —
// `encrypt()` recebe a chave por parâmetro, então funciona mesmo em testes que
// depois trocam o env (vaultDown), já que o valor já está cifrado.
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
vi.mock('@/lib/instagram/token', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/token')>()),
  sweepTokenAlerts: (...a: unknown[]) => mockSweep(...a),
  markTokenInvalid: (...a: unknown[]) => mockMark(...a),
  evaluateTransientStreak: (...a: unknown[]) => mockStreak(...a),
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

import * as Sentry from '@sentry/nextjs'
import { GET, maxDuration } from '@/app/api/cron/instagram-token-refresh/route'
import { closeSyncRow } from '@/lib/instagram/sync-log'
import { resumeStuckDeletionRequest } from '@/lib/instagram/deletion'

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
          // releaseAlert(key)
          eq: (_col: string, key: string) => { released.push(key); return Promise.resolve({ error: null }) },
          // retenção: .delete().like('key','ddpage:%').lt('last_at', …)
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
    // Cadeia genérica THENABLE: toda etapa do cron (retenção, órfãs, logs)
    // termina num `await`, e um objeto sem `then` faria o destructuring
    // devolver `undefined` em vez de `{ data, error }`.
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

function req(auth = `Bearer ${CRON_SECRET}`): NextRequest {
  const headers = new Headers({ authorization: auth })
  return { headers, nextUrl: new URL('http://x/api/cron/instagram-token-refresh') } as unknown as NextRequest
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
  // DEVIATION (plan bug): `vi.clearAllMocks()` só limpa `.mock.calls`, nunca a
  // implementação (`mockImplementation`/`mockRejectedValue` sobrevivem entre
  // testes). Sem isto, o `resumeStuckDeletionRequest.mockImplementation(() =>
  // { vi.advanceTimersByTime(9_000); … })` de um teste de fake-timers
  // continuava ativo nos testes seguintes com relógio real —
  // `vi.advanceTimersByTime` fora de `useFakeTimers` lança, e a exceção
  // (capturada pelo wrapper `step()`) inflava `step_errors` e derrubava o
  // portão de 8 s do passo 3 (falso "elapsed" alto). Idem para `markMock`.
  vi.mocked(resumeStuckDeletionRequest).mockResolvedValue(false)
  mockMark.mockResolvedValue(undefined)
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe('config', () => {
  it('maxDuration === 180', () => { expect(maxDuration).toBe(180) })
  it('401 sem CRON_SECRET', async () => {
    harness({})
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
  })
})

describe('passo 0 vazio (regressão H3): nada de rede antes do passo 1', () => {
  it('a PRIMEIRA chamada ao ntfy do run acontece depois da varredura', async () => {
    const order: string[] = []
    mockNtfy.mockImplementation(async () => { order.push('ntfy'); return { alerted: true, ntfyStatus: 200 } })
    mockHeartbeat.mockImplementation(async () => { order.push('ntfy'); return { alerted: true, ntfyStatus: 200 } })
    mockSweep.mockImplementation(async () => { order.push('sweep'); return [] })
    harness({ accounts: [] })
    await GET(req())
    expect(order[0]).toBe('sweep')
  })
})

describe('passo 2 — select com erro é o ÚNICO retorno cedo', () => {
  it('status error com a causa nomeada', async () => {
    harness({ accounts: [], selectError: { message: 'boom' } })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('select failed')
  })
})

describe('passo 3 — etapas independentes', () => {
  it('retenção roda mesmo com seleção vazia', async () => {
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('ok')
    expect(vi.mocked(resumeStuckDeletionRequest)).toHaveBeenCalled()
  })

  it('expiring_clean dispara com episódio transitório ABERTO (predicado = token_error is null)', async () => {
    harness({ accounts: [account({
      token_error: null,
      token_error_at: new Date(Date.now() - 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })] })
    await GET(req())
    const push = mockNtfy.mock.calls.find(([a]) => String(a.title).includes('expiring'))
    expect(push).toBeTruthy()
    expect(String(push![0].title)).toContain('bythiagofigueiredo')
    expect(String(push![0].title)).not.toContain('@')
    expect(push![0].tags).toEqual(['warning'])
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalled()
  })

  it('expiring_clean com Date.now() - runStart acima de 8 s => PULADO e chave liberada', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    const h = harness({ accounts: [account({
      token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(9_000); return false
    })
    await GET(req())
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('expiring'))).toBe(false)
    expect(h.released).toContain('expiring_clean:acc-1')
  })

  it('ORDEM (regressão H3): ntfy respondendo em 9 s no passo 5b NÃO fecha o portão do passo 3', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockNtfy.mockImplementation(async () => { vi.advanceTimersByTime(9_000); return { alerted: true, ntfyStatus: 200 } })
    mockHeartbeat.mockImplementation(async () => { vi.advanceTimersByTime(9_000); return { alerted: true, ntfyStatus: 200 } })
    harness({ accounts: [account({
      token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })] })
    await GET(req())
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('expiring'))).toBe(true)
  })

  it('órfã: linha started há mais de 30 min vira failed/timeout, e mode=manual gera captureMessage', async () => {
    // DEVIATION (plan bug): o plano usa `mockFrom.mockImplementationOnce(...)`
    // assumindo que a PRIMEIRA chamada a `.from()` do run é a consulta de
    // órfãs — mas o passo 2 (`select` de `instagram_accounts`) roda ANTES do
    // passo 3 (órfãs), então o "once" interceptava o select de contas (que
    // não tem `.order()`) e a rota lançava `TypeError`. Corrigido despachando
    // por NOME da tabela, como o resto do harness já faz.
    harness({ accounts: [] })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'instagram_sync_log') {
        return {
          select: () => ({ eq: () => ({ lt: () => Promise.resolve({ data: [{ id: 'l1', mode: 'manual' }], error: null }) }) }),
          update: () => ({ in: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'instagram_accounts') {
        const terminal = Promise.resolve({ data: [], error: null })
        const chain: Record<string, unknown> = {
          select: () => chain, order: () => terminal, then: terminal.then.bind(terminal),
        }
        return chain
      }
      const settled = Promise.resolve({ data: [], error: null, count: 0 })
      const generic: Record<string, unknown> = {
        select: () => generic, eq: () => generic, in: () => generic, is: () => generic,
        lt: () => generic, gt: () => generic, like: () => generic, order: () => generic,
        limit: () => settled, delete: () => generic, update: () => generic,
        insert: () => Promise.resolve({ error: null }), then: settled.then.bind(settled),
      }
      return generic
    })
    await GET(req())
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram manual sync timed out', 'warning')
  })

  it('nenhum censo de Blob neste cron', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).not.toContain('blobsize')
  })
})

describe('passo 4 — deadline relativo à FASE, seleção e reprova', () => {
  it('30 s de relógio falso nos passos 1-3 => o passo 4 ainda dispõe dos 35 s inteiros', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(30_000); return false
    })
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.refreshed).toBe(1)
    expect(body.deferred).toBe(0)
  })

  it('conta não iniciada por prazo => deferred + captureMessage 1×/dia no PRIMEIRO deferral', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockRefresh.mockImplementation(async () => { vi.advanceTimersByTime(36_000); return { accessToken: 'x', expiresIn: 1 } })
    harness({ accounts: [account({ id: 'acc-1' }), account({ id: 'acc-2' })] })
    const body = await (await GET(req())).json()
    expect(body.deferred).toBe(1)
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram cron budget starving an account', 'warning')
  })

  it('24 h 10 min => too_fresh, sem chamada e sem log', async () => {
    harness({ accounts: [account({
      token_refreshed_at: new Date(Date.now() - (24 * 3_600_000 + 600_000)).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(body.skipped_fresh).toBe(1)
    expect(body).not.toHaveProperty('skipped')
  })

  it('25 h 10 min => chamada à Meta', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account({
      token_refreshed_at: new Date(Date.now() - (25 * 3_600_000 + 600_000)).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(body.refreshed).toBe(1)
  })

  it('token_refreshed_at NULL entra na seleção (braço IS NULL do portão de 25 h)', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account({ token_refreshed_at: null, token_expires_at: null })] })
    expect((await (await GET(req())).json()).refreshed).toBe(1)
  })

  it('token legado (sem v1:) é renovado e regravado CIFRADO', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    const h = harness({ accounts: [account({ access_token: 'IGlegacyPlain' })] })
    await GET(req())
    expect(mockRefresh).toHaveBeenCalledWith('IGlegacyPlain')
    const patch = h.updates.find((u) => 'access_token' in u)!
    expect(String(patch.access_token).startsWith('v1:')).toBe(true)
  })

  it('token expirado: failed/"expired" SEM chamada + markTokenInvalid fatal', async () => {
    harness({ accounts: [account({ token_expires_at: new Date(Date.now() - 3_600_000).toISOString() })] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'expired', { fatal: true })
    expect(body.failed_permanent).toBe(1)
    expect(vi.mocked(closeSyncRow)).toHaveBeenCalledWith(expect.anything(), 'log-1', null, 'expired')
  })

  it('falha permanente => markTokenInvalid fatal + linha permanent:', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('Invalid OAuth access token'),
      { code: 190, type: 'OAuthException', httpStatus: 400 }))
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_permanent).toBe(1)
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), expect.anything(),
      expect.stringContaining('Invalid OAuth access token'), { fatal: true })
    expect(vi.mocked(closeSyncRow).mock.calls.at(-1)![3]).toMatch(/^permanent: /)
  })

  it('falha transitória => linha transient: + evaluateTransientStreak("token_refresh")', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('rate limit'), { code: 4, httpStatus: 400 }))
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_transient).toBe(1)
    expect(vi.mocked(closeSyncRow).mock.calls.at(-1)![3]).toMatch(/^transient: /)
    expect(mockStreak).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'token_refresh')
  })

  it('infra => linha infra: + step_errors, sem markTokenInvalid', async () => {
    mockRefresh.mockRejectedValue({ code: 'PGRST202', message: 'not found', details: null, hint: null })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_infra).toBe(1)
    expect(body.step_errors).toBeGreaterThan(0)
    expect(mockMark).not.toHaveBeenCalled()
  })

  it('23505 na janela C2→C4: infra SEM step_errors, SEM push, captureMessage info 1×/dia', async () => {
    mockRefresh.mockRejectedValue({
      code: '23505', message: 'duplicate key value violates unique constraint "instagram_posts_ig_media_id_key"',
      details: null, hint: null,
    })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.step_errors).toBe(0)
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram duplicate media in C2→C4 window', 'info')
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('degraded'))).toBe(false)
  })

  it('markTokenInvalid lançando (RPC E fallback mortos) => step_errors++, push 1×/dia e status ERROR', async () => {
    // Important #2: antes, este run devolvia `status:'ok'` — `recordCronSuccess`,
    // /api/health verde — com a marcação do episódio perdida. O único sinal era
    // o push genérico "cron degraded", que uma recusa transitória engole.
    mockRefresh.mockRejectedValue(Object.assign(new Error('expired'), { httpStatus: 401 }))
    mockMark.mockRejectedValue(new Error('PGRST202'))
    const h = harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('step(s) failed')
    expect(body.step_errors).toBeGreaterThan(0)
    expect(h.claimed).toContain('step_errors:instagram-token-refresh')
  })

  it('varredura falhando SOZINHA já faz o run se declarar em erro (Important #2)', async () => {
    // O caminho que o relatório do bloco 4 afirmava não existir: o select da
    // varredura morre, `step('sweep')` engole, e o run se declarava saudável —
    // sem alerta nenhum, porque a varredura é a ÚNICA porta de saída.
    // Sem NTFY_URL ausente, sem recusa, sem vault caído: só a varredura.
    mockSweep.mockRejectedValue(new Error('sweep select failed: PGRST301'))
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.step_errors).toBe(1)
    expect(body.error).toBe('1 step(s) failed')
  })
})

describe('reprova (contas já em episódio)', () => {
  it('token_expires_at ≤ 10 d => intervalo de 23 h', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    const h = harness({ accounts: [account({
      token_error: 'expired',
      token_error_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_reprobe_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(body.reprobed).toBe(1)
    const patch = h.updates.find((u) => 'token_error' in u && u.token_error === null)!
    expect(patch).toMatchObject({
      token_error: null, token_error_at: null, token_error_mode: null,
      token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
    })
    expect(patch.token_refreshed_at).toBeTruthy()
    expect(vi.mocked(closeSyncRow).mock.calls.at(-1)![2]).not.toBeNull()
    expect(body.step_errors).toBe(0)
  })

  it('token_expires_at a 20 d => intervalo de 167 h (não reprova com 24 h)', async () => {
    const h = harness({ accounts: [account({
      token_error: 'expired',
      token_error_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_reprobe_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(body.reprobed).toBe(0)
    expect(h.updates.some((u) => u.token_error === null)).toBe(false)
  })

  it('qualquer desfecho grava token_reprobe_at', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('still dead'), { httpStatus: 401 }))
    const h = harness({ accounts: [account({
      token_error: 'expired',
      token_error_at: new Date(Date.now() - 200 * 3_600_000).toISOString(),
      token_reprobe_at: new Date(Date.now() - 200 * 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    })] })
    await GET(req())
    expect(h.updates.some((u) => 'token_reprobe_at' in u && u.token_reprobe_at !== null)).toBe(true)
  })
})

describe('passo 5 e 5b — varredura antes do canal', () => {
  it('30 s de relógio falso nos passos 0-3 => a varredura AINDA entrega (elapsed é de sweepStart)', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(30_000); return false
    })
    mockSweep.mockResolvedValue([{ siteId: 's', identityKey: 'o:1', notifications: 1, ntfy: 'sent' }])
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(mockSweep).toHaveBeenCalledTimes(1)
    expect(body.alert_channels.alerts).toEqual(['sent'])
  })

  it('varredura consumindo os 25 s => sonda e heartbeat ainda são emitidos no mesmo run', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockSweep.mockImplementation(async () => { vi.advanceTimersByTime(25_000); return [] })
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(mockNtfy.mock.calls.some(([a]) => a.priority === 'min')).toBe(true)
    expect(mockHeartbeat).toHaveBeenCalledTimes(1)
    expect(body.alert_channels.probe).toBe('sent')
  })

  it('sonda diária: claim de 23 h, priority min, tag mag, SEM Click', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_probe_due')
    const probe = mockNtfy.mock.calls.find(([a]) => a.priority === 'min')![0]
    expect(probe.tags).toEqual(['mag'])
    expect(probe.click).toBeUndefined()
    expect(probe.title).toBe('Instagram ops probe')
    expect(probe.body).toBe('channel probe')
  })

  it('entrega aceita da SONDA carimba ntfy_heartbeat_ok mesmo sem heartbeat visível', async () => {
    const h = harness({ accounts: [], claims: { ntfy_heartbeat_due: false } })
    await GET(req())
    expect(mockHeartbeat).not.toHaveBeenCalled()
    expect(h.claimed).toContain('ntfy_heartbeat_ok')
  })

  it('403 na sonda => recusa TERMINAL => error no MESMO run (em produção)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 403 })
    mockHeartbeat.mockResolvedValue({ alerted: false, ntfyStatus: 403 })
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('terminal refusal (HTTP 403)')
  })

  it('5xx na sonda => episódio de canal: ok no 1º run, error no 2º (24 h depois)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
    mockHeartbeat.mockResolvedValue({ alerted: false, ntfyStatus: 503 })

    let stamp: string | null = null
    mockRpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
      if (fn !== 'ops_alert_claim') return Promise.resolve({ data: null, error: null })
      if (args.p_key === 'ntfy_transient:instagram-token-refresh') {
        if (stamp === null) { stamp = new Date().toISOString(); return Promise.resolve({ data: true, error: null }) }
        return Promise.resolve({ data: false, error: null })
      }
      return Promise.resolve({ data: true, error: null })
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: stamp ? { last_at: stamp } : null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }), like: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
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

    expect((await (await GET(req())).json()).status).toBe('ok')
    vi.setSystemTime(new Date('2026-09-07T11:00:00Z'))
    const second = await (await GET(req())).json()
    expect(second.status).toBe('error')
    expect(second.error).toContain('transient for 2 runs')
  })

  it('heartbeat: primeiro run emite (claim de 5 dias) e é priority low', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_heartbeat_due')
    expect(mockHeartbeat).toHaveBeenCalledTimes(1)
  })
})

describe('passo 7 — status e segundo canal', () => {
  it('produção sem NTFY_URL => trabalho executado + error com a causa + 1 e-mail', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NTFY_URL', '')
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.refreshed).toBe(1)
    expect(body.status).toBe('error')
    expect(body.error).toContain('NTFY_URL unset')
    expect(mockFanOut).toHaveBeenCalledTimes(1)
    expect(mockFanOut.mock.calls[0]![0]).toMatchObject({
      type: 'system.cron_failure', title: 'Instagram alert channel down', defaultChannels: ['email'],
    })
  })

  it('fora de produção a mesma condição devolve ok', async () => {
    vi.stubEnv('NTFY_URL', '')
    harness({ accounts: [] })
    expect((await (await GET(req())).json()).status).toBe('ok')
  })

  it('vaultDown: contas intocadas + error + 1 e-mail só em produção', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SOCIAL_MASTER_KEY', 'nope')
    const h = harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(h.updates.some((u) => 'access_token' in u)).toBe(false)
    expect(body.status).toBe('error')
    expect(body.error).toContain('vault unavailable')
  })

  it('vaultDown + NTFY_URL ausente => UM só e-mail com as duas causas', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SOCIAL_MASTER_KEY', 'nope')
    vi.stubEnv('NTFY_URL', '')
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(mockFanOut).toHaveBeenCalledTimes(1)
    expect(body.error).toContain('NTFY_URL unset')
    expect(body.error).toContain('vault unavailable')
    expect(mockFanOut.mock.calls[0]![0].title).toBe('Instagram token storage unavailable')
  })

  it('e-mail de fallback morto nos últimos 2 dias => error com a causa', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    harness({ accounts: [], deadEmails: 1 })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('fallback email dead')
  })

  it('carimbo ntfy_heartbeat_ok de D-6 e D-8 => ok; D-9 => error', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    for (const [days, expected] of [[6, 'ok'], [8, 'ok'], [9, 'error']] as const) {
      vi.clearAllMocks()
      mockSweep.mockResolvedValue([]); mockNtfy.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
      mockHeartbeat.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
      mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
      // +1 min nos casos 'ok': D-8 EXATO fica na borda de HEARTBEAT_STALE_MS
      // (`> 8 dias`), então qualquer milissegundo gasto entre montar a fixture
      // e o passo `heartbeat-watch` já a torna stale — o teste passava ou
      // falhava conforme a carga da máquina. A intenção é "8 dias ainda é ok,
      // 9 não"; um minuto para dentro da janela expressa isso sem ambiguidade.
      const stampIso = new Date(
        Date.now() - days * 86_400_000 + (expected === 'ok' ? 60_000 : 0),
      ).toISOString()
      mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ops_alert_state') {
          return {
            select: () => ({ eq: (_c: string, k: string) => ({ maybeSingle: () => Promise.resolve({ data: k === 'ntfy_heartbeat_ok' ? { last_at: stampIso } : null }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }), like: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
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
      expect(body.status, `D-${days}`).toBe(expected)
    }
  })

  it('sem carimbo e sem recusa => ok (o run de estreia é o caso esperado)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    harness({ accounts: [] })
    expect((await (await GET(req())).json()).status).toBe('ok')
  })

  it('chave de 31 h e de 60 h => FÓSSIL: re-carimbada, status ok', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    for (const hours of [31, 60]) {
      vi.clearAllMocks()
      mockSweep.mockResolvedValue([])
      mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
      mockHeartbeat.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
      mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
      const stampIso = new Date(Date.now() - hours * 3_600_000).toISOString()
      mockRpc.mockImplementation(() => Promise.resolve({ data: false, error: null }))
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ops_alert_state') {
          return {
            select: () => ({ eq: (_c: string, k: string) => ({ maybeSingle: () => Promise.resolve({ data: k.startsWith('ntfy_transient') ? { last_at: stampIso } : null }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }), like: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
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
      expect(body.status, `${hours}h`).toBe('ok')
    }
  })

  it('run limpo sem entrega => a chave do episódio é apagada', async () => {
    const h = harness({ accounts: [], claims: { ntfy_probe_due: false, ntfy_heartbeat_due: false } })
    await GET(req())
    expect(h.released).toContain('ntfy_transient:instagram-token-refresh')
  })

  it('still_broken conta as contas com token_error_at ao fim; alert_channels é asserido', async () => {
    harness({ accounts: [account({ token_error: 'expired', token_error_at: new Date().toISOString() })] })
    const body = await (await GET(req())).json()
    expect(body.still_broken).toBe(1)
    expect(body.alert_channels).toEqual({ probe: 'sent', heartbeat: 'sent', alerts: [] })
  })
})

describe('fake timers — 69 h e a fronteira do longOpen', () => {
  it('token_error_at em D 11:00:05 e D 13:00:05, lido em D+3 11:00 => longOpen com token_error NULL', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-09T11:00:00Z'), toFake: ['Date'] })
    mockSweep.mockImplementation(async () => [])
    harness({ accounts: [
      account({ id: 'a', token_error: null, token_error_at: '2026-09-06T11:00:05Z', token_error_mode: 'token_refresh' }),
      account({ id: 'b', token_error: null, token_error_at: '2026-09-06T13:00:05Z', token_error_mode: 'token_refresh' }),
    ] })
    const body = await (await GET(req())).json()
    // episódio transitório aberto NÃO retira a conta da seleção
    expect(body.still_broken).toBe(2)
    expect(mockSweep).toHaveBeenCalledTimes(1)
  })
})
