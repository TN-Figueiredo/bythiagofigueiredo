import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * O id "UC…" do canal dono de um vídeo (`internalVideoId` = id interno de
 * `youtube_videos`). É o `account_id` da conexão OAuth certa em
 * `social_connections` — o que se passa a `ensureFreshToken` e a
 * `preflightTokenCheck` para nunca usar o token de outro canal do site.
 *
 * Devolve `null` quando o vídeo (ou o canal dele) não existe. Erro do banco
 * LANÇA: um erro que virasse `null` seria lido como "vídeo sem canal" e, no
 * pior caso, levaria quem chama a procurar um token sem conta.
 */
export async function channelAccountIdForVideo(
  supabase: SupabaseClient<Database>,
  internalVideoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('youtube_channels!inner(channel_id)')
    .eq('id', internalVideoId)
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
