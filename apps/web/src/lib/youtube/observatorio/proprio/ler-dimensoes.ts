// A5 · E11 · Tarefa 11: leitores de servidor das dimensões do canal próprio (origem, aparelho, país, inscrito, alcance por
// origem e aparelho) e do detalhe da origem. Só leitura, sem tela. O molde é o de `ler.ts`:
//   - o acesso é a PROVA de edição do site (`EdicaoDoSite`): sem prova (ou objeto forjado) = 'negado' SEM consultar nada;
//   - toda consulta filtra por site (o da prova) E por canal; janela de datas obrigatória (máximo JANELA_MAX_DIAS), teto de vídeos;
//   - leitura paginada (o PostgREST corta em 1.000): passar do teto de linhas ou erro de banco é LANÇADO (`ErroLeituraDimensoes`),
//     nunca lista vazia nem corte em silêncio;
//   - tabela ou função que não existe (migration não aplicada) NÃO lança: vira o estado `schema_ausente` do conjunto;
//   - PRIVACIDADE: o conteúdo de `traffic_source_detail` e de `dim_value` de país junto de vídeo e dia nunca vai a nota, log, erro
//     nem Sentry. O erro lançado leva só tabela, motivo, código do banco e contagem; a mensagem do banco é descartada.
// Os estados (o que o dia vale, o que o conjunto é) são de `dimensoes-estado.ts`; aqui só se leem os fatos.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import { DIMENSOES_DESDE, LOTE_DESDE } from '@/lib/youtube/coleta/e11-config'
import { TAMANHO_PAGINA } from '@/lib/youtube/coleta/paginar'
import type { AttemptKind } from '@/lib/youtube/coleta/kinds'
import { passoDesligado, type PassoComInterruptor } from '@/lib/youtube/coleta/passos-desligados'
import { ehSchemaAusente } from '@/lib/youtube/coleta/schema'
import { tipoDoDetalhe, type TipoDetalhe } from '@/lib/youtube/reporting/codigos'
import {
  CONJUNTOS_DIMENSOES, classificarConjunto, rotuloDoValor,
  type ConjuntoDim, type ConjuntoDimensoes, type DiaLido, type DiaYt, type EstadoConjunto, type LinhaBasica,
} from './dimensoes-estado'
import { edicaoValida } from './edicao'
import { TIPO_ALCANCE, type Pedido } from './ler'
import type { Privado } from './tipos'

export const JANELA_MAX_DIAS = 120
export const TETO_VIDEOS_DIMENSOES = 50
/** Linhas por leitura: acima disto o leitor lança (a janela e o teto de vídeos já limitam; passar daqui é anormal). */
export const TETO_LINHAS_PADRAO = 100_000
const TETO_LINHAS_TENTATIVAS = 5_000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/
const ID_VIDEO = /^[A-Za-z0-9_-]{1,32}$/

// ---------------------------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------------------------

export interface PedidoDimensoes extends Pedido {
  ytIds: readonly string[]
  de: DiaYt
  ate: DiaYt
  /** a data de partida de cada conjunto (padrão: DIMENSOES_DESDE nas quatro da API; LOTE_DESDE no detalhe e no alcance por dimensão) */
  desde?: Partial<Record<ConjuntoDim, DiaYt>>
  /** onde ler YT_OWN_STEPS_OFF (padrão: process.env, lido a cada chamada) */
  env?: NodeJS.ProcessEnv
  /** teto de linhas por leitura (padrão TETO_LINHAS_PADRAO) */
  tetoLinhas?: number
}

/** Uma linha de dimensão num dia. Em `alcance_dim`, `views` leva as IMPRESSÕES e `cliquesEst` os cliques estimados. */
export interface LinhaDim extends LinhaBasica {
  rotulo: string
  catalogado: boolean
  cliquesEst: number | null
}

/** Uma linha do detalhe da origem. `valor` = `<source_type>|<hash>` (nunca o texto); `detail` e `sourceType` vêm como no banco ('' = sem detalhe). */
export interface LinhaDetalhe extends LinhaBasica {
  sourceType: string
  detail: string
  rotulo: string
  catalogado: boolean
  tipoDetalhe: TipoDetalhe
}

export interface VideoLido<L extends LinhaBasica> { ytId: string; dias: DiaLido<L>[] }
export interface ConjuntoLido<L extends LinhaBasica> { conjunto: ConjuntoDim; estado: EstadoConjunto; videos: VideoLido<L>[] }

export interface DimensoesCanal {
  canalId: string
  de: DiaYt
  ate: DiaYt
  conjuntos: Record<ConjuntoDimensoes, ConjuntoLido<LinhaDim>>
  /** valores ruins (negativos) que viraram nulos: quem chama avisa o Sentry uma vez por requisição, sem conteúdo */
  descartados: number
}

export interface DetalheCanal {
  canalId: string
  de: DiaYt
  ate: DiaYt
  conjunto: ConjuntoLido<LinhaDetalhe>
  descartados: number
}

export type MotivoLeitura = 'erro_de_banco' | 'passou_do_teto'

/** Falha de leitura. Sem o texto do banco (pode carregar conteúdo): só tabela, motivo, código e quantas linhas já tinham chegado. */
export class ErroLeituraDimensoes extends Error {
  readonly tabela: string
  readonly motivo: MotivoLeitura
  readonly codigo: string | null
  readonly lidas: number
  constructor(tabela: string, motivo: MotivoLeitura, codigo: string | null, lidas: number) {
    super(`leitura de ${tabela} falhou: ${motivo === 'passou_do_teto' ? 'passou do teto de linhas' : 'erro de banco'}${codigo ? ` (código ${codigo})` : ''}, ${lidas} linhas lidas`)
    this.name = 'ErroLeituraDimensoes'
    this.tabela = tabela
    this.motivo = motivo
    this.codigo = codigo
    this.lidas = lidas
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Leitura paginada
// ---------------------------------------------------------------------------------------------------------------

interface ConsultaFaixa { range(de: number, ate: number): PromiseLike<{ data: unknown; error: { code?: string | null } | null }> }
type Leitura<T> = { ausente: true } | { ausente: false; linhas: T[] }

/** Uma faixa de uma consulta ordenada por chave única. Erro de banco lança; tabela ou coluna inexistente devolve `ausente`. */
async function lerFaixa<T>(tabela: string, build: () => ConsultaFaixa, de: number, ate: number, lidas: number): Promise<Leitura<T>> {
  let res: { data: unknown; error: { code?: string | null } | null }
  try {
    res = await build().range(de, ate)
  } catch {
    throw new ErroLeituraDimensoes(tabela, 'erro_de_banco', null, lidas)
  }
  if (res.error) {
    if (ehSchemaAusente(res.error)) return { ausente: true }
    throw new ErroLeituraDimensoes(tabela, 'erro_de_banco', res.error.code ?? null, lidas)
  }
  // Resposta sem lista NÃO é lista vazia.
  if (!Array.isArray(res.data)) throw new ErroLeituraDimensoes(tabela, 'erro_de_banco', null, lidas)
  return { ausente: false, linhas: res.data as T[] }
}

async function lerTudo<T>(tabela: string, build: () => ConsultaFaixa, teto: number): Promise<Leitura<T>> {
  const todas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const pag = await lerFaixa<T>(tabela, build, de, de + TAMANHO_PAGINA - 1, todas.length)
    if (pag.ausente) return pag
    for (const l of pag.linhas) todas.push(l)
    if (todas.length > teto) throw new ErroLeituraDimensoes(tabela, 'passou_do_teto', null, todas.length)
    if (pag.linhas.length < TAMANHO_PAGINA) return { ausente: false, linhas: todas }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------------------------------------------

interface Alvo { siteId: string; canalId: string; ytIds: string[]; de: DiaYt; ate: DiaYt; dias: DiaYt[]; teto: number; env: NodeJS.ProcessEnv }

function diaExiste(s: string): boolean {
  return FORMATO_DIA.test(s) && addDays(s, 0) === s
}

/** `null` = negado (sem consulta). Janela inválida lança, ainda antes de qualquer consulta. */
function alvoDe(p: PedidoDimensoes): Alvo | null {
  if (!edicaoValida(p.edicao) || !UUID.test(p.canalId)) return null
  if (!diaExiste(p.de) || !diaExiste(p.ate) || p.de > p.ate) throw new RangeError('janela de leitura inválida: as datas precisam existir e "de" não pode ser depois de "ate"')
  const n = diffDias(p.de, p.ate) + 1
  if (n > JANELA_MAX_DIAS) throw new RangeError(`janela de leitura de ${n} dias passa do máximo de ${JANELA_MAX_DIAS}`)
  const ytIds = [...new Set(p.ytIds)].filter(id => ID_VIDEO.test(id)).slice(0, TETO_VIDEOS_DIMENSOES)
  const dias = Array.from({ length: n }, (_, i) => addDays(p.de, i))
  return { siteId: p.edicao.siteId, canalId: p.canalId, ytIds, de: p.de, ate: p.ate, dias, teto: p.tetoLinhas ?? TETO_LINHAS_PADRAO, env: p.env ?? process.env }
}

// ---------------------------------------------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------------------------------------------

/** Contagem nunca é negativa: negativo é lixo da fonte e vira nulo (contado), nunca zero. Nulo, vazio e não finito viram nulo. */
class Medidas {
  descartados = 0
  num(x: unknown): number | null {
    let n: number | null = null
    if (typeof x === 'number') n = Number.isFinite(x) ? x : null
    else if (typeof x === 'string' && x.trim() !== '') { const v = Number(x); n = Number.isFinite(v) ? v : null }
    if (n !== null && n < 0) { this.descartados++; return null }
    return n
  }
}

const chave = (...p: string[]): string => p.join('\u0001')

interface Intervalo { de: string; ate: string }
interface CoberturaRow { youtube_video_id: string; metric_set: string; covered_from: string; covered_to: string }
interface DiarioRow { youtube_video_id: string; day_pt: string; views: unknown }

/** Cobertura por (vídeo, conjunto). Sem filtro de data: são poucos intervalos fundidos, e dizem se o conjunto já foi coletado fora da janela. */
function lerCobertura(sb: SupabaseClient, a: Alvo, sets: readonly string[]): Promise<Leitura<CoberturaRow>> {
  return lerTudo<CoberturaRow>('yt_own_video_coverage', () => sb.from('yt_own_video_coverage')
    .select('youtube_video_id, metric_set, covered_from, covered_to')
    .eq('site_id', a.siteId).eq('channel_id', a.canalId)
    .in('youtube_video_id', a.ytIds).in('metric_set', [...sets])
    .order('youtube_video_id').order('metric_set').order('covered_from'), a.teto)
}

function lerBaseDiaria(sb: SupabaseClient, a: Alvo): Promise<Leitura<DiarioRow>> {
  return lerTudo<DiarioRow>('yt_own_video_daily', () => sb.from('yt_own_video_daily')
    .select('youtube_video_id, day_pt, views')
    .eq('site_id', a.siteId).eq('channel_id', a.canalId)
    .in('youtube_video_id', a.ytIds).gte('day_pt', a.de).lte('day_pt', a.ate)
    .order('youtube_video_id').order('day_pt'), a.teto)
}

function indexarCobertura(rows: readonly CoberturaRow[]): Map<string, Intervalo[]> {
  const m = new Map<string, Intervalo[]>()
  for (const r of rows) {
    const k = chave(r.youtube_video_id, r.metric_set)
    const lista = m.get(k) ?? []
    lista.push({ de: r.covered_from, ate: r.covered_to })
    m.set(k, lista)
  }
  return m
}

const cobre = (m: Map<string, Intervalo[]>, yt: string, conjunto: string, dia: DiaYt): boolean =>
  (m.get(chave(yt, conjunto)) ?? []).some(i => i.de <= dia && dia <= i.ate)

/** O pior resultado da tentativa mais recente do `kind` no canal (todas as tentativas do último dia, de todos os escopos); `null` = nunca tentou. */
async function ultimaTentativa(sb: SupabaseClient, a: Alvo, kind: AttemptKind): Promise<{ outcome: string } | null> {
  const base = () => sb.from('yt_own_collection_attempts').select('attempt_day')
    .eq('site_id', a.siteId).eq('channel_id', a.canalId).eq('kind', kind)
  const ultimo = await lerFaixa<{ attempt_day: string }>('yt_own_collection_attempts', () => base().order('attempt_day', { ascending: false }), 0, 0, 0)
  if (ultimo.ausente || ultimo.linhas.length === 0) return null
  const dia = ultimo.linhas[0]!.attempt_day
  const todas = await lerTudo<{ outcome: string }>('yt_own_collection_attempts', () => sb.from('yt_own_collection_attempts').select('outcome')
    .eq('site_id', a.siteId).eq('channel_id', a.canalId).eq('kind', kind).eq('attempt_day', dia)
    .order('scope_type').order('scope_id'), TETO_LINHAS_TENTATIVAS)
  if (todas.ausente || todas.linhas.length === 0) return null
  const resultados = todas.linhas.map(l => String(l.outcome))
  const PRIORIDADE = ['erro_http', 'sem_conexao', 'sem_autorizacao', 'nao_alcancado_orcamento', 'schema_ausente']
  const BENIGNOS = ['ok', 'sem_dado_na_janela', 'video_novo']
  const ruins = resultados.filter(o => !BENIGNOS.includes(o))
  if (ruins.length === 0) return { outcome: resultados[0]! }
  const rank = (o: string): number => { const i = PRIORIDADE.indexOf(o); return i === -1 ? PRIORIDADE.length : i }
  return { outcome: [...ruins].sort((x, y) => rank(x) - rank(y))[0]! }
}

const PASSO: Record<ConjuntoDim, PassoComInterruptor> = {
  trafego: 'dimensoes', dispositivo: 'dimensoes', pais: 'dimensoes', inscrito: 'dimensoes',
  detalhe: 'normalizadores', alcance_dim: 'normalizadores',
}
const KIND_DA_TENTATIVA: Record<ConjuntoDim, AttemptKind> = {
  trafego: 'dimensoes', dispositivo: 'dimensoes', pais: 'dimensoes', inscrito: 'dimensoes',
  detalhe: 'normalizador_trafego', alcance_dim: 'normalizador_alcance_dim',
}
const DIM_KIND: Record<string, ConjuntoDimensoes> = {
  traffic_source: 'trafego', device_os: 'dispositivo', country: 'pais', subscribed_status: 'inscrito',
}

const desdeDe = (p: PedidoDimensoes, c: ConjuntoDim): DiaYt =>
  p.desde?.[c] ?? (c === 'detalhe' || c === 'alcance_dim' ? LOTE_DESDE : DIMENSOES_DESDE)

const porValor = <L extends LinhaBasica>(linhas: L[]): L[] => linhas.sort((x, y) => (x.valor < y.valor ? -1 : x.valor > y.valor ? 1 : 0))

// ---------------------------------------------------------------------------------------------------------------
// lerDimensoes
// ---------------------------------------------------------------------------------------------------------------

interface DimRow { youtube_video_id: string; day_pt: string; dim_kind: string; dim_value: string; views: unknown; watch_time_minutes: unknown }
interface ReachDimRow { youtube_video_id: string; day_pt: string; traffic_source_type: string; device_type: string; operating_system: string; thumbnail_impressions: unknown; thumbnail_clicks_est: unknown }
interface ReachBaseRow { youtube_video_id: string; day_pt: string; thumbnail_impressions: unknown }
interface RelatorioRow { start_time: string; normalized_at: string | null }

/** Data UTC ('AAAA-MM-DD') de um timestamptz; inválido devolve null. */
function diaUtc(ts: unknown): DiaYt | null {
  if (typeof ts !== 'string') return null
  const t = new Date(ts).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

/**
 * Os cinco conjuntos de dimensões (origem, aparelho, país, inscrito e alcance por origem e aparelho) de até 50 vídeos numa janela de
 * até 120 dias. Para cada vídeo e dia: se o conjunto cobre o dia, se a referência (a base) foi medida, a base e as linhas; quem
 * monta a frase chama `estadoDoDiaLido`. `ytIds` vazio devolve os conjuntos sem vídeos (o estado do conjunto vale assim mesmo).
 */
export async function lerDimensoes(sb: SupabaseClient, p: PedidoDimensoes): Promise<Privado<DimensoesCanal>> {
  const a = alvoDe(p)
  if (a === null) return { acesso: 'negado' }
  const [cob, diario, dims, reachDim, relatorios, reachBase, tentDim, tentAlc] = await Promise.all([
    lerCobertura(sb, a, ['base', ...CONJUNTOS_DIMENSOES]),
    lerBaseDiaria(sb, a),
    lerTudo<DimRow>('yt_own_video_dim_daily', () => sb.from('yt_own_video_dim_daily')
      .select('youtube_video_id, day_pt, dim_kind, dim_value, views, watch_time_minutes')
      .eq('site_id', a.siteId).eq('channel_id', a.canalId)
      .in('youtube_video_id', a.ytIds).gte('day_pt', a.de).lte('day_pt', a.ate)
      .order('youtube_video_id').order('day_pt').order('dim_kind').order('dim_value'), a.teto),
    lerTudo<ReachDimRow>('yt_own_video_reach_dim_daily', () => sb.from('yt_own_video_reach_dim_daily')
      .select('youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, thumbnail_impressions, thumbnail_clicks_est')
      .eq('site_id', a.siteId).eq('channel_id', a.canalId)
      .in('youtube_video_id', a.ytIds).gte('day_pt', a.de).lte('day_pt', a.ate)
      .order('youtube_video_id').order('day_pt').order('traffic_source_type').order('device_type').order('operating_system'), a.teto),
    lerTudo<RelatorioRow>('yt_reporting_reports', () => sb.from('yt_reporting_reports').select('start_time, normalized_at, report_id')
      .eq('site_id', a.siteId).eq('channel_id', a.canalId).eq('report_type_id', TIPO_ALCANCE)
      .gte('start_time', a.de + 'T00:00:00Z').lte('start_time', a.ate + 'T23:59:59Z')
      .order('report_id'), a.teto),
    lerTudo<ReachBaseRow>('yt_own_video_reach_daily', () => sb.from('yt_own_video_reach_daily')
      .select('youtube_video_id, day_pt, thumbnail_impressions')
      .eq('site_id', a.siteId).eq('channel_id', a.canalId)
      .in('youtube_video_id', a.ytIds).gte('day_pt', a.de).lte('day_pt', a.ate)
      .order('youtube_video_id').order('day_pt'), a.teto),
    ultimaTentativa(sb, a, 'dimensoes'),
    ultimaTentativa(sb, a, 'normalizador_alcance_dim'),
  ])
  const medidas = new Medidas()
  const coberturaAusente = cob.ausente
  const cobertura = cob.ausente ? new Map<string, Intervalo[]>() : indexarCobertura(cob.linhas)

  // a base do diário (as quatro famílias da API)
  const baseDiaria = new Map<string, number | null>()
  if (!diario.ausente) for (const r of diario.linhas) baseDiaria.set(chave(r.youtube_video_id, r.day_pt), medidas.num(r.views))

  // as linhas das quatro famílias da API
  const linhasApi = new Map<ConjuntoDimensoes, Map<string, LinhaDim[]>>()
  if (!dims.ausente) {
    for (const r of dims.linhas) {
      const conj = DIM_KIND[r.dim_kind]
      if (!conj) continue
      const mapa = linhasApi.get(conj) ?? new Map<string, LinhaDim[]>()
      const k = chave(r.youtube_video_id, r.day_pt)
      const lista = mapa.get(k) ?? []
      const rot = rotuloDoValor(conj, r.dim_value)
      lista.push({ valor: r.dim_value, rotulo: rot.rotulo, catalogado: rot.catalogado, views: medidas.num(r.views), minutos: medidas.num(r.watch_time_minutes), cliquesEst: null })
      mapa.set(k, lista)
      linhasApi.set(conj, mapa)
    }
  }

  // alcance por dimensão: as linhas, os dias com o relatório básico normalizado e a soma de impressões do alcance básico
  const linhasAlcance = new Map<string, LinhaDim[]>()
  if (!reachDim.ausente) {
    for (const r of reachDim.linhas) {
      const valor = `${r.traffic_source_type}|${r.device_type}|${r.operating_system}`
      const k = chave(r.youtube_video_id, r.day_pt)
      const lista = linhasAlcance.get(k) ?? []
      const rot = rotuloDoValor('alcance_dim', valor)
      lista.push({ valor, rotulo: rot.rotulo, catalogado: rot.catalogado, views: medidas.num(r.thumbnail_impressions), minutos: null, cliquesEst: medidas.num(r.thumbnail_clicks_est) })
      linhasAlcance.set(k, lista)
    }
  }
  const diasComRelatorio = new Set<DiaYt>()
  if (!relatorios.ausente) for (const r of relatorios.linhas) { const dd = diaUtc(r.start_time); if (dd && r.normalized_at != null) diasComRelatorio.add(dd) }
  const impressoesBase = new Map<string, number>()
  if (!reachBase.ausente) for (const r of reachBase.linhas) {
    const v = medidas.num(r.thumbnail_impressions)
    if (v !== null) { const k = chave(r.youtube_video_id, r.day_pt); impressoesBase.set(k, (impressoesBase.get(k) ?? 0) + v) }
  }

  const ausenteDe = (c: ConjuntoDimensoes): boolean => coberturaAusente
    || (c === 'alcance_dim' ? reachDim.ausente || relatorios.ausente || reachBase.ausente : dims.ausente || diario.ausente)

  const conjuntos = {} as Record<ConjuntoDimensoes, ConjuntoLido<LinhaDim>>
  for (const c of CONJUNTOS_DIMENSOES) {
    const desde = desdeDe(p, c)
    const temCobertura = a.ytIds.some(yt => (cobertura.get(chave(yt, c)) ?? []).length > 0)
    const mapa = c === 'alcance_dim' ? linhasAlcance : linhasApi.get(c) ?? new Map<string, LinhaDim[]>()
    const estado = classificarConjunto({
      schemaAusente: ausenteDe(c),
      passoDesligado: passoDesligado(PASSO[c], a.env),
      ultimaTentativa: c === 'alcance_dim' ? tentAlc : tentDim,
      temCobertura,
      temLinhas: mapa.size > 0,
    })
    const videos: VideoLido<LinhaDim>[] = estado.tipo === 'schema_ausente' ? [] : a.ytIds.map(yt => ({
      ytId: yt,
      dias: a.dias.map((dia): DiaLido<LinhaDim> => {
        const k = chave(yt, dia)
        const alcance = c === 'alcance_dim'
        return {
          dia,
          coberto: cobre(cobertura, yt, c, dia),
          baseMedida: alcance ? diasComRelatorio.has(dia) : cobre(cobertura, yt, 'base', dia),
          base: alcance ? impressoesBase.get(k) ?? null : baseDiaria.get(k) ?? null,
          antesDoInicio: dia < desde,
          desde,
          linhas: porValor([...(mapa.get(k) ?? [])]),
        }
      }),
    }))
    conjuntos[c] = { conjunto: c, estado, videos }
  }
  return { acesso: 'ok', dado: { canalId: a.canalId, de: a.de, ate: a.ate, conjuntos, descartados: medidas.descartados } }
}

// ---------------------------------------------------------------------------------------------------------------
// lerDetalheDaOrigem
// ---------------------------------------------------------------------------------------------------------------

interface DetalheRow { youtube_video_id: string; day_pt: string; source_type: string; detail: string; detail_hash: string; views: unknown; watch_time_minutes: unknown }

/**
 * O detalhe da origem (termo pesquisado, site, vídeo, canal) por vídeo e dia. `detail` e `source_type` vêm como no banco; quem traduz
 * e decide o que mostrar é a tela (o `tipoDetalhe` diz que tipo de texto é). A referência é a mesma das famílias da API (o diário).
 */
export async function lerDetalheDaOrigem(sb: SupabaseClient, p: PedidoDimensoes): Promise<Privado<DetalheCanal>> {
  const a = alvoDe(p)
  if (a === null) return { acesso: 'negado' }
  const [cob, diario, detalhes, tentativa] = await Promise.all([
    lerCobertura(sb, a, ['base', 'detalhe']),
    lerBaseDiaria(sb, a),
    lerTudo<DetalheRow>('yt_own_video_traffic_detail_daily', () => sb.from('yt_own_video_traffic_detail_daily')
      .select('youtube_video_id, day_pt, source_type, detail, detail_hash, views, watch_time_minutes')
      .eq('site_id', a.siteId).eq('channel_id', a.canalId)
      .in('youtube_video_id', a.ytIds).gte('day_pt', a.de).lte('day_pt', a.ate)
      .order('youtube_video_id').order('day_pt').order('source_type').order('detail_hash'), a.teto),
    ultimaTentativa(sb, a, KIND_DA_TENTATIVA.detalhe),
  ])
  const medidas = new Medidas()
  const cobertura = cob.ausente ? new Map<string, Intervalo[]>() : indexarCobertura(cob.linhas)
  const baseDiaria = new Map<string, number | null>()
  if (!diario.ausente) for (const r of diario.linhas) baseDiaria.set(chave(r.youtube_video_id, r.day_pt), medidas.num(r.views))
  const linhas = new Map<string, LinhaDetalhe[]>()
  if (!detalhes.ausente) {
    for (const r of detalhes.linhas) {
      const k = chave(r.youtube_video_id, r.day_pt)
      const lista = linhas.get(k) ?? []
      const rot = rotuloDoValor('detalhe', r.source_type)
      lista.push({
        valor: `${r.source_type}|${r.detail_hash}`, sourceType: r.source_type, detail: r.detail,
        rotulo: rot.rotulo, catalogado: rot.catalogado, tipoDetalhe: tipoDoDetalhe(r.source_type),
        views: medidas.num(r.views), minutos: medidas.num(r.watch_time_minutes),
      })
      linhas.set(k, lista)
    }
  }
  const desde = desdeDe(p, 'detalhe')
  const estado = classificarConjunto({
    schemaAusente: cob.ausente || diario.ausente || detalhes.ausente,
    passoDesligado: passoDesligado(PASSO.detalhe, a.env),
    ultimaTentativa: tentativa,
    temCobertura: a.ytIds.some(yt => (cobertura.get(chave(yt, 'detalhe')) ?? []).length > 0),
    temLinhas: linhas.size > 0,
  })
  const videos: VideoLido<LinhaDetalhe>[] = estado.tipo === 'schema_ausente' ? [] : a.ytIds.map(yt => ({
    ytId: yt,
    dias: a.dias.map((dia): DiaLido<LinhaDetalhe> => ({
      dia,
      coberto: cobre(cobertura, yt, 'detalhe', dia),
      baseMedida: cobre(cobertura, yt, 'base', dia),
      base: baseDiaria.get(chave(yt, dia)) ?? null,
      antesDoInicio: dia < desde,
      desde,
      linhas: porValor([...(linhas.get(chave(yt, dia)) ?? [])]),
    })),
  }))
  return { acesso: 'ok', dado: { canalId: a.canalId, de: a.de, ate: a.ate, conjunto: { conjunto: 'detalhe', estado, videos }, descartados: medidas.descartados } }
}
