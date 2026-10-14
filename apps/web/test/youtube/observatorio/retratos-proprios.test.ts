// @vitest-environment node
/**
 * A5 · R9a: o leitor dos retratos públicos do canal próprio (`retratos-proprios.ts`). O banco é um PostgREST em memória que
 * APLICA `in`, `gte` e `order`: "só 90 dias" e "ordem de t" só provam alguma coisa se o falso filtrar e ordenar de verdade.
 */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerRetratosProprios } from '@/lib/youtube/observatorio/retratos-proprios'
import { DAY, H, spDateOf, spDateStart } from '@/lib/youtube/observatorio/time'

const A = '0a1b2c3d-1111-4222-8333-444455556666'
const B = '0a1b2c3d-1111-4222-8333-777788889999'
const AGORA = Date.UTC(2026, 9, 14, 15, 0)
const dia = (diasAtras: number): string => spDateOf(AGORA - diasAtras * DAY)

interface Linha { youtube_channel_id: string; snapshot_date: string; subscriber_count: number | null; subscribers_hidden: boolean; view_count: number | null }
const linha = (canal: string, diasAtras: number, subs: number | null, extra: Partial<Linha> = {}): Linha =>
  ({ youtube_channel_id: canal, snapshot_date: dia(diasAtras), subscriber_count: subs, subscribers_hidden: false, view_count: 1000, ...extra })

function banco(linhas: Linha[], erro: { message: string } | null = null) {
  const chamadas: Array<{ tabela: string; filtros: Record<string, unknown> }> = []
  const sb = {
    from: (tabela: string) => {
      const f: Record<string, unknown> = {}
      chamadas.push({ tabela, filtros: f })
      const q = {
        select: () => q,
        in: (c: string, v: string[]) => { f.in = [c, v]; return q },
        gte: (c: string, v: string) => { f.gte = [c, v]; return q },
        order: (c: string) => { f.order = c; return q },
        then: (ok: (r: { data: Linha[] | null; error: { message: string } | null }) => unknown) => {
          const [, ids] = (f.in ?? ['', []]) as [string, string[]]
          const [, desde] = (f.gte ?? ['', '0000-00-00']) as [string, string]
          const data = erro ? null : linhas.filter(l => ids.includes(l.youtube_channel_id) && l.snapshot_date >= desde)
          return Promise.resolve({ data, error: erro }).then(ok)
        },
      }
      return q
    },
  }
  return { sb: sb as unknown as SupabaseClient, chamadas }
}

describe('lerRetratosProprios', () => {
  it('sem canal próprio: não consulta e devolve mapa vazio', async () => {
    const { sb, chamadas } = banco([])
    const r = await lerRetratosProprios(sb, [], AGORA)
    expect(r.size).toBe(0)
    expect(chamadas).toHaveLength(0)
  })

  it('apaga todos os retratos: retratos vazio, não lança', async () => {
    const { sb } = banco([])
    const r = await lerRetratosProprios(sb, [A], AGORA)
    expect(r.get(A)).toEqual({ retratos: [], oculto: false })
  })

  it('converte a linha no mesmo ChannelSnapshot do concorrente (t ao meio-dia de São Paulo, data dd/mm/aaaa, views nulas viram 0)', async () => {
    const { sb } = banco([{ youtube_channel_id: A, snapshot_date: '2026-09-05', subscriber_count: 1_420_000, subscribers_hidden: false, view_count: null }])
    const r = await lerRetratosProprios(sb, [A], AGORA)
    expect(r.get(A)!.retratos).toEqual([{ t: spDateStart('2026-09-05') + 12 * H, date: '05/09/2026', subs: 1_420_000, views: 0 }])
  })

  it('retratos fora de ordem no banco: saem em ordem de t', async () => {
    const { sb } = banco([linha(A, 2, 30), linha(A, 40, 10), linha(A, 10, 20)])
    const ts = (await lerRetratosProprios(sb, [A], AGORA)).get(A)!.retratos.map(x => x.subs)
    expect(ts).toEqual([10, 20, 30])
  })

  it('pede só 90 dias, pelo índice da PK, para todos os canais de uma vez', async () => {
    const { sb, chamadas } = banco([linha(A, 89, 1), linha(A, 95, 2), linha(B, 5, 3)])
    const r = await lerRetratosProprios(sb, [A, B], AGORA)
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]!.tabela).toBe('yt_own_channel_snapshots')
    expect(chamadas[0]!.filtros.gte).toEqual(['snapshot_date', spDateOf(AGORA - 90 * DAY)])
    expect(chamadas[0]!.filtros.order).toBe('snapshot_date')
    expect(r.get(A)!.retratos.map(x => x.subs)).toEqual([1])
    expect(r.get(B)!.retratos.map(x => x.subs)).toEqual([3])
  })

  it('retrato mais novo com subscriber_count nulo e subscribers_hidden: oculto; os nulos saem dos retratos', async () => {
    const { sb } = banco([linha(A, 9, 500), linha(A, 0, null, { subscribers_hidden: true })])
    expect(await lerRetratosProprios(sb, [A], AGORA)).toEqual(new Map([[A, { retratos: [expect.objectContaining({ subs: 500 })], oculto: true }]]))
  })

  it('oculto antigo e retrato novo com número: não está oculto', async () => {
    const { sb } = banco([linha(A, 9, null, { subscribers_hidden: true }), linha(A, 0, 700)])
    const r = (await lerRetratosProprios(sb, [A], AGORA)).get(A)!
    expect(r.oculto).toBe(false)
    expect(r.retratos.map(x => x.subs)).toEqual([700])
  })

  it('banco devolve erro: lança', async () => {
    const { sb } = banco([], { message: 'boom' })
    await expect(lerRetratosProprios(sb, [A], AGORA)).rejects.toThrow(/boom/)
  })
})
