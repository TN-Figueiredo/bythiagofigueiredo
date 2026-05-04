const BOT_RE =
  /Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot/i

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_RE.test(userAgent)
}
