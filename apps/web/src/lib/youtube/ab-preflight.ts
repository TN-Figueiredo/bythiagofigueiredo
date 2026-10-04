import { ensureFreshToken, AmbiguousConnectionError } from '@/lib/social/token-refresh'

type PreflightResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string }

export async function preflightTokenCheck(
  siteId: string,
  provider: 'youtube',
  channelId?: string,
): Promise<PreflightResult> {
  try {
    const { accessToken } = await ensureFreshToken(siteId, provider, channelId)

    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!res.ok) {
      return { ok: false, reason: `youtube_api_${res.status}` }
    }

    return { ok: true, accessToken }
  } catch (err) {
    // Jargão de conexão não serve para quem lê a tela nem para o aviso ao dono: o que
    // faltou foi saber de qual canal é o vídeo.
    if (err instanceof AmbiguousConnectionError) {
      return { ok: false, reason: 'could not identify which YouTube channel owns this video' }
    }
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}
