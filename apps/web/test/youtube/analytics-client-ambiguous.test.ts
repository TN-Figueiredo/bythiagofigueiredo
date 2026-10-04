// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * `getYouTubeToken` (interno de analytics-client) sem canal pedido: com mais de
 * um canal conectado não escolhe "a conexão mais recente" — devolve "sem dados"
 * e avisa uma vez. Exercitado por `fetchYtDailyMetrics`.
 */
interface Row { site_id: string; provider: string; account_id: string; connected_at: string; revoked_at: string | null }
let rows: Row[] = []
let countError: { message: string } | null = null

function query() {
  let filtered = [...rows]
  let head = false
  const get = (r: Row, col: string) => (r as unknown as Record<string, unknown>)[col]
  const q = {
    select(_cols: string, opts?: { head?: boolean }) { head = !!opts?.head; return q },
    eq(col: string, val: string) { filtered = filtered.filter((r) => get(r, col) === val); return q },
    is(col: string, val: null) { filtered = filtered.filter((r) => get(r, col) === val); return q },
    order(col: string) { filtered.sort((a, b) => String(get(b, col)).localeCompare(String(get(a, col)))); return q },
    limit(n: number) { filtered = filtered.slice(0, n); return q },
    async single() { return filtered.length === 1 ? { data: filtered[0], error: null } : { data: null, error: { message: 'no rows' } } },
    then(resolve: (v: unknown) => void) {
      resolve(head
        ? (countError ? { count: null, error: countError } : { count: filtered.length, error: null })
        : { data: filtered, error: null })
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => query() }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))

import { fetchYtDailyMetrics } from '@/lib/youtube/analytics-client'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import * as Sentry from '@sentry/nextjs'

const H = 3600_000
const PT: Row = { site_id: 'site-1', provider: 'youtube', account_id: 'UCpt', connected_at: new Date(Date.now() - 48 * H).toISOString(), revoked_at: null }
/** Reconectado depois: "a mais recente" é a do OUTRO canal. */
const EN: Row = { site_id: 'site-1', provider: 'youtube', account_id: 'UCen', connected_at: new Date(Date.now() - 1 * H).toISOString(), revoked_at: null }

const fetchMock = vi.fn()
beforeEach(() => {
  rows = []
  countError = null
  vi.clearAllMocks()
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c' })
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ rows: [['2026-01-01', 10, 1, 0, 0, 0, 0, 0]] }), text: async () => '' })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('analytics-client — token sem canal pedido', () => {
  it('duas conexões ativas: sem dados, nenhum token pedido, nenhuma chamada ao YouTube, um aviso', async () => {
    rows = [PT, EN]
    expect(await fetchYtDailyMetrics('site-1', 28)).toEqual([])
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0]![0]).toMatch(/more than one active connection/)
  })

  it('uma conexão ativa: funciona como hoje, com a conta dela', async () => {
    rows = [PT]
    const out = await fetchYtDailyMetrics('site-1', 28)
    expect(out).toHaveLength(1)
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UCpt')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('uma ativa e uma revogada (a mais recente): a revogada não conta', async () => {
    rows = [PT, { ...EN, revoked_at: new Date().toISOString() }]
    await fetchYtDailyMetrics('site-1', 28)
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UCpt')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('zero conexões: sem dados e sem aviso (não é ambiguidade)', async () => {
    expect(await fetchYtDailyMetrics('site-1', 28)).toEqual([])
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('com canal pedido e duas conexões: nunca ambíguo — token do canal pedido, mesmo sendo o mais antigo', async () => {
    rows = [PT, EN]
    await fetchYtDailyMetrics('site-1', 28, 'UCpt')
    expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UCpt')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('a contagem falhou: sem dados e um aviso (não cai no "mais recente")', async () => {
    rows = [PT, EN]
    countError = { message: 'statement timeout' }
    expect(await fetchYtDailyMetrics('site-1', 28)).toEqual([])
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})
