import { describe, it, expect, beforeEach, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb, clienteServico } from '../helpers/db-seed'
import { YouTubeFalso, imagemComDhash, H } from '../helpers/youtube-falso'

// Fora o YouTube (falso, por fetch) tudo é real: o banco bythiago_int e as funções SQL da P4a.
vi.mock('@/lib/notifications/fan-out', () => ({
  fanOutToSiteAdminsDetailed: vi.fn(async () => ({ total: 1, sent: 1, suppressed: 0, errors: [] })),
}))

import { settleOnAir, ORIGINAL } from '@/lib/youtube/ab-settle'
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

  it('pausar e encerrar ao mesmo tempo: pelo menos um vence, no máximo duas escritas de thumbnail, restore_seq avança', async () => {
    const [a, b] = await Promise.all([
      settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'pausa' }, portas),
      settleOnAir(t.testId, { siteId: t.siteId, destino: ORIGINAL, motivo: 'encerrado' }, portas),
    ])
    expect([a.resultado, b.resultado].filter((x) => x === 'feito').length).toBeGreaterThanOrEqual(1)
    expect(yt.escritas().filter((e) => e === 'thumbnails.set').length).toBeLessThanOrEqual(2)
    const t1 = await teste()
    expect(t1.restore_seq).toBeGreaterThanOrEqual(1)
    expect(['paused', 'completed']).toContain(t1.status)
  })
})
