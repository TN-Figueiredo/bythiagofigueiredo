import type { SocialPostContent } from '@tn-figueiredo/social'

type Provider = 'facebook' | 'instagram' | 'youtube' | 'bluesky'

interface AdaptedContent extends SocialPostContent {
  _photoMode?: boolean
}

export function adaptContent(
  content: SocialPostContent,
  provider: Provider,
  format: string,
  contentOverride?: Record<string, unknown> | null,
): AdaptedContent {
  let adapted: AdaptedContent = { ...content }

  // Platform-specific caption from captions map
  const platformCaption = content.captions?.[provider]
  if (platformCaption) {
    adapted.description = platformCaption
  }

  // content_override takes highest priority
  if (contentOverride) {
    adapted = { ...adapted, ...contentOverride }
  }

  // Platform-specific transformations
  switch (provider) {
    case 'facebook': {
      if (adapted.title && adapted.title === adapted.description) {
        adapted.title = undefined
      }
      if (adapted.media_urls && adapted.media_urls.length > 0) {
        adapted._photoMode = true
      }
      break
    }
    case 'instagram': {
      adapted.title = undefined
      break
    }
    case 'bluesky': {
      adapted.title = undefined
      break
    }
  }

  // Suppress unused-variable warning for format — reserved for future format-specific logic
  void format

  return adapted
}
