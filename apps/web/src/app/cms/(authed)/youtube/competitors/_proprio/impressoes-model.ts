/**
 * Modelo do gráfico "Impressões por dia" (spec 16.6 e 17.4): um só para o canal e para o vídeo próprio. Puro: recebe os dias JÁ montados
 * (`montarDias`, `lib/.../proprio/dias.ts`) e devolve o que o componente desenha e diz; não lê banco, não pede a prova de edição e não
 * importa os leitores (uma varredura de teste barra).
 *
 * Regra de ouro (este sistema falha em VERDE): os três estados nunca se confundem. Dia com impressões é barra; ZERO MEDIDO (o relatório do
 * dia foi lido e não trouxe impressão) é uma caixa vazada com o texto "0"; NÃO MEDIDO (sem relatório, não baixado, com erro, expirado) é a
 * coluna inteira hachurada, sem número, com o motivo na dica. O não medido nunca é altura zero, nunca entra numa soma e nunca é "0".
 * Cliques são estimados (impressões × CTR) e só arredondam na hora de escrever.
 *
 * O mesmo modelo desenha "Views por dia" (`unidade: 'views'`, A4 13.2): os dias chegam no mesmo formato (`DiaAlcance`, com o valor do dia em `imp` e
 * `cliques` nulo), sem a faixa de cliques e com legendas, dicas e método próprios (ninguém viu × o YouTube não entregou o dia). Nenhum texto de
 * views fala de relatório, de impressão ou de clique.
 */
import { diffDias } from '@/lib/youtube/coleta/day-pt'
import { motivoDiaTexto, resumir, type DiaAlcance, type MotivoDia, type Periodo, type ResumoAlcance, type Situacao } from '@/lib/youtube/observatorio/proprio/dias'
import { DIARIO_PARADO_DIAS } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'

export interface ColunaView {
  dia: DiaYt
  /** "dd/mm" */
  rotulo: string
  situacao: Situacao
  /** Altura da coluna na área do gráfico: a barra cheia (mínimo 3 px), a caixa vazada do zero medido (6 px) ou a área inteira (não medido). */
  alturaPx: number
  /** O texto do número em cima da barra e na tabela; null = não medido. */
  imp: string | null
  /** Cliques estimados do dia; null = não medido (dia não medido OU dia com impressão sem CTR). "menos de 1" quando o valor é maior que 0 e arredonda a 0. */
  cliques: string | null
  /** O que aparece na faixa dos cliques, sob as datas: "1.139", "<1"; null = nada (sem clique, ou não medido). Sempre null em views. */
  cliquesFaixa: string | null
  /** A frase do dia (dica, fala do leitor de tela). */
  dica: string
  /** A situação por extenso, para a tabela. */
  situacaoTexto: string
  /** Esta coluna leva rótulo de data no eixo. */
  marca: boolean
  /** O vídeo foi publicado neste dia (linha tracejada e item da legenda). */
  publicacao: boolean
}

export interface LegendaItem { situacao: Situacao | 'cliques' | 'publicacao'; texto: string }

export interface ImpressoesView {
  teto: number
  ticks: number[]
  colunas: ColunaView[]
  /** "de dd/mm a dd/mm · N dias · dia do YouTube" (a única vez que a tela diz "dia do YouTube"); vazio quando não há período. */
  periodoTexto: string
  /** A frase quando não há o que desenhar (sem relatório, sem permissão). */
  vazio: string | null
  legenda: LegendaItem[]
  /** A frase-resumo acima do gráfico; null quando não há o que resumir. */
  resumo: string | null
  /** Avisos curtos: poucos dias, dias não medidos, coleta parada. */
  avisos: string[]
  /** O método, em parágrafos, para o ⓘ. */
  metodo: string[]
  escopo: 'canal' | 'video'
  alturaArea: number
  /** O que as colunas contam. */
  unidade: Unidade
  /** O gráfico leva a faixa própria dos cliques (só em impressões). */
  faixaCliques: boolean
  /** Anotação do eixo vertical ("impressões", "views"), cabeçalho da coluna de valor da tabela e da coluna de situação. */
  rotuloEixo: string
  rotuloValor: string
  rotuloSituacao: string
}

export type Unidade = 'impressoes' | 'views'

export interface OpcoesImpressoes {
  escopo: 'canal' | 'video'
  alturaArea: number
  /** O que as colunas contam; padrão `impressoes`. `views` não tem faixa de cliques (A4 13.2). */
  unidade?: Unidade
  /** O dia em que o vídeo foi publicado: ganha a linha tracejada se cair dentro do período. */
  publicadoEm?: DiaYt | null
  /** A frase-resumo trazida por quem chama (a tela do vídeo e a do canal escrevem a sua); `undefined` = a do modelo, `null` = nenhuma. */
  resumo?: string | null
  dm: (d: DiaYt) => string
  /** 'erro' = a leitura falhou: a frase diz que falhou, nunca "sem relatório" (falha em verde). */
  acesso: 'ok' | 'negado' | 'erro'
  /**
   * O dia de hoje (dia do YouTube), para dizer que a coleta parou. OBRIGATÓRIO: opcional, quem esquecesse perdia o aviso em silêncio (falha em verde);
   * a prova de tipo está em impressoes.type-test.ts.
   */
  hoje: DiaYt
}

export const SEM_RELATORIO = 'Ainda não há relatório de alcance deste canal.'
export const SEM_PERMISSAO = 'Só quem edita o site vê as impressões.'
export const ERRO_ALCANCE = 'A leitura do alcance falhou agora; recarregue a página.'
export const SEM_VIEWS = 'Ainda não há dia medido de views.'
export const SEM_PERMISSAO_VIEWS = 'Só quem edita o site vê as views.'
export const ERRO_VIEWS = 'A leitura das views falhou agora; recarregue a página.'
/** Menos dias medidos que isto = "ainda é pouco para ver um padrão". */
export const DIAS_PARA_PADRAO = 7
const BARRA_MINIMA_PX = 3
/** A caixa vazada do zero medido: mais alta que a barra mínima (3 px), para as duas nunca terem o mesmo tamanho nem dependerem de rótulo ou de cor. */
export const ZERO_PX = 6

/** 4, 10 ou múltiplo de 20 (spec 16.6). Nunca 0, para a escala nunca dividir por zero. */
export function tetoDoEixo(max: number): number {
  if (!(max > 0)) return 4
  return max <= 4 ? 4 : max <= 10 ? 10 : Math.ceil(max / 20) * 20
}

/** A largura de um dígito em 12 px mono: os rótulos de valor do gráfico não podem se atropelar. */
export const PX_POR_CARACTERE = 7.4

/**
 * Quais colunas levam o rótulo de valor (número em cima da barra, número dos cliques). Sem prioridade: da esquerda para a direita, só as que não esbarram
 * na anterior nem passam da borda direita. Com `prioridade` (o índice do MAIOR valor da série): essa coluna é reservada primeiro, se couber dentro do
 * desenho, e os demais entram da esquerda para a direita enquanto couberem sem sobrepor nenhum rótulo já escolhido (à esquerda ou à direita dela).
 */
export function quaisCabem(xs: readonly number[], textos: ReadonlyArray<string | null>, limite: number, prioridade: number | null = null): boolean[] {
  const largura = (i: number): number => (textos[i] ?? '').length * PX_POR_CARACTERE
  const escolhidas: number[] = []
  const livre = (i: number): boolean => escolhidas.every(j => xs[i]! + largura(i) / 2 + 3 <= xs[j]! - largura(j) / 2 || xs[i]! - largura(i) / 2 >= xs[j]! + largura(j) / 2 + 3)
  const naBorda = (i: number): boolean => xs[i]! + largura(i) / 2 > limite
  const resultado = xs.map(() => false)
  if (prioridade != null && prioridade >= 0 && prioridade < xs.length && textos[prioridade] != null && !naBorda(prioridade)) {
    escolhidas.push(prioridade)
    resultado[prioridade] = true
  }
  for (let i = 0; i < xs.length; i++) {
    if (resultado[i] || textos[i] == null || naBorda(i) || !livre(i)) continue
    escolhidas.push(i)
    resultado[i] = true
  }
  return resultado
}

/** O índice do MAIOR valor numa série de rótulos ("1.139", "<1", null). Empate fica com o primeiro; sem nenhum valor positivo, null. */
export function indiceDoMaior(textos: ReadonlyArray<string | null>): number | null {
  let melhor: number | null = null, maior = 0
  textos.forEach((t, i) => {
    const n = t == null ? 0 : Number(t.replace(/\./g, ''))
    if (Number.isFinite(n) && n > maior) { maior = n; melhor = i }
  })
  return melhor
}

/** Inteiro com ponto de milhar, igual no servidor e no cliente (sem Intl). */
export function int(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const plural = (n: number, um: string, muitos: string): string => `${int(n)} ${n === 1 ? um : muitos}`

/** "1 clique estimado", "nenhum clique", "menos de 1 clique estimado"; null = cliques não medidos. */
function cliquesFrase(c: number | null): string {
  if (c == null) return 'cliques não medidos (o YouTube não devolveu a taxa de cliques)'
  if (c <= 0) return 'nenhum clique'
  if (Math.round(c) === 0) return 'menos de 1 clique estimado'
  return plural(Math.round(c), 'clique estimado', 'cliques estimados')
}

/** O número de cliques como aparece na tabela: "0", "menos de 1" ou o inteiro. */
function cliquesTextoDia(c: number): string {
  if (c <= 0) return '0'
  if (Math.round(c) === 0) return 'menos de 1'
  return int(c)
}

function situacaoTexto(d: DiaAlcance, escopo: 'canal' | 'video', unidade: Unidade): string {
  if (unidade === 'views') return d.situacao === 'com-impressoes' ? 'com views' : d.situacao === 'zero-medido' ? 'zero medido: ninguém viu' : NAO_ENTREGUE + ': não medido'
  switch (d.situacao) {
    case 'com-impressoes':
      return 'com impressões'
    case 'zero-medido':
      return escopo === 'video' ? 'relatório baixado, sem este vídeo' : 'relatório veio vazio'
    case 'nao-medido':
      return naoMedidoTexto(d.motivo)
    default: {
      const _nunca: never = d.situacao
      return _nunca
    }
  }
}

const NAO_ENTREGUE = 'o YouTube não entregou o dia'

function naoMedidoTexto(m: MotivoDia | null): string {
  switch (m) {
    case 'nao-baixado':
    case null:
      return 'ainda não baixado: não medido'
    case 'sem-relatorio':
      return 'sem relatório: não medido'
    case 'erro':
      return 'relatório com erro: não medido'
    case 'expirado':
      return 'relatório expirado sem baixar: não medido'
    default: {
      const _nunca: never = m
      return _nunca
    }
  }
}

function dicaDoDia(d: DiaAlcance, rotulo: string, escopo: 'canal' | 'video', unidade: Unidade): string {
  if (unidade === 'views') {
    if (d.situacao === 'com-impressoes') return `${rotulo}: ${plural(d.imp ?? 0, 'view', 'views')}`
    if (d.situacao === 'zero-medido') return escopo === 'video' ? `${rotulo}: ninguém viu neste dia (nenhuma view)` : `${rotulo}: o YouTube registrou nenhuma view`
    return `${rotulo}: ${NAO_ENTREGUE} (não medido)`
  }
  switch (d.situacao) {
    case 'com-impressoes':
      return `${rotulo}: ${plural(d.imp ?? 0, 'impressão', 'impressões')}, ${cliquesFrase(d.cliques)}`
    case 'zero-medido':
      return `${rotulo}: ${escopo === 'video' ? 'o relatório do dia não trouxe este vídeo' : 'relatório veio vazio'} (nenhuma impressão)`
    case 'nao-medido':
      return `${rotulo}: ${motivoDiaTexto(d.motivo ?? 'nao-baixado')}`
    default: {
      const _nunca: never = d.situacao
      return _nunca
    }
  }
}

function colunaDe(d: DiaAlcance, i: number, n: number, teto: number, o: OpcoesImpressoes): ColunaView {
  const rotulo = o.dm(d.dia)
  const marca = i === 0 || i === n - 1 || (i % 7 === 0 && i < n - 5)
  const unidade = o.unidade ?? 'impressoes'
  const publicacao = o.publicadoEm != null && o.publicadoEm === d.dia
  const dica = dicaDoDia(d, rotulo, o.escopo, unidade) + (publicacao ? '. Dia da publicação do vídeo' : '')
  const comum = { dia: d.dia, rotulo, situacao: d.situacao, dica, situacaoTexto: situacaoTexto(d, o.escopo, unidade), marca, publicacao }
  switch (d.situacao) {
    case 'com-impressoes': {
      const imp = d.imp ?? 0
      const cliques = d.cliques
      // views não têm cliques: nunca "0", nunca "não medido" de clique; a coluna só não tem a faixa
      if (unidade === 'views') return { ...comum, alturaPx: Math.max(BARRA_MINIMA_PX, imp * o.alturaArea / teto), imp: int(imp), cliques: null, cliquesFaixa: null }
      return {
        ...comum,
        alturaPx: Math.max(BARRA_MINIMA_PX, imp * o.alturaArea / teto),
        imp: int(imp),
        cliques: cliques == null ? null : cliquesTextoDia(cliques),
        cliquesFaixa: cliques == null || cliques <= 0 ? null : Math.round(cliques) === 0 ? '<1' : int(cliques),
      }
    }
    case 'zero-medido':
      return { ...comum, alturaPx: ZERO_PX, imp: '0', cliques: unidade === 'views' ? null : '0', cliquesFaixa: null }
    case 'nao-medido':
      // não medido NÃO é barra de altura zero: a coluna ocupa a área inteira, hachurada
      return { ...comum, alturaPx: o.alturaArea, imp: null, cliques: null, cliquesFaixa: null }
    default: {
      const _nunca: never = d.situacao
      return _nunca
    }
  }
}

function resumoTexto(r: ResumoAlcance, total: number): string {
  if (r.diasLidos === 0 || r.imp == null) {
    return total === 1
      ? 'O dia do período não tem relatório lido: impressões e cliques não medidos.'
      : `Nenhum dos ${int(total)} dias do período tem relatório lido: impressões e cliques não medidos.`
  }
  // a frase só fala dos dias MEDIDOS: o dia sem relatório não entra na soma e a manchete não finge que entrou (nem que não houve impressão nele)
  const buracos = r.diasNaoMedidos > 0
  const zero = r.diasLidos - r.diasComImpressao
  const comImp = plural(r.diasComImpressao, 'dia com impressão', 'dias com impressão')
  const emZero = plural(zero, 'dia medido em zero', 'dias medidos em zero')
  const partes = buracos ? `${comImp} e ${emZero}` : `${comImp}, ${emZero} e ${plural(0, 'dia não medido', 'dias não medidos')}`
  const sem = buracos ? ` (${int(r.diasNaoMedidos)} sem relatório lido)` : ''
  const dias = buracos ? plural(r.diasLidos, 'dia medido', 'dias medidos') : plural(total, 'dia', 'dias')
  if (r.imp === 0) {
    // um único dia medido: "em 1 dia medido" (nunca "no 1 dia medido"); vários: "nos N dias medidos"
    const onde = buracos && r.diasLidos !== 1 ? `nos ${dias}` : `em ${dias}`
    return `Nenhuma impressão ${onde}${sem}: ${partes}.`
  }
  const imp = plural(r.imp, 'impressão', 'impressões')
  if (r.cliques == null) return `${imp} em ${dias}${sem}, com cliques estimados não medidos em algum dia: ${partes}.`
  const cliques = r.cliques <= 0 ? 'nenhum clique estimado' : Math.round(r.cliques) === 0 ? 'menos de 1 clique estimado' : plural(Math.round(r.cliques), 'clique estimado', 'cliques estimados')
  return `${imp} e ${cliques} em ${dias}${sem}: ${partes}.`
}

function resumoViews(r: ResumoAlcance, total: number): string {
  if (r.diasLidos === 0 || r.imp == null) {
    return total === 1 ? 'O dia do período não foi medido: views não medidas.' : `Nenhum dos ${int(total)} dias do período foi medido: views não medidas.`
  }
  const buracos = r.diasNaoMedidos > 0
  const zero = r.diasLidos - r.diasComImpressao
  const comView = plural(r.diasComImpressao, 'dia com view', 'dias com view')
  const emZero = plural(zero, 'dia medido em zero', 'dias medidos em zero')
  const nm = plural(r.diasNaoMedidos, 'dia não medido', 'dias não medidos')
  const partes = buracos ? `${comView} e ${emZero}` : `${comView}, ${emZero} e ${plural(0, 'dia não medido', 'dias não medidos')}`
  const sem = buracos ? ` (${nm})` : ''
  const dias = buracos ? plural(r.diasLidos, 'dia medido', 'dias medidos') : plural(total, 'dia', 'dias')
  if (r.imp === 0) return `Nenhuma view ${buracos && r.diasLidos !== 1 ? 'nos' : 'em'} ${dias}${sem}: ${partes}.`
  return `${plural(r.imp, 'view', 'views')} em ${dias}${sem}: ${partes}.`
}

function legendaDe(escopo: 'canal' | 'video', unidade: Unidade): LegendaItem[] {
  if (unidade === 'views') {
    return [
      { situacao: 'com-impressoes', texto: 'views do dia (barra cheia)' },
      { situacao: 'zero-medido', texto: escopo === 'video' ? 'zero medido (caixa vazada): ninguém viu neste dia' : 'zero medido (caixa vazada): o YouTube registrou nenhuma view' },
      { situacao: 'nao-medido', texto: `não medido (hachura): ${NAO_ENTREGUE}` },
    ]
  }
  return [
    { situacao: 'com-impressoes', texto: 'impressões do dia (barra cheia)' },
    { situacao: 'cliques', texto: 'cliques estimados do dia' },
    { situacao: 'zero-medido', texto: escopo === 'video' ? 'zero medido (caixa vazada): relatório sem impressão deste vídeo' : 'zero medido (caixa vazada): relatório vazio' },
    { situacao: 'nao-medido', texto: 'não medido (hachura): relatório ausente, não baixado, com erro ou expirado' },
  ]
}

function metodoDe(escopo: 'canal' | 'video', unidade: Unidade): string[] {
  if (unidade === 'views') {
    return [
      'Cada coluna é um dia fechado pelo YouTube no horário do Pacífico, não em São Paulo.',
      'A escala é linear, de 0 até o teto do eixo (4, 10 ou um múltiplo de 20). Uma barra de 1 view tem no mínimo 3 px, para não sumir ao lado de um dia grande.',
      'Barra cheia: o YouTube entregou o dia com views. Caixa vazada: o YouTube entregou o dia e ninguém viu (zero medido). Coluna hachurada: o YouTube não entregou o dia (não medido); não conta como zero nem entra em soma.',
      'Use os botões Dia anterior e Dia seguinte, as setas do teclado ou a tabela para ler um dia de cada vez.',
    ]
  }
  return [
    'Cada coluna é um dia fechado pelo YouTube no horário do Pacífico, não em São Paulo.',
    'A escala é linear, de 0 até o teto do eixo (4, 10 ou um múltiplo de 20). Uma barra de 1 impressão tem no mínimo 3 px, para não sumir ao lado de um dia grande.',
    escopo === 'video'
      ? 'Barra cheia: o relatório do dia trouxe impressões deste vídeo. Caixa vazada: o relatório foi lido e não trouxe este vídeo (zero medido). Coluna hachurada: o dia não foi medido (relatório ausente, ainda não baixado, com erro ou expirado) e não conta como zero nem entra em soma.'
      : 'Barra cheia: o relatório do dia trouxe impressões. Caixa vazada: o relatório foi lido e veio vazio (zero medido). Coluna hachurada: o dia não foi medido (relatório ausente, ainda não baixado, com erro ou expirado) e não conta como zero nem entra em soma.',
    'Cliques estimados são impressões × taxa de cliques (CTR) de cada vídeo no dia, somados e arredondados só na hora de escrever. O total pode diferir da soma dos números escritos.',
    'A faixa sob as datas mostra os cliques estimados do dia: um ponto por dia com clique, todos na mesma linha, e o número embaixo (a altura do ponto não mede nada; quem mede é o número). Dia com impressões e sem taxa de cliques fica hachurado na faixa.',
    'Use os botões Dia anterior e Dia seguinte, as setas do teclado ou a tabela para ler um dia de cada vez.',
  ]
}

/** O último dia do período, quando a coleta parou (o relatório mais novo é de mais de 7 dias atrás); null = não parou. */
export function paradaEm(periodo: Periodo, hoje: DiaYt): DiaYt | null {
  return diffDias(periodo.ate, hoje) > DIARIO_PARADO_DIAS ? periodo.ate : null
}

function avisosDe(r: ResumoAlcance, periodo: Periodo, o: OpcoesImpressoes): string[] {
  const avisos: string[] = []
  if (r.diasLidos > 0 && r.diasLidos < DIAS_PARA_PADRAO) avisos.push(`Menos de ${DIAS_PARA_PADRAO} dias medidos (${r.diasLidos}): ainda é pouco para ver um padrão.`)
  if (r.diasLidos > 0 && r.diasNaoMedidos > 0) avisos.push('Dias não medidos não contam como zero nem entram nas somas.')
  const parou = paradaEm(periodo, o.hoje)
  if (parou) avisos.push(o.unidade === 'views' ? `A coleta de views parou em ${o.dm(parou)}.` : `A coleta de relatórios deste canal parou em ${o.dm(parou)}.`)
  return avisos
}

const rotulos = (u: Unidade) => (u === 'views'
  ? { rotuloEixo: 'views', rotuloValor: 'Views', rotuloSituacao: 'Situação do dia' }
  : { rotuloEixo: 'impressões', rotuloValor: 'Impressões', rotuloSituacao: 'Situação do relatório' })

const vazioView = (vazio: string, o: OpcoesImpressoes): ImpressoesView => {
  const unidade = o.unidade ?? 'impressoes'
  return {
    teto: 4, ticks: [0, 2, 4], colunas: [], periodoTexto: '', vazio, legenda: [], resumo: null, avisos: [], metodo: [], escopo: o.escopo, alturaArea: o.alturaArea,
    unidade, faixaCliques: unidade === 'impressoes', ...rotulos(unidade),
  }
}

/** Um dia "com impressões" sem valor não é barra de 0: é não medido (este sistema falha em verde; as views entram por aqui também). */
const semValorViraNaoMedido = (d: DiaAlcance): DiaAlcance => (d.situacao === 'com-impressoes' && d.imp == null ? { ...d, situacao: 'nao-medido', cliques: null } : d)

export function buildImpressoes(diasIn: readonly DiaAlcance[], periodo: Periodo | null, o: OpcoesImpressoes): ImpressoesView {
  // sem permissão nada do dado privado entra na view, mesmo que alguém tenha passado os dias
  const unidade = o.unidade ?? 'impressoes'
  const views = unidade === 'views'
  if (o.acesso === 'negado') return vazioView(views ? SEM_PERMISSAO_VIEWS : SEM_PERMISSAO, o)
  if (o.acesso === 'erro') return vazioView(views ? ERRO_VIEWS : ERRO_ALCANCE, o)
  if (!periodo || diasIn.length === 0) return vazioView(views ? SEM_VIEWS : SEM_RELATORIO, o)
  const dias = diasIn.map(semValorViraNaoMedido)

  let max = 0
  for (const d of dias) if (d.situacao === 'com-impressoes' && d.imp != null && d.imp > max) max = d.imp
  const teto = tetoDoEixo(max)
  const r = resumir(dias)
  const n = dias.length
  return {
    teto,
    ticks: [0, teto / 2, teto],
    colunas: dias.map((d, i) => colunaDe(d, i, n, teto, o)),
    periodoTexto: `de ${o.dm(periodo.de)} a ${o.dm(periodo.ate)} · ${plural(periodo.dias, 'dia', 'dias')} · dia do YouTube`,
    vazio: null,
    legenda: legendaDe(o.escopo, unidade).concat(dias.some(d => d.dia === o.publicadoEm) ? [{ situacao: 'publicacao', texto: 'dia da publicação' }] : []),
    resumo: o.resumo !== undefined ? o.resumo : views ? resumoViews(r, n) : resumoTexto(r, n),
    avisos: avisosDe(r, periodo, o),
    metodo: metodoDe(o.escopo, unidade),
    escopo: o.escopo,
    alturaArea: o.alturaArea,
    unidade,
    faixaCliques: !views,
    ...rotulos(unidade),
  }
}
