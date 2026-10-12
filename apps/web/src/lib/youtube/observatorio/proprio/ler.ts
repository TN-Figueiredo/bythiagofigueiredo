// Leitores de servidor das duas tabelas privadas do canal próprio (alcance e diário por vídeo).
// Regras: só leitura; sempre janela de datas (o diário tem ~97 mil linhas em produção); paginados por readAll
// (limite de 1000 do PostgREST); erro de banco é LANÇADO, nunca vira lista vazia; nulo nunca vira zero.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { readAll } from '../load'
import { ObservatoryLoadError } from '../niches-db'
import { JANELA_ALCANCE_DIAS } from './dias'
import { edicaoValida, type EdicaoDoSite } from './edicao'
import type { AlcanceCanal, AlcanceLinha, DiarioCanal, DiarioLinha, DiaYt, Privado, RelatorioDia, StatusRelatorio } from './tipos'

export const TIPO_ALCANCE = 'channel_reach_basic_a1'
export const JANELA_DIARIO_DIAS = 28
export const TETO_VIDEOS_DIARIO = 50

/**
 * O acesso ao dado privado é a PROVA de edição do site (`EdicaoDoSite`, de `./edicao`), não um booleano: ela só nasce depois
 * da guarda `can_edit_site` (o critério da RLS das tabelas) e leva o `siteId` dentro. Sem prova (null) ou com um objeto
 * que não veio da guarda, o leitor devolve 'negado' SEM consultar nada. `canalId` é o canal próprio do site já resolvido
 * pela página (nunca o texto cru da URL); toda consulta filtra por site E por canal.
 */
export interface Pedido { edicao: EdicaoDoSite | null; canalId: string; hoje: DiaYt }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** O site da prova de edição, ou null: sem prova, ou id que não é uuid (o Postgres lançaria 22P02) = 'negado', sem consulta e sem número. A página resolve o canal ANTES e dá "não encontrado" ao id malformado. */
const siteAutorizado = (p: Pedido): string | null => (edicaoValida(p.edicao) && UUID.test(p.canalId) ? p.edicao.siteId : null)

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

/** Relatórios do tipo de alcance e linhas de alcance dos últimos JANELA_ALCANCE_DIAS + 5 dias. Erro de banco é LANÇADO; valor ruim (CTR fora de 0 a 1, negativo, data inválida) não lança: vira nulo ou é descartado e entra em `descartados`. */
export async function lerAlcance(sb: SupabaseClient, p: Pedido): Promise<Privado<AlcanceCanal>> {
  const siteId = siteAutorizado(p)
  if (siteId == null) return { acesso: 'negado' }
  const desde = addDays(p.hoje, -(JANELA_ALCANCE_DIAS + 5))
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

/** Diário dos `ytIds` (no máximo TETO_VIDEOS_DIARIO; o resto é ignorado) dos JANELA_DIARIO_DIAS + 10 dias que terminam no ÚLTIMO dia gravado do canal (não em hoje: a coleta atrasa e o canal pode estar parado). Lista vazia: nenhuma linha, mas o `ultimoDia` real do canal. */
export async function lerDiario(sb: SupabaseClient, p: Pedido & { ytIds: readonly string[] }): Promise<Privado<DiarioCanal>> {
  const siteId = siteAutorizado(p)
  if (siteId == null) return { acesso: 'negado' }
  const ytIds = p.ytIds.slice(0, TETO_VIDEOS_DIARIO)
  // SEM janela e sem filtro de vídeo: o último dia gravado do canal, mesmo parado há meses (a série é que é limitada).
  // Roda também com a lista de vídeos vazia: um canal sem longo acompanhado com o diário cheio não é "nunca coletado".
  const ultimoQ = () => primeiraLinha<{ day_pt: string }>('yt_own_video_daily', sb.from('yt_own_video_daily').select('day_pt')
    .eq('site_id', siteId).eq('channel_id', p.canalId)
    .order('day_pt', { ascending: false }).range(0, 0))
  const ultimo = await ultimoQ()
  // Âncora no último dia gravado: a janela de 28 dias do % assistido e da série termina nele, não em hoje. Sem dia gravado não há o que ler.
  const desde = ultimo == null ? null : addDays(ultimo.day_pt, -(JANELA_DIARIO_DIAS + 10))
  const rows = ytIds.length === 0 || desde == null ? [] : await readAll<DiarioRow>('yt_own_video_daily', () => sb.from('yt_own_video_daily')
    .select('youtube_video_id, day_pt, views, avg_view_percentage, avg_view_duration_seconds, collected_at')
    .eq('site_id', siteId).eq('channel_id', p.canalId)
    .in('youtube_video_id', ytIds).gte('day_pt', desde).order('day_pt').order('youtube_video_id'))
  let descartados = 0
  const linhas: DiarioLinha[] = umaPorVideoDia(rows).map(r => {
    const views = medida(r.views), pct = pctDe(r.avg_view_percentage), duracao = medida(r.avg_view_duration_seconds)
    if (views.ruim || pct.ruim || duracao.ruim) descartados++
    return { ytId: r.youtube_video_id, dia: r.day_pt, views: views.v, pctAssistido: pct.v, duracaoMediaSeg: duracao.v }
  })
  return { acesso: 'ok', dado: { canalId: p.canalId, ultimoDia: ultimo?.day_pt ?? null, linhas, descartados } }
}
