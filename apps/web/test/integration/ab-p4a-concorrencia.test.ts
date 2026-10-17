import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'
import { YouTubeFalso, imagemComDhash, H } from '../helpers/youtube-falso'

// Fora o YouTube (falso, por fetch) tudo é real: o banco bythiago_int e as funções SQL da P4a.
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdminsDetailed: vi.fn(async () => ({ total: 1, sent: 1, suppressed: 0, errors: [] })),
}))

vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn(async () => ({ ok: true, accessToken: 'tok' })) }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: vi.fn(async () => 'UCint'),
}))

import { settleOnAir, ORIGINAL } from '@/lib/youtube/ab-settle'
import { phaseRotateActiveTests } from '@/lib/youtube/ab-rotate-phases'
import type { PortasSaida } from '@/lib/youtube/ab-settle'

const BLOB = (v: string) => `https://t7.public.blob.vercel-storage.com/${v}.png`

describe.skipIf(skipIfNoLocalDb())('P4a T7: concorrência de settleOnAir no banco real', () => {
  let t: { testId: string; varA: string; varB: string; siteId: string }
  let yt: YouTubeFalso
  let portas: Partial<PortasSaida>

  const teste = async () => (await clienteServico().from('ab_tests').select('status, restore_seq, restore_status').eq('id', t.testId).single()).data!

  beforeEach(async () => {
    t = await semearTesteAb({ status: 'active', cicloAberto: 0 })
    const db = clienteServico()
    await db.from('ab_test_variants').update({ blob_url: BLOB('A'), thumbnail_dhash: H.A }).eq('id', t.varA)
    await db.from('ab_test_variants').update({ blob_url: BLOB('B'), thumbnail_dhash: H.B }).eq('id', t.varB)
    await db.from('ab_tests').update({ original_thumbnail_url: BLOB('A'), last_applied_variant_id: t.varB }).eq('id', t.testId)
    yt = new YouTubeFalso({
      thumb: await imagemComDhash(H.B),
      blobs: { [BLOB('A')]: await imagemComDhash(H.A), [BLOB('B')]: await imagemComDhash(H.B) },
    })
    portas = {
      supabase: db, fetch: yt.fetch, agora: () => new Date(),
      token: async () => 'tok', autoImportWinner: async () => {},
    }
  })

  it('P4a-I1: dois encerramentos simultâneos → um feito e o outro ja_encerrado ou em_andamento; uma escrita; um ciclo fechado; restore_seq +1', async () => {
    const op = { siteId: t.siteId, destino: ORIGINAL, motivo: 'encerrado' as const }
    const [a, b] = await Promise.all([settleOnAir(t.testId, op, portas), settleOnAir(t.testId, op, portas)])
    const resultados = [a.resultado, b.resultado]
    expect(resultados).toContain('feito')
    expect(['ja_encerrado', 'em_andamento']).toContain(resultados.find((x) => x !== 'feito'))
    expect(yt.escritas().filter((e) => e === 'thumbnails.set')).toHaveLength(1)
    const t1 = await teste()
    expect(t1.restore_seq).toBe(1)
    expect(t1.status).toBe('completed')
    const ciclos = await clienteServico().from('ab_test_cycles').select('ended_at').eq('test_id', t.testId)
    expect(ciclos.data?.filter((c) => c.ended_at !== null)).toHaveLength(1)
  })

  it('pausar e encerrar ao mesmo tempo: pelo menos um vence; restore_seq = nº de feito; thumbnails.set <= nº de feito; status coerente', async () => {
    const [a, b] = await Promise.all([
      settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'pausa' }, portas),
      settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'encerrado' }, portas),
    ])
    const feitos = [a, b].filter((x) => x.resultado === 'feito').length
    expect(feitos).toBeGreaterThanOrEqual(1)
    expect(yt.escritas().filter((e) => e === 'thumbnails.set').length).toBeLessThanOrEqual(feitos)
    const t1 = await teste()
    expect(t1.restore_seq).toBe(feitos)
    // dois feitos = pausa e depois encerra (completed); um feito só = o status do vencedor.
    if (feitos === 2) expect(t1.status).toBe('completed')
    else expect(['paused', 'completed']).toContain(t1.status)
  })

  // ── T9: a rotação do cron contra o banco real ────────────────────────────────────────────────────────────────
  describe('rotação do cron (T9)', () => {
    const DIA = 86_400_000
    beforeEach(async () => {
      const db = clienteServico()
      // phaseRotateActiveTests varre todo teste ativo do banco: o bythiago_int é só nosso, então pausa os restos de outros arquivos.
      await db.from('ab_tests').update({ status: 'paused' }).eq('status', 'active').neq('id', t.testId)
      await db.from('ab_tests').update({ last_applied_variant_id: null }).eq('id', t.testId)
      await db.from('ab_test_cycles').update({ started_at: new Date(Date.now() - 2 * DIA).toISOString() }).eq('test_id', t.testId)
      // O Supabase fala por fetch também: só o que não é do banco local (127.0.0.1) vai para o YouTube falso.
      const fetchReal = globalThis.fetch
      vi.stubGlobal('fetch', ((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes('127.0.0.1') ? fetchReal(input, init) : yt.fetch(input, init)) as typeof fetch)
    })
    afterEach(() => { vi.unstubAllGlobals() })

    it('Y-P13 / (b): dois phaseRotateActiveTests ao mesmo tempo → uma escrita no YouTube, restore_seq +1, um ciclo aberto', async () => {
      await Promise.all([phaseRotateActiveTests(clienteServico()), phaseRotateActiveTests(clienteServico())])
      expect(yt.escritas().filter((e) => e === 'thumbnails.set')).toHaveLength(1)
      const t1 = await teste()
      expect(t1.restore_seq).toBe(1)
      const ciclos = await clienteServico().from('ab_test_cycles').select('cycle_number, ended_at, end_reason, variant_id').eq('test_id', t.testId).order('cycle_number')
      expect(ciclos.data?.filter((c) => c.ended_at === null)).toEqual([expect.objectContaining({ cycle_number: 1, variant_id: t.varB })])
      expect(ciclos.data?.[0]).toMatchObject({ cycle_number: 0, end_reason: 'rotacao' })
    })

    it('F-D7: teste auto-pausado pelo código antigo (ciclo 1 aberto) e retomado (ciclo 2 aberto): a rotação não colide em cycle_number, fecha os dois e abre o 3', async () => {
      const db = clienteServico()
      await db.from('ab_test_cycles').update({ ended_at: new Date(Date.now() - 2 * DIA).toISOString(), end_reason: 'rotacao' }).eq('test_id', t.testId)
      await db.from('ab_test_cycles').insert([
        { test_id: t.testId, variant_id: t.varB, cycle_number: 1, started_at: new Date(Date.now() - 4 * DIA).toISOString() },
        { test_id: t.testId, variant_id: t.varA, cycle_number: 2, started_at: new Date(Date.now() - 3 * DIA).toISOString() },
      ])
      const r = await phaseRotateActiveTests(db)
      expect(r).toMatchObject({ processed: 1, errors: 0 })
      const ciclos = await db.from('ab_test_cycles').select('cycle_number, ended_at, end_reason').eq('test_id', t.testId).order('cycle_number')
      expect(ciclos.data?.map((c) => c.cycle_number)).toEqual([0, 1, 2, 3])
      expect(ciclos.data?.filter((c) => c.ended_at === null).map((c) => c.cycle_number)).toEqual([3])
      expect(ciclos.data?.slice(1, 3).map((c) => c.end_reason)).toEqual(['rotacao', 'rotacao'])
    })
  })
})
