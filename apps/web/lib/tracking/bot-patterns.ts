const BOT_RE =
  /\b(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot)\b/i

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_RE.test(userAgent)
}

export const BOT_NAMES = [
  'Googlebot', 'bingbot', 'Baiduspider', 'YandexBot', 'DuckDuckBot',
  'Bytespider', 'GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot',
  'PerplexityBot', 'Amazonbot', 'facebookexternalhit', 'Twitterbot',
] as const
