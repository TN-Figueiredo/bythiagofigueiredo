// Leitores de servidor das duas tabelas privadas do canal próprio (alcance e diário por vídeo).
// Regras: só leitura; sempre janela de datas (o diário tem ~97 mil linhas em produção); paginados por readAll
// (limite de 1000 do PostgREST); erro de banco é LANÇADO, nunca vira lista vazia; nulo nunca vira zero.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { readAll } from '../load'
import { ObservatoryLoadError } from '../niches-db'
import { materializarZeros, type IntervaloCoberto } from './cobertura-leitor'
import { JANELA_LEITURA_ALCANCE_DIAS } from './dias'
import { leituraValida, type LeituraPrivadaDoSite } from './leitura-privada'
import { TETO_VIDEOS_DIARIO } from './tipos'
import type { AlcanceCanal, AlcanceLinha, DiarioCanal, DiarioLinha, DiaYt, Privado, RelatorioDia, StatusRelatorio } from './tipos'

export const TIPO_ALCANCE = 'channel_reach_basic_a1'
export const JANELA_DIARIO_DIAS = 28
export { TETO_VIDEOS_DIARIO }

/**
 * O acesso ao dado privado é a prova de leitura privada do site (`LeituraPrivadaDoSite`, de `./leitura-privada`), não um booleano:
 * ela só nasce depois da guarda (quem edita o site, ou quem tem o direito de ver o desempenho privado: o critério da RLS das
 * tabelas) e leva o `siteId` dentro. Sem prova (null) ou com um objeto que não veio da guarda (um `EdicaoDoSite`, por exemplo),
 * o leitor devolve 'negado' SEM consultar nada. `canalId` é o canal próprio do site já resolvido
 * pela página (nunca o texto cru da URL); toda consulta filtra por site E por canal.
 */
export interface Pedido { leitura: LeituraPrivadaDoSite | null; canalId: string; hoje: DiaYt }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** O site da prova de leitura, ou null: sem prova, ou id que não é uuid (o Postgres lançaria 22P02) = 'negado', sem consulta e sem número. A página resolve o canal ANTES e dá "não encontrado" ao id malformado. */
const siteAutorizado = (p: Pedido): string | null => (leituraValida(p.leitura) && UUID.test(p.canalId) ? p.leitura.siteId : null)

const STATUS = new Set<string>(['listado', 'baixado', 'vazio', 'erro', 'expirado_sem_baixar'])
const statusDe = (s: unknown): StatusRelatorio => (typeof s === 'string' && STATUS.has(s) ? (s as StatusRelatorio) : 'desconhecido')

/** bigint/numeric chegam como número ou texto; null, undefined, vazio e não finito viram null (nunca 0). */
function num(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null
  if (typeof x === 'string' && x.trim() !== '') { const n = Number(x); return Number.isFinite(n) ? n : null }
  return null
}

interface RelatorioRow { report_id: string; status: string; start_time: string; normalized_at: string | null }
interface AlcanceRow { youtube_video_id: string; day_pt: string; thumbnail_impressions: unknown; thumbnail_ctr: unknown; collected_at: string | null }
interface DiarioRow { youtube_video_id: string; day_pt: string; views: unknown; avg_view_percentage: unknown; avg_view_duration_seconds: unknown; collected_at: string | null }

/** Data UTC ('AAAA-MM-DD') de um timestamptz, qualquer que seja o fuso em que o banco o escreveu; inválido devolve null. */
function diaUtc(ts: unknown): DiaYt | null {
  if (typeof ts !== 'string') return null
  const t = new Date(ts).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

/** A primeira linha de uma leitura já ordenada e filtrada (uma linha só, sem janela); erro de banco é LANÇADO. */
async function primeiraLinha<T>(table: string, q: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<T | null> {
  const { data, error } = await q
  if (error) throw new ObservatoryLoadError(table, error.code, error.message)
  return Array.isArray(data) ? ((data[0] as T | undefined) ?? null) : null
}

/** No máximo uma linha por (vídeo, dia): vence a de coleta mais recente (a tabela tem essa chave primária; é defesa). */
function umaPorVideoDia<T extends { youtube_video_id: string; day_pt: string; collected_at: string | null }>(rows: readonly T[]): T[] {
  const por = new Map<string, T>()
  for (const r of rows) {
    const k = r.youtube_video_id + '|' + r.day_pt
    const antes = por.get(k)
    if (!antes || (r.collected_at ?? '') > (antes.collected_at ?? '')) por.set(k, r)
  }
  return [...por.values()]
}

/** Medida que não pode ser negativa (impressões, views, duração média). Negativo é lixo da fonte: vira nulo (não medido) e `ruim` avisa. */
function medida(x: unknown): { v: number | null; ruim: boolean } {
  const n = num(x)
  return n != null && n < 0 ? { v: null, ruim: true } : { v: n, ruim: false }
}

/** CTR é fração de 0 a 1 (migration L2). Fora disso o valor não é confiável: vira nulo (não medido) e `ruim` avisa quem chama. */
function ctrDe(x: unknown): { v: number | null; ruim: boolean } {
  const n = num(x)
  return n != null && (n < 0 || n > 1) ? { v: null, ruim: true } : { v: n, ruim: false }
}

/** Teto de sanidade do % assistido, em pontos: passar de 100 é dado válido (o espectador reviu trechos); só o absurdo é descartado. */
export const PCT_ASSISTIDO_MAX = 999.99

/**
 * `avg_view_percentage` é a média do percentual assistido, em PONTOS de 0 em diante (a Analytics API entrega 51,5 para 51,5%; a
 * coleta grava o número como veio, sem escala; fixado em proprio-ler.test.ts). Acima de 100 é válido (139,38 existe em produção).
 * Negativo ou acima de PCT_ASSISTIDO_MAX não é confiável: vira nulo (não medido) e `ruim` avisa. Nunca se reescala nem se recorta:
 * 0,5 é meio ponto percentual, não 50%.
 */
function pctDe(x: unknown): { v: number | null; ruim: boolean } {
  const n = num(x)
  return n != null && (n < 0 || n > PCT_ASSISTIDO_MAX) ? { v: null, ruim: true } : { v: n, ruim: false }
}

/** Relatórios do tipo de alcance e linhas de alcance dos últimos JANELA_LEITURA_ALCANCE_DIAS dias. Erro de banco é LANÇADO; valor ruim (CTR fora de 0 a 1, negativo, data inválida) não lança: vira nulo ou é descartado e entra em `descartados`. */
export async function lerAlcance(sb: SupabaseClient, p: Pedido): Promise<Privado<AlcanceCanal>> {
  const siteId = siteAutorizado(p)
  if (siteId == null) return { acesso: 'negado' }
  const desde = addDays(p.hoje, -JANELA_LEITURA_ALCANCE_DIAS)
  const filtroRel = () => sb.from('yt_reporting_reports').select('report_id, status, start_time, normalized_at')
    .eq('site_id', siteId).eq('channel_id', p.canalId).eq('report_type_id', TIPO_ALCANCE)
  const [rels, linhas, recente] = await Promise.all([
    readAll<RelatorioRow>('yt_reporting_reports', () => filtroRel().gte('start_time', desde + 'T00:00:00Z').order('report_id')),
    readAll<AlcanceRow>('yt_own_video_reach_daily', () => sb.from('yt_own_video_reach_daily')
      .select('youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr, collected_at')
      .eq('site_id', siteId).eq('channel_id', p.canalId)
      .gte('day_pt', desde).order('day_pt').order('youtube_video_id')),
    // SEM janela: o canal parado há mais que a janela ainda diz quando foi o último relatório
    primeiraLinha<{ start_time: string }>('yt_reporting_reports', sb.from('yt_reporting_reports').select('start_time')
      .eq('site_id', siteId).eq('channel_id', p.canalId).eq('report_type_id', TIPO_ALCANCE)
      .order('start_time', { ascending: false }).range(0, 0)),
  ])
  let descartados = 0
  const relatorios: RelatorioDia[] = []
  for (const r of rels) {
    const dia = diaUtc(r.start_time)
    if (dia == null) { descartados++; continue }
    relatorios.push({ dia, status: statusDe(r.status), normalizado: r.normalized_at != null })
  }
  const out: AlcanceLinha[] = umaPorVideoDia(linhas).map(r => {
    const imp = medida(r.thumbnail_impressions), ctr = ctrDe(r.thumbnail_ctr)
    if (imp.ruim || ctr.ruim) descartados++
    return { ytId: r.youtube_video_id, dia: r.day_pt, imp: imp.v, ctr: ctr.v }
  })
  return { acesso: 'ok', dado: { canalId: p.canalId, relatorios, linhas: out, ultimoRelatorio: diaUtc(recente?.start_time), descartados } }
}

/** 42P01 tabela (Postgres) e PGRST205 tabela fora do schema cache (PostgREST). Coluna ausente (42703) NÃO entra: é outro defeito. */
const TABELA_AUSENTE = new Set(['42P01', 'PGRST205'])
interface CoberturaRow { youtube_video_id: unknown; covered_from: unknown; covered_to: unknown }

/**
 * Diário dos `ytIds` (no máximo TETO_VIDEOS_DIARIO; o resto NÃO é lido e volta em `foraDoTeto`) dos JANELA_DIARIO_DIAS + 10 dias que terminam no ÚLTIMO dia do canal (não em hoje: a coleta atrasa e o canal pode estar parado). Lista vazia: nenhuma linha, mas o `ultimoDia` real do canal.
 *
 * O diário tolera os dois estados do banco (A5 E6, D13). Antes da dieta cada (vídeo, dia) tinha linha, com `views: 0` nos dias sem atividade;
 * depois dela só os dias com atividade têm, e a cobertura (`yt_own_video_coverage`, conjunto `base`) diz quais dias foram coletados. O leitor
 * devolve os zeros apagados (`materializarZeros`), então a tela recebe as mesmas linhas nos dois estados. `ultimoDia` é o maior entre a última
 * linha do diário e o maior `covered_to` do canal. Tabela da cobertura ausente (MG14 não aplicada): segue sem cobertura e avisa o Sentry uma vez;
 * qualquer outro erro é lançado.
 */
export async function lerDiario(sb: SupabaseClient, p: Pedido & { ytIds: readonly string[] }): Promise<Privado<DiarioCanal>> {
  const siteId = siteAutorizado(p)
  if (siteId == null) return { acesso: 'negado' }
  const ytIds = p.ytIds.slice(0, TETO_VIDEOS_DIARIO)
  // o que passa do teto não é lido: sai dito no dado (nunca em silêncio), para quem soma poder avisar
  const foraDoTeto = p.ytIds.slice(TETO_VIDEOS_DIARIO)
  let coberturaAusente = false
  /** Uma leitura da cobertura: tabela ausente = `null` (segue sem cobertura); outro erro sobe. */
  const comCobertura = async <T>(leitura: () => Promise<T>): Promise<T | null> => {
    try { return await leitura() }
    catch (e) {
      if (e instanceof ObservatoryLoadError && e.table === 'yt_own_video_coverage' && e.code != null && TABELA_AUSENTE.has(e.code)) { coberturaAusente = true; return null }
      throw e
    }
  }
  // SEM janela e sem filtro de vídeo: o último dia gravado do canal, mesmo parado há meses (a série é que é limitada).
  // Roda também com a lista de vídeos vazia: um canal sem longo acompanhado com o diário cheio não é "nunca coletado".
  const ultimoQ = () => primeiraLinha<{ day_pt: string }>('yt_own_video_daily', sb.from('yt_own_video_daily').select('day_pt')
    .eq('site_id', siteId).eq('channel_id', p.canalId)
    .order('day_pt', { ascending: false }).range(0, 0))
  // o maior dia coberto do canal (conjunto base): com o diário enxuto a última linha pode ser anterior ao último dia coletado
  const ultimaCoberturaQ = () => comCobertura(() => primeiraLinha<{ covered_to: string }>('yt_own_video_coverage', sb.from('yt_own_video_coverage').select('covered_to')
    .eq('site_id', siteId).eq('channel_id', p.canalId).eq('metric_set', 'base')
    .order('covered_to', { ascending: false }).range(0, 0)))
  const [ultimo, ultimaCobertura] = await Promise.all([ultimoQ(), ultimaCoberturaQ()])
  const diaLinha = ultimo?.day_pt ?? null
  const diaCobertura = typeof ultimaCobertura?.covered_to === 'string' ? ultimaCobertura.covered_to : null
  const ultimoDia = diaLinha != null && diaCobertura != null ? (diaCobertura > diaLinha ? diaCobertura : diaLinha) : (diaLinha ?? diaCobertura)
  // Âncora no último dia: a janela de 28 dias do % assistido e da série termina nele, não em hoje. Sem dia gravado nem coberto não há o que ler.
  const desde = ultimoDia == null ? null : addDays(ultimoDia, -(JANELA_DIARIO_DIAS + 10))
  const ler = ytIds.length > 0 && desde != null
  const [rows, intervalosLidos] = await Promise.all([
    ler ? readAll<DiarioRow>('yt_own_video_daily', () => sb.from('yt_own_video_daily')
      .select('youtube_video_id, day_pt, views, avg_view_percentage, avg_view_duration_seconds, collected_at')
      .eq('site_id', siteId).eq('channel_id', p.canalId)
      .in('youtube_video_id', ytIds).gte('day_pt', desde).order('day_pt').order('youtube_video_id')) : Promise.resolve<DiarioRow[]>([]),
    ler && !coberturaAusente ? comCobertura(() => readAll<CoberturaRow>('yt_own_video_coverage', () => sb.from('yt_own_video_coverage')
      .select('youtube_video_id, covered_from, covered_to')
      .eq('site_id', siteId).eq('channel_id', p.canalId).eq('metric_set', 'base')
      .in('youtube_video_id', ytIds).gte('covered_to', desde)
      // chave (vídeo, conjunto, início): o desempate total evita repetir e perder linha entre páginas
      .order('youtube_video_id').order('covered_from'))) : Promise.resolve<CoberturaRow[] | null>([]),
  ])
  if (coberturaAusente) {
    // sem conteúdo do banco, sem id de vídeo, sem canal: só o fato
    Sentry.captureMessage('observatorio-proprio: tabela yt_own_video_coverage ausente (migration MG14 não aplicada)', {
      level: 'warning', tags: { component: 'observatorio-proprio', step: 'cobertura-ausente' },
    })
  }
  let descartados = 0
  const lidas: DiarioLinha[] = umaPorVideoDia(rows).map(r => {
    const views = medida(r.views), pct = pctDe(r.avg_view_percentage), duracao = medida(r.avg_view_duration_seconds)
    if (views.ruim || pct.ruim || duracao.ruim) descartados++
    return { ytId: r.youtube_video_id, dia: r.day_pt, views: views.v, pctAssistido: pct.v, duracaoMediaSeg: duracao.v }
  })
  // Intervalo ilegível (coluna nula ou fora do formato) não vira zero nem some em silêncio: é dado ruim, lança como as outras leituras.
  const intervalos: IntervaloCoberto[] = (intervalosLidos ?? []).map(r => {
    if (typeof r.youtube_video_id !== 'string' || typeof r.covered_from !== 'string' || typeof r.covered_to !== 'string') {
      throw new ObservatoryLoadError('yt_own_video_coverage', undefined, 'intervalo de cobertura ilegível')
    }
    return { ytId: r.youtube_video_id, de: r.covered_from, ate: r.covered_to }
  })
  const linhas = desde == null || ultimoDia == null ? lidas : materializarZeros(lidas, intervalos, { desde, ate: ultimoDia })
  return { acesso: 'ok', dado: { canalId: p.canalId, ultimoDia, linhas, foraDoTeto, descartados } }
}
