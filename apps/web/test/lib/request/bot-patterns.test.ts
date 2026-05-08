import { describe, it, expect } from 'vitest'
import { isBot, BOT_NAMES, BOT_REGEX } from '../../../lib/request/bot-patterns'

describe('isBot', () => {
  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['Baiduspider', 'Mozilla/5.0 (compatible; Baiduspider/2.0)'],
    ['YandexBot', 'Mozilla/5.0 (compatible; YandexBot/3.0)'],
    ['DuckDuckBot', 'DuckDuckBot/1.1'],
    ['Bytespider', 'Bytespider; bytedance.com'],
    ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 GPTBot/1.0'],
    ['ClaudeBot', 'ClaudeBot/1.0'],
    ['anthropic-ai', 'anthropic-ai/1.0'],
    ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
    ['PerplexityBot', 'PerplexityBot/1.0'],
    ['Amazonbot', 'Mozilla/5.0 (compatible; Amazonbot/0.1)'],
    ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['Twitterbot', 'Twitterbot/1.0'],
    ['LinkedInBot', 'LinkedInBot/1.0'],
    ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  ])('detects %s', (_name, ua) => {
    expect(isBot(ua)).toBe(true)
  })

  it('allows normal Chrome UA', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe(false)
  })

  it('allows normal Firefox UA', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe(false)
  })

  it('returns false for null/undefined UA', () => {
    expect(isBot(null)).toBe(false)
    expect(isBot(undefined)).toBe(false)
  })

  it('uses word boundaries — does not false-positive on substrings', () => {
    expect(isBot('MyGooglebotSpoofTool/1.0')).toBe(false)
  })
})

describe('BOT_NAMES', () => {
  it('contains at least 16 bot names (superset of links + tracking)', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(16)
  })

  it('includes all key bots', () => {
    expect(BOT_NAMES).toContain('Googlebot')
    expect(BOT_NAMES).toContain('LinkedInBot')
    expect(BOT_NAMES).toContain('Slackbot')
    expect(BOT_NAMES).toContain('facebookexternalhit')
  })
})

describe('BOT_REGEX', () => {
  it('exports a regex usable in SQL SIMILAR TO patterns', () => {
    expect(BOT_REGEX).toBeTypeOf('string')
    expect(BOT_REGEX).toContain('Googlebot')
    expect(BOT_REGEX).toContain('LinkedInBot')
  })
})
