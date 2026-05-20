import { describe, it, expect } from 'vitest'
import { buildLinktreeEvent, type LinktreeEventInput } from '@/lib/linktree/event-recorder'

describe('buildLinktreeEvent edge cases', () => {
  const base: LinktreeEventInput = {
    siteId: 'site-1',
    eventType: 'pageview',
    linkKey: null,
    ip: '189.1.2.3',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    referrer: null,
    headers: new Headers(),
  }

  it('handles empty user agent string', () => {
    const event = buildLinktreeEvent({ ...base, userAgent: '' })
    expect(event.device_type).toBe('other')
    expect(event.browser).toBe('Unknown')
    expect(event.os).toBe('Unknown')
    expect(event.is_bot).toBe(false)
    expect(event.visitor_id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles missing geo headers (country, region, city all null)', () => {
    const event = buildLinktreeEvent({
      ...base,
      headers: new Headers(),
    })
    expect(event.country).toBeNull()
    expect(event.region).toBeNull()
    expect(event.city).toBeNull()
  })

  it('handles empty referrer string as direct traffic', () => {
    const event = buildLinktreeEvent({ ...base, referrer: '' })
    expect(event.referrer_source).toBe('direct')
    expect(event.referrer_domain).toBeNull()
  })

  it('handles malformed referrer URL gracefully', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'not-a-valid-url' })
    expect(event.referrer_source).toBe('other')
    expect(event.referrer_domain).toBeNull()
  })

  it('truncates excessively long user agent to 512 chars', () => {
    const longUa = 'A'.repeat(1000)
    const event = buildLinktreeEvent({ ...base, userAgent: longUa })
    expect(event.user_agent.length).toBe(512)
  })

  it('preserves user agent when it is exactly 512 chars', () => {
    const exactUa = 'B'.repeat(512)
    const event = buildLinktreeEvent({ ...base, userAgent: exactUa })
    expect(event.user_agent.length).toBe(512)
  })

  it('extracts first language from accept-language header', () => {
    const headers = new Headers({ 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' })
    const event = buildLinktreeEvent({ ...base, headers })
    expect(event.language).toBe('pt-BR')
  })

  it('returns null language when accept-language header is missing', () => {
    const event = buildLinktreeEvent({ ...base, headers: new Headers() })
    expect(event.language).toBeNull()
  })

  it('classifies tablet user agent correctly (iPad)', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    expect(event.device_type).toBe('tablet')
    expect(event.os).toBe('iPadOS')
  })

  it('classifies desktop user agent correctly (macOS + Chrome)', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    expect(event.device_type).toBe('desktop')
    expect(event.browser).toBe('Chrome')
    expect(event.os).toBe('macOS')
  })

  it('classifies desktop user agent correctly (Windows + Firefox)', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    })
    expect(event.device_type).toBe('desktop')
    expect(event.browser).toBe('Firefox')
    expect(event.os).toBe('Windows')
  })

  it('classifies mobile Android user agent correctly', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    })
    expect(event.device_type).toBe('mobile')
    expect(event.os).toBe('Android')
  })

  it('classifies bot user agent correctly', () => {
    const event = buildLinktreeEvent({ ...base, userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)' })
    expect(event.is_bot).toBe(true)
    expect(event.device_type).toBe('bot')
    expect(event.browser).toBe('Bot')
    expect(event.os).toBe('Bot')
  })

  it('classifies email referrer source correctly (outlook)', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'https://outlook.live.com/mail/0/' })
    expect(event.referrer_source).toBe('email')
    expect(event.referrer_domain).toBe('outlook.live.com')
  })

  it('classifies search referrer source correctly (bing)', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'https://www.bing.com/search?q=test' })
    expect(event.referrer_source).toBe('search')
  })

  it('classifies social referrer from bsky.app', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'https://bsky.app/profile/someone' })
    expect(event.referrer_source).toBe('social')
  })

  it('classifies unknown referrer as referral', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'https://example.com/page' })
    expect(event.referrer_source).toBe('referral')
    expect(event.referrer_domain).toBe('example.com')
  })

  it('generates visitor_id as 64-char hex string', () => {
    const event = buildLinktreeEvent(base)
    expect(event.visitor_id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generates consistent visitor_id for same ip + ua combo', () => {
    const a = buildLinktreeEvent(base)
    const b = buildLinktreeEvent(base)
    expect(a.visitor_id).toBe(b.visitor_id)
  })

  it('generates different visitor_ids for different IPs', () => {
    const a = buildLinktreeEvent({ ...base, ip: '1.1.1.1' })
    const b = buildLinktreeEvent({ ...base, ip: '2.2.2.2' })
    expect(a.visitor_id).not.toBe(b.visitor_id)
  })

  it('sets is_unique to false by default (uniqueness determined by caller)', () => {
    const event = buildLinktreeEvent(base)
    expect(event.is_unique).toBe(false)
  })

  it('preserves link_key when provided', () => {
    const event = buildLinktreeEvent({
      ...base,
      eventType: 'link_click',
      linkKey: 'shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    expect(event.link_key).toBe('shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(event.event_type).toBe('link_click')
  })

  it('handles single language tag in accept-language', () => {
    const headers = new Headers({ 'accept-language': 'en' })
    const event = buildLinktreeEvent({ ...base, headers })
    expect(event.language).toBe('en')
  })

  it('classifies Android tablet (no Mobile keyword) as tablet', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    expect(event.device_type).toBe('tablet')
    expect(event.os).toBe('Android')
  })

  it('classifies Edge browser correctly', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    })
    expect(event.browser).toBe('Edge')
  })

  it('classifies Safari browser correctly (no Chrome)', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    })
    expect(event.browser).toBe('Safari')
    expect(event.os).toBe('macOS')
  })
})
