// A5 · E5b · Tarefa 9: o diário por vídeo de UM período (de `de` a `ate`), com a cobertura. Só leitura.
// Molde de `ler.ts`: o acesso é a PROVA de leitura privada (sem prova, ou canal que não é uuid: 'negado' SEM consultar); toda consulta
// filtra por site (o da prova), canal E vídeo; leitura paginada pela chave (vídeo, dia); erro de banco e teto de linhas são LANÇADOS,
// nunca lista vazia nem corte em silêncio. Depois da dieta (MG15) dia sem atividade não tem linha: quem diz "este dia foi coletado" é a
// cobertura (`yt_own_video_coverage`, conjunto `base`), lida aqui junto, e `totalDoPeriodo` só afirma total com a cobertura inteira.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ObservatoryLoadError } from '../niches-db'
import { leituraValida } from './leitura-privada'
import { cobreTodo, type CoberturaDoPeriodo, type DiarioDoPeriodo, type DiarioPeriodoLinha, type IntervaloBase } from './diario-periodo'
import type { Pedido } from './ler'
import type { DiaYt, Privado } from './tipos'

/** Teto de linhas com views por leitura (10 páginas de 1.000); acima lança. Decisão da emenda 1 (D-I6, S-I8): eram 60.000. */
export const TETO_LINHAS_DIARIO_PERIODO = 10_000
/** Vídeos por chamada; o resto volta em `foraDoTeto`. */
export const TETO_VIDEOS_DIARIO_PERIODO = 50
const PAGINA = 1000
const PCT_MAX = 999.99
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DIA = /^\d{4}-\d{2}-\d{2}$/
const TABELA_AUSENTE = new Set(['42P01', 'PGRST205'])

interface DiarioRow { youtube_video_id: string; day_pt: string; views: unknown; avg_view_percentage: unknown }
interface CoberturaRow { youtube_video_id: unknown; covered_from: unknown; covered_to: unknown }

function num(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null
  if (typeof x === 'string' && x.trim() !== '') { const n = Number(x); return Number.isFinite(n) ? n : null }
  return null
}

async function paginar<T>(tabela: string, teto: number, build: () => { range(a: number, b: number): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> }): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await build().range(de, de + PAGINA - 1)
    if (error) throw new ObservatoryLoadError(tabela, error.code, error.message)
    const pagina = Array.isArray(data) ? (data as T[]) : []
    out.push(...pagina)
    if (out.length > teto) throw new ObservatoryLoadError(tabela, undefined, `passou do teto de ${teto} linhas`)
    if (pagina.length < PAGINA) return out
  }
}

/**
 * O diário de até 50 vídeos de `de` a `ate` (`de` nulo = desde o começo, e exige `soComViews`). `ate` é RECEBIDO (o `ultimoDia` do `lerDiario`
 * tolerante), nunca "o último dia com linha". Linha com views negativas ou % fora de 0 a 999,99 vira nulo e conta em `descartados`.
 */
export async function lerDiarioDoPeriodo(sb: SupabaseClient, p: Pedido & {
  ytIds: readonly string[]; de: DiaYt | null; ate: DiaYt; soComViews: boolean
  publicacoes: ReadonlyMap<string, DiaYt | null>; tetoLinhas?: number
}): Promise<Privado<DiarioDoPeriodo>> {
  if (!leituraValida(p.leitura) || !UUID.test(p.canalId)) return { acesso: 'negado' }
  const siteId = p.leitura.siteId
  if (p.de === null && !p.soComViews) throw new RangeError('lerDiarioDoPeriodo: "desde o começo" (de nulo) exige soComViews')
  if (!DIA.test(p.ate) || (p.de !== null && (!DIA.test(p.de) || p.de > p.ate))) throw new RangeError('lerDiarioDoPeriodo: janela inválida')
  const teto = p.tetoLinhas ?? TETO_LINHAS_DIARIO_PERIODO
  if (!Number.isFinite(teto) || teto <= 0) throw new RangeError('lerDiarioDoPeriodo: teto de linhas inválido')
  const ids = [...new Set(p.ytIds)]
  const lidos = ids.slice(0, TETO_VIDEOS_DIARIO_PERIODO)
  const foraDoTeto = ids.slice(TETO_VIDEOS_DIARIO_PERIODO)
  const publicacoes = new Map(lidos.map(id => [id, p.publicacoes.get(id) ?? null] as const))
  if (lidos.length === 0) {
    return { acesso: 'ok', dado: { canalId: p.canalId, de: p.de, ate: p.ate, linhas: [], foraDoTeto, descartados: 0, cobertura: { conhecida: true, videosCompletos: 0, videosIncompletos: 0, primeiroDiaLido: null, intervalos: new Map(), ytIds: [], publicacoes } } }
  }
  const de = p.de
  const [rows, cobRows] = await Promise.all([
    paginar<DiarioRow>('yt_own_video_daily', teto, () => {
      let q = sb.from('yt_own_video_daily').select('youtube_video_id, day_pt, views, avg_view_percentage')
        .eq('site_id', siteId).eq('channel_id', p.canalId).in('youtube_video_id', lidos).lte('day_pt', p.ate)
      if (de !== null) q = q.gte('day_pt', de)
      if (p.soComViews) q = q.gt('views', 0)
      return q.order('youtube_video_id').order('day_pt')
    }),
    paginar<CoberturaRow>('yt_own_video_coverage', Number.MAX_SAFE_INTEGER, () => {
      let q = sb.from('yt_own_video_coverage').select('youtube_video_id, covered_from, covered_to')
        .eq('site_id', siteId).eq('channel_id', p.canalId).eq('metric_set', 'base').in('youtube_video_id', lidos).lte('covered_from', p.ate)
      if (de !== null) q = q.gte('covered_to', de)
      return q.order('youtube_video_id').order('covered_from')
    }).catch((e: unknown): null => {
      if (e instanceof ObservatoryLoadError && e.table === 'yt_own_video_coverage' && e.code != null && TABELA_AUSENTE.has(e.code)) return null
      throw e
    }),
  ])
  let descartados = 0
  const linhas: DiarioPeriodoLinha[] = rows.map(r => {
    let views = num(r.views), pct = num(r.avg_view_percentage)
    if (views !== null && views < 0) { views = null; descartados++ }
    if (pct !== null && (pct < 0 || pct > PCT_MAX)) { pct = null; descartados++ }
    return { ytId: r.youtube_video_id, dia: r.day_pt, views, pctAssistido: pct }
  })
  const intervalos = new Map<string, IntervaloBase[]>(lidos.map(id => [id, []]))
  const conhecida = cobRows !== null
  if (cobRows === null) {
    Sentry.captureMessage('observatorio-proprio: tabela yt_own_video_coverage ausente (migration MG14 não aplicada)', {
      level: 'warning', tags: { component: 'observatorio-proprio', step: 'cobertura-ausente' },
    })
  } else {
    for (const r of cobRows) {
      if (typeof r.youtube_video_id !== 'string' || typeof r.covered_from !== 'string' || typeof r.covered_to !== 'string') {
        throw new ObservatoryLoadError('yt_own_video_coverage', undefined, 'intervalo de cobertura ilegível')
      }
      intervalos.get(r.youtube_video_id)?.push({ de: r.covered_from, ate: r.covered_to })
    }
  }
  let completos = 0, incompletos = 0
  if (conhecida) {
    for (const id of lidos) {
      const pub = publicacoes.get(id) ?? null
      const inicio = de === null ? pub : pub === null ? null : pub > de ? pub : de
      if (inicio === null) { incompletos++; continue }
      if (cobreTodo(intervalos.get(id) ?? [], inicio, p.ate)) completos++
      else incompletos++
    }
  }
  const primeiroDiaLido = linhas.reduce<DiaYt | null>((m, l) => (m === null || l.dia < m ? l.dia : m), null)
  return {
    acesso: 'ok',
    dado: { canalId: p.canalId, de: p.de, ate: p.ate, linhas, foraDoTeto, descartados, cobertura: { conhecida, videosCompletos: completos, videosIncompletos: incompletos, primeiroDiaLido, intervalos, ytIds: lidos, publicacoes } },
  }
}
