import { describe, it, expect } from 'vitest'
import { isBot, BOT_NAMES } from '../../../lib/tracking/bot-patterns'

describe('isBot', () => {
  it('detects Googlebot', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
  })
  it('detects bingbot', () => {
    expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true)
  })
  it('detects GPTBot', () => {
    expect(isBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0')).toBe(true)
  })
  it('detects ClaudeBot', () => {
    expect(isBot('ClaudeBot/1.0')).toBe(true)
  })
  it('detects Amazonbot', () => {
    expect(isBot('Mozilla/5.0 (compatible; Amazonbot/0.1)')).toBe(true)
  })
  it('detects facebookexternalhit', () => {
    expect(isBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true)
  })
  it('detects Twitterbot', () => {
    expect(isBot('Twitterbot/1.0')).toBe(true)
  })
  it('allows normal Chrome UA', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe(false)
  })
  it('allows null UA', () => {
    expect(isBot(null)).toBe(false)
  })
  it('uses word boundaries — does not false-positive on substrings', () => {
    expect(isBot('MyGooglebotSpoofTool/1.0')).toBe(false)
  })
  it('exports BOT_NAMES list for SQL sync verification', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(14)
    expect(BOT_NAMES).toContain('Amazonbot')
    expect(BOT_NAMES).toContain('facebookexternalhit')
    expect(BOT_NAMES).toContain('Twitterbot')
  })
})
