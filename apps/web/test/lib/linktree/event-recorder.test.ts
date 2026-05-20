import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildLinktreeEvent, type LinktreeEventInput } from '@/lib/linktree/event-recorder'

describe('buildLinktreeEvent', () => {
  const base: LinktreeEventInput = {
    siteId: 'site-1',
    eventType: 'pageview',
    linkKey: null,
    ip: '189.1.2.3',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    referrer: 'https://www.instagram.com/stories/123',
    headers: new Headers({
      'x-vercel-ip-country': 'BR',
      'x-vercel-ip-city': 'São Paulo',
      'x-vercel-ip-country-region': 'SP',
    }),
  }

  it('builds pageview event with correct fields', () => {
    const event = buildLinktreeEvent(base)
    expect(event.site_id).toBe('site-1')
    expect(event.event_type).toBe('pageview')
    expect(event.link_key).toBeNull()
    expect(event.country).toBe('BR')
    expect(event.city).toBe('São Paulo')
    expect(event.device_type).toBe('mobile')
    expect(event.referrer_domain).toBe('www.instagram.com')
    expect(event.referrer_source).toBe('social')
    expect(event.visitor_id).toMatch(/^[a-f0-9]{64}$/)
    expect(event.is_bot).toBe(false)
  })

  it('builds link_click event with link_key', () => {
    const event = buildLinktreeEvent({ ...base, eventType: 'link_click', linkKey: 'shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    expect(event.event_type).toBe('link_click')
    expect(event.link_key).toBe('shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('detects bots', () => {
    const event = buildLinktreeEvent({ ...base, userAgent: 'Googlebot/2.1' })
    expect(event.is_bot).toBe(true)
    expect(event.device_type).toBe('bot')
  })

  it('classifies direct referrer', () => {
    const event = buildLinktreeEvent({ ...base, referrer: null })
    expect(event.referrer_source).toBe('direct')
    expect(event.referrer_domain).toBeNull()
  })

  it('classifies search referrer', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'https://www.google.com/search?q=test' })
    expect(event.referrer_source).toBe('search')
  })

  it('generates consistent visitor ID for same ip+ua+day', () => {
    const a = buildLinktreeEvent(base)
    const b = buildLinktreeEvent(base)
    expect(a.visitor_id).toBe(b.visitor_id)
  })
})
