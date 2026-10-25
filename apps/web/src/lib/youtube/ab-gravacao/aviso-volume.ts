// Aviso de volume do assistente e do Cowork (S8-F4 T10b): quantos dias o teste v2 precisa para chegar ao N,
// contra o teto. Uma única função para tela e Cowork (paridade). Três leituras de 14 dias por chamada: chamar uma vez
// ao abrir o passo e ao fechar V/teto, nunca por tecla.
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, dayPt, ontemPt, type DiaPt } from '../coleta/day-pt'
import { lerPaginado } from '../coleta/paginar'
import type { ResultadoV2 } from '../ab-types'
import {
  ATRASO_ALCANCE, MSG_VARIANTES_V2, V_MAXIMO_V2, baseDoVideo, folgaPorVariante, tetoDoTesteV2, volumeMinimo,
} from './decisao-v2'
import { estadoDoAlcance } from './estado'
import { diaComAlcanceValido, type Placar } from './placar'
import type { LinhaAlcance, MetaDoDia, RelatorioDoDia } from './tipos'

type Base = { dias_previstos: number; impressoes_dia: number; n: number; base_estimada: boolean }

export type AvisoDeVolume =
  | { estado: 'sem_variantes'; texto: 'adicione as variantes para estimar o volume' }
  | { estado: 'variantes_demais'; texto: 'a regra nova aceita até 2 variantes além da original' }
  | { estado: 'sem_medicao'; texto: 'sem medição para estimar o volume' }
  | ({ estado: 'ok'; texto: null } & Base)
  | ({ estado: 'so_decide_depois'; texto: string } & Base)
  | ({ estado: 'nao_chega'; texto: string } & Base)
  | ({ estado: 'teto_justo'; folga_min: number; texto: string } & Base)

const TETO_LEITURA = 20_000
const DIA_MS = 86_400_000
const plural = (n: number): string => `${n} dia${n === 1 ? '' : 's'}`

/** `estatistica` do placar vira 'calculada' sse a decisão v2 gravou `p_adj`. Não toca `placar.ts`. */
export function comEstatistica(placar: Placar, v2: ResultadoV2 | null): Placar {
  return { ...placar, estatistica: v2 && v2.p_adj !== null && v2.p_adj !== undefined ? 'calculada' : 'nao_calculada' }
}

/** Parte pura: estado do aviso dado V, teto, a base do vídeo e a entrega por dia. `impressoesDia` nulo = zero dia válido. */
export function montarAvisoDeVolume(i: {
  V: number; teto: number; p1: number; base_estimada: boolean; impressoesDia: number | null; usouUltimos7: boolean; hoje: DiaPt
}): AvisoDeVolume {
  if (i.V < 2) return { estado: 'sem_variantes', texto: 'adicione as variantes para estimar o volume' }
  if (i.V > V_MAXIMO_V2) return { estado: 'variantes_demais', texto: MSG_VARIANTES_V2 }
  if (i.impressoesDia === null || !(i.impressoesDia > 0)) return { estado: 'sem_medicao', texto: 'sem medição para estimar o volume' }
  const n = volumeMinimo(i.p1, i.V)
  const dias_previstos = Math.ceil((i.V * n) / i.impressoesDia)
  const base: Base = { dias_previstos, impressoes_dia: Math.round(i.impressoesDia), n, base_estimada: i.base_estimada }
  const fim = i.teto - 1
  const limite = fim - ATRASO_ALCANCE
  const origem = i.usouUltimos7 ? ' (estimativa pelos últimos 7 dias)' : ''
  if (dias_previstos > fim) {
    return { estado: 'nao_chega', ...base, texto: `este teste não chega ao volume em ${i.teto} dias; o desfecho provável é inconclusivo por volume${origem}` }
  }
  if (dias_previstos > limite) {
    return { estado: 'so_decide_depois', ...base, texto: `só decide depois que o YouTube enviar os últimos dias (cerca de ${plural(dias_previstos + ATRASO_ALCANCE)} depois do início)${origem}` }
  }
  const folgas = folgaPorVariante(i.V, i.teto)
  const min = Math.min(...folgas)
  if (min < 1) { // folga 1 é o alvo do dono (V=2, 15 dias): estado ok, não alarme (Phil D4)
    let paraFolga1 = i.teto
    while (paraFolga1 < i.teto + 6 && Math.min(...folgaPorVariante(i.V, paraFolga1)) < 1) paraFolga1++
    return {
      estado: 'teto_justo', ...base, folga_min: min,
      texto: `uma das versões fica com pouco tempo no ar com ${plural(i.teto)}; com ${plural(paraFolga1)} a rotação fica equilibrada${origem}`,
    }
  }
  return { estado: 'ok', ...base, texto: null }
}

type Entradas = { alcance: Map<string, LinhaAlcance>; relatorios: Map<string, RelatorioDoDia[]>; meta: Map<string, MetaDoDia> }

/** Entrega por dia dos 14 dias antes de `ate` (mesmos filtros de `baseDoVideo`): média dos 14 e dos últimos 7; vale a menor. */
function entregaPorDia(e: Entradas, video: { youtube_id: string; channel_id: string }, testId: string, ate: DiaPt, agora: Date): { impressoesDia: number | null; usouUltimos7: boolean } {
  const ontem = ontemPt(agora)
  let s14 = 0, d14 = 0, s7 = 0, d7 = 0
  for (let k = 14; k >= 1; k--) {
    const day = addDays(ate, -k)
    const meta = e.meta.get(`${video.youtube_id}|${day}`) ?? null
    if (meta && meta.ab_test_id !== null && meta.ab_test_id !== testId) continue
    const linha = e.alcance.get(`${video.youtube_id}|${day}`) ?? null
    const alcance_estado = estadoDoAlcance({ day, ontem, relatorios: e.relatorios.get(`${video.channel_id}|${day}`) ?? [], linha })
    const imp = linha?.thumbnail_impressions ?? null
    if (!diaComAlcanceValido({ alcance_estado, impressoes: imp, ctr: linha?.thumbnail_ctr ?? null })) continue
    s14 += imp as number; d14++
    if (k <= 7) { s7 += imp as number; d7++ }
  }
  if (d14 === 0) return { impressoesDia: null, usouUltimos7: false }
  const m14 = s14 / d14
  if (d7 > 0 && s7 / d7 < m14) return { impressoesDia: s7 / d7, usouUltimos7: true }
  return { impressoesDia: m14, usouUltimos7: false }
}

type Linha = Record<string, unknown>

/** `pedido`: o assistente ainda não subiu as variantes (V no banco é menor): vale o maior V; `teto` explícito do pedido vence o do banco. */
export async function avisoDeVolume(sb: SupabaseClient, siteId: string, testId: string, agora: Date, pedido?: { V: number; teto?: number }): Promise<{ ok: true; aviso: AvisoDeVolume } | { ok: false; erro: string }> {
  const t = await sb.from('ab_tests')
    .select('id, config, youtube_videos!inner(youtube_video_id, channel_id), variants:ab_test_variants!test_id(id)')
    .eq('id', testId).eq('site_id', siteId).maybeSingle()
  if (t.error) return { ok: false, erro: 'leitura do teste falhou' }
  const row = t.data as Linha | null
  if (!row) return { ok: false, erro: 'teste não encontrado' }
  const V = Math.max(Array.isArray(row.variants) ? row.variants.length : 0, pedido?.V ?? 0)
  const teto = pedido?.teto ?? tetoDoTesteV2(row.config, V, { soExplicito: true })
  const hoje = dayPt(agora)
  if (V < 2 || V > V_MAXIMO_V2) {
    return { ok: true, aviso: montarAvisoDeVolume({ V, teto, p1: 0.04, base_estimada: true, impressoesDia: null, usouUltimos7: false, hoje }) }
  }
  const v = Array.isArray(row.youtube_videos) ? row.youtube_videos[0] : row.youtube_videos
  const vid = v as { youtube_video_id?: string; channel_id?: string } | undefined
  if (!vid?.youtube_video_id || !vid.channel_id) return { ok: false, erro: 'vídeo do teste não encontrado' }
  const video = { youtube_id: vid.youtube_video_id, channel_id: vid.channel_id }
  const desde = addDays(hoje, -14)

  const m = await lerPaginado<MetaDoDia & { youtube_video_id: string; day_pt: string }>((de, ate) => sb.from('yt_own_video_meta_daily')
    .select('youtube_video_id, day_pt, ab_test_id, ab_variant_id, seconds_on_air_analytics, captured_at')
    .eq('youtube_video_id', video.youtube_id).gte('day_pt', desde).order('day_pt').range(de, ate), TETO_LEITURA)
  const a = await lerPaginado<LinhaAlcance & { youtube_video_id: string; day_pt: string }>((de, ate) => sb.from('yt_own_video_reach_daily')
    .select('youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr, source_report_id, report_create_time')
    .eq('youtube_video_id', video.youtube_id).gte('day_pt', desde).order('day_pt').range(de, ate), TETO_LEITURA)
  const r = await lerPaginado<RelatorioDoDia & { channel_id: string; start_time: string }>((de, ate) => sb.from('yt_reporting_reports')
    .select('report_id, channel_id, status, create_time, normalized_at, start_time')
    .eq('report_type_id', 'channel_reach_basic_a1').eq('channel_id', video.channel_id)
    .gte('start_time', new Date(Date.parse(`${desde}T00:00:00Z`) - DIA_MS).toISOString()).order('report_id').range(de, ate), TETO_LEITURA)
  if (!m.ok || !a.ok || !r.ok) return { ok: false, erro: 'leitura da entrega falhou' }

  const e: Entradas = { alcance: new Map(), relatorios: new Map(), meta: new Map() }
  for (const x of m.linhas) e.meta.set(`${x.youtube_video_id}|${x.day_pt}`, x)
  for (const x of a.linhas) e.alcance.set(`${x.youtube_video_id}|${x.day_pt}`, x)
  for (const x of r.linhas) {
    const k = `${x.channel_id}|${dayPt(new Date(x.start_time))}`
    const l = e.relatorios.get(k) ?? []
    l.push(x)
    e.relatorios.set(k, l)
  }
  const base = baseDoVideo({ alcancePorVideoDia: e.alcance, relatoriosPorCanalDia: e.relatorios, metaPorVideoDia: e.meta }, video, testId, hoje, agora)
  const { impressoesDia, usouUltimos7 } = entregaPorDia(e, video, testId, hoje, agora)
  return { ok: true, aviso: montarAvisoDeVolume({ V, teto, p1: base.p1, base_estimada: base.base_estimada, impressoesDia, usouUltimos7, hoje }) }
}
