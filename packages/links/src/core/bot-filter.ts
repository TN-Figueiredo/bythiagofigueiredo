/**
 * Bot detection via user-agent substring matching.
 * 12 signatures covering major search engines, social crawlers, and bots.
 */

export interface BotSignature {
  /** Substring to match (case-insensitive) */
  pattern: string
  /** Canonical name returned by getBotName */
  name: string
}

export const BOT_SIGNATURES: BotSignature[] = [
  { pattern: 'googlebot', name: 'Googlebot' },
  { pattern: 'bingbot', name: 'bingbot' },
  { pattern: 'baiduspider', name: 'Baiduspider' },
  { pattern: 'yandexbot', name: 'YandexBot' },
  { pattern: 'duckduckbot', name: 'DuckDuckBot' },
  { pattern: 'slurp', name: 'Slurp' },
  { pattern: 'facebookexternalhit', name: 'facebookexternalhit' },
  { pattern: 'linkedinbot', name: 'LinkedInBot' },
  { pattern: 'telegrambot', name: 'TelegramBot' }, // before twitterbot (UA may contain both)
  { pattern: 'twitterbot', name: 'Twitterbot' },
  { pattern: 'whatsapp', name: 'WhatsApp' },
  { pattern: 'amazonbot', name: 'Amazonbot' },
]

/**
 * Check if a user-agent belongs to a known bot.
 */
export function isBot(userAgent: string): boolean {
  if (!userAgent) return false
  const lower = userAgent.toLowerCase()
  return BOT_SIGNATURES.some((sig) => lower.includes(sig.pattern))
}

/**
 * Get the canonical bot name from a user-agent, or null if not a bot.
 */
export function getBotName(userAgent: string): string | null {
  if (!userAgent) return null
  const lower = userAgent.toLowerCase()
  const match = BOT_SIGNATURES.find((sig) => lower.includes(sig.pattern))
  return match?.name ?? null
}
