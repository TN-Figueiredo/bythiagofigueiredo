// @vitest-environment node
// A5 · E4, Tarefa 3: M2 (curva por idade) e M9 (cauda).
import { describe, expect, it } from 'vitest'
import { curvaDoCanal, type VideoComSerie } from '@/lib/youtube/observatorio/medidas/curva'
import { caudaDoVideo } from '@/lib/youtube/observatorio/medidas/cauda'
import type { Leitura } from '@/lib/youtube/observatorio/medidas/m1'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import { DAY, H } from '@/lib/youtube/observatorio/time'

const AGORA = Date.UTC(2026, 9, 10, 15, 0)
const L = (t: number, views: number): Leitura => ({ t, views, likes: null, comments: null })
const pontoDe = (r: Medida<unknown>, idade: number) => {
  if (r.estado !== 'medido') throw new Error('curva não medida')
  const pts = r.valor as Array<{ idadeDias: number; ponto: Medida<number>; relativoAV30: Medida<number> }>
  return pts.find(p => p.idadeDias === idade)!
}

/** Vídeo publicado há 120 dias, lido de 3 em 3 horas em torno de cada idade (views = 100 por dia de idade). */
function video(over: Partial<VideoComSerie> = {}, vpd = 100): VideoComSerie {
  const base = AGORA - 120 * DAY
  const leituras: Leitura[] = []
  for (let d = 0; d <= 100; d++) for (const h of [0, 12]) leituras.push(L(base + d * DAY + h * H, Math.round((d + h / 24) * vpd)))
  return { formato: 'long', publicadoEm: base, baseMs: base, wasLive: false, agendadoOuNoAr: false, marcas: {}, faltas: {}, leituras, ...over }
}
const o = { formato: 'long' as const, agoraMs: AGORA }

describe('M2: curva', () => {
  it('ponto com 3 vídeos mede e com 2 não, e cada ponto escreve o seu n', () => {
    const tres = curvaDoCanal([video(), video(), video()], o)
    expect(pontoDe(tres, 7).ponto).toMatchObject({ estado: 'medido', n: 3, valor: 700 })
    const dois = curvaDoCanal([video(), video()], o)
    expect(dois).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos' })
    const curto = video()
    curto.leituras = curto.leituras!.filter(l => l.t <= curto.baseMs! + 10 * DAY)
    const mista = curvaDoCanal([video(), video(), video(), curto], o)
    expect(pontoDe(mista, 7).ponto).toMatchObject({ estado: 'medido', n: 4 })
    expect(pontoDe(mista, 14).ponto).toMatchObject({ estado: 'medido', n: 3 })
    const mista2 = curvaDoCanal([video(), video(), curto, curto], o)
    expect(pontoDe(mista2, 7).ponto).toMatchObject({ estado: 'medido', n: 4 })
    expect(pontoDe(mista2, 14).ponto).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 2, minimo: 3 })
  })
  it('ao vivo e formato não confirmado fora, contados', () => {
    const r = curvaDoCanal([video(), video(), video(), video({ wasLive: true }), video({ formato: null })], o)
    expect(r.notas).toContainEqual({ tipo: 'ao_vivo_fora', n: 1 })
    expect(r.notas).toContainEqual({ tipo: 'formato_nao_confirmado_fora', n: 1 })
    expect(pontoDe(r, 7).ponto).toMatchObject({ n: 3 })
  })
  it('vídeo agendado fica fora e é contado', () => {
    const r = curvaDoCanal([video(), video(), video(), video({ agendadoOuNoAr: true })], o)
    expect(r.notas).toContainEqual({ tipo: 'agendado_fora', n: 1 })
  })
  it('só entram os publicados nos últimos 180 dias', () => {
    const velho = video({ publicadoEm: AGORA - 181 * DAY })
    const r = curvaDoCanal([video(), video(), video(), velho], o)
    expect(pontoDe(r, 7).ponto).toMatchObject({ n: 3 })
  })
  it('idade 60 aceita vizinhas a 8 dias e leva a nota; idade 14 não aceita', () => {
    const base = AGORA - 120 * DAY
    const esparso = (): VideoComSerie => video({ leituras: [L(base + 10 * DAY, 1000), L(base + 18 * DAY, 1800), L(base + 56 * DAY, 5600), L(base + 64 * DAY, 6400), L(base + 100 * DAY, 10000)] })
    const r = curvaDoCanal([esparso(), esparso(), esparso()], o)
    expect(pontoDe(r, 60).ponto).toMatchObject({ estado: 'medido', valor: 6000, n: 3, notas: [{ tipo: 'serie_semanal' }] })
    expect(r.notas).toContainEqual({ tipo: 'serie_semanal' })
    expect(pontoDe(r, 14).ponto).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos' })
  })
  it('as idades 1, 7 e 30 vêm das marcas, antes da série', () => {
    const base = AGORA - 120 * DAY
    const marca = { views: 4242, likes: null, comments: null, readBeforeAt: base + 7 * DAY - H, readAfterAt: base + 7 * DAY + H, ageBaseAt: base }
    const vs = [video({ marcas: { 7: marca } }), video({ marcas: { 7: marca } }), video({ marcas: { 7: marca } })]
    expect(pontoDe(curvaDoCanal(vs, o), 7).ponto).toMatchObject({ valor: 4242 })
  })
  it('relativo a V30: V30 zero sai da razão e nunca dá Infinity', () => {
    const zero = (): VideoComSerie => video({}, 0)
    const r = curvaDoCanal([video(), video(), video(), zero()], o)
    const p14 = pontoDe(r, 14)
    expect(p14.relativoAV30).toMatchObject({ estado: 'medido', valor: 14 / 30, n: 3 })
    const soZeros = curvaDoCanal([zero(), zero(), zero()], o)
    expect(pontoDe(soZeros, 14).relativoAV30).toMatchObject({ estado: 'nao_medido', motivo: 'base_zero' })
      })
  it('sem a série: 1, 7 e 30 pelas marcas, as outras serie_nao_pedida', () => {
    const base = AGORA - 120 * DAY
    const m = (d: number) => ({ views: d * 10, likes: null, comments: null, readBeforeAt: base + d * DAY, readAfterAt: base + d * DAY, ageBaseAt: base })
    const semSerie = (): VideoComSerie => video({ leituras: undefined, marcas: { 1: m(1), 7: m(7), 30: m(30) } })
    const r = curvaDoCanal([semSerie(), semSerie(), semSerie()], o)
    expect(pontoDe(r, 7).ponto).toMatchObject({ estado: 'medido', valor: 70 })
    expect(pontoDe(r, 14).ponto).toMatchObject({ estado: 'nao_medido', motivo: 'serie_nao_pedida' })
  })
  it('nenhum vídeo: poucos_videos em todos os pontos', () => {
    const r = curvaDoCanal([], o)
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 0 })
  })
})

describe('M9: cauda', () => {
  const v30 = (views: number): Medida<{ views: number; gapHoras: number; fonte: 'marca' | 'serie' }> => medido({ views, gapHoras: 1, fonte: 'marca' }, 1, { de: null, ate: null, dias: 30 })
  const semV30 = naoMedido('aguardando_calculo')
  const base = (idade: number) => ({ idadeDias: idade, agoraMs: AGORA })
  it('idade 89 não mede, 90 mede', () => {
    expect(caudaDoVideo({ ...base(89), v30: v30(4000), viewsHoje: 10000 }).cauda).toMatchObject({ motivo: 'idade_menor_que_90' })
    expect(caudaDoVideo({ ...base(90), v30: v30(4000), viewsHoje: 10000 }).cauda).toMatchObject({ estado: 'medido' })
  })
  it('sem V30', () => {
    expect(caudaDoVideo({ ...base(100), v30: semV30, viewsHoje: 10000 }).cauda).toMatchObject({ motivo: 'sem_v30' })
    expect(caudaDoVideo({ ...base(100), v30: semV30, viewsHoje: 10000 }).aindaRende).toMatchObject({ motivo: 'sem_v30' })
  })
  it('views de hoje zero, nulo, e menor que V30', () => {
    expect(caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: null }).cauda).toMatchObject({ motivo: 'sem_leitura' })
    expect(caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: 0 }).cauda).toMatchObject({ motivo: 'base_zero' })
    expect(caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: 3999 }).cauda).toMatchObject({ motivo: 'contagem_recuou' })
  })
  it('cauda: conta à mão', () => {
    const r = caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: 10000 }).cauda
    expect(r).toMatchObject({ estado: 'medido', valor: 0.6 })
  })
  it('ainda rende: conta à mão e V30 zero', () => {
    const ponta = AGORA - 28 * DAY
    const ls = [L(ponta - 12 * H, 9000), L(ponta + 12 * H, 9400)]
    const r = caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: 10000, leituras: ls }).aindaRende
    expect(r).toMatchObject({ estado: 'medido', valor: (10000 - 9200) / 4000 })
    expect(caudaDoVideo({ ...base(100), v30: v30(0), viewsHoje: 10000, leituras: ls }).aindaRende).toMatchObject({ motivo: 'base_zero' })
  })
  it('ainda rende sem a série pedida', () => {
    expect(caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: 10000 }).aindaRende).toMatchObject({ motivo: 'serie_nao_pedida' })
  })
  it('ainda rende com buraco de 9 dias na ponta: serie_diaria_incompleta', () => {
    const ponta = AGORA - 28 * DAY
    const ls = [L(ponta - 5 * DAY, 9000), L(ponta + 4 * DAY, 9400)]
    expect(caudaDoVideo({ ...base(100), v30: v30(4000), viewsHoje: 10000, leituras: ls }).aindaRende).toMatchObject({ motivo: 'serie_diaria_incompleta' })
  })
})
