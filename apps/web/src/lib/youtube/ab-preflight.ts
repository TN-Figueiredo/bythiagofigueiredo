import { ensureFreshToken } from '@/lib/social/token-refresh'

interface PreflightResult {
  ok: boolean
  reason?: string
  accessToken?: string
}

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
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}
