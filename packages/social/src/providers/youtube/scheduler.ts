import type { SocialConnection, SocialPost, SocialDelivery, PlatformResult } from '../../core/types.js'
import { updateVideoMetadata, setPrivacyStatus } from './client.js'

export function isShort(video: { duration?: number; width?: number; height?: number }): boolean {
  if (!video.duration || video.duration > 180) return false
  if (video.width == null || video.height == null) return false
  return video.height > video.width
}

export async function scheduleYouTubePublish(
  post: SocialPost,
  connection: SocialConnection,
  _delivery: SocialDelivery,
  decryptToken: (enc: string) => string,
): Promise<PlatformResult> {
  const accessToken = decryptToken(connection.access_token_enc)
  const auth = { accessToken }

  const videoId = post.content.video_id
  if (!videoId) {
    throw new Error('YouTube publish requires video_id in post content')
  }

  const hasMetadataUpdate =
    post.content.title != null ||
    post.content.description != null ||
    post.content.hashtags != null

  if (hasMetadataUpdate) {
    await updateVideoMetadata(auth, videoId, {
      title: post.content.title,
      description: post.content.description,
      tags: post.content.hashtags,
    })
  }

  await setPrivacyStatus(auth, videoId, 'public')

  return {
    id: videoId,
    url: `https://youtube.com/watch?v=${videoId}`,
  }
}
