// A4 Tarefa 9: o modelo do gráfico "Impressões por dia" (spec 16.6, 17.4). Puro, sem banco: recebe os dias JÁ montados
// (`montarDias`) e devolve o que o componente desenha. O foco é a falha em verde: dia SEM relatório não é barra de altura
// zero; zero medido e não medido têm altura, texto, dica e situação por extenso diferentes; nada divide por zero.
import { describe, it, expect } from 'vitest'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { montarDias, motivoDiaTexto, type DiaAlcance, type MotivoDia, type Periodo } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { buildImpressoes, tetoDoEixo, type ImpressoesView } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { alcanceCheio, alcanceCurto, alcanceNadaLido, alcanceSoVazios, alcanceVazio } from './proprio-fixture'

const dm = (d: DiaYt) => d.slice(8, 10) + '/' + d.slice(5, 7)
const dia = (d: DiaYt, imp: number | null, cliques: number | null = 0, motivo: MotivoDia = 'nao-baixado'): DiaAlcance => ({
  dia: d, situacao: imp == null ? 'nao-medido' : imp > 0 ? 'com-impressoes' : 'zero-medido', motivo: imp == null ? motivo : null, imp, cliques: imp == null ? null : cliques,
})
const periodo: Periodo = { de: '2026-09-24', ate: '2026-10-01', dias: 8 }
const O = { escopo: 'canal' as const, alturaArea: 180, dm, acesso: 'ok' as const }
const HOJE = '2026-10-03'

describe('escala', () => {
  it('teto do eixo: 4, 10 ou múltiplo de 20', () => {
    expect([0, 1, 4, 5, 10, 11, 20, 71, 100, 101].map(tetoDoEixo)).toEqual([4, 4, 4, 10, 10, 20, 20, 80, 100, 120])
  })
  it('escala linear: a barra de 1 impressão tem no mínimo 3 px e a de 71 não a apaga (área de 180 px)', () => {
    const v = buildImpressoes([dia('2026-10-01', 71), dia('2026-10-02', 1)], periodo, O)
    expect(v.teto).toBe(80)
    expect(v.colunas[0]!.alturaPx).toBeCloseTo(180 * 71 / 80, 0)
    expect(v.colunas[1]!.alturaPx).toBe(3)
  })
  it('eixo com três marcas: 0, metade e o teto', () => {
    expect(buildImpressoes([dia('2026-10-01', 71)], periodo, O).ticks).toEqual([0, 40, 80])
    expect(buildImpressoes([dia('2026-10-01', 3)], periodo, O).ticks).toEqual([0, 2, 4])
    expect(buildImpressoes([dia('2026-10-01', 9)], periodo, O).ticks).toEqual([0, 5, 10])
  })
  it('todos os valores iguais: não divide por zero e a barra não some nem achata (7 de teto 10 = 70% da área)', () => {
    const v = buildImpressoes([dia('2026-10-01', 7), dia('2026-10-02', 7), dia('2026-10-03', 7)], periodo, O)
    expect(v.teto).toBe(10)
    expect(v.colunas.map(c => c.alturaPx)).toEqual([126, 126, 126])
  })
  it('todos zero medido: teto 4, cada traço com 3 px, nenhuma altura NaN', () => {
    const v = buildImpressoes([dia('2026-10-01', 0), dia('2026-10-02', 0)], periodo, O)
    expect(v.teto).toBe(4)
    expect(v.colunas.map(c => c.alturaPx)).toEqual([3, 3])
    expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity/)
  })
  it('a área do vídeo (110 px) escala do mesmo jeito', () => {
    const v = buildImpressoes([dia('2026-10-01', 40)], periodo, { ...O, alturaArea: 110 })
    expect(v.colunas[0]!.alturaPx).toBeCloseTo(110 * 40 / 40, 0)
    expect(v.alturaArea).toBe(110)
  })
})

describe('os três estados nunca se confundem', () => {
  const v = buildImpressoes([dia('2026-10-01', 9, 0.4 + 0.2), dia('2026-10-02', 0), dia('2026-10-03', null)], periodo, O)
  const [com, zero, nm] = v.colunas as [ImpressoesView['colunas'][0], ImpressoesView['colunas'][0], ImpressoesView['colunas'][0]]
  it('zero medido: traço de 3 px, texto "0"; não medido: altura da área inteira, imp e cliques null', () => {
    expect(zero.situacao).toBe('zero-medido')
    expect(zero.alturaPx).toBe(3)
    expect(zero.imp).toBe('0')
    expect(zero.cliques).toBe('0')
    expect(nm.situacao).toBe('nao-medido')
    expect(nm.alturaPx).toBe(180)
    expect(nm.imp).toBeNull()
    expect(nm.cliques).toBeNull()
    expect(com.imp).toBe('9')
  })
  it('as três situações têm dica e situação por extenso diferentes entre si', () => {
    expect(new Set(v.colunas.map(c => c.dica)).size).toBe(3)
    expect(new Set(v.colunas.map(c => c.situacaoTexto)).size).toBe(3)
  })
  it('dicas, letra por letra (spec 16.6)', () => {
    const d = (arr: DiaAlcance[]) => buildImpressoes(arr, periodo, O).colunas.map(c => c.dica)
    expect(d([dia('2026-09-24', 1, 1)])).toEqual(['24/09: 1 impressão, 1 clique estimado'])
    expect(d([dia('2026-09-30', 9, 0)])).toEqual(['30/09: 9 impressões, nenhum clique'])
    expect(d([dia('2026-09-26', 0)])).toEqual(['26/09: relatório veio vazio (nenhuma impressão)'])
    expect(d([dia('2026-09-12', null)])).toEqual(['12/09: relatório ainda não baixado (não medido)'])
    expect(d([dia('2026-09-25', 5, 3)])).toEqual(['25/09: 5 impressões, 3 cliques estimados'])
  })
  it('"(não medido)" aparece uma vez só na dica (motivoDiaTexto já o traz) e o motivo de cada caso é dito', () => {
    for (const m of ['sem-relatorio', 'nao-baixado', 'erro', 'expirado'] as const) {
      const c = buildImpressoes([dia('2026-09-12', null, null, m)], periodo, O).colunas[0]!
      expect(c.dica).toBe(`12/09: ${motivoDiaTexto(m)}`)
      expect(c.dica.match(/não medido/g)).toHaveLength(1)
      expect(c.situacaoTexto).toMatch(/não medido/)
    }
    const textos = (['sem-relatorio', 'nao-baixado', 'erro', 'expirado'] as const).map(m => buildImpressoes([dia('2026-09-12', null, null, m)], periodo, O).colunas[0]!.situacaoTexto)
    expect(new Set(textos).size).toBe(4)
  })
  it('no vídeo, o zero medido diz "o relatório do dia não trouxe este vídeo"', () => {
    const c = buildImpressoes([dia('2026-09-26', 0)], periodo, { ...O, escopo: 'video', alturaArea: 110 }).colunas[0]!
    expect(c.dica).toBe('26/09: o relatório do dia não trouxe este vídeo (nenhuma impressão)')
    expect(c.situacaoTexto).toBe('relatório baixado, sem este vídeo')
  })
  it('situação por extenso na tabela: "com impressões", "relatório veio vazio", "ainda não baixado: não medido"', () => {
    expect(v.colunas.map(c => c.situacaoTexto)).toEqual(['com impressões', 'relatório veio vazio', 'ainda não baixado: não medido'])
  })
  it('cliques: arredonda só o que aparece; entre 0 e 0,5 diz "menos de 1", nunca "nenhum" nem "0"', () => {
    const c = buildImpressoes([dia('2026-10-01', 30, 0.3), dia('2026-10-02', 30, 2.6)], periodo, O).colunas
    expect(c[0]!.cliques).toBe('menos de 1')
    expect(c[0]!.dica).toBe('01/10: 30 impressões, menos de 1 clique estimado')
    expect(c[1]!.cliques).toBe('3')
  })
  it('dia com impressão e CTR nulo: impressões valem, cliques é null e a dica diz que não foram medidos (nunca "nenhum clique")', () => {
    const c = buildImpressoes([dia('2026-10-01', 9, null)], periodo, O).colunas[0]!
    expect(c.situacao).toBe('com-impressoes')
    expect(c.imp).toBe('9')
    expect(c.cliques).toBeNull()
    expect(c.dica).toBe('01/10: 9 impressões, cliques não medidos (o YouTube não devolveu a taxa de cliques)')
    expect(c.dica).not.toMatch(/nenhum clique/)
  })
  it('milhares ganham ponto, no servidor e no cliente igual', () => {
    const c = buildImpressoes([dia('2026-10-01', 1234, 56)], periodo, O).colunas[0]!
    expect(c.imp).toBe('1.234')
    expect(c.dica).toBe('01/10: 1.234 impressões, 56 cliques estimados')
  })
})

describe('eixo de datas e período', () => {
  it('poucas marcas legíveis: a primeira, a última e a cada 7 dias (sem colar na última)', () => {
    const dias = montarDias(alcanceCheio('c', ['a', 'b'], HOJE)).dias
    const v = buildImpressoes(dias, periodo, O)
    const marcadas = v.colunas.map((c, i) => (c.marca ? i : -1)).filter(i => i >= 0)
    expect(v.colunas).toHaveLength(21)
    expect(marcadas).toEqual([0, 7, 14, 20])
    expect(v.colunas[0]!.rotulo).toBe(dm(dias[0]!.dia))
  })
  it('períodos curtos marcam a primeira e a última (uma só com 1 dia)', () => {
    expect(buildImpressoes([dia('2026-10-01', 3)], periodo, O).colunas.map(c => c.marca)).toEqual([true])
    expect(buildImpressoes([dia('2026-10-01', 3), dia('2026-10-02', 3), dia('2026-10-03', 3)], periodo, O).colunas.map(c => c.marca)).toEqual([true, false, true])
  })
  it('o período é escrito com as duas datas e o número de dias, e diz que o dia é o do YouTube', () => {
    const v = buildImpressoes(montarDias(alcanceCheio('c', ['a'], HOJE)).dias, { de: '2026-09-12', ate: '2026-10-02', dias: 21 }, O)
    expect(v.periodoTexto).toBe('de 12/09 a 02/10 · 21 dias · dia do YouTube')
    expect(buildImpressoes([dia('2026-10-01', 3)], { de: '2026-10-01', ate: '2026-10-01', dias: 1 }, O).periodoTexto).toBe('de 01/10 a 01/10 · 1 dia · dia do YouTube')
  })
})

describe('a frase-resumo (acima do gráfico)', () => {
  it('série cheia: impressões, cliques estimados e a contagem dos três estados, com o número de dias do período', () => {
    const { dias, periodo: p } = montarDias(alcanceCheio('c', ['a', 'b'], HOJE))
    const v = buildImpressoes(dias, p, O)
    expect(v.resumo).toBe('187 impressões e 24 cliques estimados em 21 dias: 11 dias com impressão, 8 dias medidos em zero e 2 dias não medidos.')
  })
  it('um dia só: singular em tudo', () => {
    const v = buildImpressoes([dia('2026-10-01', 1, 1)], { de: '2026-10-01', ate: '2026-10-01', dias: 1 }, O)
    expect(v.resumo).toBe('1 impressão e 1 clique estimado em 1 dia: 1 dia com impressão, 0 dias medidos em zero e 0 dias não medidos.')
  })
  it('nenhum dia lido: não diz "0 impressões"; diz que nada foi medido', () => {
    const { dias, periodo: p } = montarDias(alcanceNadaLido('c', HOJE))
    const v = buildImpressoes(dias, p, O)
    expect(v.resumo).toBe('Nenhum dos 3 dias do período tem relatório lido: impressões e cliques não medidos.')
    expect(v.resumo).not.toMatch(/\b0 impress/)
    expect(v.colunas.every(c => c.situacao === 'nao-medido' && c.imp === null)).toBe(true)
  })
  it('todos os dias lidos em zero: "Nenhuma impressão", zero medido dito como zero', () => {
    const { dias, periodo: p } = montarDias(alcanceSoVazios('c', HOJE, 10))
    const v = buildImpressoes(dias, p, O)
    expect(v.resumo).toBe('Nenhuma impressão em 10 dias: 0 dias com impressão, 10 dias medidos em zero e 0 dias não medidos.')
  })
  it('cliques de algum dia sem CTR: o resumo diz que os cliques não foram medidos em algum dia (nunca soma parcial)', () => {
    const v = buildImpressoes([dia('2026-10-01', 9, null), dia('2026-10-02', 4, 1)], periodo, O)
    expect(v.resumo).toBe('13 impressões em 2 dias, com cliques estimados não medidos em algum dia: 2 dias com impressão, 0 dias medidos em zero e 0 dias não medidos.')
  })
})

describe('estados da série, cada um com o seu aviso', () => {
  it('sem período (nenhum relatório): nenhuma coluna e vazio = "Ainda não há relatório de alcance deste canal."', () => {
    const { dias, periodo: p } = montarDias(alcanceVazio('c'))
    const v = buildImpressoes(dias, p, O)
    expect(p).toBeNull()
    expect(v.colunas).toEqual([])
    expect(v.vazio).toBe('Ainda não há relatório de alcance deste canal.')
    expect(v.resumo).toBeNull()
    expect(v.periodoTexto).toBe('')
    expect(v.avisos).toEqual([])
  })
  it('acesso negado: nenhuma coluna e vazio = "Só quem edita o site vê as impressões."; nenhum número escapa mesmo com dias na mão', () => {
    const v = buildImpressoes([dia('2026-10-01', 71, 5)], periodo, { ...O, acesso: 'negado' })
    expect(v.colunas).toEqual([])
    expect(v.vazio).toBe('Só quem edita o site vê as impressões.')
    expect(v.resumo).toBeNull()
    expect(v.periodoTexto).toBe('')
    expect(JSON.stringify(v)).not.toContain('71')
  })
  it('período com dias mas lista de dias vazia (dado inconsistente): trata como sem relatório, não desenha nada', () => {
    const v = buildImpressoes([], periodo, O)
    expect(v.colunas).toEqual([])
    expect(v.vazio).toBe('Ainda não há relatório de alcance deste canal.')
  })
  it('série de 1 dia: uma coluna, aviso de poucos dias medidos', () => {
    const v = buildImpressoes([dia('2026-10-01', 3, 1)], { de: '2026-10-01', ate: '2026-10-01', dias: 1 }, O)
    expect(v.vazio).toBeNull()
    expect(v.colunas).toHaveLength(1)
    expect(v.avisos).toContain('Menos de 7 dias medidos (1): ainda é pouco para ver um padrão.')
  })
  it('série curta (2 dias de coleta): aviso com o número de dias medidos', () => {
    const { dias, periodo: p } = montarDias(alcanceCurto('c', ['a'], HOJE))
    const v = buildImpressoes(dias, p, O)
    expect(v.colunas).toHaveLength(2)
    expect(v.avisos).toEqual(['Menos de 7 dias medidos (2): ainda é pouco para ver um padrão.'])
  })
  it('série com buracos: o aviso diz que o dia não medido não é zero, e a contagem de lidos não inclui os buracos', () => {
    const { dias, periodo: p } = montarDias(alcanceCheio('c', ['a', 'b'], HOJE))
    const v = buildImpressoes(dias, p, O)
    expect(v.avisos).toContain('Dias não medidos não contam como zero nem entram nas somas.')
    expect(v.avisos.some(a => a.startsWith('Menos de 7'))).toBe(false)
    expect(v.colunas.filter(c => c.situacao === 'nao-medido')).toHaveLength(2)
  })
  it('sem buracos não há o aviso de buracos', () => {
    const { dias, periodo: p } = montarDias(alcanceSoVazios('c', HOJE, 10))
    expect(buildImpressoes(dias, p, O).avisos.some(a => a.includes('não contam como zero'))).toBe(false)
  })
  it('coleta parada: com `hoje` a mais de 7 dias do último relatório, "parou em dd/mm"; até 7 dias não avisa', () => {
    const { dias, periodo: p } = montarDias(alcanceCheio('c', ['a', 'b'], HOJE))
    const ate = p!.ate
    const parada = buildImpressoes(dias, p, { ...O, hoje: addDays(ate, 8) })
    expect(parada.avisos).toContain(`A coleta de relatórios deste canal parou em ${dm(ate)}.`)
    expect(buildImpressoes(dias, p, { ...O, hoje: addDays(ate, 7) }).avisos.some(a => a.includes('parou'))).toBe(false)
    expect(buildImpressoes(dias, p, O).avisos.some(a => a.includes('parou'))).toBe(false)
  })
})

describe('legenda e método', () => {
  it('a legenda tem os três estados e os cliques, cada um com texto', () => {
    const v = buildImpressoes([dia('2026-10-01', 3, 1)], periodo, O)
    expect(v.legenda.map(l => l.situacao)).toEqual(['com-impressoes', 'cliques', 'zero-medido', 'nao-medido'])
    expect(v.legenda.map(l => l.texto)).toEqual([
      'impressões do dia', 'cliques estimados', 'zero medido: relatório vazio', 'não medido: relatório ausente, não baixado, com erro ou expirado',
    ])
  })
  it('no vídeo, o zero medido da legenda fala do vídeo', () => {
    const v = buildImpressoes([dia('2026-10-01', 3, 1)], periodo, { ...O, escopo: 'video', alturaArea: 110 })
    expect(v.legenda.find(l => l.situacao === 'zero-medido')!.texto).toBe('zero medido: relatório sem impressão deste vídeo')
  })
  it('o método (ⓘ) explica o dia, a escala, os três estados e os cliques; no vídeo, o zero do vídeo', () => {
    const canal = buildImpressoes([dia('2026-10-01', 3, 1)], periodo, O).metodo.join(' ')
    expect(canal).toMatch(/Pacífico/)
    expect(canal).toMatch(/linear/)
    expect(canal).toMatch(/não contam como zero|não conta como zero/)
    expect(canal).toMatch(/impressões × taxa de cliques/)
    expect(canal).toMatch(/pode diferir da soma/)
    const video = buildImpressoes([dia('2026-10-01', 3, 1)], periodo, { ...O, escopo: 'video' }).metodo.join(' ')
    expect(video).toMatch(/não trouxe este vídeo/)
  })
})

describe('palavras internas e nulo', () => {
  it('nenhum texto de tela traz palavra interna (L2, L3, lote, pack, dataset, motor, day_pt, Reporting, Analytics API)', () => {
    const casos = [
      buildImpressoes(montarDias(alcanceCheio('c', ['a', 'b'], HOJE)).dias, periodo, { ...O, hoje: '2026-12-01' }),
      buildImpressoes(montarDias(alcanceNadaLido('c', HOJE)).dias, periodo, { ...O, escopo: 'video' }),
      buildImpressoes([], null, O),
      buildImpressoes([], null, { ...O, acesso: 'negado' }),
    ]
    for (const v of casos) {
      const tudo = JSON.stringify(v)
      expect(tudo).not.toMatch(/\bL2\b|\bL3\b|\blote\b|\bpack\b|pacote|dataset|\bmotor\b|day_pt|Reporting|Analytics API|escala √/i)
    }
  })
  it('a view é só dado simples (serializável para o cliente)', () => {
    const v = buildImpressoes(montarDias(alcanceCheio('c', ['a', 'b'], HOJE)).dias, periodo, O)
    expect(JSON.parse(JSON.stringify(v))).toEqual(v)
  })
})
