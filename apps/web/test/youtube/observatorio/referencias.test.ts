// @vitest-environment node
// apps/web/test/youtube/observatorio/referencias.test.ts
import { describe, it, expect } from 'vitest'
import { referenciaDoCanal, REGRAS_REFERENCIAS } from '@/lib/youtube/observatorio/referencias'
import { median } from '@/lib/youtube/observatorio/stats'
import type { ObsChannel, ObsVideo, Fmt } from '@/lib/youtube/observatorio/types'

const DIA = 864e5
const AGORA = Date.parse('2026-06-15T15:00:00Z')
const HORA = 36e5

function canal(over: Partial<ObsChannel> = {}, last: number | null = AGORA): ObsChannel {
  return {
    id: 'c1', name: 'C1', fullName: 'C1', niche: null, own: false, lang: 'pt', subs: 1000, video_limit: 50,
    url: '', handle: '', gender: 'n', color: '#000', ini: 'C', undated: [],
    sync: { state: 'ok', last, next: null, added: null, errorSince: null, msg: null, backfill: null },
    activity: { state: 'ativo' }, lastIdx: null, snapshots: [], ...over,
  }
}
interface VOpts { dias: number; views: number | null; fmt?: Fmt; tracked?: boolean; lidoHaDias?: number }
function video(i: number, o: VOpts): ObsVideo {
  const pub = AGORA - o.dias * DIA
  const viewsAt = AGORA - (o.lidoHaDias ?? 0) * DIA
  return {
    id: 'v' + i, ch: 'c1', niche: null, fmt: o.fmt ?? 'long', isShort: null, pub, ageDays: Math.floor((AGORA - pub) / DIA),
    tracked: o.tracked ?? true, title: 't', theme: null, formulas: [], url: '', ytId: 'y' + i, dur: null,
    views: o.views, viewsAt, likes: null, comments: null, series: [], firstIdx: null, titles: [], thumbs: [], descs: [],
  }
}
let n = 0
const vs = (views: Array<number | null>, dias = 30, fmt: Fmt = 'long'): ObsVideo[] => views.map(v => video(n++, { dias: dias + n % 5, views: v, fmt }))
const ref = (c: ObsChannel, v: ObsVideo[], fmt: Fmt = 'long', syncDoSite: number | null = AGORA) => referenciaDoCanal(c, v, { fmt, syncDoSite })

describe('referenciaDoCanal: dado ausente', () => {
  it('apaga as views de todos os vídeos da janela: sem medida, ainda não coletado, nunca sem vídeos nem 0', () => {
    const r = ref(canal(), vs([null, null, null, null, null, null]))
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado' })
  })
  it('apaga sync.last: ainda não coletado', () => {
    expect(ref(canal({}, null), vs([1, 2, 3, 4, 5]))).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado' })
  })
  it('canal em backfill: ainda não coletado', () => {
    const c = canal(); c.sync.state = 'backfill'
    expect(ref(c, vs([1, 2, 3, 4, 5]))).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado' })
  })
  it('apaga os vídeos: sem vídeos em 90 dias, k = 0', () => {
    expect(ref(canal(), [])).toMatchObject({ tipo: 'nm', motivo: 'sem_videos_90d', k: 0 })
  })
})

describe('referenciaDoCanal: tempo relativo', () => {
  it('vídeo publicado há 6 dias fica de fora e há 7 entra', () => {
    const base = vs([10, 20, 30, 40, 50])
    const com6 = ref(canal(), [...base, video(900, { dias: 6, views: 99 })])
    const com7 = ref(canal(), [...base, video(901, { dias: 7, views: 99 })])
    expect(com6).toMatchObject({ tipo: 'ok', k: 5 })
    expect(com7).toMatchObject({ tipo: 'ok', k: 6 })
  })
  it('há 90 entra, há 91 fica de fora', () => {
    const base = vs([10, 20, 30, 40, 50])
    expect(ref(canal(), [...base, video(902, { dias: 90, views: 9 })])).toMatchObject({ k: 6 })
    expect(ref(canal(), [...base, video(903, { dias: 91, views: 9 })])).toMatchObject({ k: 5 })
  })
  it('canal com 5 vídeos, um de 3 dias: provisória com 4', () => {
    const r = ref(canal(), [...vs([10, 20, 30, 40]), video(904, { dias: 3, views: 5 })])
    expect(r).toMatchObject({ tipo: 'prov', k: 4 })
  })
  it('só vídeos de 2 e 5 dias: so_videos_novos', () => {
    const r = ref(canal(), [video(905, { dias: 2, views: 5 }), video(906, { dias: 5, views: 8 })])
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'so_videos_novos', k: 0 })
  })
  it('coleta do canal 49 h antes da do site: coleta_velha com a data; 47 h: medido', () => {
    const v = vs([10, 20, 30, 40, 50])
    const velha = ref(canal({}, AGORA - 49 * HORA), v)
    expect(velha).toMatchObject({ tipo: 'nm', motivo: 'coleta_velha', desde: AGORA - 49 * HORA })
    expect(ref(canal({}, AGORA - 47 * HORA), v)).toMatchObject({ tipo: 'ok' })
  })
})

describe('referenciaDoCanal: fronteiras', () => {
  it('k = 2, 3, 4, 5 dão nm, prov, prov, ok', () => {
    expect(ref(canal(), vs([1, 2])).tipo).toBe('nm')
    expect(ref(canal(), vs([1, 2])) ).toMatchObject({ motivo: 'poucos_videos', k: 2 })
    expect(ref(canal(), vs([1, 2, 3])).tipo).toBe('prov')
    expect(ref(canal(), vs([1, 2, 3, 4])).tipo).toBe('prov')
    expect(ref(canal(), vs([1, 2, 3, 4, 5])).tipo).toBe('ok')
  })
  it('razão 2 é estreita, 2,01 média, 6 média, 6,01 larga', () => {
    const f = (p25: number, p75: number) => {
      // 5 valores: p25 = 2º, p75 = 4º
      const r = ref(canal(), vs([p25 / 2, p25, (p25 + p75) / 2, p75, p75 * 2]))
      if (r.tipo !== 'ok') throw new Error('esperava ok')
      return r
    }
    expect(f(100, 200).classe).toBe('estreita')
    expect(f(100, 201).classe).toBe('media')
    expect(f(100, 600).classe).toBe('media')
    expect(f(100, 601).classe).toBe('larga')
  })
  it('p25 = 0: larga e razao null', () => {
    const r = ref(canal(), vs([0, 0, 10, 20, 30]))
    expect(r).toMatchObject({ tipo: 'ok', classe: 'larga', razao: null, p25: 0 })
  })
  it('vídeo não acompanhado (tracked false) não entra', () => {
    const r = ref(canal(), [...vs([1, 2, 3, 4, 5]), video(910, { dias: 20, views: 1e6, tracked: false })])
    expect(r).toMatchObject({ k: 5 })
  })
  it('Shorts não entram no escopo dos longos e vice-versa', () => {
    const todos = [...vs([1, 2, 3, 4, 5]), ...vs([100, 200, 300], 30, 'short')]
    expect(ref(canal(), todos, 'long')).toMatchObject({ k: 5 })
    expect(ref(canal(), todos, 'short')).toMatchObject({ tipo: 'prov', k: 3, mediana: 200 })
  })
  it('a mediana é a de stats.ts', () => {
    const v = vs([7, 3, 9, 100, 41])
    const r = ref(canal(), v)
    expect(r.tipo === 'ok' && r.mediana).toBe(median([7, 3, 9, 100, 41]))
  })
  it('NaN em views não vira número', () => {
    const r = ref(canal(), vs([1, 2, 3, 4, 5, Number.NaN]))
    expect(r).toMatchObject({ tipo: 'ok', k: 5 })
    if (r.tipo === 'ok') { expect(Number.isFinite(r.mediana)).toBe(true); expect(Number.isFinite(r.p75)).toBe(true) }
  })
})

describe('referenciaDoCanal: idade na leitura e janela', () => {
  it('ageDays 6 fora, 7 dentro (na leitura)', () => {
    expect(ref(canal(), [video(920, { dias: 6, views: 5 })])).toMatchObject({ motivo: 'so_videos_novos' })
    expect(ref(canal(), [video(921, { dias: 7, views: 5 })])).toMatchObject({ motivo: 'poucos_videos', k: 1 })
  })
  it('ageDays 90 dentro, 91 fora', () => {
    expect(ref(canal(), [video(922, { dias: 90, views: 5 })])).toMatchObject({ k: 1 })
    expect(ref(canal(), [video(923, { dias: 91, views: 5 })])).toMatchObject({ motivo: 'sem_videos_90d', k: 0 })
  })
  it('vídeo publicado há 10 dias com viewsAt de 5 dias atrás fica de fora; com viewsAt de hoje entra', () => {
    expect(ref(canal(), [video(924, { dias: 10, views: 5, lidoHaDias: 5 })])).toMatchObject({ motivo: 'so_videos_novos' })
    expect(ref(canal(), [video(925, { dias: 10, views: 5, lidoHaDias: 0 })])).toMatchObject({ motivo: 'poucos_videos', k: 1 })
  })
  it('canal com 50 acompanhados cobrindo 20 dias: nunca ok, prov com desde', () => {
    const lista = Array.from({ length: 50 }, (_, i) => video(1000 + i, { dias: 8 + (i * 12) / 49, views: 100 + i }))
    const mais = lista.reduce((a, b) => (a.pub < b.pub ? a : b))
    const r = ref(canal({ video_limit: 50 }), lista)
    expect(r.tipo).toBe('prov')
    if (r.tipo === 'prov') expect(r.desde).toBe(mais.pub)
  })
  it('janela cheia (acompanhado mais velho com 90 dias ou mais): pode ser ok', () => {
    const lista = Array.from({ length: 50 }, (_, i) => video(1100 + i, { dias: 8 + (i * 82) / 49, views: 100 + i }))
    expect(ref(canal({ video_limit: 50 }), lista).tipo).toBe('ok')
  })
  it('6 vídeos na janela, 4 com views nulas: ainda não coletado, nunca poucos vídeos', () => {
    const r = ref(canal(), vs([5, 6, null, null, null, null]))
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado' })
  })
})

describe('referenciaDoCanal: janela parcial com poucos vídeos do escopo (portão Phil P1)', () => {
  /** 50 Shorts acompanhados cobrindo 16 dias (limite 50 cheio) + longos antigos não acompanhados. */
  const shorts = () => Array.from({ length: 50 }, (_, i) => video(2000 + i, { dias: 1 + (i * 15) / 49, views: 100 + i, fmt: 'short' }))
  const longosFora = (qtd: number) => Array.from({ length: qtd }, (_, i) => ({ ...video(2100 + i, { dias: 20 + i * 10, views: 500 }), tracked: false }))
  it('0 longos acompanhados: nm janela_parcial com desde, nunca sem_videos_90d', () => {
    const lista = [...shorts(), ...longosFora(7)]
    const mais = lista.filter(v => v.tracked).reduce((a, b) => (a.pub < b.pub ? a : b))
    const r = ref(canal({ video_limit: 50 }), lista, 'long')
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'janela_parcial', k: 0, desde: mais.pub })
  })
  it('2 longos acompanhados: nm janela_parcial, nunca poucos_videos', () => {
    const lista = [...shorts(), ...longosFora(7), video(2200, { dias: 10, views: 9 }), video(2201, { dias: 12, views: 9 })]
    const r = ref(canal({ video_limit: 52 }), lista, 'long')
    expect(r).toMatchObject({ tipo: 'nm', motivo: 'janela_parcial', k: 2 })
  })
  it('data futura nunca vira "desde": vídeo com idade negativa não ancora a janela parcial (Gio, "só desde 19/10" com hoje 14/10)', () => {
    const lista = Array.from({ length: 5 }, (_, i) => video(2400 + i, { dias: -(1 + i), views: 9 }))
    const r = ref(canal({ video_limit: 5 }), lista)
    expect(r).not.toHaveProperty('desde')
    expect(r).not.toMatchObject({ motivo: 'janela_parcial' })
    const misto = [...lista, video(2410, { dias: 6, views: 9 })]
    expect(ref(canal({ video_limit: 6 }), misto)).toMatchObject({ motivo: 'janela_parcial', desde: misto[5]!.pub })
  })
  it('só vídeos novos com janela parcial: janela_parcial', () => {
    const lista = Array.from({ length: 5 }, (_, i) => video(2300 + i, { dias: 1 + i, views: 9 }))
    expect(ref(canal({ video_limit: 5 }), lista)).toMatchObject({ tipo: 'nm', motivo: 'janela_parcial', k: 0 })
  })
  it('sem janela parcial, 0 longos: sem_videos_90d (o caso legítimo continua)', () => {
    expect(ref(canal({ video_limit: 50 }), vs([1, 2], 30, 'short'))).toMatchObject({ tipo: 'nm', motivo: 'sem_videos_90d', k: 0 })
  })
  it('ainda não coletado continua antes da janela parcial', () => {
    expect(ref(canal({ video_limit: 5 }, null), shorts())).toMatchObject({ motivo: 'ainda_nao_coletado' })
  })
})

describe('referenciaDoCanal: views não finitas contam como não lidas (portão Phil m-a)', () => {
  it('só views NaN: ainda_nao_coletado, nunca sem_videos_90d', () => {
    expect(ref(canal(), vs([Number.NaN, Number.NaN, Number.NaN]))).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado' })
  })
  it('5 vídeos, 2 NaN: ainda_nao_coletado', () => {
    expect(ref(canal(), vs([1, 2, 3, Number.NaN, Number.NaN]))).toMatchObject({ tipo: 'nm', motivo: 'ainda_nao_coletado' })
  })
})

describe('referenciaDoCanal: canal próprio e regras', () => {
  it('canal próprio é medido pela mesma regra', () => {
    expect(ref(canal({ own: true }), vs([1, 2, 3, 4, 5]))).toMatchObject({ tipo: 'ok', k: 5 })
  })
  it('as regras são as aprovadas', () => {
    expect(REGRAS_REFERENCIAS).toEqual({ janelaDias: 90, idadeMinimaDias: 7, minVideosFaixa: 5, minVideosProvisoria: 3, corteEstreita: 2, corteMedia: 6, coletaVelhaHoras: 48 })
  })
})
