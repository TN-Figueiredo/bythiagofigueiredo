export const BOT_NAMES = [
  'Googlebot', 'bingbot', 'Baiduspider', 'YandexBot', 'DuckDuckBot',
  'Bytespider', 'GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot',
  'PerplexityBot', 'Amazonbot', 'facebookexternalhit', 'Twitterbot',
  'LinkedInBot', 'Slackbot',
] as const

const BOT_RE =
  /\b(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot)\b/i

export const BOT_REGEX = BOT_NAMES.join('|')

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_RE.test(userAgent)
}
