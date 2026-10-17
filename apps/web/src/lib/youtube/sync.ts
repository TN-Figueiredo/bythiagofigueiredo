import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { fetchRecentVideoIds, fetchVideoDetails, fetchChannelStats, lookupChannelByHandle, YouTubeQuotaError } from './api-client'
import { registrarTentativa } from './coleta/attempts'
import type { Outcome } from './coleta/types'
import { autoCategorize } from './auto-categorize'
import type { YouTubeChannelRow, YouTubeCategoryRow, SyncMode } from './types'

interface SyncResult {
  videosFound: number
  videosInserted: number
  videosUpdated: number
  quotaUsed: number
  /** G-1/X2: o que não foi gravado e por quê; a rota anota no resumo da execução. */
  avisos?: string[]
}

export async function syncChannel(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  mode: SyncMode,
): Promise<SyncResult> {
  const result: SyncResult = { videosFound: 0, videosInserted: 0, videosUpdated: 0, quotaUsed: 0 }

  if (mode === 'metrics') {
    return refreshMetrics(supabase, channel, apiKey, result)
  }

  let activeChannel = channel
  let videoIds: string[]
  try {
    videoIds = await fetchRecentVideoIds(activeChannel.uploads_playlist_id, apiKey)
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      const fresh = await lookupChannelByHandle(activeChannel.handle, apiKey)
      result.quotaUsed += 1
      if (!fresh) throw new Error(`Channel not found on YouTube: ${activeChannel.handle}`)
      await supabase.from('youtube_channels').update({
        channel_id: fresh.channelId,
        uploads_playlist_id: fresh.uploadsPlaylistId,
        name: fresh.name,
        thumbnail_url: fresh.thumbnailUrl,
        banner_url: fresh.bannerUrl,
        subscriber_count: fresh.subscriberCount,
        video_count: fresh.videoCount,
        custom_url: fresh.customUrl,
        last_synced_at: new Date().toISOString(),
      }).eq('id', activeChannel.id)
      activeChannel = { ...activeChannel, channel_id: fresh.channelId, uploads_playlist_id: fresh.uploadsPlaylistId }
      try {
        videoIds = await fetchRecentVideoIds(activeChannel.uploads_playlist_id, apiKey)
      } catch (retryErr) {
        if (retryErr instanceof Error && retryErr.message.includes('404')) {
          videoIds = []
        } else {
          throw retryErr
        }
      }
    } else {
      throw err
    }
  }
  result.quotaUsed += Math.ceil(videoIds.length / 50) || 1
  result.videosFound = videoIds.length

  if (videoIds.length === 0) {
    await updateChannelMeta(supabase, activeChannel, apiKey, result)
    return result
  }

  const { data: existing, error: existingErr } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .in('youtube_video_id', videoIds)

  if (existingErr) throw new Error(`Failed to query existing videos: ${existingErr.message}`)

  const existingIds = new Set((existing ?? []).map((r: { youtube_video_id: string }) => r.youtube_video_id))
  const newIds = videoIds.filter((id) => !existingIds.has(id))

  if (newIds.length === 0) {
    await updateChannelMeta(supabase, activeChannel, apiKey, result)
    return result
  }

  const details = await fetchVideoDetails(newIds, apiKey)
  result.quotaUsed += Math.ceil(newIds.length / 50) || 1

  const { data: categories, error: catErr } = await supabase
    .from('youtube_categories')
    .select('*')
    .eq('site_id', channel.site_id)
    .order('sort_order')

  if (catErr) throw new Error(`Failed to query categories: ${catErr.message}`)

  const rows = details.map((video) => {
    const cat = autoCategorize(
      { title: video.title, tags: video.tags, description: video.description },
      (categories ?? []) as YouTubeCategoryRow[],
    )

    return {
      site_id: channel.site_id,
      channel_id: channel.id,
      youtube_video_id: video.youtubeVideoId,
      title: video.title,
      description: video.description,
      duration: video.duration,
      duration_seconds: video.durationSeconds,
      published_at: video.publishedAt,
      thumbnail_url: video.thumbnailUrl,
      thumbnail_hq_url: video.thumbnailHqUrl,
      tags: video.tags,
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
      auto_suggested_category_id: cat?.categoryId ?? null,
      category_id: cat?.autoApprove ? cat.categoryId : null,
    }
  })

  if (rows.length > 0) {
    const { error } = await supabase.from('youtube_videos').upsert(rows, {
      onConflict: 'site_id,youtube_video_id',
    })
    if (error) throw new Error(`Video upsert failed: ${error.message}`)
    result.videosInserted = newIds.length
  }

  await updateChannelMeta(supabase, channel, apiKey, result)
  return result
}

async function updateChannelMeta(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  result: SyncResult,
): Promise<void> {
  const stats = await fetchChannelStats(channel.channel_id, apiKey)
  result.quotaUsed += 1

  const { error: updateErr } = await supabase.from('youtube_channels').update({
    subscriber_count: stats.subscriberCount,
    video_count: stats.videoCount,
    last_synced_at: new Date().toISOString(),
    ...(stats.thumbnailUrl ? { thumbnail_url: stats.thumbnailUrl } : {}),
    ...(stats.bannerUrl ? { banner_url: stats.bannerUrl } : {}),
  }).eq('id', channel.id)

  if (updateErr) throw new Error(`Failed to update channel metadata: ${updateErr.message}`)

  const avisos = (result.avisos ??= [])
  await gravarRetratoPublico(supabase, channel, stats, avisos)
  await gravarEstadoDoCanal(supabase, channel, stats, avisos)
}

/** Anota a tentativa onde o dono lê (`yt_own_collection_attempts`) e devolve o aviso. Nunca lança. */
async function anotarTentativa(
  supabase: SupabaseClient,
  channel: Pick<YouTubeChannelRow, 'id' | 'site_id'>,
  kind: 'retrato_canal' | 'estado_canal',
  outcome: Outcome,
  motivo: string | null,
  avisos: string[],
): Promise<void> {
  try {
    const falhas: string[] = []
    await registrarTentativa(
      { supabase, falhas, tentativas: [] },
      { site_id: channel.site_id, scope_type: 'canal', scope_id: channel.id, kind, outcome, error: motivo, channel_id: channel.id },
    )
    // a anotação que não gravou não some calada: vira aviso (a rota o persiste em youtube_sync_log.error_message)
    for (const f of falhas) avisos.push(`tentativa ${kind} não anotada: ${f}`)
  } catch {
    // a anotação nunca derruba a sincronização; o Sentry abaixo e o aviso na rota seguem
  }
}

/**
 * X2: estado do canal próprio (branding, status, tópicos, localizações) como série: grava só quando o hash muda.
 * Parte que não veio não grava (nem zera): vira tentativa `sem_dado_na_janela` com o motivo.
 */
async function gravarEstadoDoCanal(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  stats: Awaited<ReturnType<typeof fetchChannelStats>>,
  avisos: string[],
): Promise<void> {
  if (!stats.estado) {
    const motivo = `estado do canal não gravado: parte ausente (${(stats.estadoAusentes ?? ['desconhecida']).join(',')})`
    avisos.push(motivo)
    await anotarTentativa(supabase, channel, 'estado_canal', 'sem_dado_na_janela', motivo, avisos)
    return
  }
  try {
    const { error } = await supabase.rpc('yt_own_channel_state_record', {
      p_rows: [{ channel_id: channel.id, site_id: channel.site_id, state_sha256: stats.estado.sha, raw: stats.estado.raw }],
    })
    if (error) {
      const motivo = `estado do canal não gravado: ${error.code ?? error.message}`
      avisos.push(motivo)
      Sentry.captureMessage('sync-youtube: estado do canal próprio não gravado', {
        level: 'error', fingerprint: ['sync-youtube', 'estado-proprio'], extra: { channelId: channel.id, code: error.code ?? error.message },
      })
      await anotarTentativa(supabase, channel, 'estado_canal', 'erro_http', motivo, avisos)
      return
    }
    await anotarTentativa(supabase, channel, 'estado_canal', 'ok', null, avisos)
  } catch (e) {
    const motivo = `estado do canal não gravado: ${e instanceof Error ? e.message : String(e)}`
    avisos.push(motivo)
    await anotarTentativa(supabase, channel, 'estado_canal', 'erro_http', motivo, avisos)
  }
}

/**
 * A5 R9a (MG20): retrato público diário do canal próprio. O primeiro do dia de São Paulo fica (`ignoreDuplicates`); o `catchall`
 * das 04:00 garante um por dia. Só grava se a linha diz algo sobre inscritos (número ou oculto). Falha aqui nunca para a sincronização,
 * mas (G-1) também nunca some calada: vira tentativa `retrato_canal` com o motivo, aviso no resumo e Sentry em nível de erro.
 */
async function gravarRetratoPublico(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  stats: Awaited<ReturnType<typeof fetchChannelStats>>,
  avisos: string[],
): Promise<void> {
  const falhou = async (outcome: Outcome, motivo: string): Promise<void> => {
    // O retrato é "o primeiro do dia de SP fica" e roda a cada 30 min: uma leitura posterior ruim NÃO pode pintar de falha um dia que
    // já tem retrato (a tentativa é "última escrita vence"). Leitura que falha = desconhecido, segue o caminho da falha.
    if (await retratoDoDiaExiste(supabase, channel.id)) {
      await anotarTentativa(supabase, channel, 'retrato_canal', 'ok', null, avisos)
      return
    }
    avisos.push(`retrato do canal não gravado: ${motivo}`)
    avisarRetratoNaoGravado(channel.id, motivo)
    await anotarTentativa(supabase, channel, 'retrato_canal', outcome, motivo, avisos)
  }
  if (stats.subscriberCountRaw === null && !stats.hidden) {
    // O YouTube não mandou o número nem marcou oculto: o dia fica sem retrato e o motivo fica escrito.
    await falhou('sem_dado_na_janela', 'subscriberCount ausente e não marcado como oculto')
    return
  }
  try {
    const { error } = await supabase.from('yt_own_channel_snapshots').upsert({
      youtube_channel_id: channel.id,
      snapshot_date: spDateOf(Date.now()),
      subscriber_count: stats.subscriberCountRaw,
      subscribers_hidden: stats.hidden,
      view_count: stats.viewCountRaw,
      video_count: stats.videoCountRaw,
    }, { onConflict: 'youtube_channel_id,snapshot_date', ignoreDuplicates: true })
    if (error) { await falhou('erro_http', error.code ?? error.message); return }
    await anotarTentativa(supabase, channel, 'retrato_canal', 'ok', null, avisos)
  } catch (e) {
    await falhou('erro_http', e instanceof Error ? e.message : String(e))
  }
}

/**
 * O dia do retrato é de SP e o da tentativa (`attempt_day`) é UTC: 21:00-23:59 BRT caem no dia UTC seguinte. Por isso quem precisa
 * saber se o dia tem retrato lê `yt_own_channel_snapshots` (I-4), nunca a tentativa.
 */
async function retratoDoDiaExiste(supabase: SupabaseClient, channelId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase.from('yt_own_channel_snapshots')
      .select('youtube_channel_id', { count: 'exact', head: true })
      .eq('youtube_channel_id', channelId)
      .eq('snapshot_date', spDateOf(Date.now()))
    return !error && (count ?? 0) > 0
  } catch {
    return false
  }
}

function avisarRetratoNaoGravado(channelId: string, code: string): void {
  Sentry.captureMessage('sync-youtube: retrato do canal próprio não gravado', {
    level: 'error',
    fingerprint: ['sync-youtube', 'retrato-proprio'],
    extra: { channelId, code },
  })
}

async function refreshMetrics(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  result: SyncResult,
): Promise<SyncResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: recentErr } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .gte('published_at', thirtyDaysAgo)

  if (recentErr) throw new Error(`Failed to query recent videos: ${recentErr.message}`)
  if (!recent || recent.length === 0) return result

  const ids = recent.map((r: { youtube_video_id: string }) => r.youtube_video_id)
  const batchSize = 50
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const details = await fetchVideoDetails(batch, apiKey)
    result.quotaUsed += 1

    const updateRows = details.map((video) => ({
      site_id: channel.site_id,
      channel_id: channel.id,
      youtube_video_id: video.youtubeVideoId,
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
    }))
    const { error: updateErr } = await supabase.from('youtube_videos').upsert(updateRows, {
      onConflict: 'site_id,youtube_video_id',
    })
    if (updateErr) throw new Error(`Failed to update video metrics: ${updateErr.message}`)
    result.videosUpdated += details.length
  }

  return result
}

export { YouTubeQuotaError }
