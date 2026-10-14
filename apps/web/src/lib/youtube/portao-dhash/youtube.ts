// Único ponto que escreve no YouTube. Cota: videos.list 1; thumbnails.set 50.
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { channelAccountIdForVideo } from '@/lib/youtube/channel-account'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { Recusa } from './regras'

export interface Escritor {
  canal: string
  conferirVideo(video: string): Promise<{ canal: string; privacidade: string } | null>
  definirThumb(video: string, jpeg: Buffer): Promise<void>
}

export class ErroYouTube extends Error {
  constructor(readonly status: number, readonly reason: string | null) {
    super(`YouTube respondeu ${status}${reason ? ` (${reason})` : ''}`)
    this.name = 'ErroYouTube'
  }
}

async function erroDe(res: Response): Promise<ErroYouTube> {
  const j = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null
  return new ErroYouTube(res.status, j?.error?.errors?.[0]?.reason ?? null)
}

export function escritorCom(canal: string, token: () => Promise<string>, f: typeof fetch): Escritor {
  return {
    canal,
    async conferirVideo(video) {
      const res = await f(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(video)}`, {
        headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw await erroDe(res)
      const j = (await res.json()) as { items?: { snippet?: { channelId?: string }; status?: { privacyStatus?: string } }[] }
      const it = j.items?.[0]
      return it ? { canal: it.snippet?.channelId ?? '', privacidade: it.status?.privacyStatus ?? '' } : null
    },
    async definirThumb(video, jpeg) {
      const res = await f(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(video)}&uploadType=media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(jpeg),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw await erroDe(res)
    },
  }
}

/** Mesmo caminho de ab-start.ts:90-101. Lê produção: só roda na máquina do dono, pelo `valer`/`devolver`. */
export async function escritorDoCanal(video: string): Promise<Escritor> {
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb.from('youtube_videos').select('id, site_id').eq('youtube_video_id', video).limit(2)
  if (error) throw new Error(`não li youtube_videos: ${error.message}`)
  if (!data || data.length === 0) throw new Recusa('o vídeo não está em youtube_videos: sem canal conhecido não há credencial')
  if (data.length > 1) throw new Recusa('o vídeo aparece em mais de um site: recuso escolher a credencial')
  const { id, site_id } = data[0] as { id: string; site_id: string }
  const canal = await channelAccountIdForVideo(sb, site_id, id)
  if (!canal) throw new Recusa('canal do vídeo não identificado')
  return escritorCom(canal, async () => (await ensureFreshToken(site_id, 'youtube', canal)).accessToken, fetch)
}
