// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mesmo cron da Tarefa 12 (test/api/cron/instagram-token-refresh.test.ts),
// olhado por outro ângulo: aqui a requisição é uma `NextRequest` real (em vez
// do objeto `{ headers, nextUrl }` costurado à mão) e o array de contas é
// alimentado por getSupabaseServiceClient mockado diretamente, sem o harness
// dedicado. Cobertura deliberadamente pequena — o Step 1 daquele arquivo já
// exercita passo a passo; este apenas confirma que a integração compila e
// responde corretamente pelo caminho de entrada alternativo.
const mockRpc = vi.fn(() => Promise.resolve({ data: true, error: null }))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), setTag: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
      fn().then((r) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'run-1'),
}))
vi.mock('@/lib/instagram/api-client', () => ({ refreshAccessToken: vi.fn() }))
const mockSweep = vi.fn(() => Promise.resolve([]))
vi.mock('@/lib/instagram/token', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/token')>()),
  sweepTokenAlerts: (...a: unknown[]) => mockSweep(...a),
  markTokenInvalid: vi.fn(() => Promise.resolve()),
  evaluateTransientStreak: vi.fn(() => Promise.resolve(false)),
}))
vi.mock('@/lib/ops/ntfy', async (orig) => ({
  ...(await orig<typeof import('@/lib/ops/ntfy')>()),
  sendNtfyAlert: vi.fn(() => Promise.resolve({ alerted: true, ntfyStatus: 200 })),
  sendNtfyHeartbeat: vi.fn(() => Promise.resolve({ alerted: true, ntfyStatus: 200 })),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  NO_SITE_ADMINS_ERROR: 'no site admins to email',
  fanOutToSiteAdminsDetailed: vi.fn(() => Promise.resolve({ total: 1, sent: 1, suppressed: 0, errors: [] })),
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

import { GET } from '@/app/api/cron/instagram-token-refresh/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { refreshAccessToken } from '@/lib/instagram/api-client'

const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRefresh = vi.mocked(refreshAccessToken)

function makeRequest(secret = 'test-secret'): NextRequest {
  return new NextRequest('http://localhost/api/cron/instagram-token-refresh', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

/** Proxy encadeável e "thenable" em qualquer ponto — serve `instagram_sync_log`,
 *  `instagram_deletion_requests` e `ops_alert_state` sem exigir uma forma exata. */
function genericChain(result: unknown = { data: [], error: null, count: 0 }): unknown {
  const p = Promise.resolve(result)
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then') return p.then.bind(p)
      if (prop === 'catch') return p.catch.bind(p)
      if (prop === 'finally') return p.finally.bind(p)
      if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve({ data: null, error: null })
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

function clientWithAccounts(accounts: Array<Record<string, unknown>>) {
  return {
    rpc: mockRpc,
    from: vi.fn((table: string) => {
      if (table === 'instagram_accounts') {
        const terminal = Promise.resolve({ data: accounts, error: null })
        const chain: Record<string, unknown> = {
          select: () => chain, order: () => terminal, then: terminal.then.bind(terminal),
          update: () => chain, eq: () => chain,
        }
        return chain
      }
      if (table === 'sites') {
        return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
      }
      if (table === 'notification_deliveries') {
        return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
      }
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }), like: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
          upsert: () => Promise.resolve({ error: null }),
        }
      }
      return genericChain()
    }),
  }
}

describe('GET /api/cron/instagram-token-refresh (via NextRequest real)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('NTFY_URL', 'https://ntfy.example/t')
    vi.stubEnv('SOCIAL_MASTER_KEY', '0'.repeat(64))
    vi.stubEnv('VERCEL_ENV', 'development')
    mockSweep.mockResolvedValue([])
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok when there are no accounts at all', async () => {
    mockGetClient.mockReturnValue(clientWithAccounts([]) as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.refreshed).toBe(0)
    expect(body.still_broken).toBe(0)
  })

  it('refreshes an eligible account and reports the new response shape', async () => {
    mockGetClient.mockReturnValue(clientWithAccounts([{
      id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: 'test',
      ig_user_id: 'ig-1', access_token: 'IGAAlegacyPlain',
      token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      token_refreshed_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
      token_error: null, token_error_at: null, token_error_mode: null,
      token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
      ig_professional_id: null, ig_user_id_source: 'legacy',
      sync_enabled: true, display_slots: 6, layout_type: 'grid',
      section_title_pt: null, section_title_en: null, section_subtitle_pt: null,
      section_subtitle_en: null, last_synced_at: null, created_at: '', updated_at: '',
    }]) as never)
    mockRefresh.mockResolvedValueOnce({ accessToken: 'new-tok', expiresIn: 5_184_000 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.refreshed).toBe(1)
    expect(body.failed_permanent).toBe(0)
    expect(body.failed_transient).toBe(0)
    expect(body.failed_infra).toBe(0)
    expect(mockRefresh).toHaveBeenCalledWith('IGAAlegacyPlain')
  })

  it('reports a permanent failure without crashing the run', async () => {
    mockGetClient.mockReturnValue(clientWithAccounts([{
      id: 'acc-fail', site_id: 'site-1', locale: 'pt', handle: 'test',
      ig_user_id: 'ig-1', access_token: 'IGAAbadPlain',
      token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      token_refreshed_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
      token_error: null, token_error_at: null, token_error_mode: null,
      token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
      ig_professional_id: null, ig_user_id_source: 'legacy',
      sync_enabled: true, display_slots: 6, layout_type: 'grid',
      section_title_pt: null, section_title_en: null, section_subtitle_pt: null,
      section_subtitle_en: null, last_synced_at: null, created_at: '', updated_at: '',
    }]) as never)
    mockRefresh.mockRejectedValueOnce(Object.assign(new Error('Invalid OAuth access token'), {
      code: 190, type: 'OAuthException', httpStatus: 400,
    }))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.refreshed).toBe(0)
    expect(body.failed_permanent).toBe(1)
  })
})
