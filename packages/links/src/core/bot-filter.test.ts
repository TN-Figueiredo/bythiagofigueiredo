import { describe, it, expect } from 'vitest'
import { isBot, getBotName, BOT_SIGNATURES } from './bot-filter.js'

describe('BotFilter', () => {
  it('has 12 bot signatures', () => {
    expect(BOT_SIGNATURES).toHaveLength(12)
  })

  const botUserAgents: Array<[string, string]> = [
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Googlebot'],
    ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'bingbot'],
    ['Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)', 'Baiduspider'],
    ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'YandexBot'],
    ['DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)', 'DuckDuckBot'],
    ['Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)', 'Slurp'],
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'facebookexternalhit'],
    ['Twitterbot/1.0', 'Twitterbot'],
    ['LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)', 'LinkedInBot'],
    ['WhatsApp/2.23.20.0 A', 'WhatsApp'],
    ['TelegramBot (like TwitterBot)', 'TelegramBot'],
    ['Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)', 'Amazonbot'],
  ]

  it.each(botUserAgents)('detects bot: %s', (ua, expectedName) => {
    expect(isBot(ua)).toBe(true)
    expect(getBotName(ua)).toBe(expectedName)
  })

  it('is case-insensitive', () => {
    expect(isBot('GOOGLEBOT/2.1')).toBe(true)
    expect(isBot('twitterbot/1.0')).toBe(true)
    expect(getBotName('GOOGLEBOT/2.1')).toBe('Googlebot')
  })

  const realBrowsers: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ]

  it.each(realBrowsers)('returns false for real browser: %s', (ua) => {
    expect(isBot(ua)).toBe(false)
    expect(getBotName(ua)).toBeNull()
  })

  it('returns false for empty string', () => {
    expect(isBot('')).toBe(false)
  })
})
