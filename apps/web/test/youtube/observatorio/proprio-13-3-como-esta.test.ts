// @vitest-environment node
// A4 Tarefa 13.3: "Como o canal está" no estado dos mockups 1, 2 e 5 (12/10): o bloco "Taxa de clique do canal" (valor, "X de Y", intervalo, faixa, nota e o ⓘ),
// o gráfico "Views por dia, soma dos vídeos" (28 dias, do diário) e "O que ainda não é medido" com só a curva de retenção e a origem do tráfego.
// Dado ausente afirma o valor nulo E a frase. Quem só lê o site não recebe nenhum número privado.
import { afterEach, describe, it, expect } from 'vitest'
import { proprioWorld, alcanceCheio, alcanceVazio, alcanceNadaLido, CHEIO } from './proprio-fixture'
import { comDiario, diarioComPct } from './proprio-assistido-fixture'
import { buildProprioHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { montarComoEsta, type ComoEstaView } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { concorrentesDoSite, posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { METODO_TAXA_CANAL } from '@/app/cms/(authed)/youtube/competitors/_proprio/taxa-faixa-model'
import { SEM_PERMISSAO_VIEWS, ERRO_VIEWS, SEM_VIEWS } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))
const w = proprioWorld()
const { posicao } = posicaoDoSite(w.obs, w.canalId)
const header = buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao, muitosProprios: false })!
const videos = w.obs.videos.filter(x => x.ch === w.canalId).map(x => ({ id: x.id, ytId: x.ytId, title: x.title, thumb: null }))
const monta = (dados: DadosDoCanal = w.dados) => montarComoEsta({ dados, hoje: w.hoje, dm: w.dm, posicao, posicaoItens: header.posicaoItens, videos, concorrentes: concorrentesDoSite(w.obs, w.canalId), canalId: w.canalId })
const texto = (t: NonNullable<ComoEstaView['taxa']['frase']>): string => t.map(x => x.t).join('')

describe('13.3 bloco "Taxa de clique do canal"', () => {
  it('série cheia: o valor, "X de Y", o intervalo de 95% e o aviso de faixa larga (mais de 5 pontos)', () => {
    const { view } = monta()
    const t = view.taxa
    expect(t.titulo).toBe('Taxa de clique do canal')
    expect(t.vazio).toBeNull()
    expect(texto(t.frase!)).toMatch(/^\d+,\d% das impressões viraram clique \(24 de 187\)\. Com este volume, a taxa real fica entre \d+,\d% e \d+,\d%\. Ainda não dá para dizer se é alta ou baixa\.$/)
    // o valor e os dois limites vão em negrito
    expect(t.frase!.filter(x => x.b).map(x => x.t)).toHaveLength(3)
    expect(t.faixa).not.toBeNull()
    expect(t.faixa!.linhas).toHaveLength(1)
    expect(t.faixa!.linhas[0]!.rotulo).toBeNull()
    expect(t.faixa!.alt).toMatch(/^Taxa de clique do canal: \d+,\d%, intervalo de 95% de \d+,\d% a \d+,\d%$/)
    expect(t.nota).toBe('Compare com os seus próprios vídeos e períodos, não com outros canais: o YouTube só entrega a taxa de clique ao dono do canal.')
    expect(METODO_TAXA_CANAL).toHaveLength(2)
    expect(METODO_TAXA_CANAL[0]).toContain('Cliques estimados ÷ impressões')
    expect('metodo' in t).toBe(false)   // o texto do ⓘ é estático: não viaja na view
  })

  it('volume grande: faixa estreita, sem o aviso de "não dá para dizer"', () => {
    const base = alcanceCheio(w.canalId, w.ytIds, w.hoje)
    const linhas = base.linhas.map(l => ({ ...l, imp: (l.imp ?? 0) * 400 }))
    const { view } = monta({ ...w.dados, alcance: { acesso: 'ok', dado: { ...base, linhas } } })
    expect(texto(view.taxa.frase!)).not.toContain('Ainda não dá para dizer')
    expect(view.taxa.faixa!.linhas[0]!.inconclusiva).toBe(false)
  })

  it.each([
    ['negado', { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } } as DadosDoCanal, 'Só quem edita o site vê a taxa de clique.'],
    ['erro', { alcance: { acesso: 'erro' }, diario: { acesso: 'erro' } } as DadosDoCanal, 'A leitura do alcance falhou agora; recarregue a página.'],
  ])('%s: sem frase de número, sem faixa, com a frase do motivo', (_n, dados, vazio) => {
    const { view } = monta(dados)
    expect(view.taxa).toMatchObject({ frase: null, faixa: null, vazio, nota: null })
  })

  it('sem relatório e nenhum dia lido: nula, com a frase de cada um (nunca 0%)', () => {
    expect(monta({ ...w.dados, alcance: { acesso: 'ok', dado: alcanceVazio(w.canalId) } }).view.taxa).toMatchObject({ frase: null, faixa: null, vazio: 'Sem relatório de alcance não há como calcular a taxa.' })
    expect(monta({ ...w.dados, alcance: { acesso: 'ok', dado: alcanceNadaLido(w.canalId, w.hoje) } }).view.taxa).toMatchObject({ frase: null, faixa: null, vazio: 'Nenhum dia do período foi medido ainda, então não há taxa.' })
  })

  it('zero impressão nos dias lidos: não há taxa; algum dia sem CTR: a taxa não é calculada', () => {
    const base = alcanceCheio(w.canalId, w.ytIds, w.hoje)
    expect(monta({ ...w.dados, alcance: { acesso: 'ok', dado: { ...base, linhas: [] } } }).view.taxa).toMatchObject({ frase: null, vazio: 'Nenhuma impressão nos dias medidos, então não há taxa.' })
    const semCtr = { ...base, linhas: base.linhas.map((l, i) => (i === 0 ? { ...l, ctr: null } : l)) }
    expect(monta({ ...w.dados, alcance: { acesso: 'ok', dado: semCtr } }).view.taxa).toMatchObject({ frase: null, faixa: null, vazio: 'Não dá para calcular a taxa: o YouTube não informou a taxa de clique de pelo menos um dia com impressões.' })
  })

  it('usuário só de leitura: a view do bloco não leva nenhum dígito (sentinelas)', () => {
    const { view } = monta({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    expect(JSON.stringify(view.taxa)).not.toMatch(/\d/)
    expect(CHEIO.imp).toBe(187)
  })
})

describe('13.3 gráfico "Views por dia, soma dos vídeos"', () => {
  it('cheio: 28 dias de views, sem faixa de cliques, que terminam no último dia medido', () => {
    const { graficoViews: g } = monta()
    expect(g.unidade).toBe('views')
    expect(g.faixaCliques).toBe(false)
    expect(g.colunas).toHaveLength(28)
    expect(g.escopo).toBe('canal')
    expect(g.vazio).toBeNull()
    // o diário cheio dá 2, 4, 6… views por dia a cada longo acompanhado: a soma do dia é conferível à mão
    const soma = w.ytIds.reduce((s, _y, j) => s + (j + 1) * 2, 0)
    expect(g.colunas[27]!.imp).toBe(String(soma).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
    expect(g.colunas[27]!.situacao).toBe('com-impressoes')
  })
  it('a coluna do dia sem linha em nenhum vídeo é NÃO medida, nunca zero', () => {
    const d = diarioComPct(w.canalId, w.ytIds, w.hoje, [{ dias: 5, views: 3, pct: null }])
    const { graficoViews: g } = monta(comDiario(w.dados, d))
    expect(g.colunas[27]!.situacao).toBe('com-impressoes')
    expect(g.colunas[0]!.situacao).toBe('nao-medido')
    expect(g.colunas[0]!.imp).toBeNull()
  })
  it('sem permissão, com erro e com o diário vazio: a frase de cada um e nenhuma coluna', () => {
    expect(monta({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }).graficoViews).toMatchObject({ vazio: SEM_PERMISSAO_VIEWS, colunas: [] })
    expect(monta({ alcance: { acesso: 'erro' }, diario: { acesso: 'erro' } }).graficoViews).toMatchObject({ vazio: ERRO_VIEWS, colunas: [] })
    expect(monta({ ...w.dados, diario: { acesso: 'ok', dado: { canalId: w.canalId, ultimoDia: null, linhas: [], descartados: 0 } } }).graficoViews).toMatchObject({ vazio: SEM_VIEWS, colunas: [] })
  })
})

describe('13.3 "O que ainda não é medido"', () => {
  it('só a curva de retenção e a origem do tráfego (some a frase "o desenho delas nesta tela ainda não existe")', () => {
    const { view } = monta()
    expect(view.naoMedido).toEqual([
      { rotulo: 'Curva de retenção', texto: 'ainda não é coletada.' },
      { rotulo: 'Origem do tráfego', texto: 'ainda não aparece aqui.' },
    ])
    expect(JSON.stringify(view.naoMedido)).not.toContain('desenho delas')
  })
})
