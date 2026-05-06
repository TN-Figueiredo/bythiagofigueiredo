import { describe, it, expect } from 'vitest'
import { classifyDevice } from './device-classifier.js'

describe('DeviceClassifier', () => {
  it('classifies iPhone as mobile Safari iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('mobile')
    expect(info.browser).toBe('Safari')
    expect(info.os).toBe('iOS')
  })

  it('classifies Android phone as mobile Chrome Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('mobile')
    expect(info.browser).toBe('Chrome')
    expect(info.os).toBe('Android')
  })

  it('classifies iPad as tablet Safari iPadOS', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('tablet')
    expect(info.browser).toBe('Safari')
    expect(info.os).toBe('iPadOS')
  })

  it('classifies Chrome on Windows as desktop Chrome Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('desktop')
    expect(info.browser).toBe('Chrome')
    expect(info.os).toBe('Windows')
  })

  it('classifies Safari on macOS as desktop Safari macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('desktop')
    expect(info.browser).toBe('Safari')
    expect(info.os).toBe('macOS')
  })

  it('classifies Firefox on Linux as desktop Firefox Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('desktop')
    expect(info.browser).toBe('Firefox')
    expect(info.os).toBe('Linux')
  })

  it('classifies Edge on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    const info = classifyDevice(ua)
    expect(info.deviceType).toBe('desktop')
    expect(info.browser).toBe('Edge')
    expect(info.os).toBe('Windows')
  })

  it('returns unknown for empty user agent', () => {
    const info = classifyDevice('')
    expect(info.deviceType).toBe('unknown')
    expect(info.browser).toBe('Unknown')
    expect(info.os).toBe('Unknown')
  })

  it('classifies Android tablet', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const info = classifyDevice(ua)
    // Android tablet without "Mobile" → tablet
    expect(info.deviceType).toBe('tablet')
    expect(info.os).toBe('Android')
  })
})
