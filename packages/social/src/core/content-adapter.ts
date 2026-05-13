import {
  DEFAULT_TEMPLATES,
  PLATFORM_LIMITS,
  type Provider,
  type SocialPostContent,
} from './types.js'

export function truncateForPlatform(
  text: string,
  provider: Provider,
  field: string,
): string {
  const limits = PLATFORM_LIMITS[provider]
  const limit = (limits as Record<string, number>)[field] as number | undefined
  if (limit == null || text.length <= limit) return text
  return text.slice(0, limit - 3) + '...'
}

export function adaptHashtags(
  hashtags: string[],
  provider: Provider,
): string[] {
  const normalized = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`))
  if (provider === 'instagram') {
    return normalized.slice(0, PLATFORM_LIMITS.instagram.hashtags)
  }
  return normalized
}

function applyTemplate(
  content: SocialPostContent,
  templateId?: string,
): string {
  const template =
    (templateId ? DEFAULT_TEMPLATES[templateId] : undefined) ??
    DEFAULT_TEMPLATES['link-share'] ??
    '{title}\n{url}'

  return template
    .replace('{title}', content.title ?? '')
    .replace('{description}', content.description ?? '')
    .replace('{url}', content.url ?? '')
    .replace('{hashtags}', (content.hashtags ?? []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '))
    .trim()
}

export function formatForPlatform(
  content: SocialPostContent,
  provider: Provider,
  templateId?: string,
): string {
  let text = applyTemplate(content, templateId)
  const hashtags = adaptHashtags(content.hashtags ?? [], provider)

  switch (provider) {
    case 'instagram': {
      // Build text without hashtags, then append as a separate block
      const igParts: string[] = []
      if (content.title) igParts.push(content.title)
      if (content.description) igParts.push(content.description)
      if (content.url) igParts.push(content.url)
      const body = igParts.join('\n\n')
      const hashtagBlock = hashtags.join(' ')
      const combined = hashtagBlock ? `${body}\n\n${hashtagBlock}` : body
      return truncateForPlatform(combined, 'instagram', 'caption')
    }

    case 'bluesky': {
      // Hashtags inline (auto-detected via RichText facets on the platform)
      return truncateForPlatform(text, 'bluesky', 'text')
    }

    case 'facebook': {
      // Hashtags inline in text
      return truncateForPlatform(text, 'facebook', 'text')
    }

    case 'youtube': {
      // Hashtags in description; tags field is separate
      return truncateForPlatform(text, 'youtube', 'description')
    }
  }
}
