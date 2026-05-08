import { describe, it, expect } from 'vitest'
import { classifyDevice, type DeviceType } from '../../../lib/request/device'

describe('classifyDevice', () => {
  it('returns "bot" for Googlebot', () => {
    expect(classifyDevice('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('bot')
  })

  it('returns "bot" for ClaudeBot', () => {
    expect(classifyDevice('ClaudeBot/1.0')).toBe('bot')
  })

  it('returns "tablet" for iPad', () => {
    expect(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('tablet')
  })

  it('returns "tablet" for Android tablet (no Mobile token)', () => {
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/125.0')).toBe('tablet')
  })

  it('returns "mobile" for iPhone', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('mobile')
  })

  it('returns "mobile" for Android phone (with Mobile token)', () => {
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile')).toBe('mobile')
  })

  it('returns "desktop" for Chrome on macOS', () => {
    expect(classifyDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe('desktop')
  })

  it('returns "desktop" for Firefox on Windows', () => {
    expect(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe('desktop')
  })

  it('returns null for null UA', () => {
    expect(classifyDevice(null)).toBeNull()
  })

  it('returns null for undefined UA', () => {
    expect(classifyDevice(undefined)).toBeNull()
  })

  it('returns null for empty string UA', () => {
    expect(classifyDevice('')).toBeNull()
  })

  it('bot detection takes priority over mobile tokens', () => {
    expect(classifyDevice('facebookexternalhit/1.1 Mobile')).toBe('bot')
  })
})
