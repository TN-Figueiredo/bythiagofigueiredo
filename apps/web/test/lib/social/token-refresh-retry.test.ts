// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: mockFrom }) }))
vi.mock('@tn-figueiredo/social/vault', () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ''),
  getMasterKey: () => Buffer.from('k'),
}))

import { ensureFreshToken, NoActiveConnectionError, LEITURA_RETRY_MS } from '@/lib/social/token-refresh'
import { describeCronCause } from '@/lib/cron/failure-note'

const CONN = {
  id: 'c1', access_token_enc: 'enc:tok', refresh_token_enc: 'enc:r',
  token_expires_at: new Date(Date.now() + 3_600_000).toISOString(), metadata: null,
  bluesky_did: null, bluesky_access_jwt_enc: null, bluesky_refresh_jwt_enc: null, bluesky_jwt_expires_at: null,
}
type R = { data: unknown; error: { code?: string; message: string } | null }

/** Cada leitura da conexão devolve o próximo resultado da fila (com conta informada, não há contagem prévia). */
function leituras(...rs: R[]) {
  const single = vi.fn()
  for (const r of rs) single.mockResolvedValueOnce(r)
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'limit']) chain[m] = vi.fn().mockReturnValue(chain)
  chain.single = single
  mockFrom.mockReturnValue(chain)
  return single
}

describe('ensureFreshToken: nova tentativa na leitura da conexão', () => {
  beforeEach(() => { vi.useFakeTimers(); mockFrom.mockReset() })
  afterEach(() => vi.useRealTimers())

  it('timeout na 1a leitura e sucesso na 2a: devolve o token, após ~500 ms', async () => {
    const single = leituras(
      { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } },
      { data: CONN, error: null },
    )
    const p = ensureFreshToken('s1', 'youtube', 'UC1')
    await vi.advanceTimersByTimeAsync(LEITURA_RETRY_MS)
    await expect(p).resolves.toMatchObject({ accessToken: 'tok' })
    expect(single).toHaveBeenCalledTimes(2)
  })

  it('falha nas duas leituras: lança com a causa real (código e mensagem) e o failure-note a anexa', async () => {
    const single = leituras(
      { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } },
      { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } },
    )
    const p = ensureFreshToken('s1', 'youtube', 'UC1')
    const visto = p.catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(LEITURA_RETRY_MS)
    const e = (await visto) as Error
    expect(single).toHaveBeenCalledTimes(2)
    expect(e.message).toContain('statement timeout')
    expect(e.message).toContain('57014')
    const nota = describeCronCause(e)
    expect(nota).toBe('database error reading the connection (statement timeout, code 57014)')
  })

  it('exceção de rede (fetch failed) também conta como transitória', async () => {
    const single = vi.fn().mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValueOnce({ data: CONN, error: null })
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'limit']) chain[m] = vi.fn().mockReturnValue(chain)
    chain.single = single
    mockFrom.mockReturnValue(chain)
    const p = ensureFreshToken('s1', 'youtube', 'UC1')
    await vi.advanceTimersByTimeAsync(LEITURA_RETRY_MS)
    await expect(p).resolves.toMatchObject({ accessToken: 'tok' })
  })

  it('erro de dado (sem linha, PGRST116): sem nova tentativa', async () => {
    const single = leituras({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    await expect(ensureFreshToken('s1', 'youtube', 'UC1')).rejects.toBeInstanceOf(NoActiveConnectionError)
    expect(single).toHaveBeenCalledTimes(1)
  })
})
