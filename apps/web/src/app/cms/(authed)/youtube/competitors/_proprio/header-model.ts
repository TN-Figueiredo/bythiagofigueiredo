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
import { alcancePorVideo, montarDias, resumir, type Periodo, type ResumoAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { AlcanceCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { baseVpdTexto, motivoVpdTexto, vpdDoCanal, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import {
  celulaCrescimento30, celulaInscritos, makeCell, sincronizacaoDoCanal, type MakeCell, type NumCell,
} from '../_canal/header-model'
import { durText, duracaoMediana, vpdText } from '../_canal/numeros'
import { langChip, type LangChip } from '../_chrome/own-channels'
import type { DadosDoCanal } from './dados'
import { longosAcompanhados } from './extras'

export type { NumCell }

/** As posições do canal entre os do nicho (ou no geral, sem nicho), calculadas no servidor com o conjunto do site. null = não calculadas. */
export interface PosicaoNoNicho {
  conjunto: Conjunto
  inscritos: Posicao | null
  medianaViews: Posicao | null
  longos90: Posicao | null
  vpdPorMil: Posicao | null
}

export interface ProprioHeaderView {
  id: string; name: string; handle: string; url: string; avatar: string | null; ini: string; lang: LangChip | null
  /** 6, nesta ordem: inscritos, videos, viewsSomadas, impressoes, diasComImpressao, diasDesdeUltimo */
  faixa: NumCell[]
  /** 11, na ordem de 16.3: cliques, videosComImpressao, medianaViews, maisVisto, engajamento90, engajamentoTodos, duracaoMediana, ritmo, vpdVideo, retencao, inscritos30 */
  todos: NumCell[]
  sync: string
  /** "Entre 14 canais de Viagem: 14º em inscritos, …"; null = as posições não foram calculadas */
  posicaoLinha: string | null
}

/* ---------------------------------------------------------------- o dado privado, em quatro estados */

/** Onde o alcance está: tudo o que não é 'ok' vira UMA frase (a mesma em toda célula de alcance). */
export type EstadoAlcance = 'negado' | 'erro' | 'sem-relatorio' | 'ok'

export const FRASE_NEGADO = 'só quem edita o site vê este número'
export const FRASE_ERRO = 'a leitura do alcance falhou agora; recarregue a página'
export const FRASE_SEM_RELATORIO = 'ainda sem relatório de alcance deste canal'
/** Há relatório, mas nenhum dia do período foi lido ainda (todos por baixar, com erro ou expirados). */
export const FRASE_NADA_LIDO = 'nenhum dia do período foi lido ainda'
export const FRASE_CTR = 'não medido: o YouTube não devolveu o CTR de algum dia com impressão'

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
export function lerEstado(p: Privado<AlcanceCanal>): AlcanceLido {
  if (p.acesso === 'negado') return { estado: 'negado' }
  if (p.acesso === 'erro') return { estado: 'erro' }
  const { periodo, dias } = montarDias(p.dado)
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
  o: { hoje: DiaYt; dm: (d: DiaYt) => string; posicao: PosicaoNoNicho | null },
): ProprioHeaderView | null {
  const ch: ObsChannel | undefined = obs.channel(canalId)
  if (!ch || !ch.own) return null
  const F: Fmt = obs.fmt, D = obs.date, R = obs.RULES, { dm } = o
  const noun = (n: number, one: string, many: string) => F.plural(n, one, many)
  const cell: MakeCell = makeCell(false, R.weakBase)
  const vids = obs.videos.filter(v => v.ch === ch.id)
  const total = vids.length + ch.undated.length
  const longos = longosAcompanhados(obs, ch.id)

  const alc = lerEstado(dados.alcance)
  const vpd: VpdCanal = vpdDoCanal(dados.diario, longos, o.hoje)

  const SL = obs.channelStats(ch.id, 'long')
  const kl = obs.cadence(ch.id, 'long'), ks = obs.cadence(ch.id, 'short')

  /* ---------------------------------------------------------------- faixa */
  const inscritos: NumCell = { ...celulaInscritos(ch, F, cell), key: 'inscritos' }

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

  const DIA_YT = 'O dia é o do YouTube (horário do Pacífico), não o de São Paulo.'
  const periodoTxt = alc.estado === 'ok' ? `de ${dm(alc.periodo.de)} a ${dm(alc.periodo.ate)}` : null
  const lidos = alc.estado === 'ok' ? alc.resumo.diasLidos : 0
  const nada = alc.estado === 'ok' && alc.resumo.diasLidos === 0
  /** A frase quando falta número: a do estado, ou "nada lido" quando há relatório mas nenhum dia foi lido. */
  const faltaAlcance = (): string => fraseDoAlcance(alc.estado) ?? FRASE_NADA_LIDO

  const impressoes = cell('impressoes', periodoTxt ? `impressões ${periodoTxt}` : 'impressões no período', {
    value: alc.estado === 'ok' && !nada ? F.num(alc.resumo.imp ?? 0) : null,
    missing: faltaAlcance(),
    base: alc.estado === 'ok'
      ? `Vezes em que a miniatura de um vídeo apareceu no YouTube, somadas ${periodoTxt} (${noun(alc.periodo.dias, 'dia', 'dias')}). ${noun(lidos, 'dia lido', 'dias lidos')}; ${alc.resumo.diasNaoMedidos ? `${noun(alc.resumo.diasNaoMedidos, 'dia', 'dias')} sem relatório lido ficam fora da soma` : 'nenhum dia fica sem relatório lido'}. ${DIA_YT}`
      : 'Vezes em que a miniatura de um vídeo apareceu no YouTube, somadas no período dos relatórios de alcance do canal.',
  })

  const diasComImpressao = cell('diasComImpressao', 'dias com impressão', {
    value: alc.estado === 'ok' && !nada ? `${alc.resumo.diasComImpressao} de ${alc.resumo.diasLidos}` : null,
    missing: faltaAlcance(),
    base: alc.estado === 'ok'
      ? `Dos ${noun(lidos, 'dia lido', 'dias lidos')} ${periodoTxt}, ${alc.resumo.diasComImpressao} trouxeram impressões e ${lidos - alc.resumo.diasComImpressao} vieram vazios. ${alc.resumo.diasNaoMedidos ? `${noun(alc.resumo.diasNaoMedidos, 'dia', 'dias')} sem relatório lido ficam fora da conta. ` : ''}${DIA_YT}`
      : 'Dias do período em que algum vídeo teve impressões, sobre os dias com relatório de alcance lido.',
  })

  // o vídeo mais recente (de qualquer formato) diz há quantos dias o canal não publica
  const ultimo = vids.reduce<ObsVideo | null>((m, v) => (m == null || v.pub > m.pub ? v : m), null)
  const diasDesdeUltimo = cell('diasDesdeUltimo', 'desde o último vídeo', {
    value: ultimo ? noun(ultimo.ageDays, 'dia', 'dias') : null,
    missing: 'nenhum vídeo guardado',
    base: ultimo ? `publicado em ${D.dmOrDmy(ultimo.pub)} ${D.hm(ultimo.pub)} (São Paulo)` : 'o canal não tem vídeo com data de publicação guardado',
  })

  /* ---------------------------------------------------------------- todos os números */
  const cliquesOk = alc.estado === 'ok' && !nada
  const cliquesTotal = alc.estado === 'ok' ? alc.resumo.cliques : null
  const BASE_CLIQUES = 'Estimado: impressões × CTR de cada dia e vídeo, somados e arredondados uma vez, no total; por isso o total pode diferir da soma das partes escritas. O YouTube não informa cliques.'
  const cliques = cell('cliques', 'cliques estimados no período', {
    // arredonda só o total que aparece; um total positivo que arredondaria para 0 diz "menos de 1", nunca "0"
    value: cliquesOk && cliquesTotal != null ? cliquesTexto(cliquesTotal, F) : null,
    missing: cliquesOk ? FRASE_CTR : faltaAlcance(),
    base: cliquesOk && cliquesTotal == null ? `${BASE_CLIQUES} Algum dia com impressão veio sem CTR, então o total não é calculado.` : BASE_CLIQUES,
  })

  // o numerador sai do MESMO conjunto do total: linha de vídeo que saiu do canal (apagado, privado) não conta, senão "5 de 3"
  const doCanal = new Set<string>([...vids.map(v => v.ytId), ...ch.undated.map(u => u.ytId)])
  const comImpressao = alc.estado === 'ok' ? [...alc.porVideo.keys()].filter(id => doCanal.has(id)).length : 0

  const videosComImpressao = cell('videosComImpressao', 'vídeos com alguma impressão', {
    value: alc.estado === 'ok' && !nada ? `${comImpressao} de ${total}` : null,
    missing: faltaAlcance(),
    base: alc.estado === 'ok' ? `Vídeos que apareceram ao menos uma vez nos dias lidos ${periodoTxt}. ${DIA_YT}` : 'Vídeos do canal que apareceram ao menos uma vez nos dias com relatório de alcance lido.',
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

  const taxas = vids.filter(v => v.views != null && v.views > 0 && v.likes != null && v.comments != null).map(v => (v.likes! + v.comments!) / v.views!)
  const eTodos = obs.median(taxas)
  const engajamentoTodos = cell('engajamentoTodos', 'engajamento, todos os vídeos', {
    value: eTodos == null ? null : F.dec1(eTodos * 100) + '%', n: taxas.length,
    missing: total === 0 ? 'nenhum vídeo guardado' : 'nenhum vídeo com curtidas e comentários medidos',
    base: `(curtidas + comentários) ÷ views, mediana em ${noun(taxas.length, 'vídeo', 'vídeos')}, sem janela de tempo; ${vids.length - taxas.length ? `${vids.length - taxas.length} sem curtidas ou comentários medidos ficam fora` : 'nenhum fica de fora'}`,
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
  })

  const retencao = cell('retencao', 'retenção e percentual assistido', {
    value: null, missing: 'ainda não coletada', base: 'chega com a coleta de retenção',
  })

  const inscritos30: NumCell = { ...celulaCrescimento30(obs, ch, SL.growth30, cell), key: 'inscritos30' }

  /* ---------------------------------------------------------------- sincronização e posição */
  const tail = total ? ` · ${noun(total, 'vídeo', 'vídeos')}` : ' · nenhum vídeo guardado'
  const sync = sincronizacaoDoCanal(obs, ch, tail).text

  const many = obs.ownChannels().length > 1
  return {
    id: ch.id, name: ch.name, handle: ch.handle, url: ch.url, avatar: ch.avatar ?? null, ini: ch.ini, lang: langChip(ch.lang, many),
    faixa: [inscritos, videos, viewsSomadas, impressoes, diasComImpressao, diasDesdeUltimo],
    todos: [cliques, videosComImpressao, medianaViews, maisVistoCell, engajamento90, engajamentoTodos, duracao, ritmo, vpdVideo, retencao, inscritos30],
    sync,
    posicaoLinha: o.posicao ? linhaDePosicao(o.posicao, { ch, longos90: recentes.length, vpd, dm, F }) : null,
  }
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

function linhaDePosicao(
  p: PosicaoNoNicho,
  x: { ch: ObsChannel; longos90: number; vpd: VpdCanal; dm: (d: DiaYt) => string; F: Fmt },
): string {
  const { F } = x
  const todas = [p.inscritos, p.medianaViews, p.longos90].filter((q): q is Posicao => q != null)
  const de = Math.max(0, ...todas.map(q => q.de), p.vpdPorMil?.de ?? 0)
  // a posição, com o "de N" só quando o conjunto deste número é menor que o da frase (canal sem o valor fica fora)
  const pos = (q: Posicao) => `${q.pos}º${q.de !== de ? ` de ${q.de}` : ''}`
  const emp = (q: Posicao) => (q.empate ? ' (empate)' : '')
  const itens = [
    p.inscritos ? `${pos(p.inscritos)} em inscritos${emp(p.inscritos)}` : `sem posição em inscritos${x.ch.subs == null ? ' (ocultos pelo canal)' : ''}`,
    p.medianaViews ? `${pos(p.medianaViews)} em mediana de views${emp(p.medianaViews)}` : 'sem posição em mediana de views (sem contagem)',
    p.longos90 ? `${pos(p.longos90)} em longos em 90 dias${x.longos90 === 0 ? ' (nenhum)' : ''}${emp(p.longos90)}` : 'sem posição em longos em 90 dias',
  ]
  const intro = todas.length ? `${entreTexto(p.conjunto, de, F)}: ${itens.join(', ')}.` : `Sem posição calculada ${conjuntoTexto(p.conjunto)}: ${itens.join(', ')}.`
  return `${intro} Views/dia por mil inscritos: ${porMil(p.vpdPorMil, de, x)}.`
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
