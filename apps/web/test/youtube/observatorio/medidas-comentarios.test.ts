// @vitest-environment node
// A5 · E4, Tarefa 8: M11 (o criador responde) e M12 (peso do comentário de topo). Funções puras (item 124 do spec).
import { describe, expect, it } from 'vitest'
import {
  criadorResponde, pesoDoComentarioDeTopo, pesoDoComentarioDeTopoDoCanal, type VideoParaResposta, type EntradaPeso,
} from '@/lib/youtube/observatorio/medidas/comentarios'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { DAY } from '@/lib/youtube/observatorio/time'

const AGORA = Date.UTC(2026, 9, 12, 15, 0)

describe('M11: o criador responde', () => {
  const v = (com: boolean, over: Partial<VideoParaResposta> = {}): VideoParaResposta => ({ formato: 'long', idadeDias: 30, retrato30: 'ok', algumComRespostaDoCriador: com, ...over })
  const o = { formato: 'long' as const, coletaDesdeMs: AGORA - 60 * DAY, agoraMs: AGORA }
  const n = (k: number, com = 0) => Array.from({ length: k }, (_, i) => v(i < com))
  it('4 vídeos com retrato ok não mede, 5 mede', () => {
    expect(criadorResponde(n(4), o)).toMatchObject({ motivo: 'poucos_videos', n: 4, minimo: 5 })
    expect(criadorResponde(n(5, 2), o)).toMatchObject({ estado: 'medido', valor: { com: 2, total: 5 } })
  })
  it('exatamente 10 vídeos tem percentual; 9 não', () => {
    expect(criadorResponde(n(10, 4), o)).toMatchObject({ valor: { com: 4, total: 10, pct: 0.4 } })
    expect(criadorResponde(n(9, 4), o)).toMatchObject({ valor: { total: 9, pct: null } })
  })
  it('retrato desligados, sem_comentarios, erro e ausente ficam fora da base', () => {
    const fora = (['desligados', 'sem_comentarios', 'erro', null] as const).map(r => v(true, { retrato30: r }))
    expect(criadorResponde([...n(5, 1), ...fora], o)).toMatchObject({ valor: { com: 1, total: 5 } })
  })
  it('só vídeos de até 90 dias e do formato pedido', () => {
    const outros = [v(true, { idadeDias: 91 }), v(true, { formato: 'short' }), v(true, { formato: null })]
    expect(criadorResponde([...n(5, 0), ...outros], o)).toMatchObject({ valor: { com: 0, total: 5 } })
  })
  it('coleta há 29 dias: fecha_em com a data; há 30: mede', () => {
    const desde29 = AGORA - 29 * DAY
    expect(criadorResponde(n(5), { ...o, coletaDesdeMs: desde29 })).toMatchObject({ estado: 'nao_medido', motivo: 'fecha_em', fechaEm: new Date(desde29 + 30 * DAY - 3 * 36e5).toISOString().slice(0, 10) })
    expect(criadorResponde(n(5), { ...o, coletaDesdeMs: AGORA - 30 * DAY }).estado).toBe('medido')
    expect(criadorResponde(n(5), { ...o, coletaDesdeMs: null })).toMatchObject({ motivo: 'retrato_ausente' })
  })
  it('nenhum vídeo', () => {
    expect(criadorResponde([], o)).toMatchObject({ motivo: 'poucos_videos', n: 0 })
  })
  it('o valor não tem nenhum campo que afirme "não respondeu"', () => {
    const r = criadorResponde(n(5, 2), o)
    expect(r.estado === 'medido' && Object.keys(r.valor).sort()).toEqual(['com', 'pct', 'total'])
  })
})

describe('M12: peso do comentário de topo', () => {
  const e = (over: Partial<EntradaPeso> = {}): EntradaPeso => ({
    marco: 30, retrato: 'ok', maiorCurtidasDeComentario: 300, curtidasDoVideoNaMarca: 1200, likesHiddenNaMarca: false, marca: 'gravada', ...over,
  })
  it('conta à mão', () => {
    expect(pesoDoComentarioDeTopo(e())).toMatchObject({ estado: 'medido', valor: 0.25 })
  })
  it('99 curtidas no vídeo não mede, 100 mede', () => {
    expect(pesoDoComentarioDeTopo(e({ curtidasDoVideoNaMarca: 99 }))).toMatchObject({ motivo: 'poucas_curtidas' })
    expect(pesoDoComentarioDeTopo(e({ curtidasDoVideoNaMarca: 100 })).estado).toBe('medido')
  })
  it('curtidas do vídeo ocultas', () => {
    expect(pesoDoComentarioDeTopo(e({ curtidasDoVideoNaMarca: null, likesHiddenNaMarca: true }))).toMatchObject({ motivo: 'curtidas_ocultas' })
  })
  it('curtidas nulas sem o sinalizador: sem_reacao_publica', () => {
    expect(pesoDoComentarioDeTopo(e({ curtidasDoVideoNaMarca: null, likesHiddenNaMarca: null }))).toMatchObject({ motivo: 'sem_reacao_publica' })
  })
  it('retrato desligados, ausente ou sem o maior comentário: retrato_ausente', () => {
    expect(pesoDoComentarioDeTopo(e({ retrato: 'desligados' }))).toMatchObject({ motivo: 'retrato_ausente' })
    expect(pesoDoComentarioDeTopo(e({ retrato: null }))).toMatchObject({ motivo: 'retrato_ausente' })
    expect(pesoDoComentarioDeTopo(e({ maiorCurtidasDeComentario: null }))).toMatchObject({ motivo: 'retrato_ausente' })
  })
  it('marca ainda não decidida: aguardando_calculo', () => {
    expect(pesoDoComentarioDeTopo(e({ marca: 'aguardando' }))).toMatchObject({ motivo: 'aguardando_calculo' })
  })
  it('marca com motivo registrado devolve o motivo', () => {
    expect(pesoDoComentarioDeTopo(e({ marca: 'leituras_distantes' }))).toMatchObject({ motivo: 'leituras_distantes' })
    expect(pesoDoComentarioDeTopo(e({ marca: 'views_ocultas' }))).toMatchObject({ motivo: 'views_ocultas' })
  })
  it('zero curtidas no vídeo nunca divide', () => {
    const r = pesoDoComentarioDeTopo(e({ curtidasDoVideoNaMarca: 0 }))
    expect(r).toMatchObject({ motivo: 'poucas_curtidas' })
  })
  const ok = (x: number) => medido(x, 1, { de: null, ate: null, dias: 30 })
  it('canal: 3 mede, 2 não', () => {
    expect(pesoDoComentarioDeTopoDoCanal([ok(0.1), ok(0.3), ok(0.2), naoMedido('retrato_ausente')])).toMatchObject({ estado: 'medido', valor: 0.2, n: 3 })
    expect(pesoDoComentarioDeTopoDoCanal([ok(0.1), ok(0.3), naoMedido('poucas_curtidas')])).toMatchObject({ motivo: 'poucos_videos', n: 2, minimo: 3 })
  })
  it('longos e Shorts separados: quem chama separa as listas, e cada uma tem a sua mediana', () => {
    expect(pesoDoComentarioDeTopoDoCanal([ok(0.1), ok(0.1), ok(0.1)])).toMatchObject({ valor: 0.1 })
    expect(pesoDoComentarioDeTopoDoCanal([ok(0.5), ok(0.5), ok(0.5)])).toMatchObject({ valor: 0.5 })
  })
})
