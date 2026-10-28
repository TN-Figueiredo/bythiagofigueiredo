// F2b T3: as consultas SEM prova de leitura do dado privado do canal próprio (leitura paginada, cobertura, base diária, dimensões, alcance,
// relatórios e detalhe), extraídas de `ler-dimensoes.ts` para a medida D2 reusar (§3.7: nenhum leitor paralelo). Os leitores com prova
// (`ler-dimensoes.ts`) continuam sendo a porta das telas e chamam estas funções; a prova fica lá. Quem chama daqui sem prova é só
// `sinais/medida/series.ts` (tarefa de servidor com cliente de serviço; sai agregado, nunca a linha do dia). O erro lançado leva só tabela,
// motivo, código e contagem: a mensagem do banco é descartada (pode carregar conteúdo).
import type { SupabaseClient } from '@supabase/supabase-js'
import { TAMANHO_PAGINA } from '@/lib/youtube/coleta/paginar'
import { ehSchemaAusente } from '@/lib/youtube/coleta/schema'

/** O relatório do alcance básico (R2): impressões por vídeo e dia. */
export const TIPO_ALCANCE = 'channel_reach_basic_a1'
/** Vídeos por consulta (o `in` do PostgREST); os leitores e a medida D2 leem em blocos deste tamanho. */
export const TETO_VIDEOS_CONSULTA = 50

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

export interface ConsultaFaixa { range(de: number, ate: number): PromiseLike<{ data: unknown; error: { code?: string | null } | null }> }
export type Leitura<T> = { ausente: true } | { ausente: false; linhas: T[] }

/** Uma faixa de uma consulta ordenada por chave única. Erro de banco lança; tabela ou coluna inexistente devolve `ausente`. */
export async function lerFaixa<T>(tabela: string, build: () => ConsultaFaixa, de: number, ate: number, lidas: number): Promise<Leitura<T>> {
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

export async function lerTudo<T>(tabela: string, build: () => ConsultaFaixa, teto: number): Promise<Leitura<T>> {
  const todas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const pag = await lerFaixa<T>(tabela, build, de, de + TAMANHO_PAGINA - 1, todas.length)
    if (pag.ausente) return pag
    for (const l of pag.linhas) todas.push(l)
    if (todas.length > teto) throw new ErroLeituraDimensoes(tabela, 'passou_do_teto', null, todas.length)
    if (pag.linhas.length < TAMANHO_PAGINA) return { ausente: false, linhas: todas }
  }
}

/**
 * O que as consultas precisam: site, vídeos (ids do YouTube) e janela. `canalId` nulo = todos os canais do site (o id do vídeo do YouTube
 * já o identifica; a medida D2 lê vários canais de uma vez). Toda consulta filtra por site.
 */
export interface AlvoConsulta { siteId: string; canalId: string | null; ytIds: readonly string[]; de: string; ate: string; teto: number }

export interface CoberturaRow { youtube_video_id: string; metric_set: string; covered_from: string; covered_to: string }
export interface DiarioRow { youtube_video_id: string; day_pt: string; views: unknown }
export interface DimRow { youtube_video_id: string; day_pt: string; dim_kind: string; dim_value: string; views: unknown; watch_time_minutes: unknown }
export interface ReachDimRow { youtube_video_id: string; day_pt: string; traffic_source_type: string; device_type: string; operating_system: string; thumbnail_impressions: unknown; thumbnail_clicks_est: unknown }
export interface ReachBaseRow { youtube_video_id: string; day_pt: string; thumbnail_impressions: unknown }
export interface RelatorioRow { start_time: string; normalized_at: string | null }
export interface DetalheRow { youtube_video_id: string; day_pt: string; source_type: string; detail: string; detail_hash: string; views: unknown; watch_time_minutes: unknown }

/** `extras`: colunas a mais no `select` (só a medida D2 pede; as telas ficam com o select de sempre). */
const colunas = (base: string, extras: string): string => (extras ? `${base}, ${extras}` : base)

/** Cobertura por (vídeo, conjunto). Sem filtro de data: são poucos intervalos fundidos, e dizem se o conjunto já foi coletado fora da janela. */
export function lerCobertura(sb: SupabaseClient, a: AlvoConsulta, sets: readonly string[], extras = ''): Promise<Leitura<CoberturaRow>> {
  return lerTudo<CoberturaRow>('yt_own_video_coverage', () => {
    const q = sb.from('yt_own_video_coverage').select(colunas('youtube_video_id, metric_set, covered_from, covered_to', extras)).eq('site_id', a.siteId)
    return (a.canalId === null ? q : q.eq('channel_id', a.canalId))
      .in('youtube_video_id', [...a.ytIds]).in('metric_set', [...sets])
      .order('youtube_video_id').order('metric_set').order('covered_from')
  }, a.teto)
}

export function lerBaseDiaria(sb: SupabaseClient, a: AlvoConsulta): Promise<Leitura<DiarioRow>> {
  return lerTudo<DiarioRow>('yt_own_video_daily', () => {
    const q = sb.from('yt_own_video_daily').select('youtube_video_id, day_pt, views').eq('site_id', a.siteId)
    return (a.canalId === null ? q : q.eq('channel_id', a.canalId))
      .in('youtube_video_id', [...a.ytIds]).gte('day_pt', a.de).lte('day_pt', a.ate)
      .order('youtube_video_id').order('day_pt')
  }, a.teto)
}

/** Origem, aparelho, país e inscrito (`dim_kind`); a medida D2 pede só `traffic_source` (`dimKinds`). */
export function lerDimDiaria(sb: SupabaseClient, a: AlvoConsulta, dimKinds?: readonly string[]): Promise<Leitura<DimRow>> {
  return lerTudo<DimRow>('yt_own_video_dim_daily', () => {
    let q = sb.from('yt_own_video_dim_daily').select('youtube_video_id, day_pt, dim_kind, dim_value, views, watch_time_minutes').eq('site_id', a.siteId)
    if (a.canalId !== null) q = q.eq('channel_id', a.canalId)
    q = q.in('youtube_video_id', [...a.ytIds]).gte('day_pt', a.de).lte('day_pt', a.ate)
    if (dimKinds) q = q.in('dim_kind', [...dimKinds])
    return q.order('youtube_video_id').order('day_pt').order('dim_kind').order('dim_value')
  }, a.teto)
}

/** Alcance por origem e aparelho; a medida D2 pede só os tipos de origem de que precisa (`tipos`). */
export function lerReachDimDiaria(sb: SupabaseClient, a: AlvoConsulta, tipos?: readonly string[]): Promise<Leitura<ReachDimRow>> {
  return lerTudo<ReachDimRow>('yt_own_video_reach_dim_daily', () => {
    let q = sb.from('yt_own_video_reach_dim_daily')
      .select('youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, thumbnail_impressions, thumbnail_clicks_est').eq('site_id', a.siteId)
    if (a.canalId !== null) q = q.eq('channel_id', a.canalId)
    q = q.in('youtube_video_id', [...a.ytIds]).gte('day_pt', a.de).lte('day_pt', a.ate)
    if (tipos) q = q.in('traffic_source_type', [...tipos])
    return q.order('youtube_video_id').order('day_pt').order('traffic_source_type').order('device_type').order('operating_system')
  }, a.teto)
}

/** Relatórios do tipo `tipo` cujo início cai na janela. `extras`: `status, end_time, channel_id` para a medida D2. */
export function lerRelatorios(sb: SupabaseClient, a: AlvoConsulta, tipo: string, extras = ''): Promise<Leitura<RelatorioRow>> {
  return lerTudo<RelatorioRow>('yt_reporting_reports', () => {
    const q = sb.from('yt_reporting_reports').select(colunas('start_time, normalized_at, report_id', extras)).eq('site_id', a.siteId)
    return (a.canalId === null ? q : q.eq('channel_id', a.canalId)).eq('report_type_id', tipo)
      .gte('start_time', a.de + 'T00:00:00Z').lte('start_time', a.ate + 'T23:59:59Z')
      .order('report_id')
  }, a.teto)
}

/** Impressões do alcance básico por vídeo e dia (a referência do alcance por dimensão). */
export function lerReachBase(sb: SupabaseClient, a: AlvoConsulta): Promise<Leitura<ReachBaseRow>> {
  return lerTudo<ReachBaseRow>('yt_own_video_reach_daily', () => {
    const q = sb.from('yt_own_video_reach_daily').select('youtube_video_id, day_pt, thumbnail_impressions').eq('site_id', a.siteId)
    return (a.canalId === null ? q : q.eq('channel_id', a.canalId))
      .in('youtube_video_id', [...a.ytIds]).gte('day_pt', a.de).lte('day_pt', a.ate)
      .order('youtube_video_id').order('day_pt')
  }, a.teto)
}

/** O detalhe da origem. `filtro` (medida D2): só um tipo de origem e só os `detail` pedidos, nunca o texto de outro tipo. */
export function lerDetalheDiario(sb: SupabaseClient, a: AlvoConsulta, filtro?: { sourceType: string; details: readonly string[] }): Promise<Leitura<DetalheRow>> {
  return lerTudo<DetalheRow>('yt_own_video_traffic_detail_daily', () => {
    let q = sb.from('yt_own_video_traffic_detail_daily').select('youtube_video_id, day_pt, source_type, detail, detail_hash, views, watch_time_minutes').eq('site_id', a.siteId)
    if (a.canalId !== null) q = q.eq('channel_id', a.canalId)
    q = q.in('youtube_video_id', [...a.ytIds]).gte('day_pt', a.de).lte('day_pt', a.ate)
    if (filtro) q = q.eq('source_type', filtro.sourceType).in('detail', [...filtro.details])
    return q.order('youtube_video_id').order('day_pt').order('source_type').order('detail_hash')
  }, a.teto)
}
