// @vitest-environment node
// A5 · E4, Tarefa 5: M4 (acerto), M6 (ritmo), M7 (engajamento). Funções puras.
import { describe, expect, it } from 'vitest'
import { taxaDeAcerto, type VideoParaAcerto } from '@/lib/youtube/observatorio/medidas/acerto'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { ritmo, listaCortada, coberturaDaLista, baseDoRitmo, limiteEfetivo, PISO_RITMO_DIAS } from '@/lib/youtube/observatorio/medidas/ritmo'
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
    expect(ritmo(pubs(4, 7), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null }).estado).toBe('medido')
    expect(ritmo(pubs(3, 7), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })).toMatchObject({ motivo: 'poucas_publicacoes', n: 3, minimo: 4 })
  })
  // (revisão Yannis 14/10, M-3) publicação exatamente no limite de 91 dias não cria uma 14ª semana
  it('14 publicações a cada 7 dias, a mais antiga exatamente 91 dias atrás: no máximo 13 semanas com publicação', () => {
    const r = ritmo(pubs(14, 7, 0), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor.semanasComPublicacao).toBe(13)
    expect(r.estado === 'medido' && r.valor.semanas).toBe(13)
  })
  it('conta à mão: a cada 7 dias', () => {
    const r = ritmo(pubs(13, 7), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
    expect(r).toMatchObject({ estado: 'medido', valor: { porSemana: 1, intervaloMedianoDias: 7, semanasComPublicacao: 13, semanas: 13, maiorBuracoDias: 7 } })
  })
  it('maior buraco inclui o trecho da última publicação até agora', () => {
    const ps = [AGORA - 40 * DAY, AGORA - 47 * DAY, AGORA - 54 * DAY, AGORA - 61 * DAY]
    const r = ritmo(ps, { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
    expect(r).toMatchObject({ valor: { maiorBuracoDias: 40 } })
  })
  it('o buraco olha 26 semanas, o ritmo 13', () => {
    const ps = [...pubs(5, 7), AGORA - 150 * DAY]
    const r = ritmo(ps, { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
    expect(r).toMatchObject({ valor: { maiorBuracoDias: expect.any(Number) } })
    expect(r.estado === 'medido' && r.valor.maiorBuracoDias).toBeCloseTo(150 - 29, 5)
  })
  // Parecer Phil 19/10 (C-1): a janela começa no max(agora - 91 d, criação, mais antigo guardado de lista cortada).
  const em = (dias: number) => AGORA - dias * DAY
  it('DNA: canal criado há 81 dias, 5 publicações: 5 / 11,57 semanas, nota e janela de 81 dias', () => {
    const r = ritmo(pubs(5, 7, 1), { agoraMs: AGORA, criadoEmMs: em(81), coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor.porSemana).toBeCloseTo(5 / (81 / 7), 6)
    expect(r.estado === 'medido' && r.janela.dias).toBe(81)
    expect(r.notas).toContainEqual({ tipo: 'canal_mais_novo_que_a_janela', dias: 81, desde: spDateOf(em(81)) })
  })
  it('Estevam: lista cortada com cobertura a 73 dias, 11 longos: 11 / 10,43 semanas e nota de cobertura', () => {
    const r = ritmo(pubs(11, 6, 1), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: em(73) })
    expect(r.estado === 'medido' && r.valor.porSemana).toBeCloseTo(11 / (73 / 7), 6)
    expect(r.estado === 'medido' && r.janela.dias).toBe(73)
    expect(r.notas).toContainEqual({ tipo: 'cobertura_curta', dias: 73, desde: spDateOf(em(73)) })
  })
  it('canal antigo com lista completa: n / 13, sem nota (regressão)', () => {
    const r = ritmo(pubs(13, 7), { agoraMs: AGORA, criadoEmMs: em(2000), coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor.porSemana).toBe(1)
    expect(r.estado === 'medido' && r.janela.dias).toBe(91)
    expect(r.notas).toEqual([])
  })
  it('criado há 20 dias: abaixo do piso de 4 semanas, canal_novo; cobertura de 20 dias é outro motivo, ritmo_parcial', () => {
    expect(ritmo(pubs(5, 3, 1), { agoraMs: AGORA, criadoEmMs: em(20), coberturaDesdeMs: null })).toMatchObject({ estado: 'nao_medido', motivo: 'canal_novo' })
    expect(ritmo(pubs(5, 3, 1), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: em(20) })).toMatchObject({ estado: 'nao_medido', motivo: 'ritmo_parcial' })
  })
  it('a borda do piso: 27,9 dias não mede, 28 dias mede', () => {
    expect(PISO_RITMO_DIAS).toBe(28)
    expect(ritmo(pubs(5, 5, 1), { agoraMs: AGORA, criadoEmMs: em(27.9), coberturaDesdeMs: null })).toMatchObject({ estado: 'nao_medido', motivo: 'canal_novo' })
    expect(ritmo(pubs(5, 5, 1), { agoraMs: AGORA, criadoEmMs: em(28), coberturaDesdeMs: null }).estado).toBe('medido')
    expect(ritmo(pubs(5, 5, 1), { agoraMs: AGORA, criadoEmMs: em(24), coberturaDesdeMs: null })).toMatchObject({ motivo: 'canal_novo' })
  })
  // Parecer Phil 19/10 (I-1): a semana fracionária não vaza; `semanas` são casas inteiras e `semanasComPublicacao` nunca passa delas.
  it('DNA: semanas é inteiro (12), semanasContadas 11,57 e dias 81; semanas com publicação nunca passa de semanas', () => {
    const r = ritmo(pubs(5, 7, 1), { agoraMs: AGORA, criadoEmMs: em(81), coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor).toMatchObject({ semanas: 12, semanasContadas: 11.57, dias: 81, semanasComPublicacao: 5 })
    const toda = ritmo(pubs(12, 7, 1), { agoraMs: AGORA, criadoEmMs: em(81), coberturaDesdeMs: null })
    expect(toda.estado === 'medido' && toda.valor.semanasComPublicacao).toBe(12)
    expect(toda.estado === 'medido' && toda.valor.semanasComPublicacao).toBeLessThanOrEqual(toda.estado === 'medido' ? toda.valor.semanas : 0)
    expect(r.estado === 'medido' && Number.isInteger(r.valor.semanas) && Number.isInteger(r.valor.dias)).toBe(true)
  })
  it('Estevam: 11 longos a cada 6 dias, cobertura a 73 dias: 9 semanas com publicação de 11', () => {
    const r = ritmo(pubs(11, 6, 1), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: em(73) })
    expect(r.estado === 'medido' && r.valor).toMatchObject({ semanas: 11, semanasComPublicacao: 9, semanasContadas: 10.43, dias: 73 })
  })
  it('criação a 84 dias e publicação exatamente nela: a 13ª casa não existe, semanas com publicação não passa de semanas (12)', () => {
    const r = ritmo(pubs(13, 7, 0), { agoraMs: AGORA, criadoEmMs: em(84), coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor).toMatchObject({ semanas: 12, semanasComPublicacao: 12, dias: 84 })
  })
  it('sem corte: semanas 13, dias 91, semanasContadas 13', () => {
    const r = ritmo(pubs(13, 7), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor).toMatchObject({ semanas: 13, dias: 91, semanasContadas: 13 })
  })
  it('criação nula: janela de 91 dias sem nota (ausência não encurta nem inventa)', () => {
    const r = ritmo(pubs(13, 7), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.janela.dias).toBe(91)
    expect(r.notas).toEqual([])
  })
  it('criação exatamente a 91 dias: sem nota, sem 14ª semana', () => {
    const r = ritmo(pubs(14, 7, 0), { agoraMs: AGORA, criadoEmMs: em(91), coberturaDesdeMs: null })
    expect(r.estado === 'medido' && r.valor.semanasComPublicacao).toBe(13)
    expect(r.estado === 'medido' && r.janela.dias).toBe(91)
    expect(r.notas).toEqual([])
  })
  it('lista vazia', () => {
    expect(ritmo([], { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })).toMatchObject({ motivo: 'poucas_publicacoes', n: 0 })
  })
})

describe('lista cortada e cobertura (Phil I-3, Yannis I-2 e I-4)', () => {
  const lc = (guardados: number, totalNoYoutube: number | null, limiteDeVideos: number | null) => listaCortada({ guardados, totalNoYoutube, limiteDeVideos })
  it('tabela-verdade', () => {
    expect(lc(20, 3000, 50)).toBe(true) // primeira busca: guardou menos que o limite, mas o YouTube tem mais
    expect(lc(50, 50, 50)).toBe(false)
    expect(lc(51, 3355, 50)).toBe(true)
    expect(lc(50, null, 50)).toBe(true) // total desconhecido + limite atingido: não vira "completo"
    expect(lc(10, null, 50)).toBe(false)
    expect(lc(6, 6, 50)).toBe(false)
    expect(lc(49, 3355, 50)).toBe(true) // lista podada
    expect(lc(50, 3355, null)).toBe(true) // com o total conhecido o limite nem importa
    expect(lc(50, null, null)).toBe(false)
    expect(lc(250, null, 300)).toBe(true) // o limite cru de 300 vale 200 (mesma leitura da tela e da API)
    expect(lc(199, null, 300)).toBe(false)
  })
  it('limiteEfetivo: o do banco passa do máximo da regra', () => {
    expect(limiteEfetivo(300)).toBe(200); expect(limiteEfetivo(50)).toBe(50); expect(limiteEfetivo(null)).toBeNull(); expect(limiteEfetivo(undefined)).toBeNull()
  })
  it('coberturaDaLista: a publicação na posição do limite; o fixado antigo não conta', () => {
    const recentes = Array.from({ length: 50 }, (_, j) => AGORA - (1 + j * 1.2) * DAY) // 1 a 59,8 dias
    const fixado = AGORA - 80 * DAY
    expect(coberturaDaLista([...recentes, fixado], 50)).toBe(recentes[49])
    expect(coberturaDaLista(recentes.slice(0, 11), 50)).toBe(recentes[10]) // lista menor que o limite: o mais antigo
    expect(coberturaDaLista([], 50)).toBeNull()
    expect(coberturaDaLista(recentes, null)).toBe(recentes[49])
  })
  const base = (o: Partial<Parameters<typeof baseDoRitmo>[0]>) => baseDoRitmo({ publicacoesMs: [AGORA - 5 * DAY, AGORA - 60 * DAY], criadoEmMs: null, guardados: 2, totalNoYoutube: null, limiteDeVideos: 50, ...o })
  it('baseDoRitmo: canal próprio nunca é lista cortada', () => {
    const pubsMs = Array.from({ length: 200 }, (_, j) => AGORA - (1 + j * 0.15) * DAY)
    expect(baseDoRitmo({ publicacoesMs: pubsMs, criadoEmMs: null, guardados: 200, totalNoYoutube: null, limiteDeVideos: 200, proprio: true }).coberturaDesdeMs).toBeNull()
    expect(baseDoRitmo({ publicacoesMs: pubsMs, criadoEmMs: null, guardados: 200, totalNoYoutube: null, limiteDeVideos: 200 }).coberturaDesdeMs).toBe(pubsMs[199])
  })
  it('baseDoRitmo: criação posterior ao vídeo mais antigo perde para ele', () => {
    expect(base({ criadoEmMs: AGORA - 30 * DAY }).criadoEmMs).toBe(AGORA - 60 * DAY)
    expect(base({ criadoEmMs: AGORA - 100 * DAY }).criadoEmMs).toBe(AGORA - 100 * DAY)
    expect(base({ criadoEmMs: null }).criadoEmMs).toBeNull()
    const r = ritmo(Array.from({ length: 5 }, (_, j) => AGORA - (40 + j * 5) * DAY), { agoraMs: AGORA, ...baseDoRitmo({ publicacoesMs: Array.from({ length: 5 }, (_, j) => AGORA - (40 + j * 5) * DAY), criadoEmMs: AGORA - 30 * DAY, guardados: 5, totalNoYoutube: 5, limiteDeVideos: 50 }) })
    expect(r.estado).toBe('medido') // nenhum vídeo sai da conta por a "criação" ser posterior
    expect(r.estado === 'medido' && r.n).toBe(5)
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
  // (revisão Yannis 14/10, I3) a mediana é do mesmo componente: nunca mistura só curtidas com curtidas e comentários
  const so = (taxa: number, qual: 'curtidas' | 'comentarios') => vc(taxa, qual === 'curtidas'
    ? { likes30: taxa * 1000, comments30: 0, commentsDisabled: true }
    : { likes30: 0, likesHidden: true, comments30: taxa * 1000, commentsDisabled: false })
  const doisC = (taxa: number) => vc(taxa, { likes30: taxa * 1000, comments30: 0, commentsDisabled: false })
  it('canal: três só-curtidas (0,05) contra três com os dois (0,01): o grupo maior vence, sem mistura, e a nota é so_curtidas', () => {
    const r = engajamentoDoCanal([so(0.05, 'curtidas'), so(0.05, 'curtidas'), so(0.05, 'curtidas'), so(0.05, 'curtidas'), doisC(0.01), doisC(0.01), doisC(0.01), so(0.4, 'comentarios')], o)
    expect(r).toMatchObject({ estado: 'medido', valor: 0.05, n: 4 })
    expect(r.notas).toContainEqual({ tipo: 'so_curtidas' })
    const outro = engajamentoDoCanal([so(0.05, 'curtidas'), so(0.05, 'curtidas'), so(0.05, 'curtidas'), doisC(0.01), doisC(0.01), doisC(0.01), doisC(0.01), so(0.4, 'comentarios')], o)
    expect(outro).toMatchObject({ estado: 'medido', valor: 0.01, n: 4 })
    expect(outro.notas.some(n => n.tipo === 'so_curtidas' || n.tipo === 'so_comentarios')).toBe(false)
  })
  it('canal: grupos do mesmo tamanho desempatam por idade_30 e depois por os_dois, depois so_curtidas, depois so_comentarios', () => {
    const empate = engajamentoDoCanal([so(0.05, 'curtidas'), so(0.05, 'curtidas'), so(0.05, 'curtidas'), doisC(0.01), doisC(0.01), doisC(0.01)], o)
    expect(empate).toMatchObject({ valor: 0.01, n: 3 })
    const curtidasXcomentarios = engajamentoDoCanal([so(0.05, 'curtidas'), so(0.05, 'curtidas'), so(0.05, 'curtidas'), so(0.3, 'comentarios'), so(0.3, 'comentarios'), so(0.3, 'comentarios')], o)
    expect(curtidasXcomentarios).toMatchObject({ valor: 0.05, n: 3 })
    expect(curtidasXcomentarios.notas).toContainEqual({ tipo: 'so_curtidas' })
    // total de hoje, mesmo grupo maior, perde para 30 dias de tamanho igual
    const hoje = (x: number) => vc(0, { temMarca30: false, viewsHoje: 5000, likesHoje: x * 5000, commentsHoje: 0, commentsDisabled: false })
    expect(engajamentoDoCanal([hoje(0.5), hoje(0.5), hoje(0.5), doisC(0.01), doisC(0.01), doisC(0.01)], o)).toMatchObject({ valor: 0.01, n: 3 })
  })
  it('canal: ao vivo fora e contado; formato não confirmado; agendado', () => {
    const r = engajamentoDoCanal([vc(0.01), vc(0.03), vc(0.02), vc(0.9, {}, { wasLive: true }), vc(0.9, {}, { formato: null }), vc(0, {}, { agendadoOuNoAr: true })], o)
    expect(r).toMatchObject({ valor: 0.02, n: 3 })
    expect(r.notas).toContainEqual({ tipo: 'ao_vivo_fora', n: 1 })
    expect(r.notas).toContainEqual({ tipo: 'formato_nao_confirmado_fora', n: 1 })
    expect(r.notas).toContainEqual({ tipo: 'agendado_fora', n: 1 })
  })
})
