import type {
  ISocialProvider,
  SocialConnection,
  SocialPost,
  SocialDelivery,
  PlatformResult,
} from '../../core/types.js'
import { formatForPlatform } from '../../core/content-adapter.js'
import { createSession } from './client.js'
import { createPost, deletePost as deleteAtPost } from './post.js'
import { createPostWithLinkCard } from './link-embed.js'

export type { BlueskySession } from './client.js'
export type { PostImageInput } from './post.js'
export type { OGTags, ExternalEmbed } from './link-embed.js'
export { createSession, resumeSession } from './client.js'
export { createPost, deletePost, buildPostUrl } from './post.js'
export { fetchOGTags, buildExternalEmbed, createPostWithLinkCard } from './link-embed.js'

const IMAGE_MAX_SIZE = 1024 * 1024 // 1 MB
const MAX_IMAGES = 4

interface BlueskyMetadata {
  did: string
  handle: string
  pds_url?: string
}

async function downloadImage(
  url: string,
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return null

    const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    if (data.byteLength > IMAGE_MAX_SIZE) return null

    return { data, mimeType }
  } catch {
    return null
  }
}

export class BlueskyProvider implements ISocialProvider {
  readonly provider = 'bluesky' as const

  constructor(private decryptToken: (enc: string) => string) {}

  async publish(
    post: SocialPost,
    connection: SocialConnection,
    _delivery: SocialDelivery,
  ): Promise<PlatformResult> {
    const appPassword = this.decryptToken(connection.access_token_enc)
    const { handle, pds_url } = connection.metadata as unknown as BlueskyMetadata

    const agent = await createSession(handle, appPassword, pds_url)
    const formattedText = formatForPlatform(post.content, 'bluesky', post.template_id ?? undefined)

    if (post.content.url) {
      return createPostWithLinkCard(agent, formattedText, post.content.url)
    }

    if (post.content.media_urls?.length) {
      const downloads = await Promise.all(
        post.content.media_urls.slice(0, MAX_IMAGES).map(downloadImage),
      )

      const images = downloads
        .filter((d): d is { data: Uint8Array; mimeType: string } => d !== null)
        .map((d) => ({ data: d.data, mimeType: d.mimeType }))

      if (images.length > 0) {
        return createPost(agent, formattedText, { images })
      }
    }

    return createPost(agent, formattedText)
  }

  async deletePost(
    platformPostId: string,
    connection: SocialConnection,
  ): Promise<void> {
    const appPassword = this.decryptToken(connection.access_token_enc)
    const { handle, pds_url } = connection.metadata as unknown as BlueskyMetadata

    const agent = await createSession(handle, appPassword, pds_url)
    await deleteAtPost(agent, platformPostId)
  }

  async validateConnection(connection: SocialConnection): Promise<boolean> {
    try {
      const appPassword = this.decryptToken(connection.access_token_enc)
      const { handle, pds_url } = connection.metadata as unknown as BlueskyMetadata

      await createSession(handle, appPassword, pds_url)
      return true
    } catch {
      return false
    }
  }
}
