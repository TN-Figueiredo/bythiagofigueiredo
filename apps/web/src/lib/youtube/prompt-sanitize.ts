export function sanitizeForJson(text: string | null | undefined): string {
  return JSON.stringify(text ?? '').slice(1, -1)
}

const UNICODE_CF = /[\p{Cf}]/gu

export function sanitizeForMarkdown(text: string, maxLen?: number): string {
  let s = text
  s = s.replace(/#/g, '\\#')
  s = s.replace(/`/g, "'")
  s = s.replace(/\|/g, '\\|')
  s = s.replace(/---|===|\*\*\*/g, '- - -')
  s = s.replace(/[<>{}[\]]/g, '')
  s = s.replace(/\n/g, ' ')
  s = s.replace(UNICODE_CF, '')
  if (maxLen !== undefined) s = s.slice(0, maxLen)
  return s
}

const THUMB_PATH_RE = /^\/vi\/[A-Za-z0-9_-]{11}\/[a-z]+\.jpg$/

export function sanitizeThumbnailUrl(url: string, expectedVideoId: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.hostname !== 'i.ytimg.com') return null
  if (!THUMB_PATH_RE.test(parsed.pathname)) return null
  const segments = parsed.pathname.split('/')
  if (segments[2] !== expectedVideoId) return null
  return `https://i.ytimg.com${parsed.pathname}`
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.0)
}

export function estimateChars(text: string): number {
  return text.length
}
