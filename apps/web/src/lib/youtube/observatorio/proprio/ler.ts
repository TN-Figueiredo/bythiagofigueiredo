// Leitores de servidor das duas tabelas privadas do canal próprio (alcance e diário por vídeo).
// Regras: só leitura; sempre janela de datas (o diário tem ~97 mil linhas em produção); paginados por readAll
// (limite de 1000 do PostgREST); erro de banco é LANÇADO, nunca vira lista vazia; nulo nunca vira zero.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { readAll } from '../load'
import { ObservatoryLoadError } from '../niches-db'
import { JANELA_ALCANCE_DIAS } from './dias'
import type { AlcanceCanal, AlcanceLinha, DiarioCanal, DiarioLinha, DiaYt, Privado, RelatorioDia, StatusRelatorio } from './tipos'

export const TIPO_ALCANCE = 'channel_reach_basic_a1'
export const JANELA_DIARIO_DIAS = 28
export const TETO_VIDEOS_DIARIO = 50

/**
 * QUEM CHAMA valida o acesso ao site; este leitor só recebe o resultado em `podeEditar` (critério `can_edit_site`,
 * o mesmo da RLS das tabelas) e, sendo falso, devolve 'negado' SEM consultar nada. `siteId` vem de getSiteContext(),
 * nunca da URL; `canalId` é o canal próprio do site, e toda consulta filtra por site E por canal.
 */
export interface Pedido { siteId: string; canalId: string; hoje: DiaYt; podeEditar: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Id que não é uuid (vindo da URL, por exemplo) não chega ao banco: o Postgres lançaria 22P02. Devolve 'negado', sem consulta e sem número. */
const semConsulta = (p: Pedido): boolean => !p.podeEditar || !UUID.test(p.canalId)

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
interface DiarioRow { youtube_video_id: string; day_pt: string; views: unknown; collected_at: string | null }

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

/** Medida que não pode ser negativa (impressões, views). Negativo é lixo da fonte: vira nulo (não medido) e `ruim` avisa. */
function medida(x: unknown): { v: number | null; ruim: boolean } {
  const n = num(x)
  return n != null && n < 0 ? { v: null, ruim: true } : { v: n, ruim: false }
}

/** CTR é fração de 0 a 1 (migration L2). Fora disso o valor não é confiável: vira nulo (não medido) e `ruim` avisa quem chama. */
function ctrDe(x: unknown): { v: number | null; ruim: boolean } {
  const n = num(x)
  return n != null && (n < 0 || n > 1) ? { v: null, ruim: true } : { v: n, ruim: false }
}

/** Relatórios do tipo de alcance e linhas de alcance dos últimos JANELA_ALCANCE_DIAS + 5 dias. Erro de banco é LANÇADO; valor ruim (CTR fora de 0 a 1, negativo, data inválida) não lança: vira nulo ou é descartado e entra em `descartados`. */
export async function lerAlcance(sb: SupabaseClient, p: Pedido): Promise<Privado<AlcanceCanal>> {
  if (semConsulta(p)) return { acesso: 'negado' }
  const desde = addDays(p.hoje, -(JANELA_ALCANCE_DIAS + 5))
  const filtroRel = () => sb.from('yt_reporting_reports').select('report_id, status, start_time, normalized_at')
    .eq('site_id', p.siteId).eq('channel_id', p.canalId).eq('report_type_id', TIPO_ALCANCE)
  const [rels, linhas, recente] = await Promise.all([
    readAll<RelatorioRow>('yt_reporting_reports', () => filtroRel().gte('start_time', desde + 'T00:00:00Z').order('report_id')),
    readAll<AlcanceRow>('yt_own_video_reach_daily', () => sb.from('yt_own_video_reach_daily')
      .select('youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr, collected_at')
      .eq('site_id', p.siteId).eq('channel_id', p.canalId)
      .gte('day_pt', desde).order('day_pt').order('youtube_video_id')),
    // SEM janela: o canal parado há mais que a janela ainda diz quando foi o último relatório
    primeiraLinha<{ start_time: string }>('yt_reporting_reports', sb.from('yt_reporting_reports').select('start_time')
      .eq('site_id', p.siteId).eq('channel_id', p.canalId).eq('report_type_id', TIPO_ALCANCE)
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

/** Diário dos `ytIds` (no máximo TETO_VIDEOS_DIARIO; o resto é ignorado) dos últimos JANELA_DIARIO_DIAS + 10 dias. */
export async function lerDiario(sb: SupabaseClient, p: Pedido & { ytIds: readonly string[] }): Promise<Privado<DiarioCanal>> {
  if (semConsulta(p)) return { acesso: 'negado' }
  const ytIds = p.ytIds.slice(0, TETO_VIDEOS_DIARIO)
  if (ytIds.length === 0) return { acesso: 'ok', dado: { canalId: p.canalId, ultimoDia: null, linhas: [], descartados: 0 } }
  const desde = addDays(p.hoje, -(JANELA_DIARIO_DIAS + 10))
  const [rows, ultimo] = await Promise.all([
    readAll<DiarioRow>('yt_own_video_daily', () => sb.from('yt_own_video_daily')
      .select('youtube_video_id, day_pt, views, collected_at')
      .eq('site_id', p.siteId).eq('channel_id', p.canalId)
      .in('youtube_video_id', ytIds).gte('day_pt', desde).order('day_pt').order('youtube_video_id')),
    // SEM janela e sem filtro de vídeo: o último dia gravado do canal, mesmo parado há meses (a série é que é limitada)
    primeiraLinha<{ day_pt: string }>('yt_own_video_daily', sb.from('yt_own_video_daily').select('day_pt')
      .eq('site_id', p.siteId).eq('channel_id', p.canalId)
      .order('day_pt', { ascending: false }).range(0, 0)),
  ])
  let descartados = 0
  const linhas: DiarioLinha[] = umaPorVideoDia(rows).map(r => {
    const views = medida(r.views)
    if (views.ruim) descartados++
    return { ytId: r.youtube_video_id, dia: r.day_pt, views: views.v }
  })
  return { acesso: 'ok', dado: { canalId: p.canalId, ultimoDia: ultimo?.day_pt ?? null, linhas, descartados } }
}
