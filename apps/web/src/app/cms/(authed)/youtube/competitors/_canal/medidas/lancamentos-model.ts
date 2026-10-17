// E5a Tarefa 17: Lançamentos (como os vídeos novos começam) e as 72 horas do canal. Puro: relógio e dados entram por parâmetro.
// A linha do normal é a M2 da E4, com o `n` de cada ponto. A razão de cada vídeo usa o normal SEM o próprio vídeo (pergunta 21).
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import type { PontoDaCurva, VideoComSerie } from '@/lib/youtube/observatorio/medidas/curva'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { baseDaIdade, type Leitura } from '@/lib/youtube/observatorio/medidas/m1'
import type { MarcasDoCanal, VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { Formato, Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import { INICIO_DAS_MARCAS } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { faixaDeLancamento, normalSem, type FaixaDeLancamento } from '@/lib/youtube/observatorio/medidas-telas/faixa-do-normal'
import { FRASES_DAS_HORAS } from '@/lib/youtube/observatorio/medidas-telas/frases-das-horas'
import type { HorasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'
import { pontosDoVideoDeM1 } from '@/lib/youtube/observatorio/medidas-telas/pontos-por-idade'
import { REGRAS_DAS_72_HORAS as R72, curvaDe72Horas, tracaoDoCanal, type VideoDaTracao } from '@/lib/youtube/observatorio/medidas-telas/tracao-72h'
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'
import type { UltimoVideo, VideoDaOracao } from './frase-do-topo'
import type { FormatoDoCanal } from './cabecalho-model'
import { dec1, dm, ptn, quando } from './formatos'

export const QUANTOS_VIDEOS = 6
/** As idades da linha do normal na tela (as oito casas): de 1 a 30 dias. */
export const IDADES_DA_TELA: readonly number[] = MEASURE_RULES.curve.ages.filter(a => a <= 30)
const RAZAO_ACIMA = 1.5

export const NOME_DA_FAIXA: Record<FaixaDeLancamento | 'sem_normal', string> = {
  muito_acima: 'muito acima do normal', acima: 'acima do normal', perto: 'perto do normal', abaixo: 'abaixo do normal', sem_normal: 'sem normal para comparar',
}

export interface PontoDoNormal { idadeDias: number; valor: number | null; n: number | null }
export interface VideoDeLancamento {
  id: string
  ordem: number
  titulo: string
  /** "o último longo · publicado há 3 dias · 12,4 mil views". */
  legenda: string
  faixa: FaixaDeLancamento | 'sem_normal'
  faixaNome: string
  /** "1,4× no dia 7"; nulo = sem ponto para comparar. */
  razao: string | null
  /** O último ponto com normal, em números (a frase do topo usa). */
  ultima: { dia: number; razao: number } | null
  curva: Array<{ idadeDias: number; views: number }>
  passou: { dia: number; razao: number; valor: number } | null
  frase: { negrito: string; resto: string }
}

export type ModeloDeLancamentos =
  | { tipo: 'nao_carregou'; motivo: string }
  /** Nenhum vídeo com um dia de contagem: o cartão de uma linha, sem gráfico e sem as oito casas. */
  | { tipo: 'vazio'; frase: string; explicacao: string }
  | {
    tipo: 'curvas'
    soShorts: boolean
    frase: { negrito: string; resto: string } | null
    normal: PontoDoNormal[]
    temNormal: boolean
    /** A legenda "menos de 3 vídeos: sem ponto" só existe quando há casa hachurada. */
    temCasaSemPonto: boolean
    videos: VideoDeLancamento[]
    melhorN: number | null
    /** O teto do eixo de views e os três rótulos (0, metade, teto), escritos no servidor. */
    escala: { ymax: number; rotulos: [string, string, string] }
  }

export interface EntradaDeLancamentos {
  F: Pick<Fmt, 'num'>
  medidas: MedidasDoCanal | null
  videos: readonly VideoLido[] | null
  marcas: MarcasDoCanal | null
  /** Nulo = a série dia a dia não foi lida (ou não foi pedida). */
  serie: ReadonlyMap<string, Leitura[]> | null
  formato: FormatoDoCanal
  titulos: ReadonlyMap<string, string>
  primeiraBusca: boolean
  agoraMs: number
  hojeSP: string
}

const formatoDe = (v: VideoLido): Formato | null => (v.isShort === true ? 'short' : v.isShort === false ? 'long' : null)
const x1 = (r: number): string => dec1(r)

/** Os vídeos do formato principal com data, do mais recente ao mais antigo. */
function doFormato(videos: readonly VideoLido[], f: Formato): Array<{ v: VideoLido; baseMs: number }> {
  const out: Array<{ v: VideoLido; baseMs: number }> = []
  for (const v of videos) {
    if (v.liveBroadcastContent === 'upcoming' || formatoDe(v) !== f) continue
    const baseMs = baseDaIdade(v)
    if (baseMs !== null) out.push({ v, baseMs })
  }
  return out.sort((a, b) => b.baseMs - a.baseMs)
}

/** Um teto "redondo" (1, 2, 2,5, 3, 4, 5, 8 ou 10 vezes uma potência de dez) logo acima de `mx`. */
export function tetoRedondo(mx: number): number {
  const e = Math.pow(10, Math.floor(Math.log10(mx)))
  const f = mx / e
  const g = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 8 ? 8 : 10
  return g * e
}

export interface ResultadoDeLancamentos { modelo: ModeloDeLancamentos; ultimo: UltimoVideo }

export function lancamentosDoCanal(o: EntradaDeLancamentos): ResultadoDeLancamentos {
  const f = o.formato.fmt
  const quem = f === 'long' ? 'vídeo longo' : 'Short'
  const nc = (motivo: string): ResultadoDeLancamentos => ({ modelo: { tipo: 'nao_carregou', motivo }, ultimo: { tipo: o.primeiraBusca ? 'canal_novo' : 'nenhum' } })
  if (o.medidas === null || o.videos === null || o.marcas === null) return nc('a leitura dos vídeos ou das medidas falhou')
  if (o.serie === null) return nc('não deu para ler o dia a dia dos vídeos')
  const m2 = o.medidas.porFormato[f].m2
  if (m2.estado === 'nao_medido' && classeDoMotivo(m2.motivo) === 'nao_carregou') return nc('a linha do normal não carregou')

  const todos = o.videos.filter(v => v.publishedAt !== null)
  const serie = o.serie
  const comSerie: Array<VideoComSerie & { id: string }> = []
  for (const v of todos) {
    const baseMs = baseDaIdade(v)
    const pub = Date.parse(v.publishedAt as string)
    if (!Number.isFinite(pub)) continue
    comSerie.push({
      id: v.id, formato: formatoDe(v), publicadoEm: pub, baseMs, wasLive: v.wasLive,
      agendadoOuNoAr: v.liveBroadcastContent === 'upcoming' || v.liveBroadcastContent === 'live',
      marcas: o.marcas.marcas.get(v.id) ?? {}, faltas: o.marcas.faltas.get(v.id) ?? {}, leituras: serie.get(v.id) ?? [],
    })
  }

  const pontosDe = (v: VideoLido, baseMs: number) => {
    const m1 = o.medidas!.porVideo.get(v.id)?.m1
    if (!m1) return []
    return pontosDoVideoDeM1({ baseMs }, serie.get(v.id) ?? [], m1, o.agoraMs)
      .filter(p => p.idadeDias <= 30 && p.ponto.estado === 'medido')
      .map(p => ({ idadeDias: p.idadeDias, views: (p.ponto as Extract<Medida<number>, { estado: 'medido' }>).valor }))
  }

  // A linha do normal da E4, com o n de cada ponto. Sem M2 medida, todos os pontos ficam sem valor.
  const pontosM2: Map<number, PontoDaCurva> = new Map()
  if (m2.estado === 'medido') for (const p of m2.valor) pontosM2.set(p.idadeDias, p)
  const normal: PontoDoNormal[] = IDADES_DA_TELA.map(a => {
    const p = pontosM2.get(a)
    if (!p) return { idadeDias: a, valor: null, n: null }
    return p.ponto.estado === 'medido' ? { idadeDias: a, valor: p.ponto.valor, n: p.ponto.n } : { idadeDias: a, valor: null, n: p.ponto.n ?? null }
  })
  const temNormal = normal.some(p => p.valor !== null)

  // Os 6 mais recentes que já completaram um dia de contagem e têm pelo menos um ponto.
  const candidatos = doFormato(o.videos, f).filter(c => c.v.wasLive !== true)
  const listados: Array<{ v: VideoLido; baseMs: number; pontos: Array<{ idadeDias: number; views: number }> }> = []
  for (const c of candidatos) {
    if (listados.length >= QUANTOS_VIDEOS) break
    if (o.agoraMs - c.baseMs < DAY) continue
    const pontos = pontosDe(c.v, c.baseMs)
    if (pontos.length > 0) listados.push({ ...c, pontos })
  }

  const ultimoDoFormato = candidatos[0] ?? null
  const razoesDe = (id: string, pontos: Array<{ idadeDias: number; views: number }>) => {
    const n = normalSem(comSerie, id, { formato: f, agoraMs: o.agoraMs })
    const porIdade = new Map<number, number>()
    if (n.estado === 'medido') for (const p of n.valor) if (p.ponto.estado === 'medido' && p.ponto.valor > 0) porIdade.set(p.idadeDias, p.ponto.valor)
    return pontos.flatMap(p => { const nv = porIdade.get(p.idadeDias); return nv === undefined ? [] : [{ dia: p.idadeDias, razao: p.views / nv, valor: nv, views: p.views }] })
  }

  const videosDeTela: VideoDeLancamento[] = listados.map((l, i) => {
    const titulo = o.titulos.get(l.v.id) ?? '(sem título)'
    const rz = razoesDe(l.v.id, l.pontos)
    const ult = rz.length ? rz[rz.length - 1]! : null
    const pas = rz.find(r => r.razao >= RAZAO_ACIMA) ?? null
    const faixa: FaixaDeLancamento | 'sem_normal' = ult ? faixaDeLancamento(ult.razao) : 'sem_normal'
    const dias = Math.floor((o.agoraMs - l.baseMs) / DAY)
    const prefixo = i === 0 ? (ultimoDoFormato && ultimoDoFormato.v.id === l.v.id ? (o.formato.doisFormatos ? 'o último longo · ' : 'o último · ') : 'o mais recente com contagem · ') : ''
    const legenda = `${prefixo}publicado ${quando(spDateOf(l.baseMs), o.hojeSP)} · ${l.v.viewCount === null ? 'sem views lidas' : `${o.F.num(l.v.viewCount)} views`}`
    let frase: { negrito: string; resto: string }
    if (pas) frase = { negrito: `“${titulo}” saiu acima do normal já no dia ${pas.dia}:`, resto: ` ${o.F.num(Math.round(pas.views))} views, ${x1(pas.razao)}× o normal do canal (${o.F.num(Math.round(pas.valor))}).` }
    else if (ult) frase = { negrito: `“${titulo}” está ${NOME_DA_FAIXA[faixa]}:`, resto: ` ${x1(ult.razao)}× o normal do canal no dia ${ult.dia}.` }
    else frase = { negrito: `“${titulo}” ainda não tem um ponto para comparar com o normal.`, resto: ` Ele tem ${ptn(dias, 'dia', 'dias')} e a linha do normal começa no dia 1.` }
    return {
      id: l.v.id, ordem: i + 1, titulo, legenda, faixa, faixaNome: NOME_DA_FAIXA[faixa], razao: ult ? `${x1(ult.razao)}× no dia ${ult.dia}` : null, ultima: ult ? { dia: ult.dia, razao: ult.razao } : null,
      curva: l.pontos, passou: pas ? { dia: pas.dia, razao: pas.razao, valor: pas.views } : null, frase,
    }
  })

  // O último vídeo, para a frase do topo.
  const oracaoDe = (v: VideoDeLancamento): VideoDaOracao => {
    if (v.passou) return { tipo: 'passou', titulo: v.titulo, dia: v.passou.dia, razao: v.passou.razao }
    if (!v.ultima) return { tipo: 'sem_normal', titulo: v.titulo }
    return { tipo: 'faixa', titulo: v.titulo, dia: v.ultima.dia, razao: v.ultima.razao }
  }
  let ultimo: UltimoVideo
  if (o.primeiraBusca) ultimo = { tipo: 'canal_novo' }
  else if (!ultimoDoFormato) ultimo = { tipo: 'nenhum' }
  else if (videosDeTela[0] && videosDeTela[0].id === ultimoDoFormato.v.id) ultimo = { tipo: 'medido', v: oracaoDe(videosDeTela[0]) }
  else if (o.agoraMs - ultimoDoFormato.baseMs < DAY) {
    ultimo = { tipo: 'saiu_agora', quando: quando(spDateOf(ultimoDoFormato.baseMs), o.hojeSP), anterior: videosDeTela[0] ? oracaoDe(videosDeTela[0]) : null }
  } else ultimo = { tipo: 'sem_contagem', motivo: ultimoDoFormato.baseMs < Date.parse(`${INICIO_DAS_MARCAS}T00:00:00-03:00`) ? 'antes_da_contagem' : 'sem_leitura' }

  if (videosDeTela.length === 0) {
    return {
      ultimo,
      modelo: {
        tipo: 'vazio', frase: `Nenhum ${quem} com contagem por vídeo ainda.`,
        explicacao: `As curvas aparecem quando o primeiro ${f === 'long' ? 'vídeo' : 'Short'} completar um dia de contagem; a linha do normal, quando houver ${3} medidos na mesma idade.`,
      },
    }
  }

  // O melhor n (só para a frase "ainda não há normal"): o E4 não o entrega quando a curva inteira não tem ponto.
  let melhorN: number | null = null
  if (!temNormal) {
    const por = new Map<number, number>()
    for (const c of candidatos) {
      if (o.agoraMs - c.baseMs > MEASURE_RULES.curve.windowDays * DAY) continue
      for (const p of pontosDe(c.v, c.baseMs)) por.set(p.idadeDias, (por.get(p.idadeDias) ?? 0) + 1)
    }
    melhorN = Math.max(0, ...por.values())
  }
  const escolhido = videosDeTela[0]!
  const frase = !temNormal
    ? { negrito: 'Ainda não há “normal” para comparar.', resto: ` Cada ponto da linha pede 3 ${f === 'long' ? 'vídeos' : 'Shorts'} medidos na mesma idade; hoje o melhor ponto tem ${melhorN ?? 0}. As curvas abaixo já mostram como cada ${f === 'long' ? 'vídeo' : 'Short'} novo começou.` }
    : escolhido.frase
  let mx = 10
  for (const v of videosDeTela) for (const p of v.curva) mx = Math.max(mx, p.views)
  for (const p of normal) if (p.valor !== null) mx = Math.max(mx, p.valor)
  const ymax = tetoRedondo(mx * 1.06)
  return {
    ultimo,
    modelo: {
      escala: { ymax, rotulos: [o.F.num(0), o.F.num(ymax / 2), o.F.num(ymax)] },
      tipo: 'curvas', soShorts: o.formato.soShorts, frase, normal, temNormal, temCasaSemPonto: normal.some(p => p.valor === null), videos: videosDeTela, melhorN,
    },
  }
}

// ───────────── as 72 horas ─────────────

export type ModeloDe72Horas =
  | { tipo: 'nao_carregou'; motivo: string }
  | { tipo: 'nao_medido'; motivo: string }
  | { tipo: 'medido'; frase: { negrito: string; resto: string }; fracaoPorHora: Array<number | null>; metade: number; umQuarto: number; tresQuartos: number; n: number; aviso: string | null }

export interface EntradaDe72Horas {
  videos: readonly VideoLido[] | null
  /** Nulo = a leitura por hora não carregou. */
  horas: HorasDoCanal | null
  formato: FormatoDoCanal
  agoraMs: number
}

const hhmm = (ms: number): string => `${dm(spDateOf(ms))} ${new Date(ms - 3 * 3_600_000).toISOString().slice(11, 16)}`

export function horasDoCanal(o: EntradaDe72Horas): ModeloDe72Horas {
  if (o.videos === null || o.horas === null) return { tipo: 'nao_carregou', motivo: FRASES_DAS_HORAS.leitura_falhou({}).longa }
  if (o.horas.primeiraHoraDoSiteMs === null) return { tipo: 'nao_medido', motivo: FRASES_DAS_HORAS.leitura_por_hora_nao_comecou({}).longa }
  const horas = o.horas
  const doTipo: VideoDaTracao[] = []
  for (const v of o.videos) {
    const base = baseDaIdade(v)
    if (base === null) continue
    const desc = v.discoveredAt ? Date.parse(v.discoveredAt) : NaN
    doTipo.push({
      curva: curvaDe72Horas(horas.porVideo.get(v.id) ?? [], base, o.agoraMs),
      descobertoComHoras: Number.isFinite(desc) ? (desc - base) / 3_600_000 : null,
      aoVivo: v.wasLive, formato: formatoDe(v), publicadoEmMs: base,
    })
  }
  const t = tracaoDoCanal(doTipo, { formato: o.formato.fmt, agoraMs: o.agoraMs })
  if (t.estado === 'nao_medido') {
    return { tipo: 'nao_medido', motivo: FRASES_DAS_HORAS[t.motivo]({ n: t.n ?? 0, minimo: R72.MIN_VIDEOS }).longa }
  }
  const quem = o.formato.fmt === 'long' ? 'vídeos' : 'Shorts'
  const parada = horas.ultimoOkDaTarefaMs !== null && o.agoraMs - horas.ultimoOkDaTarefaMs > R72.FOLGA_DA_ULTIMA_LEITURA_MIN * 60_000
  return {
    tipo: 'medido',
    frase: { negrito: `Metade das views das primeiras 72 horas chega em ${t.valor.metade} ${t.valor.metade === 1 ? 'hora' : 'horas'}`, resto: ` (valor do meio de ${t.n} ${quem}).` },
    fracaoPorHora: t.valor.fracaoPorHora, metade: t.valor.metade, umQuarto: t.valor.umQuarto, tresQuartos: t.valor.tresQuartos, n: t.n,
    aviso: parada && horas.ultimoOkDaTarefaMs !== null ? FRASES_DAS_HORAS.leitura_por_hora_parada({ paradaDesde: hhmm(horas.ultimoOkDaTarefaMs) }).longa : null,
  }
}
