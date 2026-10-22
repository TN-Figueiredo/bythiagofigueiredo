// @vitest-environment node
// F2 T6: projeção dos outliers a partir do motor (régua única D6) e recomposição dos vistos por video_lugares.
import { describe, it, expect } from 'vitest'
import { rowsToDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { projetarOutliers, recomporVistos, type VistoRow, type AncoraRow } from '@/lib/youtube/observatorio/sinais/projecao'
import { canal, rowsDe, NOW, DAY, type VideoSpec } from './fixture-sinais'

/** 9 vídeos "normais" (100 views/dia) no canal + os extras pedidos. */
function especs(ch: string, extras: VideoSpec[], formato: 'long' | 'short' = 'long'): VideoSpec[] {
  const base = Array.from({ length: 9 }, (_, i) => ({ id: `${ch}-n${i}-${formato}`, ch, vpd: 100, ageDias: 20 + i, short: formato === 'short' }))
  return [...base, ...extras]
}
const obsDe = (cs: ReturnType<typeof canal>[], vs: VideoSpec[]) => createObservatory(rowsToDataset(rowsDe(cs, vs), NOW))
const semLugar = (): string[] => []
const semTexto = (): string => ''

describe('projetarOutliers', () => {
  it('o vídeo estourando entra; paridade com obs.outliers() da tela; id é o uuid do banco', () => {
    const obs = obsDe([canal('c1')], especs('c1', [{ id: 'c1-hit', ch: 'c1', vpd: 1000, ageDias: 21 }]))
    const tela = obs.outliers({ maxAge: 30, fmt: 'long' }).items.filter((i) => !i.weak && i.phase.id === 'estourando')
    expect(tela.map((i) => i.id)).toEqual(['c1-hit'])
    const p = projetarOutliers(obs, semLugar, semTexto)
    expect(p.outliers.map((o) => o.videoId)).toEqual(tela.map((i) => i.id))
    expect(p.outliers[0]!.videoId).toBe('c1-hit')
    expect(p.outliers[0]!.videoId).not.toBe('yt-c1-hit')
    expect(p.outliers[0]!.deHoje).toBe(true)
    expect(p.outliers[0]!.formato).toBe('long')
  })

  it('mult = vpd7/m7 (régua) e multTela = item.mult.value; nCanal = n do conjunto de median7', () => {
    const obs = obsDe([canal('c1')], especs('c1', [{ id: 'c1-hit', ch: 'c1', vpd: 1000, ageDias: 21 }]))
    const hit = obs.video('c1-hit')!
    const grupo = obs.videos.filter((v) => v.ch === 'c1' && v.fmt === 'long' && v.tracked && v.vpd7 != null)
    const m7 = obs.median(grupo.map((v) => v.vpd7 as number))!
    const o = projetarOutliers(obs, semLugar, semTexto).outliers[0]!
    expect(o.nCanal).toBe(grupo.length)
    expect(o.mult).toBeCloseTo(hit.vpd7! / m7, 10)
    expect(o.vpd7).toBe(hit.vpd7)
    // a grandeza da tela é outra (base por faixa de idade): os dois ficam separados na saída
    expect(o.multTela).toBe(obs.outliers({ maxAge: 30, fmt: 'long' }).items.find((i) => i.id === 'c1-hit')!.mult.value)
  })

  it('vpd7 = 4 x m7 e mult de tela 2,5 -> mult 4 e multTela 2,5 (a tela só lista a partir de 2x)', () => {
    const base = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, ch: 'c1', vpd: 100, ageDias: 20 + i, inicio: 2000 }))
    const obs = obsDe([canal('c1')], [...base, { id: 'hit', ch: 'c1', vpd: 400, ageDias: 21, inicio: 3500 }])
    const o = projetarOutliers(obs, semLugar, semTexto).outliers[0]!
    expect(o.videoId).toBe('hit')
    expect(o.mult).toBeCloseTo(4, 10)
    expect(o.multTela).toBeCloseTo(2.5, 10)
  })

  it('Short entra só na rodada short; base fraca (weak) fica fora', () => {
    const cs = [canal('c1'), canal('c2')]
    const vs = [
      ...especs('c1', [{ id: 'c1-short', ch: 'c1', vpd: 1000, ageDias: 21, short: true }], 'short'),
      // c2: só 2 longos de base -> mult fraco, não conta
      { id: 'c2-a', ch: 'c2', vpd: 100, ageDias: 20 }, { id: 'c2-b', ch: 'c2', vpd: 900, ageDias: 22 },
    ]
    const obs = obsDe(cs, vs)
    const p = projetarOutliers(obs, semLugar, semTexto)
    expect(p.outliers.map((o) => o.videoId)).toEqual(['c1-short'])
    expect(p.outliers[0]!.formato).toBe('short')
    expect(obs.outliers({ maxAge: 30, fmt: 'long' }).items.some((i) => i.id === 'c1-short')).toBe(false)
    expect(p.outliers.some((o) => o.videoId === 'c2-b')).toBe(false)
  })

  it('chaves vêm de lugarDe, tokens de título + tags; outliersSemLugar coerente com a lista', () => {
    const obs = obsDe([canal('c1')], especs('c1', [
      { id: 'c1-a', ch: 'c1', vpd: 1000, ageDias: 21 }, { id: 'c1-b', ch: 'c1', vpd: 1200, ageDias: 22 },
    ]))
    const p = projetarOutliers(obs, (id) => (id === 'c1-a' ? ['istambul', 'pais:TR'] : []), (id) => (id === 'c1-a' ? 'Passeio Istambul barato' : 'x'))
    const a = p.outliers.find((o) => o.videoId === 'c1-a')!
    expect(a.chaves).toEqual(['istambul', 'pais:TR'])
    expect(a.tokens).toEqual(expect.arrayContaining(['passeio', 'istambul', 'barato']))
    expect(p.outliers).toHaveLength(2)
    expect(p.outliersSemLugar).toBe(1)
  })

  it('canal em sem-ritmo e total de canais (só concorrentes)', () => {
    const cs = [canal('c1'), canal('c2', { sync_status: 'error', sync_error: 'x', sync_error_since: new Date(NOW - 3 * DAY).toISOString(), last_ok_synced_at: null })]
    const obs = obsDe(cs, [...especs('c1', []), { id: 'c2-a', ch: 'c2', vpd: 100, ageDias: 10 }])
    const p = projetarOutliers(obs, semLugar, semTexto)
    expect(p.canaisTotal).toBe(2)
    expect(p.canaisSemRitmo).toBe(1)
  })
})

describe('recomporVistos (M2)', () => {
  const agora = new Date(NOW)
  const visto = (id: string, chaves: string[], extra: Partial<VistoRow> = {}): VistoRow => ({
    video_id: id, canal_id: 'c9', formato: 'long', published_at: new Date(NOW - 5 * DAY).toISOString(), n_canal: 12,
    ultimo_visto_em: new Date(NOW - 2 * DAY).toISOString(), mult_max: '3.50', vpd7_max: 700, chaves, ...extra,
  })

  it('semente v2: vistos com chaves antigas passam a ter as novas (e nunca repetem os de hoje)', () => {
    const novas: Record<string, string[]> = { v1: ['istambul', 'pais:TR'], v2: ['pais:TR'], hoje: ['pais:TR'] }
    const r = recomporVistos({
      vistos: [visto('v1', ['pais:XX']), visto('v2', []), visto('hoje', ['pais:TR'])],
      ancoras: [], lugarDe: (id) => novas[id] ?? [], idsDeHoje: new Set(['hoje']), agora, janelaDias: 14,
    })
    expect(r.outliers.map((o) => o.videoId)).toEqual(['v1', 'v2'])
    expect(r.outliers[0]!.chaves).toEqual(['istambul', 'pais:TR'])
    expect(r.outliers[0]).toMatchObject({ deHoje: false, formato: 'long', nCanal: 12, mult: 3.5, vpd7: 700, tokens: [] })
  })

  it('vistos fora dos 14 dias saem; vídeo desconhecido mantém as chaves gravadas', () => {
    const r = recomporVistos({
      vistos: [visto('velho', ['pais:TR'], { ultimo_visto_em: new Date(NOW - 20 * DAY).toISOString() }), visto('podado', ['pais:EG'])],
      ancoras: [], lugarDe: () => [], conhecido: () => false, idsDeHoje: new Set(), agora, janelaDias: 14,
    })
    expect(r.outliers.map((o) => o.videoId)).toEqual(['podado'])
    expect(r.outliers[0]!.chaves).toEqual(['pais:EG'])
  })

  it('ancorasPorChave com chaves recompostas', () => {
    const ancoras: AncoraRow[] = [{ subject_key: 'pais:XX', video_id: 'v1' }, { subject_key: 'pais:TR', video_id: 'v2' }]
    const novas: Record<string, string[]> = { v1: ['pais:TR'], v2: ['pais:TR'] }
    const r = recomporVistos({
      vistos: [visto('v1', ['pais:XX']), visto('v2', ['pais:TR'])], ancoras, lugarDe: (id) => novas[id] ?? [],
      idsDeHoje: new Set(), agora, janelaDias: 14,
    })
    expect([...(r.ancorasPorChave.get('pais:TR') ?? [])].sort()).toEqual(['v1', 'v2'])
    expect(r.ancorasPorChave.get('pais:XX')).toBeUndefined()
  })
})
