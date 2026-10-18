// Passo do cron ab-retrato (S8-F1): carrega em lote, chama `montarRetrato` (pura) e grava por RPC.
// Só escreve em `ab_test_dias`. Toda leitura é paginada (PostgREST corta em 1.000) e tem teto: qualquer falha de
// leitura registra a falha do cron e NADA é escrito (um dia nunca vira `aguardando` por falta de leitura).
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordCronFailure } from '@/lib/cron-health'
import { addDays, boundsAnalytics, dayPt, diffDias, ontemPt, type DiaPt } from '../coleta/day-pt'
import type { AbCycle } from '../coleta/ab-seconds'
import { lerPaginado, type LeituraPaginada } from '../coleta/paginar'
import type { ErroBanco } from '../coleta/schema'
import type { LinhaAlcance, MetaDoDia, RelatorioDoDia } from './tipos'
import {
  janelaDesde, montarRetrato,
  type EntradasDoRetrato, type LinhaRetrato, type LinhaSonda, type LinhaViews, type TesteParaRetrato,
} from './retrato'

const JOB = 'ab-retrato'
const BLOCO_APPLY = 500
const DIA_MS = 86_400_000
const TETO_TESTES = 5_000
const TETO_LINHAS = 20_000
const DIAS_RELATORIO_ABERTO = 11

export type ResultadoRetrato =
  | { status: 'ok'; testes: number; linhas: number; fechadas_apagados: number; fechadas_antigas: number; fechadas_sem_alcance: number; notas: string[] }
  | { status: 'error'; error: string; health_written: true }

type Linha = Record<string, unknown>

class FalhaDeLeitura extends Error {}

async function ler<T>(
  tabela: string,
  teto: number,
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const r: LeituraPaginada<T> = await lerPaginado<T>(
    (de, ate) => pagina(de, ate) as PromiseLike<{ data: T[] | null; error: ErroBanco | null }>,
    teto,
  )
  if (!r.ok) throw new FalhaDeLeitura(`${tabela}: ${r.motivo}${r.detalhe ? ` (${r.detalhe})` : ''}`)
  return r.linhas
}

const BLOCO_IN = 100

/** Filtro `in (...)` com muitos ids estoura a URL do PostgREST: lê por blocos de 100 e junta (cada bloco é paginado). */
async function emBlocos<V, T>(valores: V[], fn: (bloco: V[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < valores.length; i += BLOCO_IN) out.push(...(await fn(valores.slice(i, i + BLOCO_IN))))
  return out
}

const SELECT_TESTE = 'id, site_id, status, test_type, regra_duracao, paused_at, completed_at, original_title, started_at, youtube_videos!inner(youtube_video_id, channel_id)'

interface TesteLido extends Linha {
  id: string; site_id: string; status: string; test_type: TesteParaRetrato['test_type']; regra_duracao: TesteParaRetrato['regra_duracao']
  paused_at: string | null; completed_at: string | null; original_title: string | null; started_at: string | null
  youtube_videos: { youtube_video_id: string; channel_id: string } | Array<{ youtube_video_id: string; channel_id: string }>
}

function paraTeste(t: TesteLido): TesteParaRetrato & { started_at: string | null } {
  const v = Array.isArray(t.youtube_videos) ? t.youtube_videos[0]! : t.youtube_videos
  return {
    id: t.id, status: t.status, paused_at: t.paused_at, completed_at: t.completed_at, original_title: t.original_title,
    site_id: t.site_id, test_type: t.test_type, regra_duracao: t.regra_duracao,
    youtube_id: v.youtube_video_id, channel_id: v.channel_id, started_at: t.started_at,
  }
}

const meiaNoite = (dia: DiaPt): string => new Date(boundsAnalytics(dia).start).toISOString()
const chave = (a: string, b: string): string => `${a}|${b}`

function agrupar<T>(m: Map<string, T[]>, k: string, v: T): void {
  const l = m.get(k)
  if (l) l.push(v)
  else m.set(k, [v])
}

async function falha(msg: string): Promise<ResultadoRetrato> {
  await recordCronFailure(JOB, msg)
  return { status: 'error', error: msg, health_written: true }
}

export async function rodarRetrato(sb: SupabaseClient, agora: Date): Promise<ResultadoRetrato> {
  const ontem = ontemPt(agora)
  const desdeJanela = janelaDesde(ontem)
  let testes: Array<TesteParaRetrato & { started_at: string | null }>
  let apagados: string[]
  let entradasBase: Omit<EntradasDoRetrato, 'testes' | 'desde'> | null = null

  try {
    // (1) testes vivos ou concluídos há pouco
    const corte = new Date(agora.getTime() - 11 * DIA_MS).toISOString()
    const lidos = await ler<TesteLido>('ab_tests', TETO_TESTES, (de, ate) => sb.from('ab_tests').select(SELECT_TESTE)
      .or(`status.in.(active,paused),and(status.in.(completed,archived),completed_at.gte.${corte})`)
      .order('id').range(de, ate))
    // (2) testes com linha aberta que a 1ª leitura não trouxe
    const abertas = await ler<{ test_id: string; day_pt: string }>('ab_test_dias', TETO_LINHAS, (de, ate) => sb.from('ab_test_dias')
      .select('test_id, day_pt').eq('final', false).order('test_id').order('day_pt').range(de, ate))
    const vistos = new Set(lidos.map((t) => t.id))
    const faltantes = [...new Set(abertas.map((a) => a.test_id))].filter((id) => !vistos.has(id))
    let extras: TesteLido[] = []
    if (faltantes.length > 0) {
      extras = await emBlocos(faltantes, (bl) => ler<TesteLido>('ab_tests', TETO_TESTES, (de, ate) => sb.from('ab_tests').select(SELECT_TESTE)
        .in('id', bl).order('id').range(de, ate)))
    }
    const achados = new Set(extras.map((t) => t.id))
    apagados = faltantes.filter((id) => !achados.has(id))
    testes = [...lidos, ...extras].map(paraTeste)

    if (testes.length > 0) {
      const ids = testes.map((t) => t.id)
      const videos = [...new Set(testes.map((t) => t.youtube_id))]
      const canais = [...new Set(testes.map((t) => t.channel_id))]
      const desdeStr = desdeJanela
      const ciclos = await emBlocos(ids, (bl) => ler<AbCycle>('ab_test_cycles', TETO_TESTES * 20, (de, ate) => sb.from('ab_test_cycles')
        .select('id, test_id, variant_id, started_at, ended_at, applied_metadata').in('test_id', bl).order('id').range(de, ate)))
      const metas = await emBlocos(videos, (bl) => ler<MetaDoDia & { youtube_video_id: string; day_pt: string }>('yt_own_video_meta_daily', TETO_LINHAS, (de, ate) => sb.from('yt_own_video_meta_daily')
        .select('youtube_video_id, day_pt, ab_test_id, ab_variant_id, seconds_on_air_analytics, captured_at')
        .in('youtube_video_id', bl).gte('day_pt', desdeStr).order('youtube_video_id').order('day_pt').range(de, ate)))
      const alcances = await emBlocos(videos, (bl) => ler<LinhaAlcance & { youtube_video_id: string; day_pt: string }>('yt_own_video_reach_daily', TETO_LINHAS, (de, ate) => sb.from('yt_own_video_reach_daily')
        .select('youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr, source_report_id, report_create_time')
        .in('youtube_video_id', bl).gte('day_pt', desdeStr).order('youtube_video_id').order('day_pt').range(de, ate)))
      const relatorios = await emBlocos(canais, (bl) => ler<RelatorioDoDia & { channel_id: string; start_time: string }>('yt_reporting_reports', TETO_LINHAS, (de, ate) => sb.from('yt_reporting_reports')
        .select('report_id, channel_id, status, create_time, normalized_at, start_time')
        .eq('report_type_id', 'channel_reach_basic_a1').in('channel_id', bl)
        .gte('start_time', new Date(boundsAnalytics(desdeStr).start - DIA_MS).toISOString()).order('report_id').range(de, ate)))
      const views = await emBlocos(videos, (bl) => ler<LinhaViews & { youtube_video_id: string; day_pt: string }>('yt_own_video_daily', TETO_LINHAS, (de, ate) => sb.from('yt_own_video_daily')
        .select('youtube_video_id, day_pt, views, engaged_views, watch_time_minutes, avg_view_percentage, source, metric_version')
        .in('youtube_video_id', bl).gte('day_pt', desdeStr).order('youtube_video_id').order('day_pt').range(de, ate)))
      const cobertura = await emBlocos(videos, (bl) => ler<{ youtube_video_id: string; covered_from: string; covered_to: string }>('yt_own_video_coverage', TETO_LINHAS, (de, ate) => sb.from('yt_own_video_coverage')
        .select('youtube_video_id, covered_from, covered_to').in('youtube_video_id', bl).eq('metric_set', 'base')
        .order('youtube_video_id').order('covered_from').range(de, ate)))
      const sondas = await emBlocos(ids, (bl) => ler<LinhaSonda & { test_id: string }>('ab_test_sondas', TETO_LINHAS, (de, ate) => sb.from('ab_test_sondas')
        .select('test_id, hora, lida_em, leitura_estado, variante_vista').in('test_id', bl).eq('leitura_estado', 'bate')
        .gte('hora', meiaNoite(addDays(ontem, -DIAS_RELATORIO_ABERTO))).order('test_id').order('hora').range(de, ate)))

      const ciclosPorTeste = new Map<string, AbCycle[]>()
      for (const c of ciclos) agrupar(ciclosPorTeste, c.test_id, c)
      const metaPorVideoDia = new Map<string, MetaDoDia>()
      for (const m of metas) metaPorVideoDia.set(chave(m.youtube_video_id, m.day_pt), m)
      const alcancePorVideoDia = new Map<string, LinhaAlcance>()
      for (const a of alcances) alcancePorVideoDia.set(chave(a.youtube_video_id, a.day_pt), a)
      const relatoriosPorCanalDia = new Map<string, RelatorioDoDia[]>()
      for (const r of relatorios) agrupar(relatoriosPorCanalDia, chave(r.channel_id, dayPt(new Date(r.start_time))), r)
      const viewsPorVideoDia = new Map<string, LinhaViews>()
      for (const v of views) viewsPorVideoDia.set(chave(v.youtube_video_id, v.day_pt), v)
      const coberturaPorVideo = new Map<string, Array<{ de: DiaPt; ate: DiaPt }>>()
      for (const c of cobertura) agrupar(coberturaPorVideo, c.youtube_video_id, { de: c.covered_from, ate: c.covered_to })
      const sondasPorTesteDia = new Map<string, LinhaSonda[]>()
      for (const s of sondas) agrupar(sondasPorTesteDia, chave(s.test_id, dayPt(new Date(s.hora))), s)
      entradasBase = { ciclosPorTeste, metaPorVideoDia, alcancePorVideoDia, relatoriosPorCanalDia, viewsPorVideoDia, coberturaPorVideo, sondasPorTesteDia }
    }
  } catch (e) {
    if (e instanceof FalhaDeLeitura) return falha(e.message)
    return falha(`leitura: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (testes.length === 0 && apagados.length === 0) {
    return { status: 'ok', testes: 0, linhas: 0, fechadas_apagados: 0, fechadas_antigas: 0, fechadas_sem_alcance: 0, notas: [] }
  }

  // Montagem: o `desde` é por teste, max(janela, início do teste).
  const linhas: LinhaRetrato[] = []
  if (entradasBase) {
    for (const t of testes) {
      const inicio = t.started_at ? dayPt(new Date(t.started_at)) : null
      const desde = inicio && inicio > desdeJanela ? inicio : desdeJanela
      linhas.push(...montarRetrato({ ...entradasBase, testes: [t], desde }, agora))
    }
  }

  // Gravação
  let fechadasAntigas = 0
  let fechadasApagados = 0
  const antigas = await sb.rpc('ab_test_dias_fechar_antigas', { p_antes: desdeJanela })
  if (antigas.error) return falha(`ab_test_dias_fechar_antigas: ${antigas.error.message}`)
  fechadasAntigas = typeof antigas.data === 'number' ? antigas.data : 0
  for (let i = 0; i < linhas.length; i += BLOCO_APPLY) {
    const r = await sb.rpc('ab_test_dias_apply', { p_rows: linhas.slice(i, i + BLOCO_APPLY) })
    if (r.error) return falha(`ab_test_dias_apply: ${r.error.message}`)
  }
  if (apagados.length > 0) {
    const r = await sb.rpc('ab_test_dias_fechar_apagados', { p_test_ids: apagados })
    if (r.error) return falha(`ab_test_dias_fechar_apagados: ${r.error.message}`)
    fechadasApagados = typeof r.data === 'number' ? r.data : 0
  }

  // Números do log e notas (info, sem marcar o cron como falho: o atraso é do YouTube).
  const ativos = new Set(testes.filter((t) => t.status === 'active').map((t) => t.id))
  const notas: string[] = []
  let fechadasSemAlcance = 0
  for (const l of linhas) {
    const d = diffDias(l.day_pt, ontem)
    if (d === 10 && l.alcance_estado === 'nao_medido' && l.source_report_id === null) fechadasSemAlcance++
    if (ativos.has(l.test_id) && l.alcance_estado === 'aguardando' && d >= 5) {
      const frase = `teste ${l.test_id}: alcance de ${l.day_pt} ainda aguardando o relatório (D+${d})`
      notas.push(frase)
      Sentry.captureMessage('ab-retrato: alcance aguardando', {
        level: 'info',
        fingerprint: ['ab-retrato-aguardando', l.test_id, l.day_pt],
        extra: { testId: l.test_id, day: l.day_pt, dias: d },
      })
    }
  }
  return { status: 'ok', testes: testes.length, linhas: linhas.length, fechadas_apagados: fechadasApagados, fechadas_antigas: fechadasAntigas, fechadas_sem_alcance: fechadasSemAlcance, notas }
}
