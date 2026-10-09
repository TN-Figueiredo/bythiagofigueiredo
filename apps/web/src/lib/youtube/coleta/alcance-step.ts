// Passo `alcance` (spec, seção 5, "Normalizar o alcance básico" — lote L2). Só banco: lê o bruto que o passo de
// relatórios já baixou e grava uma linha por vídeo e dia em yt_own_video_reach_daily.
// Pode ser refeito a partir do bruto: `normalized_at` nulo põe o relatório de volta na fila.
// Quem decide "o mais novo vence" é a função do banco yt_own_reach_apply, não este arquivo.
import * as Sentry from '@sentry/nextjs'
import { gunzipSync } from 'node:zlib'
import { describeCronCause } from '@/lib/cron/failure-note'
import { deBytea } from '@/lib/youtube/reporting/client'
import { agregarAlcance, CsvAlcanceError, lerAlcanceBasico, type LinhaAlcance } from '@/lib/youtube/reporting/reach-csv'
import { restante } from './clock'
import { metricVersion } from './metric-version'
import { conferirBanco, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

export const MAX_NORMALIZAR = 200
const TIPO = 'channel_reach_basic_a1'
const MAX_VIDEOS_LIDOS = 1000

export interface AlcanceResumo extends StepResumo {
  /** Relatórios com dado normalizados nesta execução. */
  normalizados: number
  /** Relatórios `vazio` conferidos (cabeçalho certo) e marcados como normalizados. */
  vazios: number
  /** Relatórios que viraram `erro` nesta execução (cabeçalho, linha, canal, bruto). */
  erros: number
  /** Linhas de vídeo sem par em youtube_videos (gravadas com video_id nulo e listadas no relatório). */
  sem_par: number
}

interface Fila {
  report_id: string
  site_id: string
  channel_id: string
  status: string
  create_time: string
}

/** `feito`: o relatório saiu da fila (normalizado ou em erro). `pendente`: volta amanhã. `parar`: o passo não tem como seguir. */
type Desfecho = 'feito' | 'pendente' | 'parar'

type MapaVideos = Map<string, string>

export async function passoAlcance(ctx: StepCtx): Promise<AlcanceResumo> {
  const resumo: AlcanceResumo = { gravados: 0, tentativas: {}, pendentes: 0, normalizados: 0, vazios: 0, erros: 0, sem_par: 0 }
  const canais = new Map<string, ColetaChannel>(ctx.channels.map(c => [c.id, c]))
  if (canais.size === 0) return resumo

  const lida = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, site_id, channel_id, status, create_time')
    .eq('report_type_id', TIPO)
    .in('status', ['baixado', 'vazio'])
    .is('normalized_at', null)
    .in('channel_id', [...canais.keys()])
    .order('create_time', { ascending: true })
    .limit(MAX_NORMALIZAR + 1)
  if (conferirBanco(lida, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return resumo

  const lidos = (lida.data ?? []) as Fila[]
  const fila = lidos.slice(0, MAX_NORMALIZAR)
  // O excedente exato não é conhecido (a leitura parou em 201): soma 1 e deixa o critério de relatórios
  // pendentes (Task 6) contar o resto direto no banco.
  if (lidos.length > MAX_NORMALIZAR) resumo.pendentes += 1

  // Uma leitura de vídeos por canal e execução. `null` = não deu para ler (ou veio truncada): o relatório espera.
  const videosPorCanal = new Map<string, MapaVideos | null>()
  const videosDe = async (c: ColetaChannel): Promise<MapaVideos | null> => {
    if (videosPorCanal.has(c.id)) return videosPorCanal.get(c.id)!
    let mapa: MapaVideos | null = null
    const res = await ctx.supabase.from('youtube_videos').select('youtube_video_id, id').eq('channel_id', c.id).limit(MAX_VIDEOS_LIDOS)
    if (conferirBanco(res, 'youtube_videos', ctx.falhas, 'ler') === 'ok') {
      const linhas = (res.data ?? []) as Array<{ youtube_video_id: string; id: string }>
      if (linhas.length >= MAX_VIDEOS_LIDOS) {
        pushUnico(ctx.falhas, `alcance: vídeos do canal ${c.name} lidos até o limite de ${MAX_VIDEOS_LIDOS} — a leitura pode estar truncada`)
      } else {
        mapa = new Map(linhas.map(v => [v.youtube_video_id, v.id]))
      }
    }
    videosPorCanal.set(c.id, mapa)
    return mapa
  }

  /** Marca o relatório como `erro`. Falha ao marcar: ele continua na fila. */
  const marcarErro = async (rel: Fila, motivo: string): Promise<Desfecho> => {
    const upd = await ctx.supabase.from('yt_reporting_reports').update({ status: 'erro', error: motivo }).eq('report_id', rel.report_id)
    if (conferirBanco(upd, 'yt_reporting_reports', ctx.falhas) !== 'ok') return 'pendente'
    resumo.erros++
    return 'feito'
  }

  const normalizarUm = async (rel: Fila, canal: ColetaChannel): Promise<Desfecho> => {
    const mapa = await videosDe(canal)
    if (!mapa) return 'pendente'

    const bruto = await ctx.supabase.from('yt_reporting_report_blobs').select('csv_gz').eq('report_id', rel.report_id).maybeSingle()
    if (conferirBanco(bruto, 'yt_reporting_report_blobs', ctx.falhas, 'ler') !== 'ok') return 'pendente'
    const csvGz = (bruto.data as { csv_gz: string } | null)?.csv_gz
    if (!csvGz) return marcarErro(rel, 'bruto_ausente')

    let texto: string
    try {
      texto = gunzipSync(deBytea(csvGz)).toString('utf8')
    } catch {
      return marcarErro(rel, 'gzip_invalido')
    }

    let lidas: LinhaAlcance[]
    try {
      lidas = lerAlcanceBasico(texto)
    } catch (e) {
      if (e instanceof CsvAlcanceError) return marcarErro(rel, e.motivo)
      throw e
    }
    if (lidas.some(l => l.channelId !== canal.channel_id)) return marcarErro(rel, 'canal_inesperado')

    // agregarAlcance devolve uma linha por vídeo e dia: a função do banco recusa chave repetida no lote.
    const alcance = agregarAlcance(lidas)
    const semPar = [...new Set(alcance.filter(a => !mapa.has(a.videoId)).map(a => a.videoId))].sort()
    const p_rows = alcance.map(a => ({
      youtube_video_id: a.videoId,
      day_pt: a.day,
      site_id: rel.site_id,
      video_id: mapa.get(a.videoId) ?? null,
      channel_id: rel.channel_id,
      thumbnail_impressions: a.impressions,
      // Nulo, nunca zero: CTR que não veio fica fora do payload.
      ...(a.ctr !== null ? { thumbnail_ctr: a.ctr } : {}),
      source_report_id: rel.report_id,
      report_create_time: rel.create_time,
      metric_version: metricVersion(a.day),
    }))

    if (p_rows.length > 0) {
      let res: { data: unknown; error: ErroBanco | null }
      try {
        res = await ctx.supabase.rpc('yt_own_reach_apply', { p_rows })
      } catch {
        res = { data: null, error: { code: null, message: 'rpc lançou' } }
      }
      const escrita = conferirBanco(res, 'yt_own_reach_apply', ctx.falhas)
      if (escrita === 'schema_ausente') return 'parar'
      if (escrita !== 'ok') return 'pendente'
      resumo.gravados += typeof res.data === 'number' ? res.data : 0
    }

    const marca = await ctx.supabase
      .from('yt_reporting_reports')
      .update({
        normalized_at: new Date().toISOString(),
        unmatched_video_ids: semPar.length ? { count: semPar.length, ids: semPar } : null,
      })
      .eq('report_id', rel.report_id)
    // Se marcar falhar, as linhas já gravadas ficam; a próxima execução refaz e a função aceita o mesmo relatório.
    if (conferirBanco(marca, 'yt_reporting_reports', ctx.falhas) !== 'ok') return 'pendente'
    if (p_rows.length > 0) resumo.normalizados++
    else resumo.vazios++
    resumo.sem_par += semPar.length
    return 'feito'
  }

  for (let i = 0; i < fila.length; i++) {
    const rel = fila[i]!
    if (restante(ctx.deadline) <= 0) {
      resumo.pendentes += fila.length - i
      break
    }
    const canal = canais.get(rel.channel_id)
    let desfecho: Desfecho = 'pendente'
    if (canal) {
      try {
        desfecho = await normalizarUm(rel, canal)
      } catch (e) {
        Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'alcance' }, extra: { report: rel.report_id } })
        pushUnico(ctx.falhas, `alcance: ${describeCronCause(e)}`)
      }
    }
    if (desfecho === 'parar') {
      resumo.pendentes += fila.length - i
      break
    }
    if (desfecho === 'pendente') resumo.pendentes++
  }
  return resumo
}
