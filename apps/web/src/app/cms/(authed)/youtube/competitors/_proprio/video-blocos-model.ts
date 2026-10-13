/**
 * Modelo dos blocos da tela do VÍDEO próprio (A4 13.4): "Views por dia", "Impressões e cliques" (com a taxa de clique), "Quanto do vídeo as
 * pessoas assistem", "Retenção", "Este vídeo no canal", o cartão da forja e "O que ainda não há deste vídeo". Puro: recebe o dado privado JÁ LIDO
 * (`Privado<DadosDoVideo>`, depois do token de edição), não lê banco, não pede a prova de edição e não importa os leitores (uma varredura de teste
 * barra). Devolve só texto e frações já prontas: é o que desce para os componentes, e o que o navegador de quem só lê o site nunca recebe.
 *
 * Regras (este sistema falha em VERDE):
 *  - dado ausente é `null`/frase com o motivo, nunca zero: dia sem linha é "não medido", linha com 0 é "zero medido"; CTR nulo não vira taxa de 0%;
 *  - acesso `negado`/`erro`: nenhum bloco privado é montado; só a nota única e a parte pública das réguas (views, curtidas…), com as linhas
 *    privadas dizendo quem vê;
 *  - taxa de clique: intervalo de Wilson, veredito só quando as faixas se separam; nunca "capa boa" nem "capa ruim", nunca cor de direção;
 *  - % assistido: o número real, mesmo acima de 100; abaixo de 10 views não compara; "na média" é até 2 pontos (`contraNormal`, a função única); o normal é a
 *    mediana do CANAL (os outros vídeos com views, mínimo de 5), não a da faixa de duração (a faixa é da aba Retenção do canal);
 *  - nada de troca de título/thumbnail e nada de curva de retenção com dado (A5): só os estados "ainda não coletado" e "ainda não registrado".
 */
import { addDays, dayPt, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import { assistidoDoVideo, contraNormal, MIN_VIDEOS_FAIXA, normalDoCanal, POUCAS_VIEWS } from '@/lib/youtube/observatorio/proprio/assistido'
import { montarDias, publicacoesDe, resumir, videoNovo, type DiaAlcance, type Periodo, type PublicacoesPorYtId } from '@/lib/youtube/observatorio/proprio/dias'
import { serieDoVideo, type SerieVideo } from '@/lib/youtube/observatorio/proprio/serie-video'
import { taxaComIntervalo, veredito, type TaxaComIntervalo, type Veredito } from '@/lib/youtube/observatorio/proprio/taxa'
import type { DiarioCanal, DiarioLinha, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { MIN_DIAS_VPD, vpdDoVideo } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DadosDoVideo } from './dados'
import { cliquesTexto, lerEstado } from './header-model'
import { buildImpressoes, int, SEM_RELATORIO, type ImpressoesView } from './impressoes-model'
import { buildReguas, type DiarioReguas, type ReguasView } from './reguas-model'
import { buildTaxaFaixa, type TaxaFaixaView } from './taxa-faixa-model'
import { canalProprioDoVideo } from './video-model'
import { durText } from './formato'

/** O texto com destaque: `b` = negrito (o número que a frase informa). */
export interface Parte { t: string; b?: boolean }

export interface BlocoViews {
  /** false = a frase ocupa o lugar do gráfico (sem diário, vídeo novo, sem dia medido) */
  medido: boolean
  frase: string
  grafico: ImpressoesView | null
}

export interface BlocoTaxa {
  partes: Parte[]
  faixa: TaxaFaixaView
  /** a faixa do vídeo é larga demais para concluir (tracejada) */
  inconclusiva: boolean
  metodo: string[]
}

export interface BlocoImpressoes {
  medido: boolean
  /** a frase de quando não há o que desenhar */
  frase: string | null
  grafico: ImpressoesView | null
  taxa: BlocoTaxa | null
  /** por que não há taxa, quando há impressões (CTR de algum dia não veio) */
  semTaxa: string | null
}

export type DirecaoAssistido = 'acima' | 'na-media' | 'abaixo'

export interface BlocoAssistido {
  estado: 'ok' | 'pouco' | 'nao-medido'
  partes: Parte[]
  /** "78%"; null = sem número */
  pctTexto: string | null
  /** o tamanho da barra, de 0 a 100 (acima de 100% não estoura) */
  barraPct: number | null
  /** o normal do canal (mediana do % assistido dos outros vídeos), em pontos (para a marca); null = não compara */
  normalPct: number | null
  normalTexto: string | null
  /** a posição da marca na barra, de 0 a 100 */
  marcaPct: number | null
  /** onde o rótulo "normal do canal: NN%" se prende: no meio, sob a marca; nas pontas ele fica dentro da barra (perto de 0% ou de 100% centrado estouraria); null = sem marca */
  rotuloAncora: 'inicio' | 'meio' | 'fim' | null
  /** "Perto do normal do canal (…)." etc.; null = não compara */
  contra: string | null
  direcao: DirecaoAssistido | null
  /** por que não há normal para comparar ("Poucos outros vídeos do canal com % assistido para comparar (3; precisa de 5).") */
  semNormal: string | null
  /** "0:00", metade e fim da barra; null = o vídeo não tem duração */
  marcas: [string, string, string] | null
  alt: string
  metodo: string[]
}

export interface BlocoRetencao { frase: string; metodo: string[] }

export interface ForjaIndisponivelView {
  titulo: string
  estado: string
  oQue: string
  botao: string
  porque: string
}

export interface BlocoCanal {
  reguas: ReguasView
  /** a frase que ocupa o lugar das linhas "Views por dia" e "% assistido" quando elas não existem; null = elas estão na tabela */
  notaDiario: string | null
}

export interface VideoBlocosView {
  acesso: 'ok' | 'negado' | 'erro'
  /** negado / erro: a frase única que ocupa o lugar dos blocos privados; null = foram montados */
  nota: string | null
  views: BlocoViews | null
  impressoes: BlocoImpressoes | null
  assistido: BlocoAssistido | null
  retencao: BlocoRetencao
  canal: BlocoCanal
  forja: ForjaIndisponivelView
  ainda: string
}

export interface EntradaBlocos {
  obs: Observatory
  videoId: string
  dados: Privado<DadosDoVideo>
  /** o dia de hoje no dia do YouTube */
  hoje: DiaYt
  dm: (d: DiaYt) => string
  /** Para onde Enter e o segundo toque num traço da régua levam (preserva o `back=` da página); ausente = os traços não abrem nada. */
  hrefVideo?: (id: string) => string
}

/* ---------------------------------------------------------------- frases fixas */

export const NOTA_NEGADO = 'Só quem edita o site vê as views por dia, as impressões e cliques, o % assistido e a posição deste vídeo nessas medidas.'
export const NOTA_ERRO = 'A leitura dos números deste vídeo falhou agora; recarregue a página.'
const NOTA_DIARIO_NEGADO = 'Só quem edita o site vê a posição deste vídeo em views por dia e em % assistido.'
const NOTA_DIARIO_ERRO = 'A leitura das views por dia deste vídeo falhou agora; recarregue a página.'
const NOTA_DIARIO_NOVO = 'Vídeo novo: ainda não há leitura diária para posicionar este vídeo entre os outros em views por dia nem em % assistido.'
const NOTA_DIARIO_VAZIO = 'Sem a leitura diária não há como posicionar este vídeo entre os outros em views por dia nem em % assistido.'

const FRASE_VIDEO_NOVO_VIEWS = 'Vídeo novo: o YouTube entrega as views de cada dia com 2 a 3 dias de atraso, então com menos de 3 dias de vida ainda não há dia fechado.'
const FRASE_SEM_DIARIO_VIEWS = 'A coleta diária de views ainda não rodou para este canal. Nenhum dia é zero: falta medir.'
const FRASE_VIDEO_NOVO_IMPRESSOES = 'Vídeo novo: os números de alcance chegam com 2 a 3 dias de atraso, então ainda não há dia deste vídeo.'
const POUCO_IMPRESSAO = 100
const FRASE_POUCA_IMPRESSAO = 'É pouco para dizer se a capa funciona: leia como contagem.'
const SEM_TAXA_CTR = 'Não dá para calcular a taxa de clique deste vídeo: o YouTube não informou a taxa de pelo menos um dia com impressões.'
const ALTURA_GRAFICO = 110
const MINUS = '−'
/** Dentro desta distância de 0% ou de 100% o rótulo da marca (cerca de 20% da largura de uma tela de 390 px) deixa de ficar centrado nela. */
const ANCORA_PONTA = 20

const plural = (n: number, um: string, muitos: string): string => `${int(n)} ${n === 1 ? um : muitos}`

/* ---------------------------------------------------------------- views por dia */

function viewsDe(serie: SerieVideo, o: { pubDia: DiaYt | null; dm: (d: DiaYt) => string; hoje: DiaYt; F: Observatory['fmt'] }): BlocoViews {
  switch (serie.estado) {
    case 'video-novo': return { medido: false, frase: FRASE_VIDEO_NOVO_VIEWS, grafico: null }
    case 'sem-diario': return { medido: false, frase: FRASE_SEM_DIARIO_VIEWS, grafico: null }
    case 'sem-acesso': case 'leitura-falhou': return { medido: false, frase: NOTA_ERRO, grafico: null }
    case 'sem-medida': {
      const ate = serie.ultimoDia != null ? ` até ${o.dm(serie.ultimoDia)}` : ''
      return { medido: false, frase: `Nenhum dia medido nos 28 dias${ate}. Não é zero: falta medir.`, grafico: null }
    }
    case 'ok': break
    default: { const nunca: never = serie.estado; return nunca }
  }
  const dias = serie.dias
  const medidos = dias.filter(d => d.estado !== 'nao-medido')
  const nm = dias.length - medidos.length
  const total = medidos.reduce((s, d) => s + (d.views ?? 0), 0)
  const dm = medidos.length
  const semMedida = nm > 0 ? ` ${plural(nm, 'dia', 'dias')} sem medida.` : ''
  let frase: string
  if (total === 0) {
    const fim = nm > 0 ? `, e ${plural(nm, 'dia', 'dias')} sem medida` : ''
    frase = `Nenhuma view ${dm === 1 ? 'em 1 dia medido' : `nos ${int(dm)} dias medidos`}${fim}. É zero medido: o YouTube entregou os dias e ninguém viu.`
  } else {
    const pm = total / dm
    const melhor = medidos.reduce((m, d) => ((d.views ?? 0) > (m.views ?? 0) ? d : m))
    frase = `${plural(total, 'view', 'views')} em ${dm === 1 ? '1 dia medido' : `${int(dm)} dias medidos`} (${pm < 10 ? o.F.dec1(pm) : int(pm)} por dia). O melhor dia foi ${o.dm(melhor.dia)}, com ${int(melhor.views ?? 0)}.${semMedida}`
  }
  const alcance: DiaAlcance[] = dias.map(d => ({
    dia: d.dia, situacao: d.estado === 'com-views' ? 'com-impressoes' : d.estado === 'zero-medido' ? 'zero-medido' : 'nao-medido', motivo: null, imp: d.views, cliques: null,
  }))
  const periodo: Periodo = { de: serie.janela!.de, ate: serie.janela!.ate, dias: dias.length }
  const grafico = buildImpressoes(alcance, periodo, { escopo: 'video', unidade: 'views', alturaArea: ALTURA_GRAFICO, publicadoEm: o.pubDia, resumo: frase, dm: o.dm, acesso: 'ok', hoje: o.hoje })
  return { medido: true, frase, grafico }
}

/* ---------------------------------------------------------------- impressões, cliques e taxa */

/** A frase de direção contra a taxa do canal. `faixaCanal` = "a% a b%". Sem taxa do canal (direcao null) não há frase. */
export function fraseVeredito(v: Veredito, faixaCanal: string): string | null {
  switch (v.direcao) {
    case null: return null
    case 'acima': case 'abaixo':
      return v.quaseSeTocam
        ? `Fica um pouco ${v.direcao} da taxa do canal (${faixaCanal}): as duas faixas quase se tocam, então a diferença é pequena.`
        : `Fica ${v.direcao} da taxa do canal (${faixaCanal}), mesmo contando a incerteza.`
    case 'igual': return `Pode ser igual à taxa do canal (${faixaCanal}): com este volume, não dá para dizer que a capa funciona melhor ou pior.`
    default: { const nunca: never = v.direcao; return nunca }
  }
}

const METODO_TAXA = [
  'Cliques estimados ÷ impressões, nos dias medidos. Os cliques são estimados por dia (impressões × taxa do dia), porque o YouTube não entrega a contagem de cliques.',
  'A faixa colorida é o intervalo de 95% (Wilson). Com poucas impressões ela é larga e cobre a taxa do canal: por isso a tela diz “não dá para dizer”, em vez de chamar a capa de boa ou ruim. Quando a faixa é larga demais para concluir, ela fica tracejada e cinza.',
]

function taxaDe(video: TaxaComIntervalo, canal: TaxaComIntervalo | null, F: Observatory['fmt']): BlocoTaxa {
  const v = veredito(video, canal)
  const faixa = buildTaxaFaixa({ alvo: video, canal, inconclusivo: v.inconclusivo, alt: '' })
  const meu = faixa.linhas[faixa.linhas.length - 1]!, ref = canal ? faixa.linhas[0]! : null
  const faixaCanal = ref ? `${ref.loTxt} a ${ref.hiTxt}` : ''
  const verd = ref ? fraseVeredito(v, faixaCanal) : null
  const kTxt = cliquesTexto(video.cliques, F)
  const alt = `Taxa de clique do vídeo ${meu.valor}, de ${meu.loTxt} a ${meu.hiTxt}` + (ref ? `; do canal, de ${ref.loTxt} a ${ref.hiTxt}` : '') + (v.inconclusivo ? '; faixa larga demais: ainda não conclui' : '')
  const partes: Parte[] = [
    { t: meu.valor, b: true }, { t: ` das impressões viraram clique (${kTxt} de ${int(video.imp)}). A taxa real fica entre ` },
    { t: meu.loTxt, b: true }, { t: ' e ' }, { t: meu.hiTxt, b: true }, { t: '.' + (verd ? ' ' + verd : '') },
  ]
  return { partes, faixa: { ...faixa, alt }, inconclusiva: v.inconclusivo, metodo: METODO_TAXA }
}

function impressoesDe(alcance: DadosDoVideo['alcance'], o: { ytId: string; pubDia: DiaYt | null; publicacoes: PublicacoesPorYtId; dm: (d: DiaYt) => string; hoje: DiaYt; F: Observatory['fmt'] }): BlocoImpressoes {
  const lido = lerEstado({ acesso: 'ok', dado: alcance }, o.hoje, o.publicacoes)
  if (lido.estado !== 'ok') return { medido: false, frase: SEM_RELATORIO, grafico: null, taxa: null, semTaxa: null }
  const novo: BlocoImpressoes = { medido: false, frase: FRASE_VIDEO_NOVO_IMPRESSOES, grafico: null, taxa: null, semTaxa: null }
  // o dia anterior à publicação não existe (nem "zero medido" nem "não medido"): a série começa no dia da publicação, como a de views
  // a regra dos dias que valem para o vídeo (a partir da publicação; D e D-1 sem linha são "não medido") é a de `montarDias`, a mesma da régua e do cartão
  const montado = montarDias(alcance, { hoje: o.hoje, ytId: o.ytId, publicadoEm: o.pubDia })
  // vídeo novo (menos de DIAS_DE_VIDA_MIN dias de vida) SEM linha de alcance desde a publicação: a seção diz "vídeo novo". Com linha, o dado existe e a seção o mostra (a mesma regra do cartão e da régua)
  if (videoNovo(o.pubDia, o.hoje) && !montado.dias.some(x => x.situacao === 'com-impressoes')) return novo
  if (montado.periodo == null || montado.dias.length === 0) return novo
  const dias = montado.dias
  const periodo: Periodo = montado.periodo
  const base = { escopo: 'video' as const, alturaArea: ALTURA_GRAFICO, publicadoEm: o.pubDia, dm: o.dm, acesso: 'ok' as const, hoje: o.hoje }
  const r = resumir(dias)
  let grafico = buildImpressoes(dias, periodo, base)
  if (r.imp != null && r.imp > 0 && r.imp < POUCO_IMPRESSAO && grafico.resumo != null) grafico = buildImpressoes(dias, periodo, { ...base, resumo: `${grafico.resumo} ${FRASE_POUCA_IMPRESSAO}` })
  if (r.imp == null || r.imp <= 0) return { medido: true, frase: null, grafico, taxa: null, semTaxa: null }
  const tv = taxaComIntervalo(r.cliques, r.imp)
  if (tv == null) return { medido: true, frase: null, grafico, taxa: null, semTaxa: SEM_TAXA_CTR }
  const rc = resumir(montarDias(alcance, { hoje: o.hoje }).dias)
  const tc = taxaComIntervalo(rc.cliques, rc.imp)
  return { medido: true, frase: null, grafico, taxa: taxaDe(tv, tc, o.F), semTaxa: null }
}

/* ---------------------------------------------------------------- % assistido */

const METODO_ASSISTIDO = [
  '% assistido: do total de tempo de vídeo possível, quanto foi assistido. É a média do percentual de cada dia, pesada pelas views do dia (dá o mesmo valor que o YouTube calcula para o período).',
  'Janela: os 28 dias que terminam no último dia medido do canal.',
  'Poucas views: abaixo de 10 views o valor sai com a contagem ao lado, em cinza, e sem comparar com o normal do canal.',
  'O normal do canal é a mediana do % assistido dos outros vídeos do canal que tiveram views, e só vale com 5 ou mais vídeos. Perto do normal: até 2 pontos para cima ou para baixo.',
  'Acima de 100%: trecho que muita gente voltou para rever.',
]

function assistidoNaoMedido(frase: string): BlocoAssistido {
  return {
    estado: 'nao-medido', partes: [{ t: frase }], pctTexto: null, barraPct: null, normalPct: null, normalTexto: null, marcaPct: null, rotuloAncora: null, contra: null, direcao: null, semNormal: null,
    marcas: null, alt: frase, metodo: METODO_ASSISTIDO,
  }
}

function assistidoDe(
  diario: Privado<DiarioCanal>, serie: SerieVideo,
  o: { ytId: string; dur: number | null; pctDosOutros: ReadonlyArray<number | null>; dm: (d: DiaYt) => string; F: Observatory['fmt'] },
): BlocoAssistido {
  if (serie.estado === 'video-novo') return assistidoNaoMedido('Vídeo novo: o YouTube só entrega o % assistido depois de fechar o dia, então com menos de 3 dias de vida ainda não há valor.')
  if (serie.estado === 'sem-diario') return assistidoNaoMedido('A coleta diária ainda não rodou: sem ela não há % assistido.')
  const a = assistidoDoVideo(diario, o.ytId)
  if (a.pct == null) {
    const ate = a.janela ? ` até ${o.dm(a.janela.ate)}` : ''
    return assistidoNaoMedido(`Nenhuma view nos 28 dias${ate}: sem views não há % assistido.`)
  }
  const pct = a.pct
  const pctTexto = o.F.int(pct) + '%'
  // acima de 100% o tempo assistido passa da duração: "(13:56 de 10:00)" pareceria erro; a frase diz por quê
  const duracao = Math.round(pct) > 100
    ? (o.dur != null ? ` (${durText(pct / 100 * o.dur)} num vídeo de ${durText(o.dur)}): acontece quando muita gente revê trechos` : ': acontece quando muita gente revê trechos')
    : o.dur != null ? ` (${durText(pct / 100 * o.dur)} de ${durText(o.dur)})` : ''
  const pouco = a.pouco
  const partes: Parte[] = [{ t: 'Quem assiste vê em média ' }, { t: pctTexto, b: true }, { t: ` do vídeo${duracao}.` }]
  partes.push({ t: pouco
    ? ` São só ${plural(a.n, 'view', 'views')}: cada pessoa muda o resultado e não dá para comparar com o normal do canal.`
    : ` Baseado em ${plural(a.n, 'view', 'views')}.` })
  const marcas: [string, string, string] | null = o.dur != null ? ['0:00', durText(o.dur / 2) ?? '', durText(o.dur) ?? ''] : null
  const barraPct = Math.max(0, Math.min(100, Math.round(pct)))
  const base: BlocoAssistido = {
    estado: pouco ? 'pouco' : 'ok', partes, pctTexto, barraPct, normalPct: null, normalTexto: null, marcaPct: null, rotuloAncora: null, contra: null, direcao: null, semNormal: null, marcas,
    alt: `${pctTexto} do vídeo assistido em média${pouco ? ', com poucas views' : ''}`, metodo: METODO_ASSISTIDO,
  }
  if (pouco) return base
  const { comViews, normal } = normalDoCanal(o.pctDosOutros)
  if (normal == null) return { ...base, semNormal: `Poucos outros vídeos do canal com % assistido para comparar (${int(comViews)}; precisa de ${MIN_VIDEOS_FAIXA}).` }
  const c = contraNormal(pct, normal)!
  const normalTexto = o.F.int(normal) + '%'
  const contra = c.leitura === 'na-media' ? `Perto do normal do canal (${normalTexto}).`
    : c.leitura === 'acima' ? `Acima do normal do canal (${normalTexto}): +${Math.abs(c.dif)} pontos.`
      : `Abaixo do normal do canal (${normalTexto}): ${MINUS}${Math.abs(c.dif)} pontos.`
  const marcaPct = Math.max(0, Math.min(100, Math.round(normal)))
  const rotuloAncora = marcaPct < ANCORA_PONTA ? 'inicio' : marcaPct > 100 - ANCORA_PONTA ? 'fim' : 'meio'
  return { ...base, normalPct: normal, normalTexto, marcaPct, rotuloAncora, contra, direcao: c.leitura }
}

/* ---------------------------------------------------------------- retenção, forja, o que falta */

const RETENCAO: BlocoRetencao = {
  frase: 'Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.',
  metodo: [
    'Curva: a parte do público que ainda está assistindo em cada ponto do vídeo, da publicação até a coleta. Vem de uma consulta do YouTube Analytics por posição no vídeo.',
    'Janela: a curva é da vida inteira do vídeo; o % assistido da seção anterior é dos últimos dias. As janelas são diferentes.',
    'Acima de 100%: trecho que muita gente voltou para rever.',
  ],
}

const FORJA: ForjaIndisponivelView = {
  titulo: 'Leitura da forja',
  estado: 'ainda não disponível para o seu canal',
  oQue: 'A leitura deste vídeo seria sobre views por dia, impressões e cliques dele, comparados com os outros vídeos do seu canal.',
  botao: 'Pedir leitura deste vídeo à forja',
  porque: 'A forja só recebe dados públicos de concorrente; a leitura de vídeo do seu canal ainda não existe.',
}

const AINDA = 'Origem do tráfego (esta tela ainda não a mostra) e trocas de título e thumbnail (ainda não registradas; gráfico sem marca não quer dizer que não houve troca).'

/* ---------------------------------------------------------------- as réguas */

interface VideoDoCanal { id: string; ytId: string; titulo: string; views: number | null; likes: number | null; comments: number | null; dur: number | null }

/** Os vídeos do canal como as réguas os leem: os datados do motor e os guardados sem data. Sem montar os cartões do canal (cada um consulta as trocas). */
function videosDoCanal(obs: Observatory, canalId: string): VideoDoCanal[] {
  const ch = obs.channel(canalId)
  const datados = obs.videos.filter(v => v.ch === canalId).map(v => ({ id: v.id, ytId: v.ytId, titulo: v.title, views: v.views, likes: v.likes, comments: v.comments, dur: v.dur }))
  const sem = (ch?.undated ?? []).map(u => ({ id: u.id, ytId: u.ytId, titulo: u.title ?? 'Vídeo sem título', views: u.views, likes: u.likes, comments: u.comments, dur: u.dur }))
  return [...datados, ...sem]
}

/** As linhas do diário agrupadas por vídeo: cada conta olha só as do próprio vídeo (o canal tem milhares de vídeos e centenas de linhas). */
function porVideo(d: DiarioCanal): Map<string, DiarioLinha[]> {
  const m = new Map<string, DiarioLinha[]>()
  for (const l of d.linhas) { const g = m.get(l.ytId); if (g) g.push(l); else m.set(l.ytId, [l]) }
  return m
}

const JANELA_DIAS = 28
function views28(linhas: readonly DiarioLinha[], ultimoDia: DiaYt): number {
  const de = addDays(ultimoDia, -(JANELA_DIAS - 1))
  let s = 0
  for (const l of linhas) if (l.views != null && l.dia >= de && l.dia <= ultimoDia) s += l.views
  return s
}

/** "K dos M outros medidos ficam abaixo de 1 view por dia; N sem medida." Só os medidos entram em K e M. */
export function fraseOutrosAbaixoDe1(k: number, medidos: number, semMedida: number): string {
  if (medidos === 0) return 'nenhum outro vídeo do canal tem views por dia medidas.'
  return `${int(k)} dos ${int(medidos)} outros medidos ficam abaixo de 1 view por dia${semMedida > 0 ? `; ${int(semMedida)} sem medida` : ''}.`
}

export function buildVideoBlocos(a: EntradaBlocos): VideoBlocosView {
  const { obs, videoId, dm, hoje } = a
  const ch = canalProprioDoVideo(obs, videoId)
  if (!ch) throw new Error(`blocos do vídeo: ${videoId} não é de um canal próprio`)
  const F = obs.fmt
  const videos = videosDoCanal(obs, ch.id)
  const este = videos.find(v => v.id === videoId)
  if (!este) throw new Error(`blocos do vídeo: ${videoId} não está entre os vídeos do canal ${ch.id}`)
  const dated = obs.video(videoId)
  const pubDia: DiaYt | null = dated ? dayPt(new Date(dated.pub)) : null
  const hrefs = { vistos: link.canal(ch.id, { sort: 'vistos', video: videoId }), imp: link.canal(ch.id, { sort: 'imp', video: videoId }) }
  const fixos = { retencao: RETENCAO, forja: FORJA, ainda: AINDA }

  /* sem acesso ao dado privado: só a parte pública das réguas, e nenhuma conta com número privado */
  if (a.dados.acesso !== 'ok') {
    const negado = a.dados.acesso === 'negado'
    const reguas = buildReguas({
      videoId, videos, porVideo: new Map(), alcanceLido: false, dias: { medidos: 0, semRelatorio: 0 }, periodoTexto: null, hrefs, hrefVideo: a.hrefVideo, fmt: F,
      motivoImpressoes: negado ? 'só quem edita o site vê as impressões' : 'a leitura das impressões falhou agora; recarregue a página',
    })
    return {
      acesso: negado ? 'negado' : 'erro', nota: negado ? NOTA_NEGADO : NOTA_ERRO, views: null, impressoes: null, assistido: null,
      canal: { reguas, notaDiario: negado ? NOTA_DIARIO_NEGADO : NOTA_DIARIO_ERRO }, ...fixos,
    }
  }

  const { alcance, diario } = a.dados.dado
  // o dia da publicação de cada vídeo do canal: o total de impressões de cada um começa nele (a mesma regra do gráfico, do cartão e da lista)
  const publicacoes = publicacoesDe(obs.videos.filter(v => v.ch === ch.id))
  const diarioPriv: Privado<DiarioCanal> = { acesso: 'ok', dado: diario }
  const serie = serieDoVideo(diarioPriv, { ytId: este.ytId, publicadoEm: pubDia, hoje })

  const views = viewsDe(serie, { pubDia, dm, hoje, F })
  const impressoes = impressoesDe(alcance, { ytId: este.ytId, pubDia, publicacoes, dm, hoje, F })

  /* contas do diário, uma vez por vídeo que tem linha */
  const grupos = porVideo(diario)
  const vpdPorId = new Map<string, number | null>()
  const pctPorId = new Map<string, number | null>()
  for (const v of videos) {
    const linhas = grupos.get(v.ytId)
    if (!linhas) { vpdPorId.set(v.id, null); pctPorId.set(v.id, null); continue }
    const parcial: DiarioCanal = { ...diario, linhas }
    const pct = assistidoDoVideo({ acesso: 'ok', dado: parcial }, v.ytId).pct
    pctPorId.set(v.id, pct)
    vpdPorId.set(v.id, vpdDoVideo(parcial, v.ytId).vpd)
  }
  const pctDosOutros = videos.filter(v => v.id !== este.id).map(v => pctPorId.get(v.id) ?? null)
  const assistido = assistidoDe(diarioPriv, serie, { ytId: este.ytId, dur: este.dur, pctDosOutros, dm, F })

  /* as duas linhas novas da régua: só com leitura diária deste vídeo (vídeo novo e coleta que não rodou dizem uma frase no lugar) */
  const lidoAlcance = lerEstado({ acesso: 'ok', dado: alcance }, hoje, publicacoes)
  const periodoTexto = lidoAlcance.estado === 'ok' ? `de ${dm(lidoAlcance.periodo.de)} a ${dm(lidoAlcance.periodo.ate)}` : null
  const temDiarioDoVideo = serie.estado !== 'video-novo' && serie.estado !== 'sem-diario'
  let diarioReguas: DiarioReguas | undefined
  let notaDiario: string | null = null
  if (!temDiarioDoVideo) notaDiario = serie.estado === 'video-novo' ? NOTA_DIARIO_NOVO : NOTA_DIARIO_VAZIO
  else {
    const v28 = diario.ultimoDia != null ? views28(grupos.get(este.ytId) ?? [], diario.ultimoDia) : 0
    const meuVpd = vpdPorId.get(este.id) ?? null
    const outros = videos.filter(v => v.id !== este.id)
    // só os MEDIDOS entram na conta: "não medido" (sem diário, short, menos de 7 dias) nunca vira "abaixo de 1"; os sem medida aparecem à parte
    const medidosVpd = outros.map(v => vpdPorId.get(v.id) ?? null).filter((x): x is number => x != null)
    const abaixoDe1 = medidosVpd.filter(x => x < 1).length
    const semMedidaVpd = outros.length - medidosVpd.length
    const meuPct = assistidoDoVideo(diarioPriv, este.ytId)
    diarioReguas = {
      vpd: vpdPorId, pct: pctPorId,
      naoPosicionaVpd: meuVpd != null && v28 < POUCAS_VIEWS
        ? `Com ${int(v28)} ${v28 === 1 ? 'view' : 'views'} em 28 dias não dá para posicionar este vídeo: ${fraseOutrosAbaixoDe1(abaixoDe1, medidosVpd.length, semMedidaVpd)}` : null,
      naoPosicionaPct: meuPct.pct != null && meuPct.pouco ? `Com só ${int(meuPct.n)} ${meuPct.n === 1 ? 'view' : 'views'} não dá para posicionar o % assistido.` : null,
      semVpd: `sem ${MIN_DIAS_VPD} dias de medida`,
      semPct: 'sem views nos 28 dias',
    }
  }
  // os dias que valem para CADA vídeo da régua: a partir da publicação dele, D e D-1 sem linha fora do zero (a regra de `montarDias`, a mesma do gráfico)
  const pubDiaDe = new Map(obs.videos.filter(v => v.ch === ch.id).map(v => [v.id, dayPt(new Date(v.pub))] as const))
  const memoDias = new Map<string, { medidos: number; semRelatorio: number; novo: boolean }>()
  const diasDoVideo = (id: string): { medidos: number; semRelatorio: number; novo: boolean } => {
    const hit = memoDias.get(id)
    if (hit) return hit
    const v = videos.find(x => x.id === id)
    const pub = pubDiaDe.get(id) ?? null
    const dias = v ? montarDias(alcance, { hoje, ytId: v.ytId, publicadoEm: pub }).dias : []
    // vídeo novo e sem linha desde a publicação: nenhum dia vale ainda (a mesma regra do cartão e da página); com linha, os dias dele contam como sempre
    const novo = v != null && videoNovo(pub, hoje) && !dias.some(x => x.situacao === 'com-impressoes')
    const r = v && !novo ? resumir(dias) : null
    const out = { medidos: r?.diasLidos ?? 0, semRelatorio: r?.diasNaoMedidos ?? 0, novo }
    memoDias.set(id, out)
    return out
  }
  const reguas = buildReguas({
    videoId, videos, porVideo: lidoAlcance.estado === 'ok' ? lidoAlcance.porVideo : new Map(), alcanceLido: lidoAlcance.estado === 'ok',
    dias: lidoAlcance.estado === 'ok' ? { medidos: lidoAlcance.resumo.diasLidos, semRelatorio: lidoAlcance.resumo.diasNaoMedidos } : { medidos: 0, semRelatorio: 0 }, diasDe: diasDoVideo, periodoTexto, hrefs, hrefVideo: a.hrefVideo, fmt: F,
    ...(diarioReguas ? { diario: diarioReguas } : {}),
  })

  return { acesso: 'ok', nota: null, views, impressoes, assistido, canal: { reguas, notaDiario }, ...fixos }
}

