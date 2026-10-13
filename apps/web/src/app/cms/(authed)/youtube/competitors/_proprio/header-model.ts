/**
 * Modelo do cabeçalho do canal próprio (spec 16.3 e 16.7): a faixa de seis números e os onze de "Todos os números".
 * Puro: recebe o dado privado JÁ LIDO (`DadosDoCanal`, com os estados ok / negado / erro) e não lê banco, não pede a prova de
 * edição e não importa os leitores (uma varredura de teste barra). Dado ausente é `value: null` com a frase em `missing`, nunca
 * zero; zero medido é "0". Cada célula tem base escrita e nunca fica sem valor e sem frase ao mesmo tempo.
 *
 * Reaproveita o cabeçalho do concorrente (`_canal/header-model.ts`): a célula, os inscritos, os inscritos em 30 dias e a linha
 * de sincronização são as mesmas funções; as views por dia saem de `vpdText`, como na lista e na comparação.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'
import { conjuntoTexto, type Conjunto, type Posicao } from '@/lib/youtube/observatorio/posicao'
import { link } from '@/lib/youtube/observatorio/links'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'
import { alcancePorVideo, montarDias, resumir, type Periodo, type ResumoAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { AlcanceCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { baseVpdTexto, motivoVpdTexto, vpdDoCanal, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { canalLargo } from '@/lib/youtube/observatorio/proprio/taxa'
import {
  celulaCrescimento30, celulaInscritos, makeCell, sincronizacaoDoCanal, type MakeCell, type NumCell,
} from '../_canal/header-model'
import { durText, duracaoMediana, vpdText } from '../_canal/numeros'
import { langChip, type LangChip } from '../_chrome/own-channels'
import type { DadosDoCanal } from './dados'
import { foraDosGuardadosFrase, longosAcompanhados } from './extras'
import { assistidoDoCanal, MIN_DIAS_ASSISTIDO, POUCAS_VIEWS, POUCAS_VIEWS_MEDIA, taxaDoCanal, type AssistidoCanal } from './canal-agregados'
import { pctUm } from './taxa-faixa-model'

export type { NumCell }

/**
 * Uma célula do cabeçalho do canal próprio: a do concorrente mais o que o mockup de 12/10 acrescenta. `sub` = a segunda linha (a base curta);
 * `fraco` = o valor sai em cinza (pouca base); `parado` = o canal está parado (forma e palavra, nunca só cor); `semNumero` = há dado, mas pouco
 * demais para dizer (não é "não medido"); `explicada` = a frase do motivo fica DENTRO da célula (não sobe para a linha de baixo da faixa).
 */
export interface ProprioCell extends NumCell { sub: string | null; fraco: boolean; parado: boolean; semNumero: boolean; explicada: boolean }

/** A linha-resumo sob o nome: "Canal parado há 666 dias" (destaque, com a palavra) + "; 18.201 impressões em 29 dias." */
export interface ResumoCanalView { destaque: string; parado: boolean; resto: string }

/** As posições do canal entre os do nicho (ou no geral, sem nicho), calculadas no servidor com o conjunto do site. null = não calculadas. */
export interface PosicaoNoNicho {
  conjunto: Conjunto
  inscritos: Posicao | null
  medianaViews: Posicao | null
  longos90: Posicao | null
  vpdPorMil: Posicao | null
}

export interface ProprioHeaderView {
  id: string; name: string; handle: string; url: string; avatar: string | null; ini: string; color: string; lang: LangChip | null
  /** 6, nesta ordem: inscritos, videos, viewsSomadas, impressoes, diasComImpressao, diasDesdeUltimo */
  faixa: ProprioCell[]
  /** 13: cliques, taxaClique, videosComImpressao, medianaViews, maisVisto, engajamento90, engajamentoTodos, duracaoMediana, ritmo, vpdVideo, assistido, retencao, inscritos30 */
  todos: ProprioCell[]
  /** A linha sob o nome (null = canal sem vídeo, que não tem página). */
  resumo: ResumoCanalView | null
  /** UMA frase com o motivo das células da faixa 1 que não têm número; null = todas têm. */
  faixaMotivo: string | null
  /** Idem para a faixa 2. */
  todosMotivo: string | null
  sync: string
  /** "Entre 14 canais de Viagem: 14º em inscritos, …"; null = as posições não foram calculadas. É a junção de `posicaoItens` (uma fonte só). */
  posicaoLinha: string | null
  /** A mesma linha em pedaços, para a tela pôr o link em cada item. null = as posições não foram calculadas. */
  posicaoItens: PosicaoItens | null
}

/** Um pedaço da linha de posição. `href` = a lista de Canais já ordenada por ESTE número; null = a lista não ordena por ele (texto, não link). */
export interface PosicaoItem { chave: 'inscritos' | 'medianaViews' | 'longos90' | 'vpdPorMil'; texto: string; href: string | null }
/** `intro` ("Entre 14 canais de Viagem:") + 4 itens, nesta ordem: inscritos, mediana de views, longos em 90 dias, views/dia por mil inscritos. */
export interface PosicaoItens { intro: string; itens: PosicaoItem[] }

/* ---------------------------------------------------------------- o dado privado, em quatro estados */

/** Onde o alcance está: tudo o que não é 'ok' vira UMA frase (a mesma em toda célula de alcance). */
export type EstadoAlcance = 'negado' | 'erro' | 'sem-relatorio' | 'ok'

export const FRASE_NEGADO = 'só quem edita o site vê este número'
export const FRASE_ERRO = 'a leitura do alcance falhou agora; recarregue a página'
export const FRASE_SEM_RELATORIO = 'ainda sem relatório de alcance deste canal'
/** Há relatório, mas nenhum dia do período foi lido ainda (todos por baixar, com erro ou expirados). */
export const FRASE_NADA_LIDO = 'nenhum dia do período foi medido ainda'
export const FRASE_CTR = 'não medido: o YouTube não informou a taxa de clique de algum dia com impressões'

/** A frase de cada estado em que não há número; `ok` não tem frase. Switch exaustivo: um estado novo não compila sem a sua frase. */
export function fraseDoAlcance(e: EstadoAlcance): string | null {
  switch (e) {
    case 'negado': return FRASE_NEGADO
    case 'erro': return FRASE_ERRO
    case 'sem-relatorio': return FRASE_SEM_RELATORIO
    case 'ok': return null
    default: { const nunca: never = e; return nunca }
  }
}

export type AlcanceLido =
  | { estado: Exclude<EstadoAlcance, 'ok'> }
  | { estado: 'ok'; periodo: Periodo; resumo: ResumoAlcance; porVideo: ReturnType<typeof alcancePorVideo> }

/** Relatório nenhum (tabela vazia, canal sem linha) é 'sem-relatorio': a série não tem onde começar. */
export function lerEstado(p: Privado<AlcanceCanal>, hoje: DiaYt): AlcanceLido {
  if (p.acesso === 'negado') return { estado: 'negado' }
  if (p.acesso === 'erro') return { estado: 'erro' }
  const { periodo, dias } = montarDias(p.dado, { hoje })
  if (periodo == null) return { estado: 'sem-relatorio' }
  return { estado: 'ok', periodo, resumo: resumir(dias), porVideo: alcancePorVideo(p.dado) }
}

/* ---------------------------------------------------------------- pedaços do cabeçalho */

type Fmt = Observatory['fmt']

/** Cliques estimados como texto: arredonda só aqui; positivo que arredonda a 0 diz "menos de 1", nunca "0". O cabeçalho e a linha do vídeo usam esta. */
export function cliquesTexto(cliques: number, F: Pick<Fmt, 'int'>): string {
  return cliques > 0 && Math.round(cliques) === 0 ? 'menos de 1' : F.int(Math.round(cliques))
}

const comContagem = (vids: readonly ObsVideo[]) => vids.filter((v): v is ObsVideo & { views: number } => v.views != null)

export function buildProprioHeader(
  obs: Observatory, canalId: string, dados: DadosDoCanal,
  o: {
    hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null
    /**
     * O site tem mais de um canal próprio (decide o selo de idioma). OBRIGATÓRIO: a página do canal lê um conjunto de UM canal, onde `ownChannels()`
     * LANÇA; quem monta a página passa o que sabe do menu "Meu canal" (a prova de tipo está em header-model.type-test.ts).
     */
    muitosProprios: boolean
  },
): ProprioHeaderView | null {
  const ch: ObsChannel | undefined = obs.channel(canalId)
  if (!ch || !ch.own) return null
  const F: Fmt = obs.fmt, D = obs.date, R = obs.RULES, { dm } = o
  const noun = (n: number, one: string, many: string) => F.plural(n, one, many)
  const base0: MakeCell = makeCell(false, R.weakBase)
  /** A célula com os campos do canal próprio em estado neutro; `x` acerta o que a célula tem de seu. */
  const pc = (c: NumCell, x: Partial<Omit<ProprioCell, keyof NumCell>> = {}): ProprioCell => ({ sub: null, fraco: false, parado: false, semNumero: false, explicada: false, ...c, ...x })
  const cell = (key: string, label: string, v: Parameters<MakeCell>[2], x: Partial<Omit<ProprioCell, keyof NumCell>> = {}): ProprioCell => pc(base0(key, label, v), x)
  const vids = obs.videos.filter(v => v.ch === ch.id)
  const total = vids.length + ch.undated.length
  const longos = longosAcompanhados(obs, ch.id)

  const alc = lerEstado(dados.alcance, o.hoje)
  const vpd: VpdCanal = vpdDoCanal(dados.diario, longos, o.hoje)

  const SL = obs.channelStats(ch.id, 'long')
  const kl = obs.cadence(ch.id, 'long'), ks = obs.cadence(ch.id, 'short')

  /* ---------------------------------------------------------------- faixa */
  const inscritos = pc({ ...celulaInscritos(ch, F, cell), key: 'inscritos' })

  const nShort = vids.filter(v => v.fmt === 'short').length + ch.undated.filter(u => u.isShort === true).length
  const videos = cell('videos', 'vídeos', {
    value: String(total), missing: '',
    base: total === 0 ? 'nenhum vídeo guardado para este canal'
      : `${noun(total, 'vídeo guardado', 'vídeos guardados')}: ${noun(total - nShort, 'longo', 'longos')} e ${noun(nShort, 'Short', 'Shorts')}`,
  })

  const comViews = comContagem(vids)
  const viewsSomadas = cell('viewsSomadas', 'views somadas', {
    value: comViews.length ? F.num(comViews.reduce((s, v) => s + v.views, 0)) : null,
    missing: total === 0 ? 'nenhum vídeo guardado' : 'sem contagem de views',
    base: `soma de ${noun(comViews.length, 'vídeo', 'vídeos')}; ${vids.length - comViews.length ? `${vids.length - comViews.length} sem contagem ficam fora` : 'nenhum fica sem contagem'}`,
  })

  // os totais de impressões e cliques são os do canal no relatório: somam também as linhas de vídeos que não estão entre os guardados do canal (sem dizer por quê: o site não sabe),
  // que não têm cartão nem entram em "vídeos com impressão"; a base diz quantos são, para a soma dos cartões não parecer erro
  const doCanal = new Set<string>([...vids.map(v => v.ytId), ...ch.undated.map(u => u.ytId)])
  const foraDoCanal = alc.estado === 'ok' ? [...alc.porVideo.keys()].filter(id => !doCanal.has(id)).length : 0
  const INCLUI = foraDoCanal ? ` O total é o do relatório. ${foraDosGuardadosFrase(foraDoCanal, F.int)}` : ''

  const DIA_YT = 'O dia é o do YouTube (horário do Pacífico), não o de São Paulo.'
  const periodoTxt = alc.estado === 'ok' ? `de ${dm(alc.periodo.de)} a ${dm(alc.periodo.ate)}` : null
  const lidos = alc.estado === 'ok' ? alc.resumo.diasLidos : 0
  const nada = alc.estado === 'ok' && alc.resumo.diasLidos === 0
  /** A frase quando falta número: a do estado, ou "nada lido" quando há relatório mas nenhum dia foi lido. */
  const faltaAlcance = (): string => fraseDoAlcance(alc.estado) ?? FRASE_NADA_LIDO

  const impressoes = cell('impressoes', periodoTxt && !nada ? 'impressões' : 'impressões no período', {
    value: alc.estado === 'ok' && !nada ? F.num(alc.resumo.imp ?? 0) : null,
    missing: faltaAlcance(),
    base: alc.estado === 'ok'
      ? `Vezes em que a miniatura de um vídeo apareceu no YouTube, somadas ${periodoTxt} (${noun(alc.periodo.dias, 'dia', 'dias')}). ${noun(lidos, 'dia medido', 'dias medidos')}; ${alc.resumo.diasNaoMedidos ? `${noun(alc.resumo.diasNaoMedidos, 'dia', 'dias')} sem relatório ficam fora da soma` : 'nenhum dia fica sem relatório'}. ${DIA_YT}${INCLUI}`
      : 'Vezes em que a miniatura de um vídeo apareceu no YouTube, somadas no período dos relatórios de alcance do canal.',
  }, { sub: periodoTxt && !nada ? periodoTxt : null })

  const diasComImpressao = cell('diasComImpressao', 'dias com impressão', {
    value: alc.estado === 'ok' && !nada ? `${alc.resumo.diasComImpressao} de ${alc.resumo.diasLidos}` : null,
    missing: faltaAlcance(),
    base: alc.estado === 'ok'
      ? `Dos ${noun(lidos, 'dia medido', 'dias medidos')} ${periodoTxt}, ${alc.resumo.diasComImpressao} trouxeram impressões e ${lidos - alc.resumo.diasComImpressao} vieram vazios. ${alc.resumo.diasNaoMedidos ? `${noun(alc.resumo.diasNaoMedidos, 'dia', 'dias')} sem relatório ficam fora da conta. ` : ''}${DIA_YT}`
      : 'Dias do período em que algum vídeo teve impressões, sobre os dias com relatório de alcance lido.',
  })

  // o vídeo mais recente (de qualquer formato) diz há quantos dias o canal não publica
  const ultimo = vids.reduce<ObsVideo | null>((m, v) => (m == null || v.pub > m.pub ? v : m), null)
  const canalParado = ultimo != null && ultimo.ageDays > DIAS_CANAL_PARADO
  const diasDesdeUltimo = cell('diasDesdeUltimo', 'desde o último vídeo', {
    value: ultimo ? noun(ultimo.ageDays, 'dia', 'dias') : null,
    missing: 'nenhum vídeo guardado',
    base: ultimo ? `publicado em ${D.dmOrDmy(ultimo.pub)} ${D.hm(ultimo.pub)} (São Paulo)` : 'o canal não tem vídeo com data de publicação guardado',
  }, { parado: canalParado })

  /* ---------------------------------------------------------------- todos os números */
  const cliquesOk = alc.estado === 'ok' && !nada
  const cliquesTotal = alc.estado === 'ok' ? alc.resumo.cliques : null
  const BASE_CLIQUES = `Estimado: impressões × taxa de clique de cada dia e vídeo, somados e arredondados uma vez, no total; por isso o total pode diferir da soma das partes escritas. O YouTube não informa cliques.${INCLUI}`
  const cliques = cell('cliques', 'cliques estimados no período', {
    // arredonda só o total que aparece; um total positivo que arredondaria para 0 diz "menos de 1", nunca "0"
    value: cliquesOk && cliquesTotal != null ? cliquesTexto(cliquesTotal, F) : null,
    missing: cliquesOk ? FRASE_CTR : faltaAlcance(),
    base: cliquesOk && cliquesTotal == null ? `${BASE_CLIQUES} Algum dia com impressões veio sem a taxa de clique, então o total não é calculado.` : BASE_CLIQUES,
  }, { sub: cliquesOk && cliquesTotal != null ? 'impressões × taxa de cada dia' : null })

  // taxa de clique do canal: cliques estimados ÷ impressões do período, com o intervalo de 95% (Wilson); sem impressão não há taxa (nula, nunca 0%)
  const taxa = cliquesOk ? taxaDoCanal(alc.resumo) : null
  const taxaClique = cell('taxaClique', 'taxa de clique do canal', {
    value: taxa ? pctUm(taxa.taxa) : null,
    missing: !cliquesOk ? faltaAlcance() : alc.estado === 'ok' && alc.resumo.imp === 0 ? 'nenhuma impressão nos dias medidos, então não há taxa' : FRASE_CTR,
    base: taxa
      ? `Cliques estimados ÷ impressões, no período ${periodoTxt}. O intervalo de ${pctUm(taxa.lo)} a ${pctUm(taxa.hi)} é o de 95% de confiança (Wilson): com poucas impressões ele é largo. ${taxaLargaFrase(taxa)}`
      : 'Cliques estimados ÷ impressões, no período dos relatórios de alcance do canal.',
  }, { sub: taxa ? `entre ${pctUm(taxa.lo)} e ${pctUm(taxa.hi)}` : null })

  // o numerador sai do MESMO conjunto do total: linha de vídeo que saiu do canal (apagado, privado) não conta, senão "5 de 3"
  const comImpressao = alc.estado === 'ok' ? [...alc.porVideo.keys()].filter(id => doCanal.has(id)).length : 0

  const videosComImpressao = cell('videosComImpressao', 'vídeos com alguma impressão', {
    value: alc.estado === 'ok' && !nada ? `${comImpressao} de ${total}` : null,
    missing: faltaAlcance(),
    base: alc.estado === 'ok' ? `Vídeos que apareceram ao menos uma vez nos dias medidos ${periodoTxt}. ${DIA_YT}` : 'Vídeos do canal que apareceram ao menos uma vez nos dias com alcance medido.',
  })

  const medianaN = obs.median(comViews.map(v => v.views))
  const medianaViews = cell('medianaViews', 'mediana de views por vídeo', {
    value: medianaN == null ? null : F.num(medianaN), n: comViews.length,
    missing: total === 0 ? 'nenhum vídeo guardado' : 'sem contagem de views',
    base: `mediana de ${noun(comViews.length, 'vídeo', 'vídeos')} com contagem; ${vids.length - comViews.length ? `${vids.length - comViews.length} sem contagem ficam fora` : 'nenhum fica sem contagem'}`,
  })

  const maisVisto = comViews.reduce<(ObsVideo & { views: number }) | null>((m, v) => (m == null || v.views > m.views ? v : m), null)
  const maisVistoCell = cell('maisVisto', 'views do vídeo mais visto', {
    value: maisVisto ? F.num(maisVisto.views) : null,
    missing: total === 0 ? 'nenhum vídeo guardado' : 'sem contagem de views',
    base: maisVisto ? (maisVisto.title.trim() ? maisVisto.title : 'vídeo sem título') : 'nenhum vídeo com contagem de views',
  })

  const e90 = SL.engagement
  const recentes = vids.filter(v => v.tracked && v.fmt === 'long' && v.ageDays <= 90)
  const engajamento90 = cell('engajamento90', 'engajamento em 90 dias', {
    value: e90.median == null ? null : F.dec1(e90.median * 100) + '%', n: e90.n,
    missing: recentes.length === 0 ? 'nenhum longo em 90 dias' : 'nenhum longo de 90 dias com curtidas e comentários medidos',
    base: `(curtidas + comentários) ÷ views, mediana em ${noun(e90.n, 'longo', 'longos')} de até 90 dias`,
  })

  // (curtidas + comentários) ÷ views por vídeo; só entra quem tem as três medidas, views acima de 0 e a taxa finita (NaN nunca vira "NaN%")
  const taxaDe = (v: ObsVideo): number | null => {
    if (v.views == null || v.views <= 0 || v.likes == null || v.comments == null) return null
    const t = (v.likes + v.comments) / v.views
    return Number.isFinite(t) ? t : null
  }
  const taxas = vids.map(taxaDe).filter((t): t is number => t != null)
  const eTodos = obs.median(taxas)
  // quem fica fora da conta, por motivo (cada vídeo conta em UM só): sem contagem de views, com 0 views (a taxa não existe), sem curtidas ou comentários medidos
  const semViewsN = vids.filter(v => v.views == null).length
  const zeroViewsN = vids.filter(v => v.views === 0).length
  const semMedidaN = vids.length - taxas.length - semViewsN - zeroViewsN
  const foraDaConta = [
    semViewsN ? `${semViewsN} sem contagem de views` : null,
    zeroViewsN ? `${zeroViewsN} com 0 views` : null,
    semMedidaN ? `${semMedidaN} sem curtidas ou comentários medidos` : null,
  ].filter((t): t is string => t != null)
  const engajamentoTodos = cell('engajamentoTodos', 'engajamento, todos os vídeos', {
    value: eTodos == null ? null : F.dec1(eTodos * 100) + '%', n: taxas.length,
    missing: total === 0 ? 'nenhum vídeo guardado' : 'nenhum vídeo com curtidas e comentários medidos',
    base: `(curtidas + comentários) ÷ views, mediana em ${noun(taxas.length, 'vídeo', 'vídeos')}, sem janela de tempo; ${foraDaConta.length ? `${foraDaConta.join(' e ')} ficam fora` : 'nenhum fica de fora'}`,
  })

  const dur = duracaoMediana(obs, vids)
  const duracao = cell('duracaoMediana', 'duração mediana dos longos', {
    value: dur.median == null ? null : durText(dur.median), missing: 'sem duração nos longos',
    base: dur.median == null ? 'nenhum longo acompanhado tem a duração guardada' : `mediana em ${noun(dur.n, 'longo acompanhado', 'longos acompanhados')}`,
  })

  // zero medido (nenhum vídeo em 13 semanas) é um VALOR, "parado", e não "não medido": a célula não usa o estilo do dado ausente
  const parado = kl.n + ks.n === 0
  const ritmo = cell('ritmo', 'longos + Shorts por semana', {
    value: parado ? `parado: nenhum em ${R.habit.weeks} semanas` : `${F.dec1(kl.pw)} + ${F.dec1(ks.pw)}`, missing: '',
    base: `longos + Shorts por semana, média de ${R.habit.weeks} semanas (${noun(kl.n, 'longo', 'longos')}, ${noun(ks.n, 'Short', 'Shorts')})`,
  })

  const vpdVideo = cell('vpdVideo', 'views/dia por vídeo', {
    value: vpd.valor == null ? null : vpdText(vpd.valor, F.num), n: vpd.n,
    missing: vpd.motivo == null ? '' : motivoVpdTexto(vpd.motivo, vpd, dm),
    base: baseVpdTexto(vpd, dm) ?? 'mediana, entre os longos acompanhados, da média diária dos últimos 28 dias do YouTube com medida',
  }, { sub: vpd.valor != null ? 'mediana dos longos, 28 dias' : null })

  // % assistido do canal: média do percentual de cada dia, pesada pelas views, nos 28 dias; com menos de 7 dias com dado não crava número (decisão do dono)
  const ass = assistidoDoCanal(dados.diario, longos)
  const assistido = celulaAssistido(ass, cell, dm)

  const retencao = cell('retencao', 'retenção (curva)', {
    value: null, missing: 'a curva ainda não é coletada', base: 'a curva de retenção por minuto chega com a coleta de retenção; fica na página de cada vídeo',
  }, { sub: 'a curva ainda não é coletada', explicada: true })

  const inscritos30 = pc({ ...celulaCrescimento30(obs, ch, SL.growth30, cell), key: 'inscritos30' })

  /* ---------------------------------------------------------------- sincronização e posição */
  const tail = total ? ` · ${noun(total, 'vídeo', 'vídeos')}` : ' · nenhum vídeo guardado'
  const sync = sincronizacaoDoCanal(obs, ch, tail).text

  const posicaoItens = o.posicao ? itensDePosicao(o.posicao, { ch, longos90: recentes.length, vpd, dm, F }) : null
  const many = o.muitosProprios
  const faixa = [inscritos, videos, viewsSomadas, impressoes, diasComImpressao, diasDesdeUltimo]
  const todos = [cliques, taxaClique, videosComImpressao, medianaViews, maisVistoCell, engajamento90, engajamentoTodos, duracao, ritmo, vpdVideo, assistido, retencao, inscritos30]
  return {
    id: ch.id, name: ch.name, handle: ch.handle, url: ch.url, avatar: ch.avatar ?? null, ini: ch.ini, color: ch.color, lang: langChip(ch.lang, many),
    faixa,
    resumo: resumoDoCanal(ultimo, canalParado, alc, noun, F),
    faixaMotivo: motivoDasCelulas(faixa), todosMotivo: motivoDasCelulas(todos),
    todos,
    sync,
    posicaoLinha: posicaoItens ? juntar(posicaoItens) : null,
    posicaoItens,
  }
}

/* ---------------------------------------------------------------- resumo, motivo e % assistido */

/** Mais que isto sem publicar e o canal está parado (a linha-resumo diz "Canal parado há N dias"). */
export const DIAS_CANAL_PARADO = 60

const plural1 = (n: number, um: string, muitos: string, F: Pick<Fmt, 'int'>): string => `${F.int(n)} ${n === 1 ? um : muitos}`

/** A linha sob o nome (mockup 2): "Canal parado há N dias" ou "Último vídeo há N dias", e o que o alcance diz em uma oração. Nenhum número privado sem permissão. */
function resumoDoCanal(ultimo: ObsVideo | null, parado: boolean, alc: AlcanceLido, noun: (n: number, um: string, muitos: string) => string, F: Pick<Fmt, 'int'>): ResumoCanalView | null {
  if (!ultimo) return null
  // vídeo de hoje: "há 0 dias" soaria a erro
  const destaque = ultimo.ageDays === 0 ? 'Último vídeo hoje' : `${parado ? 'Canal parado' : 'Último vídeo'} há ${noun(ultimo.ageDays, 'dia', 'dias')}`
  let resto: string
  switch (alc.estado) {
    case 'negado': resto = '; só quem edita o site vê os números de alcance.'; break
    case 'erro': resto = '; a leitura do alcance falhou agora; recarregue a página.'; break
    case 'sem-relatorio': resto = '; ainda sem números de alcance.'; break
    case 'ok': {
      const r = alc.resumo
      if (r.diasLidos === 0 || r.imp == null) resto = '; ainda não há dia de alcance medido.'
      else if (r.imp === 0) resto = `; nenhuma impressão em ${plural1(r.diasLidos, 'dia medido', 'dias medidos', F)}.`
      else resto = `; ${plural1(r.imp, 'impressão', 'impressões', F)} em ${plural1(alc.periodo.dias, 'dia', 'dias', F)}.`
      break
    }
    default: { const nunca: never = alc; return nunca }
  }
  return { destaque, parado, resto }
}

const cap1 = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * UMA frase com o motivo das células sem número que não se explicam sozinhas (a pastilha da célula é só o quadradinho hachurado; o motivo sobe para
 * cá, sem repetir quatro vezes). Sem permissão: só quem vê. Senão: "Não medido: ..." e a lembrança de que não é zero. null = nenhuma célula sem número.
 */
export function motivoDasCelulas(cs: readonly ProprioCell[]): string | null {
  const todos = [...new Set(cs.filter(c => c.value == null && !c.explicada && c.missing).map(c => c.missing as string))]
  const negados = todos.filter(m => m.startsWith('só quem edita'))
  const outros = todos.filter(m => !m.startsWith('só quem edita'))
  const frases = [
    ...negados.map(m => cap1(m) + '.'),
    ...(outros.length ? [`Não medido: ${outros.join('; ')}. Nenhum destes números é zero, só falta medir.`] : []),
  ]
  return frases.length ? frases.join(' ') : null
}

/** Na taxa do canal: faixa de mais de 5 pontos não diz se é alta ou baixa. */
function taxaLargaFrase(t: Parameters<typeof canalLargo>[0]): string {
  return canalLargo(t) ? 'Ainda não dá para dizer se é alta ou baixa.' : ''
}

/** O motivo (curto, em minúscula, sem ponto) de não haver % assistido do canal. */
function motivoAssistido(a: AssistidoCanal, dm: (d: DiaYt) => string): string {
  switch (a.motivo) {
    case 'sem-acesso': return FRASE_NEGADO
    case 'leitura-falhou': return 'a leitura do % assistido falhou agora; recarregue a página'
    case 'sem-diario': return 'ainda não há coleta diária deste canal'
    case 'sem-views': return a.janela ? `nenhum vídeo teve views nos 28 dias até ${dm(a.janela.ate)}` : 'nenhum vídeo teve views nos 28 dias'
    case 'sem-percentual': return 'o YouTube ainda não entregou o % assistido'
    case null: return ''
    default: { const nunca: never = a.motivo; return nunca }
  }
}

const BASE_ASSISTIDO = 'Média do percentual assistido de cada dia, pesada pelas views do dia, nos vídeos longos acompanhados, nos 28 dias que terminam no último dia medido. Acima de 100%: trecho que muita gente voltou para rever.'

function celulaAssistido(a: AssistidoCanal, cell: (key: string, label: string, v: Parameters<MakeCell>[2], x?: Partial<Omit<ProprioCell, keyof NumCell>>) => ProprioCell, dm: (d: DiaYt) => string): ProprioCell {
  if (a.pct == null) return cell('assistido', '% assistido', { value: null, missing: motivoAssistido(a, dm), base: BASE_ASSISTIDO })
  if (a.dias < MIN_DIAS_ASSISTIDO) {
    // há dado, mas poucos dias: nunca um número cravado em cima de quase nada
    return cell('assistido', '% assistido', { value: null, missing: 'ainda não dá para dizer', base: `${BASE_ASSISTIDO} Com menos de ${MIN_DIAS_ASSISTIDO} dias com dado a média ainda não diz nada.` },
      { sub: `só ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'} com dado; precisa de ${MIN_DIAS_ASSISTIDO}`, semNumero: true, explicada: true })
  }
  return cell('assistido', '% assistido', { value: `${Math.round(a.pct)}%`, missing: '', base: BASE_ASSISTIDO },
    { sub: a.n < POUCAS_VIEWS_MEDIA ? `só ${a.n} views: pouco para uma média` : 'média pelas views, 28 dias', fraco: a.n < POUCAS_VIEWS })
}

/* ---------------------------------------------------------------- a linha de posição */

/** "Entre 14 canais de Viagem" | "Entre 75 canais no geral". Switch exaustivo sobre o conjunto. */
function entreTexto(c: Conjunto, de: number, F: Fmt): string {
  switch (c.tipo) {
    case 'nicho': return `Entre ${F.plural(de, 'canal', 'canais')} de ${c.label}`
    case 'geral': return `Entre ${F.plural(de, 'canal', 'canais')} ${conjuntoTexto(c)}`
    default: { const nunca: never = c; return nunca }
  }
}

/** O nicho da lista de Canais que a posição usa: o do conjunto, ou "todos" no geral (e para um nicho que a lista não conhece). */
export function nichoDoLink(c: Conjunto): NicheScope {
  switch (c.tipo) {
    case 'nicho': return parseNiche(c.niche) ?? 'todos'
    case 'geral': return 'todos'
    default: { const nunca: never = c; return nunca }
  }
}

/**
 * Os pedaços da linha de posição. Só inscritos e views/dia por mil inscritos têm a lista de Canais ordenada por eles (`link.canais({ sort })`);
 * mediana de views e longos em 90 dias não têm ordenação equivalente na lista e ficam sem link (texto, não link que promete o que não faz).
 */
function itensDePosicao(
  p: PosicaoNoNicho,
  x: { ch: ObsChannel; longos90: number; vpd: VpdCanal; dm: (d: DiaYt) => string; F: Fmt },
): PosicaoItens {
  const { F } = x
  const todas = [p.inscritos, p.medianaViews, p.longos90].filter((q): q is Posicao => q != null)
  const de = Math.max(0, ...todas.map(q => q.de), p.vpdPorMil?.de ?? 0)
  // a posição, com o "de N" só quando o conjunto deste número é menor que o da frase (canal sem o valor fica fora)
  const pos = (q: Posicao) => `${q.pos}º${q.de !== de ? ` de ${q.de}` : ''}`
  const emp = (q: Posicao) => (q.empate ? ' (empate)' : '')
  const niche = nichoDoLink(p.conjunto)
  const itens: PosicaoItem[] = [
    // só liga quando HÁ posição: sem ela o clique levaria a uma lista ordenada onde este canal está sem valor
    { chave: 'inscritos', href: p.inscritos ? link.canais({ niche, sort: 'subs' }) : null,
      texto: p.inscritos ? `${pos(p.inscritos)} em inscritos${emp(p.inscritos)}` : `sem posição em inscritos${x.ch.subs == null ? ' (ocultos pelo canal)' : ''}` },
    { chave: 'medianaViews', href: null,
      texto: p.medianaViews ? `${pos(p.medianaViews)} em mediana de views${emp(p.medianaViews)}` : 'sem posição em mediana de views (sem contagem)' },
    { chave: 'longos90', href: null,
      texto: p.longos90 ? `${pos(p.longos90)} em longos em 90 dias${x.longos90 === 0 ? ' (nenhum)' : ''}${emp(p.longos90)}` : 'sem posição em longos em 90 dias' },
    { chave: 'vpdPorMil', href: p.vpdPorMil ? link.canais({ niche, sort: 'vpd' }) : null, texto: `Views/dia por mil inscritos: ${porMil(p.vpdPorMil, de, x)}` },
  ]
  const intro = todas.length ? `${entreTexto(p.conjunto, de, F)}:` : `Sem posição calculada ${conjuntoTexto(p.conjunto)}:`
  return { intro, itens }
}

/** A linha inteira: a introdução, os três primeiros itens separados por vírgula e o quarto em outra frase. */
function juntar(p: PosicaoItens): string {
  const [a, b, c, e] = p.itens
  return `${p.intro} ${[a, b, c].map(i => i?.texto).join(', ')}. ${e?.texto}.`
}

/** A posição em views/dia por mil inscritos, ou o motivo de não haver: nunca "0" no lugar de "não medido". */
function porMil(q: Posicao | null, de: number, x: { ch: ObsChannel; vpd: VpdCanal; dm: (d: DiaYt) => string; F: Fmt }): string {
  if (q) {
    const valor = x.vpd.valor != null && x.ch.subs != null && x.ch.subs > 0 ? vpdText(x.vpd.valor / (x.ch.subs / 1000), x.F.num) : null
    return `${q.pos}º${q.de !== de ? ` de ${q.de}` : ''}${q.empate ? ' (empate)' : ''}${valor != null ? `, com ${valor}` : ''}`
  }
  if (x.vpd.motivo != null) return motivoVpdTexto(x.vpd.motivo, x.vpd, x.dm)
  if (x.ch.subs == null) return 'inscritos ocultos pelo canal'
  if (x.ch.subs === 0) return 'o canal ainda não tem inscritos'
  return 'ainda não medido'
}
