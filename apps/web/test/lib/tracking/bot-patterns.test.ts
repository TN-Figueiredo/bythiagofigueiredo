import { describe, it, expect } from 'vitest'
import { isBot } from '../../../lib/tracking/bot-patterns'

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
  it('allows normal Chrome UA', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe(false)
  })
  it('allows null UA', () => {
    expect(isBot(null)).toBe(false)
  })
})
