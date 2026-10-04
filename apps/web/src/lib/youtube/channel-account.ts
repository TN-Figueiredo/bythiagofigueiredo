import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * O id "UC…" do canal dono de um vídeo (`internalVideoId` = id interno de
 * `youtube_videos`). É o `account_id` da conexão OAuth certa em
 * `social_connections` — o que se passa a `ensureFreshToken` e a
 * `preflightTokenCheck` para nunca usar o token de outro canal do site.
 *
 * O vídeo tem de ser do `siteId`: um id de vídeo de outro site não resolve o canal de
 * outro site. Devolve `null` quando o vídeo (ou o canal dele) não existe nesse site. Erro do banco
 * LANÇA: um erro que virasse `null` seria lido como "vídeo sem canal" e, no
 * pior caso, levaria quem chama a procurar um token sem conta.
 */
export async function channelAccountIdForVideo(
  supabase: SupabaseClient<Database>,
  siteId: string,
  internalVideoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('youtube_channels!inner(channel_id)')
    .eq('id', internalVideoId)
    .eq('site_id', siteId)
    .single()

  if (error) {
    // PGRST116 = nenhuma linha: o vídeo não existe (ou não tem canal, pelo inner join).
    if (error.code === 'PGRST116') return null
    throw new Error(
      `channelAccountIdForVideo: could not read the channel of video ${internalVideoId}: ${error.message}`,
    )
  }

  const row = data as { youtube_channels: { channel_id: string | null } | null } | null
  return row?.youtube_channels?.channel_id ?? null
}

/** Mensagem honesta para quando não dá para saber de qual canal é o vídeo (nunca "Token inválido"). */
export const CHANNEL_NOT_IDENTIFIED_MESSAGE =
  "Could not identify which YouTube channel owns this video. Reload and try again; if it persists, check that the video's channel is still connected."
