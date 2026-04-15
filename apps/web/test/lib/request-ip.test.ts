import { describe, it, expect } from 'vitest'
import { getClientIp, isValidInet } from '../../lib/request-ip'

describe('getClientIp', () => {
  it('picks first entry of x-forwarded-for and trims whitespace', () => {
    const h = new Headers({ 'x-forwarded-for': '  1.2.3.4 , 5.6.7.8 ' })
    expect(getClientIp(h)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const h = new Headers({ 'x-real-ip': '9.9.9.9' })
    expect(getClientIp(h)).toBe('9.9.9.9')
  })

  it('falls back to cf-connecting-ip when neither xff nor x-real-ip is set', () => {
    const h = new Headers({ 'cf-connecting-ip': '2001:db8::1' })
    expect(getClientIp(h)).toBe('2001:db8::1')
  })

  it('returns null when no IP header is present', () => {
    const h = new Headers()
    expect(getClientIp(h)).toBeNull()
  })

  it('skips empty x-forwarded-for and falls through', () => {
    const h = new Headers({
      'x-forwarded-for': '  ,',
      'x-real-ip': '7.7.7.7',
    })
    expect(getClientIp(h)).toBe('7.7.7.7')
  })
})

describe('isValidInet', () => {
  it('accepts IPv4 dotted-quad', () => {
    expect(isValidInet('1.2.3.4')).toBe(true)
    expect(isValidInet('255.255.255.255')).toBe(true)
  })

  it('accepts IPv6 shapes', () => {
    expect(isValidInet('2001:db8::1')).toBe(true)
    expect(isValidInet('::1')).toBe(true)
  })

  it('rejects null, empty, and obvious garbage', () => {
    expect(isValidInet(null)).toBe(false)
    expect(isValidInet('')).toBe(false)
    expect(isValidInet('not-an-ip')).toBe(false)
    expect(isValidInet('<script>')).toBe(false)
  })

  it('rejects malformed IPv4 (too many octets)', () => {
    expect(isValidInet('1.2.3.4.5')).toBe(false)
  })

  it('rejects out-of-range IPv4 octets', () => {
    expect(isValidInet('999.1.1.1')).toBe(false)
  })

  it('rejects overly long inputs', () => {
    expect(isValidInet('a'.repeat(46))).toBe(false)
  })
})
