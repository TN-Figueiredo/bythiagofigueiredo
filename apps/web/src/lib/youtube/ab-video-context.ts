import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { channelAccountIdForVideo, CHANNEL_NOT_IDENTIFIED_MESSAGE } from '@/lib/youtube/channel-account'

/**
 * O id "UC…" do canal dono do vídeo, ou a mensagem pronta para a tela. Nunca cai em
 * "a conexão mais recente": sem canal identificado a operação não sai.
 */
export async function resolveVideoChannel(
  supabase: SupabaseClient,
  siteId: string,
  internalVideoId: string,
): Promise<{ ok: true; channelAccountId: string } | { ok: false; error: string }> {
  try {
    const channelAccountId = await channelAccountIdForVideo(supabase, siteId, internalVideoId)
    if (!channelAccountId) return { ok: false, error: CHANNEL_NOT_IDENTIFIED_MESSAGE }
    return { ok: true, channelAccountId }
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'ab-lab' }, extra: { stage: 'resolve-video-channel', internalVideoId } })
    return { ok: false, error: CHANNEL_NOT_IDENTIFIED_MESSAGE }
  }
}

/** O id do vídeo no YouTube a partir do id interno de `youtube_videos`; null quando não existe. */
export async function resolveYouTubeVideoId(supabase: SupabaseClient, internalVideoId: string): Promise<string | null> {
  const { data } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', internalVideoId)
    .single()
  return (data?.youtube_video_id as string | null) ?? null
}
