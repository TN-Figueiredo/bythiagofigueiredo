import type {
  ISocialProvider,
  PlatformResult,
  SocialConnection,
  SocialDelivery,
  SocialPost,
  SocialPostContent,
} from '../../core/types.js'
import { exchangeForLongLivedToken } from './oauth.js'
import { postToPage, warmOGCache, deletePagePost } from './facebook.js'
import {
  publishInstagramMedia,
  deleteInstagramMedia,
} from './instagram.js'

function formatFacebookContent(
  content: SocialPostContent,
  limit: number,
): { message: string; link?: string } {
  const parts: string[] = []

  if (content.title) parts.push(content.title)
  if (content.description) parts.push(content.description)
  if (content.hashtags?.length) parts.push(content.hashtags.map((h) => `#${h}`).join(' '))

  let message = parts.join('\n\n')
  if (message.length > limit) {
    message = message.slice(0, limit - 1) + '…'
  }

  return { message, link: content.url }
}

function formatInstagramCaption(content: SocialPostContent): string {
  const parts: string[] = []

  if (content.title) parts.push(content.title)
  if (content.description) parts.push(content.description)
  if (content.url) parts.push(content.url)
  if (content.hashtags?.length) {
    const tags = content.hashtags.slice(0, 30).map((h) => `#${h}`).join(' ')
    parts.push(tags)
  }

  const caption = parts.join('\n\n')
  return caption.length > 2200 ? caption.slice(0, 2199) + '…' : caption
}

export class FacebookProvider implements ISocialProvider {
  readonly provider = 'facebook' as const

  constructor(
    private readonly decryptToken: (enc: string) => string,
    private readonly appId: string,
    private readonly appSecret: string,
  ) {}

  async publish(
    post: SocialPost,
    connection: SocialConnection,
    _delivery: SocialDelivery,
  ): Promise<PlatformResult> {
    const pageToken = this.decryptToken(connection.page_token_enc!)
    const pageId = connection.account_id
    const content = formatFacebookContent(post.content, 63_206)

    if (content.link) {
      await warmOGCache(content.link, pageToken)
    }

    return postToPage(pageId, pageToken, content)
  }

  async deletePost(
    platformPostId: string,
    connection: SocialConnection,
  ): Promise<void> {
    const pageToken = this.decryptToken(connection.page_token_enc!)
    await deletePagePost(platformPostId, pageToken)
  }

  async validateConnection(connection: SocialConnection): Promise<boolean> {
    const pageToken = this.decryptToken(connection.page_token_enc!)
    const url = `https://graph.facebook.com/v25.0/me?access_token=${pageToken}`
    const res = await fetch(url)
    return res.ok
  }

  async refreshToken(
    connection: SocialConnection,
  ): Promise<{ access_token: string; expires_at?: Date } | null> {
    const currentToken = this.decryptToken(connection.access_token_enc)
    const result = await exchangeForLongLivedToken(
      currentToken,
      this.appId,
      this.appSecret,
    )

    return {
      access_token: result.access_token,
      expires_at: new Date(Date.now() + result.expires_in * 1000),
    }
  }
}

export class InstagramProvider implements ISocialProvider {
  readonly provider = 'instagram' as const

  constructor(
    private readonly decryptToken: (enc: string) => string,
  ) {}

  async publish(
    post: SocialPost,
    connection: SocialConnection,
    delivery: SocialDelivery,
  ): Promise<PlatformResult> {
    const token = this.decryptToken(connection.page_token_enc!)
    const igUserId = (connection.metadata as { ig_user_id: string }).ig_user_id
    const caption = formatInstagramCaption(post.content)

    const mediaUrls = post.content.media_urls ?? []
    const firstMedia = mediaUrls[0]

    const isVideo = firstMedia
      ? /\.(mp4|mov|webm)(\?|$)/i.test(firstMedia)
      : false

    // Determine media_type from delivery format first, then file extension
    let mediaType: 'STORIES' | 'REELS' | undefined
    if (delivery.format === 'story') {
      mediaType = 'STORIES'
    } else if (delivery.format === 'reel' || isVideo) {
      mediaType = 'REELS'
    }

    return publishInstagramMedia(igUserId, token, {
      image_url: !isVideo ? firstMedia : undefined,
      video_url: isVideo ? firstMedia : undefined,
      caption,
      media_type: mediaType,
    })
  }

  async deletePost(
    platformPostId: string,
    connection: SocialConnection,
  ): Promise<void> {
    const token = this.decryptToken(connection.page_token_enc!)
    await deleteInstagramMedia(platformPostId, token)
  }

  async validateConnection(connection: SocialConnection): Promise<boolean> {
    const token = this.decryptToken(connection.page_token_enc!)
    const igUserId = (connection.metadata as { ig_user_id: string }).ig_user_id
    const url = `https://graph.facebook.com/v25.0/${igUserId}?fields=id&access_token=${token}`
    const res = await fetch(url)
    return res.ok
  }
}

export {
  exchangeForLongLivedToken,
  getPageAccessToken,
  getUserPages,
  getInstagramBusinessAccount,
  buildOAuthUrl,
} from './oauth.js'

export {
  postToPage,
  warmOGCache,
  deletePagePost,
} from './facebook.js'

export {
  createMediaContainer,
  pollContainerStatus,
  publishContainer,
  publishInstagramMedia,
  publishMultiSlideStory,
  deleteInstagramMedia,
  InsufficientRateBudgetError,
} from './instagram.js'

export {
  checkRateBudget,
  remainingFromUsage,
  parseAppUsageHeader,
} from './rate-budget.js'
