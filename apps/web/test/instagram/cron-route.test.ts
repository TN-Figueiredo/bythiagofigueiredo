// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { encrypt } from '@tn-figueiredo/social/vault'

// Mesmo cron da Tarefa 13 (test/api/cron/instagram-sync.test.ts), olhado por
// outro ângulo: aqui a requisição é uma `NextRequest` real com `?mode=` na
// URL (mantido por decisão de A5 — não é conteúdo desta tarefa) e a conta é
// alimentada por getSupabaseServiceClient mockado diretamente, sem o harness
// dedicado. Cobertura deliberadamente pequena — o Step 1 daquele arquivo já
// exercita passo a passo.
const VAULT_KEY_HEX = '0'.repeat(64)
const VAULT_KEY = Buffer.from(VAULT_KEY_HEX, 'hex')
function encToken(plain = 'IGAAplaintoken'): string {
  return `v1:${encrypt(plain, VAULT_KEY)}`
}

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
      fn().then((r) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'run-1'),
}))
const mockSync = vi.fn()
const mockImgHealth = vi.fn()
vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: (...a: unknown[]) => mockSync(...a),
  checkImageCacheHealth: (...a: unknown[]) => mockImgHealth(...a),
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
}))
const mockProbe = vi.fn(() => Promise.resolve({ ok: true }))
vi.mock('@/lib/instagram/token', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/token')>()),
  probeToken: (...a: unknown[]) => mockProbe(...a),
}))
vi.mock('@/lib/instagram/deletion', () => ({
  DELETION_BLOB_BUDGET_MS: 45_000,
  resumeStuckDeletionRequest: vi.fn(() => Promise.resolve(false)),
  runDeletionEffects: vi.fn(),
}))
const listMock = vi.fn(() => Promise.resolve({ blobs: [], hasMore: false, cursor: undefined }))
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a), del: vi.fn() }))

import { GET } from '@/app/api/cron/instagram-sync/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidateTag } from 'next/cache'

const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRevalidate = vi.mocked(revalidateTag)

function makeRequest(mode = 'daily', secret = 'test-secret'): NextRequest {
  return new NextRequest(`http://localhost/api/cron/instagram-sync?mode=${mode}`, {
    headers: { authorization: `Bearer ${secret}` },
  })
}

/** Proxy encadeável e "thenable" em qualquer ponto — serve qualquer tabela
 *  auxiliar (instagram_sync_log, instagram_deletion_requests, ops_alert_state,
 *  notification_deliveries) sem exigir uma forma exata. */
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
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
    from: vi.fn((table: string) => {
      if (table === 'instagram_accounts') {
        const terminal = Promise.resolve({ data: accounts, error: null })
        const chain: Record<string, unknown> = {
          select: () => chain, order: () => terminal, then: terminal.then.bind(terminal),
          update: () => chain, eq: () => chain,
        }
        return chain
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

describe('GET /api/cron/instagram-sync (via NextRequest real, ?mode= preservado)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('NTFY_URL', '') // evita fetch real; fica alertChannelUnset, mas VERCEL_ENV=development não escala
    vi.stubEnv('SOCIAL_MASTER_KEY', VAULT_KEY_HEX)
    vi.stubEnv('VERCEL_ENV', 'development')
    mockProbe.mockResolvedValue({ ok: true })
    listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined })
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('daily', 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok when no accounts configured', async () => {
    mockGetClient.mockReturnValue(clientWithAccounts([]) as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.synced).toBe(0)
    expect(body.probed).toBe(0)
  })

  it('probes and syncs accounts and revalidates cache', async () => {
    mockGetClient.mockReturnValue(clientWithAccounts([{
      id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: 'test', ig_user_id: 'ig-1',
      access_token: encToken(), token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      token_refreshed_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
      token_error: null, token_error_at: null, token_error_mode: null,
      token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
      ig_professional_id: null, ig_user_id_source: 'legacy',
      sync_enabled: true, display_slots: 6, layout_type: 'grid',
      section_title_pt: null, section_title_en: null, section_subtitle_pt: null,
      section_subtitle_en: null, last_synced_at: null, created_at: '', updated_at: '',
    }]) as never)
    mockSync.mockResolvedValueOnce({ postsFound: 10, postsInserted: 3, postsUpdated: 7, mediaCached: 3, partial: false, mediaFailed: 0 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(mockProbe).toHaveBeenCalledTimes(1)
    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(body.probed).toBe(1)
    expect(body.synced).toBe(1)
    expect(body.inserted).toBe(3)
    expect(body.updated).toBe(7)
    expect(mockRevalidate).toHaveBeenCalledWith('instagram-feed', { expire: 0 })
  })
})
