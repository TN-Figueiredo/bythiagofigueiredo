import type {
  ISocialProvider,
  SocialConnection,
  SocialPost,
  SocialDelivery,
  PlatformResult,
} from '../../core/types.js'
import { deleteVideo, listVideos } from './client.js'
import { scheduleYouTubePublish } from './scheduler.js'

export { isShort } from './scheduler.js'
export type { YouTubeVideo, YouTubeAuth, VideoMetadata } from './client.js'
export {
  createUploadSession,
  updateVideoMetadata,
  setThumbnail,
  setPrivacyStatus,
  getVideo,
  deleteVideo,
  listVideos,
} from './client.js'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope?: string
}

export class YouTubeProvider implements ISocialProvider {
  readonly provider = 'youtube' as const

  constructor(private decryptToken: (enc: string) => string) {}

  async publish(
    post: SocialPost,
    connection: SocialConnection,
    delivery: SocialDelivery,
  ): Promise<PlatformResult> {
    return scheduleYouTubePublish(post, connection, delivery, this.decryptToken)
  }

  async deletePost(
    platformPostId: string,
    connection: SocialConnection,
  ): Promise<void> {
    const accessToken = this.decryptToken(connection.access_token_enc)
    await deleteVideo({ accessToken }, platformPostId)
  }

  async validateConnection(connection: SocialConnection): Promise<boolean> {
    try {
      const accessToken = this.decryptToken(connection.access_token_enc)
      const channelId = connection.account_id
      await listVideos({ accessToken }, channelId, 1)
      return true
    } catch {
      return false
    }
  }

  async refreshToken(
    connection: SocialConnection,
  ): Promise<{ access_token: string; expires_at?: Date } | null> {
    if (!connection.refresh_token_enc) return null

    const refreshToken = this.decryptToken(connection.refresh_token_enc)
    const clientId = (connection.metadata['client_id'] as string | undefined) ?? process.env['GOOGLE_CLIENT_ID']
    const clientSecret = (connection.metadata['client_secret'] as string | undefined) ?? process.env['GOOGLE_CLIENT_SECRET']

    if (!clientId || !clientSecret) return null

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) return null

    const data = (await response.json()) as GoogleTokenResponse

    return {
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
    }
  }
}
