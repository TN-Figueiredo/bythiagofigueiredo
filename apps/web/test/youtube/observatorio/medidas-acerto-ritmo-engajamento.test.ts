// @vitest-environment node
// A5 · E4, Tarefa 5: M4 (acerto), M6 (ritmo), M7 (engajamento). Funções puras.
import { describe, expect, it } from 'vitest'
import { taxaDeAcerto, type VideoParaAcerto } from '@/lib/youtube/observatorio/medidas/acerto'
import { ritmo } from '@/lib/youtube/observatorio/medidas/ritmo'
import { engajamentoDoVideo, engajamentoDoCanal, type EntradaEngajamento, type VideoParaEngajamento } from '@/lib/youtube/observatorio/medidas/engajamento'
import { DAY } from '@/lib/youtube/observatorio/time'

const AGORA = Date.UTC(2026, 9, 12, 15, 0)

describe('M4: taxa de acerto', () => {
  const v = (multiplo: number | null, over: Partial<VideoParaAcerto> = {}): VideoParaAcerto => ({ formato: 'long', idadeDias: 30, multiplo, baseFraca: false, agendadoOuNoAr: false, ...over })
  const o = { formato: 'long' as const }
  const cinco = (m: number[]) => m.map(x => v(x))
  it('múltiplo exatamente 2 conta; 1,99 não; fracasso exatamente 0,5 conta; 0,51 não', () => {
    const r = taxaDeAcerto(cinco([2, 1.99, 0.5, 0.51, 1]), o)
    expect(r).toMatchObject({ estado: 'medido', valor: { acertos: 1, fracassos: 1, total: 5 } })
  })
  it('5 vídeos mede, 4 não', () => {
    expect(taxaDeAcerto(cinco([1, 1, 1, 1, 1]), o).estado).toBe('medido')
    expect(taxaDeAcerto(cinco([1, 1, 1, 1]), o)).toMatchObject({ motivo: 'poucos_videos', n: 4, minimo: 5 })
  })
  it('percentual com 10, sem percentual com 9', () => {
    const dez = taxaDeAcerto(cinco([3, 3, 3, 1, 1, 1, 1, 0.4, 0.4, 0.4]), o)
    expect(dez).toMatchObject({ valor: { total: 10, pctAcerto: 0.3, pctFracasso: 0.3 } })
    const nove = taxaDeAcerto(cinco([3, 3, 3, 1, 1, 1, 1, 0.4, 0.4]), o)
    expect(nove).toMatchObject({ valor: { total: 9, pctAcerto: null, pctFracasso: null } })
  })
  it('vídeo de 6 dias fica fora, de 7 entra; de 91 fica fora', () => {
    const base = cinco([1, 1, 1, 1])
    expect(taxaDeAcerto([...base, v(1, { idadeDias: 6 })], o).estado).toBe('nao_medido')
    expect(taxaDeAcerto([...base, v(1, { idadeDias: 7 })], o).estado).toBe('medido')
    expect(taxaDeAcerto([...base, v(1, { idadeDias: 90 })], o).estado).toBe('medido')
    expect(taxaDeAcerto([...base, v(1, { idadeDias: 91 })], o).estado).toBe('nao_medido')
  })
  it('base fraca e múltiplo nulo ficam fora', () => {
    expect(taxaDeAcerto([...cinco([1, 1, 1, 1]), v(5, { baseFraca: true }), v(null)], o).estado).toBe('nao_medido')
  })
  it('nenhum múltiplo: sem_multiplo', () => {
    expect(taxaDeAcerto([v(null), v(null), v(null)], o)).toMatchObject({ motivo: 'sem_multiplo' })
    expect(taxaDeAcerto([], o)).toMatchObject({ motivo: 'poucos_videos', n: 0 })
  })
  it('longos e Shorts não se misturam', () => {
    expect(taxaDeAcerto([...cinco([1, 1, 1, 1]), v(1, { formato: 'short' })], o).estado).toBe('nao_medido')
  })
  it('vídeo agendado ou no ar fica fora e é contado', () => {
    const r = taxaDeAcerto([...cinco([1, 1, 1, 1, 1]), v(9, { agendadoOuNoAr: true })], o)
    expect(r).toMatchObject({ estado: 'medido', valor: { acertos: 0, total: 5 } })
    expect(r.notas).toContainEqual({ tipo: 'agendado_fora', n: 1 })
  })
})

describe('M6: ritmo', () => {
  const pubs = (n: number, passoDias = 7, inicioDias = 1) => Array.from({ length: n }, (_, j) => AGORA - (inicioDias + j * passoDias) * DAY)
  it('4 publicações mede, 3 não', () => {
    expect(ritmo(pubs(4, 7), { agoraMs: AGORA, parcial: false }).estado).toBe('medido')
    expect(ritmo(pubs(3, 7), { agoraMs: AGORA, parcial: false })).toMatchObject({ motivo: 'poucas_publicacoes', n: 3, minimo: 4 })
  })
  it('conta à mão: a cada 7 dias', () => {
    const r = ritmo(pubs(13, 7), { agoraMs: AGORA, parcial: false })
    expect(r).toMatchObject({ estado: 'medido', valor: { porSemana: 1, intervaloMedianoDias: 7, semanasComPublicacao: 13, semanas: 13, maiorBuracoDias: 7 } })
  })
  it('maior buraco inclui o trecho da última publicação até agora', () => {
    const ps = [AGORA - 40 * DAY, AGORA - 47 * DAY, AGORA - 54 * DAY, AGORA - 61 * DAY]
    const r = ritmo(ps, { agoraMs: AGORA, parcial: false })
    expect(r).toMatchObject({ valor: { maiorBuracoDias: 40 } })
  })
  it('o buraco olha 26 semanas, o ritmo 13', () => {
    const ps = [...pubs(5, 7), AGORA - 150 * DAY]
    const r = ritmo(ps, { agoraMs: AGORA, parcial: false })
    expect(r).toMatchObject({ valor: { maiorBuracoDias: expect.any(Number) } })
    expect(r.estado === 'medido' && r.valor.maiorBuracoDias).toBeCloseTo(150 - 29, 5)
  })
  it('ritmo parcial', () => {
    expect(ritmo(pubs(13, 7), { agoraMs: AGORA, parcial: true })).toMatchObject({ motivo: 'ritmo_parcial' })
  })
  it('lista vazia', () => {
    expect(ritmo([], { agoraMs: AGORA, parcial: false })).toMatchObject({ motivo: 'poucas_publicacoes', n: 0 })
  })
})

describe('M7: engajamento', () => {
  const e = (over: Partial<EntradaEngajamento> = {}): EntradaEngajamento => ({
    views30: 1000, likes30: 50, comments30: 10, temMarca30: true, viewsHoje: 5000, likesHoje: 400, commentsHoje: 80,
    likesHidden: false, commentsDisabled: false, idadeDias: 40, agendadoOuNoAr: false, ...over,
  })
  it('usa a marca de 30 quando existe', () => {
    const r = engajamentoDoVideo(e())
    expect(r).toMatchObject({ estado: 'medido', valor: { taxa: 0.06, curtidasPorView: 0.05, comentariosPorView: 0.01, base: 'idade_30' } })
    expect(r.notas).toEqual([])
  })
  it('sem marca e 90 dias: total de hoje com a nota; 91 dias: sem_v30', () => {
    const r = engajamentoDoVideo(e({ temMarca30: false, idadeDias: 90 }))
    expect(r).toMatchObject({ estado: 'medido', valor: { base: 'total_de_hoje', taxa: 480 / 5000 } })
    expect(r.notas).toContainEqual({ tipo: 'total_de_hoje' })
    expect(engajamentoDoVideo(e({ temMarca30: false, idadeDias: 91 }))).toMatchObject({ motivo: 'sem_v30' })
  })
  it('99 views não mede, 100 mede', () => {
    expect(engajamentoDoVideo(e({ views30: 99 }))).toMatchObject({ motivo: 'poucas_views' })
    expect(engajamentoDoVideo(e({ views30: 100 })).estado).toBe('medido')
  })
  it('só curtidas, só comentários, nenhum', () => {
    const so = engajamentoDoVideo(e({ comments30: null }))
    expect(so).toMatchObject({ valor: { taxa: 0.05, comentariosPorView: null } })
    expect(so.notas).toContainEqual({ tipo: 'so_curtidas' })
    const soC = engajamentoDoVideo(e({ likes30: null }))
    expect(soC).toMatchObject({ valor: { taxa: 0.01, curtidasPorView: null } })
    expect(soC.notas).toContainEqual({ tipo: 'so_comentarios' })
    expect(engajamentoDoVideo(e({ likes30: null, comments30: null }))).toMatchObject({ motivo: 'sem_reacao_publica' })
  })
  it('curtidas ocultas e comentários desligados contam como nulos', () => {
    expect(engajamentoDoVideo(e({ likesHidden: true, commentsDisabled: true }))).toMatchObject({ motivo: 'sem_reacao_publica' })
    expect(engajamentoDoVideo(e({ commentsDisabled: true })).notas).toContainEqual({ tipo: 'so_curtidas' })
  })
  it('zero com sinalizador nulo é nulo; zero com sinalizador falso é zero medido', () => {
    const nulo = engajamentoDoVideo(e({ likes30: 0, likesHidden: null }))
    expect(nulo).toMatchObject({ valor: { curtidasPorView: null, taxa: 0.01 } })
    expect(nulo.notas).toContainEqual({ tipo: 'so_comentarios' })
    const zero = engajamentoDoVideo(e({ likes30: 0, likesHidden: false }))
    expect(zero).toMatchObject({ valor: { curtidasPorView: 0, taxa: 0.01 } })
    expect(zero.notas).toEqual([])
  })
  it('views zero: poucas_views, nunca divisão', () => {
    expect(engajamentoDoVideo(e({ views30: 0 }))).toMatchObject({ motivo: 'poucas_views' })
  })
  it('vídeo agendado: fecha_em sem data', () => {
    const r = engajamentoDoVideo(e({ agendadoOuNoAr: true, views30: 0, viewsHoje: 0 }))
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'fecha_em' })
    expect(r.estado === 'nao_medido' && r.fechaEm).toBeUndefined()
  })

  const vc = (taxaViews: number, over: Partial<EntradaEngajamento> = {}, meta: Partial<VideoParaEngajamento> = {}): VideoParaEngajamento => ({
    formato: 'long', wasLive: false, agendadoOuNoAr: false,
    engajamento: engajamentoDoVideo(e({ likes30: taxaViews * 1000, comments30: 0, commentsDisabled: false, ...over })), ...meta,
  })
  const o = { formato: 'long' as const }
  it('canal: mediana de três mede, dois não', () => {
    expect(engajamentoDoCanal([vc(0.01), vc(0.03), vc(0.02)], o)).toMatchObject({ estado: 'medido', valor: 0.02, n: 3 })
    expect(engajamentoDoCanal([vc(0.01), vc(0.03)], o)).toMatchObject({ motivo: 'poucos_videos', n: 2, minimo: 3 })
  })
  it('canal: não mistura base de 30 dias com total de hoje', () => {
    const hoje = (x: number) => vc(0, { temMarca30: false, viewsHoje: 5000, likesHoje: x * 5000, commentsHoje: 0 })
    const r = engajamentoDoCanal([vc(0.01), vc(0.02), vc(0.03), hoje(0.5), hoje(0.5)], o)
    expect(r).toMatchObject({ estado: 'medido', valor: 0.02, n: 3 })
    expect(r.notas).not.toContainEqual({ tipo: 'total_de_hoje' })
    const soHoje = engajamentoDoCanal([hoje(0.1), hoje(0.2), hoje(0.3)], o)
    expect(soHoje.notas).toContainEqual({ tipo: 'total_de_hoje' })
  })
  it('canal: ao vivo fora e contado; formato não confirmado; agendado', () => {
    const r = engajamentoDoCanal([vc(0.01), vc(0.03), vc(0.02), vc(0.9, {}, { wasLive: true }), vc(0.9, {}, { formato: null }), vc(0, {}, { agendadoOuNoAr: true })], o)
    expect(r).toMatchObject({ valor: 0.02, n: 3 })
    expect(r.notas).toContainEqual({ tipo: 'ao_vivo_fora', n: 1 })
    expect(r.notas).toContainEqual({ tipo: 'formato_nao_confirmado_fora', n: 1 })
    expect(r.notas).toContainEqual({ tipo: 'agendado_fora', n: 1 })
  })
})
