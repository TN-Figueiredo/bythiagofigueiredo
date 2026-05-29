'use client'

import type { DestId } from '@/lib/social/destinations'
import { IgStoryPreview } from './ig-story-preview'
import { YtCommunityCard } from './yt-community-card'
import { IgFeedPost } from './ig-feed-post'
import { FbPagePost } from './fb-page-post'

interface DestPreviewProps {
  destId: DestId
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  poll?: Array<{ text: string; percentage?: number }>
  linkUrl?: string | null
  linkTitle?: string | null
  className?: string
}

export function DestPreview({ destId, caption, imageUrl, accountName, avatarUrl, poll, linkUrl, linkTitle, className }: DestPreviewProps) {
  switch (destId) {
    case 'ig_story':
      return <IgStoryPreview imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} className={className} />
    case 'yt_community':
      return <YtCommunityCard caption={caption} imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} poll={poll} className={className} />
    case 'ig_feed':
      return <IgFeedPost caption={caption} imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} className={className} />
    case 'fb_page':
      return <FbPagePost caption={caption} imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} linkUrl={linkUrl} linkTitle={linkTitle} className={className} />
    default: {
      const _exhaustive: never = destId
      return null
    }
  }
}
