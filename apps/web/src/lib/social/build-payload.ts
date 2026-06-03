import { DESTINATIONS, type DestId } from './destinations'
import type { Provider } from '@tn-figueiredo/social'

interface PayloadOptions {
  scheduledAt?: string
  publishNow?: boolean
  sourceContentId?: string
  sourceContentType?: 'blog' | 'newsletter' | 'campaign' | 'video'
  mediaUrls?: string[]
  contentUrl?: string
}

export function buildPublishPayload(
  captions: Record<string, string>,
  destsOn: Record<string, boolean>,
  schedMode: 'now' | 'schedule' | 'queue',
  opts: PayloadOptions,
) {
  const activeDests = (Object.entries(destsOn) as [DestId, boolean][])
    .filter(([id, on]) => on && DESTINATIONS[id])
    .map(([id]) => id as DestId)

  const platforms = [...new Set(activeDests.map(id => DESTINATIONS[id]!.provider))] as Provider[]

  const firstDest = activeDests[0]
  const primaryCaption = firstDest ? (captions[firstDest] ?? '') : ''

  const captionsMap: Record<string, string> = {}
  for (const dest of activeDests) {
    const provider = DESTINATIONS[dest]!.provider
    if (captions[dest] && !captionsMap[provider]) {
      captionsMap[provider] = captions[dest]!
    }
  }

  return {
    type: 'text' as const,
    content: {
      description: primaryCaption,
      url: opts.contentUrl,
      media_urls: opts.mediaUrls,
      captions: Object.keys(captionsMap).length > 0 ? captionsMap : undefined,
    },
    platforms,
    scheduledAt: schedMode === 'schedule' ? opts.scheduledAt : undefined,
    storyMode: activeDests.includes('ig_story' as DestId),
    publishNow: schedMode === 'now' ? opts.publishNow : undefined,
    sourceContentId: opts.sourceContentId,
    sourceContentType: opts.sourceContentType,
  }
}
