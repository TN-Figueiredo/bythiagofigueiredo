// @vitest-environment node
// A5 · E4, Tarefa 4: M3 (direção) e M8 (estado do canal). Funções puras, datas explícitas no passado ou de entrada.
import { describe, expect, it } from 'vitest'
import {
  direcaoDe, direcaoDoCanalInteiro, direcaoDosVideosNovos, somaDias, variacoesDoCanal, type RetratoDoCanal, type VideoParaDirecao,
} from '@/lib/youtube/observatorio/medidas/direcao'
import { estadoDoCanal } from '@/lib/youtube/observatorio/medidas/estado-canal'
import { DAY } from '@/lib/youtube/observatorio/time'

const HOJE = '2026-10-12'
const AGORA = Date.UTC(2026, 9, 12, 15, 0)

/** Retratos diários até `fim`, `n` dias, com `views(i)` onde i = 0 é o dia `fim`. */
function retratos(fim: string, n: number, views: (i: number) => number | null): RetratoDoCanal[] {
  return Array.from({ length: n }, (_, k) => { const i = n - 1 - k; return { dia: somaDias(fim, -i), views: views(i) } })
}
/** Série diária em que o ganho de cada janela de 28 dias, da mais recente à mais antiga, é `ganhos[k]`; o dia mais antigo tem 1.000.000. */
function comGanhos(fim: string, ganhos: number[]): RetratoDoCanal[] {
  const n = ganhos.length
  const borda = (j: number) => 1_000_000 + ganhos.slice(j).reduce((a, g) => a + g, 0)
  return retratos(fim, 28 * n + 1, i => {
    if (i === 28 * n) return borda(n)
    const w = Math.floor(i / 28)
    return Math.round(borda(w + 1) + ((28 * (w + 1) - i) / 28) * ganhos[w]!)
  })
}

describe('M3 a: direção do canal inteiro', () => {
  it('exatamente +10% sobe; +9,99% é igual; exatamente −10% desce; −9,99% é igual', () => {
    expect(direcaoDe(0.10)).toBe('subindo')
    expect(direcaoDe(0.0999)).toBe('igual')
    expect(direcaoDe(-0.10)).toBe('descendo')
    expect(direcaoDe(-0.0999)).toBe('igual')
    expect(direcaoDe(110 / 100 - 1)).toBe('subindo')
    expect(direcaoDe(90 / 100 - 1)).toBe('descendo')
  })
  it('conta à mão com três retratos', () => {
    const rs = [{ dia: somaDias(HOJE, -56), views: 1_000_000 }, { dia: somaDias(HOJE, -28), views: 1_100_000 }, { dia: HOJE, views: 1_230_000 }]
    const r = direcaoDoCanalInteiro(rs, HOJE)
    expect(r).toMatchObject({ estado: 'medido', valor: { ganhoRecente: 130000, ganhoAnterior: 100000, direcao: 'subindo' } })
    expect(r.estado === 'medido' && r.valor.variacao).toBeCloseTo(0.30, 10)
  })
  it('falta o dia da borda: sem_registro_na_borda com a data', () => {
    const rs = retratos(HOJE, 60, i => 2_000_000 - i * 1000).filter(r => r.dia !== somaDias(HOJE, -28))
    expect(direcaoDoCanalInteiro(rs, HOJE)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_registro_na_borda', desde: somaDias(HOJE, -28) })
  })
  it('views nulo na borda é sem registro, nunca zero', () => {
    const rs = retratos(HOJE, 60, i => (i === 56 ? null : 2_000_000 - i * 1000))
    const r = direcaoDoCanalInteiro(rs, HOJE)
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'sem_registro_na_borda', desde: somaDias(HOJE, -56) })
  })
  it('só 55 dias de série', () => {
    expect(direcaoDoCanalInteiro(retratos(HOJE, 55, i => 2_000_000 - i * 1000), HOJE)).toMatchObject({ motivo: 'pouco_registro' })
  })
  it('ganho anterior zero: base_zero, nunca Infinity', () => {
    const rs = [{ dia: somaDias(HOJE, -56), views: 1000 }, { dia: somaDias(HOJE, -28), views: 1000 }, { dia: HOJE, views: 2000 }]
    expect(direcaoDoCanalInteiro(rs, HOJE)).toMatchObject({ motivo: 'base_zero' })
  })
  it('ganho negativo: contagem_recuou', () => {
    const rs = [{ dia: somaDias(HOJE, -56), views: 1000 }, { dia: somaDias(HOJE, -28), views: 900 }, { dia: HOJE, views: 2000 }]
    expect(direcaoDoCanalInteiro(rs, HOJE)).toMatchObject({ motivo: 'contagem_recuou' })
  })
  it('último retrato de anteontem: sem_registro_recente; de ontem mede', () => {
    const base = (fim: string) => [{ dia: somaDias(fim, -56), views: 1000 }, { dia: somaDias(fim, -28), views: 1100 }, { dia: fim, views: 1230 }]
    expect(direcaoDoCanalInteiro(base(somaDias(HOJE, -2)), HOJE)).toMatchObject({ motivo: 'sem_registro_recente' })
    expect(direcaoDoCanalInteiro(base(somaDias(HOJE, -1)), HOJE)).toMatchObject({ estado: 'medido' })
  })
  it('janela de 01/08 a 26/09 leva a nota de mudança de contagem; de 24/08 a 19/10 não leva', () => {
    const rs = (fim: string) => [{ dia: somaDias(fim, -56), views: 1000 }, { dia: somaDias(fim, -28), views: 1100 }, { dia: fim, views: 1230 }]
    const a = direcaoDoCanalInteiro(rs('2026-09-26'), '2026-09-27')
    expect(a.notas).toContainEqual({ tipo: 'mudanca_de_contagem' })
    const b = direcaoDoCanalInteiro(rs('2026-10-19'), '2026-10-20')
    expect(b.notas).toEqual([])
  })
  it('lista vazia', () => {
    expect(direcaoDoCanalInteiro([], HOJE)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_registro_recente' })
  })
})

describe('M3 b e c: direção dos vídeos novos', () => {
  const v = (diasAtras: number, hoje: number | null, over: Partial<VideoParaDirecao> = {}): VideoParaDirecao => ({
    formato: 'long', publicadoEm: AGORA - diasAtras * DAY, wasLive: false, agendadoOuNoAr: false, viewsHidden: false, viewsHoje: hoje, v30: null, ...over,
  })
  const o = { agoraMs: AGORA, base: 'views_de_hoje' as const }
  it('3 e 3 medem, 2 e 5 não', () => {
    const tres = [v(10, 300), v(20, 300), v(30, 300), v(100, 200), v(110, 200), v(120, 200)]
    const r = direcaoDosVideosNovos(tres, o)
    expect(r).toMatchObject({ estado: 'medido', valor: { direcao: 'subindo', medianaRecente: 300, medianaAnterior: 200 } })
    expect(r.estado === 'medido' && r.valor.variacao).toBeCloseTo(0.5, 10)
    const dois = [v(10, 300), v(20, 300), v(100, 200), v(110, 200), v(120, 200), v(130, 200), v(140, 200)]
    expect(direcaoDosVideosNovos(dois, o)).toMatchObject({ motivo: 'poucos_videos', n: 2, minimo: 3 })
  })
  it('com V30: sem marcas é poucos_videos', () => {
    const vs = [v(10, 300), v(20, 300), v(30, 300), v(100, 200), v(110, 200), v(120, 200)]
    expect(direcaoDosVideosNovos(vs, { ...o, base: 'v30' })).toMatchObject({ motivo: 'poucos_videos', n: 0 })
  })
  it('com V30: usa o V30 das marcas', () => {
    const m = (views: number) => ({ estado: 'medido' as const, valor: { views, gapHoras: 1, fonte: 'marca' as const }, n: 1, janela: { de: null, ate: null, dias: 30 }, notas: [] })
    const vs = [v(40, null, { v30: m(300) }), v(50, null, { v30: m(300) }), v(60, null, { v30: m(300) }), v(100, null, { v30: m(100) }), v(110, null, { v30: m(100) }), v(120, null, { v30: m(100) })]
    expect(direcaoDosVideosNovos(vs, { ...o, base: 'v30' })).toMatchObject({ estado: 'medido', valor: { direcao: 'subindo' } })
  })
  it('Shorts e formato não confirmado nunca entram', () => {
    const vs = [v(10, 300), v(20, 300), v(100, 200), v(110, 200), v(120, 200), v(15, 9999, { formato: 'short' }), v(16, 9999, { formato: null })]
    expect(direcaoDosVideosNovos(vs, o)).toMatchObject({ motivo: 'poucos_videos', n: 2 })
  })
  it('views ocultas e nulas ficam fora', () => {
    const vs = [v(10, 300), v(20, 300), v(30, 300), v(40, null), v(50, 5000, { viewsHidden: true }), v(100, 200), v(110, 200), v(120, 200)]
    expect(direcaoDosVideosNovos(vs, o)).toMatchObject({ estado: 'medido', valor: { medianaRecente: 300 } })
  })
  it('mediana anterior zero', () => {
    const vs = [v(10, 300), v(20, 300), v(30, 300), v(100, 0), v(110, 0), v(120, 0)]
    expect(direcaoDosVideosNovos(vs, o)).toMatchObject({ motivo: 'base_zero' })
  })
  // (revisão Yannis 14/10) was_live nulo entra na conta e é contado, como em M1 e M7
  it('was_live nulo: o vídeo entra e a nota ao_vivo_nao_se_sabe conta só os que entraram', () => {
    const vs = [v(10, 300, { wasLive: null }), v(20, 300), v(30, 300), v(100, 200, { wasLive: null }), v(110, 200), v(120, 200), v(500, 200, { wasLive: null }), v(15, 9999, { wasLive: null, viewsHidden: true })]
    const r = direcaoDosVideosNovos(vs, o)
    expect(r).toMatchObject({ estado: 'medido', valor: { medianaRecente: 300, medianaAnterior: 200 } })
    expect(r.notas).toContainEqual({ tipo: 'ao_vivo_nao_se_sabe', n: 2 })
    expect(direcaoDosVideosNovos([v(10, 300), v(20, 300), v(30, 300), v(100, 200), v(110, 200), v(120, 200)], o).notas.some(n => n.tipo === 'ao_vivo_nao_se_sabe')).toBe(false)
  })
  it('o agendado e o que está no ar ficam fora e são contados', () => {
    const vs = [v(10, 300), v(20, 300), v(30, 300), v(1, 0, { agendadoOuNoAr: true }), v(100, 200), v(110, 200), v(120, 200)]
    const r = direcaoDosVideosNovos(vs, o)
    expect(r).toMatchObject({ estado: 'medido', valor: { medianaRecente: 300 } })
    expect(r.notas).toContainEqual({ tipo: 'agendado_fora', n: 1 })
  })
})

describe('M8: estado do canal', () => {
  const base = { missingSince: null, ultimaPublicacaoMs: AGORA - DAY, intervaloMedianoDias: null, retratos: [] as RetratoDoCanal[], hojeSP: HOJE, agoraMs: AGORA, collectionPausedAt: null }
  it('parado: exatamente 28 dias não é, 29 é (sem intervalo)', () => {
    expect(estadoDoCanal({ ...base, ultimaPublicacaoMs: AGORA - 28 * DAY }).estado).toBe('ativo')
    expect(estadoDoCanal({ ...base, ultimaPublicacaoMs: AGORA - 29 * DAY })).toMatchObject({ estado: 'parado', parado: { estado: 'medido', valor: { dias: 29, limite: 28 } } })
  })
  it('parado: intervalo de 10 dias dá limite 40; 40 não é, 41 é', () => {
    expect(estadoDoCanal({ ...base, intervaloMedianoDias: 10, ultimaPublicacaoMs: AGORA - 40 * DAY }).estado).toBe('ativo')
    expect(estadoDoCanal({ ...base, intervaloMedianoDias: 10, ultimaPublicacaoMs: AGORA - 41 * DAY })).toMatchObject({ estado: 'parado', parado: { valor: { limite: 40 } } })
  })
  it('sem publicação: parado não medido', () => {
    expect(estadoDoCanal({ ...base, ultimaPublicacaoMs: null }).parado).toMatchObject({ estado: 'nao_medido', motivo: 'sem_publicacao' })
  })
  it('fora do ar vence parado', () => {
    expect(estadoDoCanal({ ...base, missingSince: '2026-10-01T00:00:00Z', ultimaPublicacaoMs: AGORA - 90 * DAY }).estado).toBe('fora_do_ar')
  })
  // Série em que os ganhos de 28 dias, do mais recente ao mais antigo, são `g` (um por janela).
  // Depois de 14/12/2026 a janela de 112 dias já não cruza a mudança de contagem de 24/08.
  const FIM = '2026-12-20'
  const quedaDe = (fim: string, g: number[], hojeSP = somaDias(fim, 1)) => estadoDoCanal({ ...base, retratos: comGanhos(fim, g), hojeSP })
  it('queda: três janelas em −10% exato é queda; uma em −9,99% não é', () => {
    // g0 = 0,9 × g1 = 0,9 × 0,9 × g2 = 0,9 × 0,9 × 0,9 × g3  (g3 = 1.000.000)
    const r = quedaDe(FIM, [729_000, 810_000, 900_000, 1_000_000])
    expect(r).toMatchObject({ estado: 'em_queda', queda: { estado: 'medido' } })
    const quase = quedaDe(FIM, [729_000, 810_000, 899_800, 1_000_000])
    expect(quase.estado).toBe('ativo')
    expect(quase.queda.estado).toBe('medido')
  })
  it('queda: 111 dias de registro não mede', () => {
    const rs = comGanhos(FIM, [729_000, 810_000, 900_000, 1_000_000]).slice(2)
    const r = estadoDoCanal({ ...base, retratos: rs, hojeSP: somaDias(FIM, 1) })
    expect(r.queda).toMatchObject({ estado: 'nao_medido', motivo: 'pouco_registro' })
    expect(r.estado).toBe('ativo')
  })
  it('queda antes de 14/12/2026 cruza a mudança', () => {
    const g = [729_000, 810_000, 900_000, 1_000_000]
    const antes = estadoDoCanal({ ...base, retratos: comGanhos('2026-12-13', g), hojeSP: '2026-12-14', ultimaPublicacaoMs: Date.UTC(2026, 11, 13), agoraMs: Date.UTC(2026, 11, 14) })
    expect(antes.queda).toMatchObject({ estado: 'nao_medido', motivo: 'janela_cruza_mudanca_de_contagem' })
    const depois = estadoDoCanal({ ...base, retratos: comGanhos('2026-12-14', g), hojeSP: '2026-12-15', ultimaPublicacaoMs: Date.UTC(2026, 11, 14), agoraMs: Date.UTC(2026, 11, 15) })
    expect(depois.queda.estado).toBe('medido')
  })
  it('queda não medida deixa o estado ativo e diz que a queda não foi medida', () => {
    const r = estadoDoCanal({ ...base, retratos: [] })
    expect(r.estado).toBe('ativo')
    expect(r.queda).toMatchObject({ estado: 'nao_medido' })
  })
  // (revisão Yannis 14/10, I1) variacoesDoCanal: a conta do em_queda não pode se apoiar em contagem que recuou nem em base zero
  it('queda: contagem que recuou numa janela não mede e não vira em_queda', () => {
    // sem a guarda, as três variações (−100,6%, −10%, −10%) dariam em_queda sobre dado que recuou (vídeo apagado, F6)
    const r = quedaDe(FIM, [-5_000, 810_000, 900_000, 1_000_000])
    expect(r.queda).toMatchObject({ estado: 'nao_medido', motivo: 'contagem_recuou' })
    expect(r.estado).toBe('ativo')
    const antiga = quedaDe(FIM, [729_000, 810_000, -900_000, 1_000_000])
    expect(antiga.queda).toMatchObject({ estado: 'nao_medido', motivo: 'contagem_recuou' })
    expect(antiga.estado).toBe('ativo')
  })
  it('queda: ganho zero na janela anterior é base_zero, nunca Infinity nem NaN', () => {
    for (const g of [[729_000, 810_000, 900_000, 0], [729_000, 810_000, 0, 1_000_000], [729_000, 0, 900_000, 1_000_000]]) {
      const r = quedaDe(FIM, g)
      expect(r.queda).toMatchObject({ estado: 'nao_medido', motivo: 'base_zero' })
      expect(r.estado).toBe('ativo')
    }
  })
  it('variacoesDoCanal: nenhum resultado medido traz NaN ou Infinity', () => {
    const m = variacoesDoCanal(comGanhos(FIM, [729_000, 810_000, 900_000, 1_000_000]), somaDias(FIM, 1), 3)
    expect(m.estado === 'medido' && m.valor.variacoes.every(Number.isFinite)).toBe(true)
  })
  it('parado vence em_queda: canal sem publicar há 90 dias e com três janelas em queda é parado, com a queda medida', () => {
    const r = estadoDoCanal({ ...base, retratos: comGanhos(FIM, [729_000, 810_000, 900_000, 1_000_000]), hojeSP: somaDias(FIM, 1), ultimaPublicacaoMs: AGORA - 90 * DAY })
    expect(r.estado).toBe('parado')
    expect(r.queda.estado).toBe('medido')
  })
  it('canal pausado: estado é pausado, nunca parado nem ativo', () => {
    const r = estadoDoCanal({ ...base, collectionPausedAt: '2026-10-01T00:00:00Z', ultimaPublicacaoMs: AGORA - 90 * DAY })
    expect(r.estado).toBe('pausado')
  })
  it('canal pausado e fora do ar: fora_do_ar vence', () => {
    expect(estadoDoCanal({ ...base, collectionPausedAt: '2026-10-01T00:00:00Z', missingSince: '2026-10-02T00:00:00Z' }).estado).toBe('fora_do_ar')
  })
  it('canal pausado: parado e queda saem nao_medido com coleta_pausada', () => {
    const r = estadoDoCanal({ ...base, collectionPausedAt: '2026-10-01T00:00:00Z' })
    expect(r.parado).toMatchObject({ estado: 'nao_medido', motivo: 'coleta_pausada' })
    expect(r.queda).toMatchObject({ estado: 'nao_medido', motivo: 'coleta_pausada' })
  })
  it('canal despausado: volta à precedência normal', () => {
    expect(estadoDoCanal({ ...base, collectionPausedAt: null, ultimaPublicacaoMs: AGORA - 90 * DAY }).estado).toBe('parado')
  })
})
