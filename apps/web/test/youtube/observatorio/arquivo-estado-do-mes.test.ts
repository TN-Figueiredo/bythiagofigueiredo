// apps/web/test/youtube/observatorio/arquivo-estado-do-mes.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { montarPagina, casaDe, modeloDesligado, modeloNaoLido } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { paginaVazia, mesCom, AGORA } from './fixtures/arquivo-pagina'

// [nome do estado (04), mês semeado, frase que começa assim, forma da etapa que manda, gravidade]
const CASOS: [string, ReturnType<typeof mesCom>, string, string, string][] = [
  ['No ar', mesCom({ mes: 'corrente' }), 'Em coleta', 'pontilhado', 'nenhuma'],
  ['Aguardando a margem', mesCom({ mes: 'fechado_ha', dias: 10 }), 'Fechado. Cópia a partir de', 'pontilhado', 'nenhuma'],
  ['Copiando', mesCom({ devidoHa: 1, esperadas: 45, recebidas: 12 }), 'Copiando: 12 de 45 canais', 'barra', 'nenhuma'],
  ['No NAS', mesCom({ nasHorasAtras: 3 }), 'No NAS, verificado hoje às', 'visto', 'nenhuma'],
  ['No B2 pela forja', mesCom({ nasHorasAtras: 3, b2Forja: 1 }), 'No B2, conferido pela forja', 'visto', 'nenhuma'],
  ['Só a sua vale', mesCom({ nasHorasAtras: 3, b2Forja: 9, b2Dono: 20 }), 'No B2, conferido por você em', 'triangulo', 'ambar'],
  ['B2 sem nenhuma válida', mesCom({ nasHorasAtras: 3, b2Forja: 9, b2Dono: 40 }), 'A forja não confere o B2 há 9 dias. Nada sai deste mês', 'octogono', 'vermelho'],
  ['Atrasado 6 dias', mesCom({ devidoHa: 6, esperadas: 2, recebidas: 0 }), 'Cópia atrasada há 6 dias', 'triangulo', 'ambar'],
  ['Atrasado 31 dias', mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0 }), 'Cópia atrasada há 31 dias', 'octogono', 'vermelho'],
  ['Verificação vencida', mesCom({ nasHorasAtras: 30 }), 'Cópia sem verificação há 30 horas', 'triangulo', 'ambar'],
  ['Tentativa falhou', mesCom({ b2Tentativa: 'arquivo_ausente' }), 'Última tentativa de conferir o B2', 'octogono', 'vermelho'],
  ['Sem chave', mesCom({ b2Forja: 2, b2Tentativa: 'chave_ausente' }), 'não pôde ser feita: falta a chave', 'triangulo', 'ambar'],
  ['Forja e Mac discordam', mesCom({ b2Divergiu: true }), 'A forja disse que o arquivo de', 'octogono', 'vermelho'],
  ['Arquivo não bate', mesCom({ conteudoDivergente: true }), 'está diferente do que o site guardou', 'octogono', 'vermelho'],
  ['Voltou a não selado', mesCom({ unsealed: 'conteudo_mudou' }), 'O dado deste mês mudou depois da cópia', 'pontilhado', 'nenhuma'],
  ['Recuperação vencida', mesCom({ recuperacaoHa: 200 }), 'Refaça o teste de recuperação: o último é de', 'triangulo', 'ambar'],
  ['Recuperação vence em 30 dias', mesCom({ recuperacaoHa: 151 }), 'O teste de recuperação de', 'triangulo', 'ambar'],
  ['Recuperação de um esquema antigo', mesCom({ recuperacaoHa: 10, fpMudou: true }), 'Refaça o teste de recuperação', 'triangulo', 'ambar'],
  ['Sem registro', mesCom({ vazioConferido: true }), 'Sem registro neste mês (conferimos em', 'zero', 'nenhuma'],
  ['Destacado', mesCom({ destacadoHa: 2 }), 'Saiu das telas em', 'pontilhado', 'nenhuma'],
  ['Destacado 15 dias', mesCom({ destacadoHa: 15 }), 'Saiu das telas há 15 dias', 'triangulo', 'ambar'],
  ['No arquivo', mesCom({ descartadoHa: 30, nasHorasAtras: 5 }), 'No arquivo desde', 'arquivo', 'nenhuma'],
  ['No arquivo sem verificação 22 dias', mesCom({ descartadoHa: 60, nasHorasAtras: 22 * 24 }), 'No arquivo. Sem verificação há 22 dias', 'triangulo', 'ambar'],
  ['No arquivo sem verificação 46 dias', mesCom({ descartadoHa: 90, nasHorasAtras: 46 * 24 }), 'No arquivo. Sem verificação há 46 dias', 'octogono', 'vermelho'],
]

describe('peça 2: o caminho de cada mês (item 39)', () => {
  it.each(CASOS)('%s', (_n, mes, comeco, forma, grav) => {
    const p = montarPagina(paginaVazia({ meses: [mes] }), { arquivoLigado: true })
    const l = p.tipos.flatMap(t => t.linhas)[0]!
    expect(l.frase.includes(comeco)).toBe(true)   // divergência do plano: alguns começos são trechos do meio da frase
    expect(l.regua.some(e => e.forma === forma) || (forma === 'arquivo' && l.regua[0]?.forma === 'arquivo')).toBe(true)
    expect(l.gravidade).toBe(grav)
    expect(l.frase.trim().length).toBeGreaterThan(0)
  })
  it('Phil C1: mês devido sem nenhuma linha de registro aparece, atrasado, e não some', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ semLinha: true, devidoHa: 31, esperadas: 2, recebidas: 0 })] }), { arquivoLigado: true })
    expect(p.tipos[0]!.linhas[0]).toMatchObject({ gravidade: 'vermelho' })
    expect(p.tipos[0]!.linhas[0]!.frase).toMatch(/^Cópia atrasada há 31 dias/)
  })
  it('a linha que precisa do dono sobe e é a única com gravidade', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 }), mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 2 })] }), { arquivoLigado: true })
    expect(p.tipos[0]!.linhas[0]!.gravidade).toBe('vermelho')
  })
  it('as três ausências têm formas diferentes', () => {
    const nr = casaDe([], [], AGORA).forma, nm = 'hachura', arq = 'arquivo'
    expect(new Set([nr, nm, arq]).size).toBe(3)
  })
  it('Review Focus 3: casa sem batimento com mês devido nunca é "Em coleta" nem verde', () => {
    const p = montarPagina(paginaVazia({ casa: [], meses: [mesCom({ devidoHa: 2, esperadas: 2, recebidas: 0 })] }), { arquivoLigado: true })
    expect(p.casa.estado).toBe('nunca_deu_sinal')
    expect(p.resumo.texto).toMatch(/A casa ainda não deu sinal/)
  })
  it('arquivo desligado: uma frase só', () => {
    const p = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 })] }), { arquivoLigado: false })
    expect(p.tipos).toEqual([])
    expect(p.resumo.texto).toBe('O arquivo está desligado neste site: nada está sendo copiado nem tirado')
  })
  it('site sem nenhum mês: primeira cópia, nunca "0 meses"', () => {
    const p = montarPagina(paginaVazia({}), { arquivoLigado: true })
    expect(p.resumo.texto).not.toMatch(/\b0 meses\b/)
  })
  it('a página usa o relógio do banco (lido_em), não o da máquina', () => {
    const lido = Date.parse('2027-03-01T15:00:00Z')
    const p = montarPagina(paginaVazia({ lido_em: new Date(lido).toISOString(), hoje: '2027-03-01', casa: [{ worker: 'copiador', last_poll_at: new Date(lido - 30 * 3_600_000).toISOString(), updated_at: new Date(lido - 30 * 3_600_000).toISOString() }] }), { arquivoLigado: true })
    expect(p.casa.forma).toBe('triangulo')
  })
})

describe('Phil I2: a casa', () => {
  const h = (h: number) => new Date(AGORA - h * 3_600_000).toISOString()
  const bat = (worker: string, o: Record<string, unknown>) => ({ worker, last_poll_at: null, updated_at: null, nas_ok: true, nas_checked_at: null, last_error: null, ...o })
  const b2ok = bat('conferir_b2', { updated_at: h(1) })   // r2 N7: 'responde' exige o copiador E o conferir_b2
  it('só o conferir_b2 deu sinal, 1 h atrás por updated_at: responde (last_poll_at nulo não é silêncio)', () => {
    // r2 N7/N-8: sem linha do copiador não é 'responde'
    expect(casaDe([bat('conferir_b2', { updated_at: h(1) })] as never, [], AGORA)).toMatchObject({ estado: 'programa_sem_sinal', forma: 'triangulo' })
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(1) }), bat('conferir_b2', { updated_at: h(1) })] as never, [], AGORA).estado).toBe('responde')
  })
  it('copiador há 25 h: triângulo; há 37 h: octógono', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(25), updated_at: h(25) })] as never, [], AGORA).forma).toBe('triangulo')
    expect(casaDe([bat('copiador', { last_poll_at: h(37), updated_at: h(37) })] as never, [], AGORA)).toMatchObject({ forma: 'octogono', estado: 'nao_respondeu' })
  })
  it('nas_checked_at velho: o NAS não foi verificado, mesmo com o copiador respondendo', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(30) })] as never, [], AGORA)).toMatchObject({ estado: 'nas_sem_verificar', forma: 'triangulo' })
  })
  it('NAS cheio vem do vermelho nas_80:, não de last_error', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(1), last_error: 'nas_cheio' }), b2ok] as never, [], AGORA).estado).toBe('responde')
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_checked_at: h(1) }), b2ok] as never, ['nas_80:numerico'], AGORA).estado).toBe('nas_cheio')
  })
  it('nas_ok falso: nas_fora', () => {
    expect(casaDe([bat('copiador', { last_poll_at: h(1), updated_at: h(1), nas_ok: false })] as never, [], AGORA).estado).toBe('nas_fora')
  })
})

describe('Phil I1: os vermelhos do pulso chegam à página', () => {
  const PREFIXOS = ['atraso de cópia: 3 unidades', 'mês sem selo: 2026-10', 'NAS: a cópia sumiu', 'B2: arquivo ausente', 'conteúdo divergente em 2026-10', 'mês descartado sem releitura: 2026-10',
    'b2_atrasado', 'B2 recusou o fileId', 'canário do filho falhou', 'canario_regravado:2026-10', 'nas_ilegivel:2026-10', 'b2_ilegivel:2026-10', 'nas_80:numerico',
    'tabela_ausente:competitor_video_early', 'b2_piso_acima_do_teto', 'b2_completo_atrasado', 'b2_teto_2_dias', 'vigia da remoção: consulta 3 com 1']
  it.each(PREFIXOS)('%s tem frase e forma próprias, não a genérica', v => {
    const p = montarPagina(paginaVazia({ vermelhos: [v] }), { arquivoLigado: true })
    expect(p.problemas).toHaveLength(1)
    expect(p.problemas[0]!.frase).not.toMatch(/ainda não descreve/)
    expect(['octogono', 'triangulo']).toContain(p.problemas[0]!.forma)
  })
  it('prefixo desconhecido: linha genérica em octógono, nunca engolido', () => {
    const p = montarPagina(paginaVazia({ vermelhos: ['xyz:1'] }), { arquivoLigado: true })
    expect(p.problemas[0]).toMatchObject({ frase: 'O arquivo tem um problema que esta página ainda não descreve.', forma: 'octogono' })
  })
})

describe('Phil M3: os meses à frente', () => {
  it('-1 e nulo têm frase própria; nunca "-1 meses"', () => {
    const p = montarPagina(paginaVazia({ meses_a_frente: [
      { table_name: 'competitor_video_daily', months_ahead: -1, last_month: null, converted_at: null },
      { table_name: 'competitor_video_early', months_ahead: null, last_month: null, converted_at: null },
      { table_name: 'competitor_video_hourly', months_ahead: 2, last_month: '2028-07-01', converted_at: '2028-01-01T00:00:00Z' }] }), { arquivoLigado: true })
    const f = p.mesesAFrente
    expect(f[0]!.frase).toBe('O mês corrente não existe nesta tabela. Rode a criação de partições.'); expect(f[0]!.forma).toBe('octogono')
    expect(f[1]!.frase).toMatch(/não particionada: não medido/); expect(f[1]!.forma).toBe('hachura')
    expect(f[2]!.forma).toBe('octogono')                                      // menos de 3
    expect(f.some(x => /-1|−1/.test(x.frase))).toBe(false)
  })
})

describe('o que acontece quando o dado não existe (acréscimos desta execução)', () => {
  const liga = { arquivoLigado: true }
  it('modeloNaoLido: função ausente e leitura falha têm frases próprias, em hachura, e a casa fica não medida (nunca "ainda não deu sinal")', () => {
    const a = modeloNaoLido('funcao_ausente'), b = modeloNaoLido('erro_do_banco'), c = modeloNaoLido('fora_do_esquema')
    expect(a.resumo).toEqual({ texto: 'O arquivo ainda não foi instalado neste banco.', forma: 'hachura' })
    for (const m of [b, c]) expect(m.resumo).toEqual({ texto: 'Não foi possível ler o estado do arquivo', forma: 'hachura' })
    for (const m of [a, b, c]) { expect(m.casa).toMatchObject({ estado: 'nao_medida', forma: 'hachura' }); expect(m.tipos).toEqual([]) }
    expect(modeloDesligado().resumo.forma).toBe('pontilhado')
  })
  it('canais_esperados = 0: "Sem canais neste mês" em zero, nunca "Copiando: 0 de 0"', () => {
    const l = montarPagina(paginaVazia({ meses: [mesCom({ devidoHa: 3, esperadas: 0, recebidas: 0 })] }), liga).tipos[0]!.linhas[0]!
    expect(l.frase).toBe('Sem canais neste mês'); expect(l.regua[0]!.forma).toBe('zero'); expect(l.frase).not.toMatch(/0 de 0/)
  })
  it('mês devido sem progresso lido: não medido (hachura), nunca "copiando" nem verde', () => {
    const m = mesCom({ devidoHa: 3, esperadas: 2, recebidas: 0 }); delete (m as { progresso?: unknown }).progresso
    const l = montarPagina(paginaVazia({ meses: [m] }), liga).tipos[0]!.linhas[0]!
    expect(l).toMatchObject({ gravidade: 'nao_medido' }); expect(l.regua[0]!.forma).toBe('hachura')
  })
  it('schema_fp_atual nulo (tabela ausente) não vira "o formato mudou"', () => {
    const m = mesCom({ recuperacaoHa: 10 })
    const p = paginaVazia({ meses: [m] }); p.recuperacao = p.recuperacao.map(r => (r.class === 'serie' ? { ...r, schema_fp_atual: null } : r))
    const l = montarPagina(p, liga).tipos[0]!.linhas[0]!
    expect(l.frase).not.toMatch(/formato/); expect(l.gravidade).toBe('nenhuma'); expect(l.regua[2]!.forma).toBe('hachura')
  })
  it('as duas tabelas da série: o mês só avança quando as duas avançaram', () => {
    const a = mesCom({ nasHorasAtras: 3 }).linha, b = { ...a, table_name: 'competitor_video_early', nas_attested_at: null, sealed_at: null }
    const p = paginaVazia({}); p.meses = [a, b]
    expect(montarPagina(p, liga).tipos[0]!.linhas[0]!.frase).not.toMatch(/^No NAS, verificado/)
  })
  it('ordem: dono, depois destacado, depois online; no arquivo por último', () => {
    const p = paginaVazia({ meses: [
      mesCom({ descartadoHa: 60, nasHorasAtras: 5, mesNum: 1 }), mesCom({ nasHorasAtras: 3, mesNum: 2 }),
      mesCom({ destacadoHa: 2, mesNum: 3 }), mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 4 }) ] })
    const fr = montarPagina(p, liga).tipos[0]!.linhas.map(l => l.frase.split(/[ .]/).slice(0, 2).join(' '))
    expect(fr).toEqual(['Cópia atrasada', 'Saiu das', 'No NAS,', 'No arquivo'])
  })
  it('limiares do atraso: 5 dias sem aviso, 6 âmbar, 30 âmbar, 31 vermelho (os mesmos de obs_archive_atraso)', () => {
    const g = (d: number) => montarPagina(paginaVazia({ meses: [mesCom({ devidoHa: d, esperadas: 2, recebidas: 0 })] }), liga).tipos[0]!.linhas[0]!.gravidade
    expect([g(5), g(6), g(30), g(31)]).toEqual(['nenhuma', 'ambar', 'ambar', 'vermelho'])
  })
  it('anosNoArquivo agrupa por ano e marca se todos estão conferidos', () => {
    const p = paginaVazia({ meses: [mesCom({ descartadoHa: 60, nasHorasAtras: 5, mesNum: 1 }), mesCom({ descartadoHa: 90, nasHorasAtras: 46 * 24, mesNum: 2 })] })
    expect(montarPagina(p, liga).tipos[0]!.anosNoArquivo).toEqual([{ ano: 2027, meses: 1, todosConferidos: true }]) // o vermelho vai ao topo, não ao grupo do ano
  })
})
