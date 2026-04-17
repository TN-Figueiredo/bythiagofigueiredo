import { describe, it, expect } from 'vitest'
import { IDENTITY_PROFILES, getIdentityProfile } from '@/lib/seo/identity-profiles'

describe('identity-profiles', () => {
  it('has bythiagofigueiredo Person profile with required fields', () => {
    const p = getIdentityProfile('bythiagofigueiredo')
    expect(p).not.toBeNull()
    expect(p!.type).toBe('person')
    if (p!.type !== 'person') throw new Error('unreachable')
    expect(p.name).toBe('Thiago Figueiredo')
    expect(p.jobTitle).toBe('Creator & Builder')
    expect(p.imageUrl).toMatch(/^https:\/\/bythiagofigueiredo\.com\/identity\/thiago\.jpg$/)
    expect(p.sameAs).toEqual(expect.arrayContaining([
      expect.stringMatching(/^https:\/\/www\.instagram\.com\//),
      expect.stringMatching(/^https:\/\/www\.youtube\.com\//),
      expect.stringMatching(/^https:\/\/github\.com\//),
    ]))
    expect(p.sameAs.every((u) => u.startsWith('https://'))).toBe(true)
  })

  it('returns null for unknown slug', () => {
    expect(getIdentityProfile('nonexistent-site')).toBeNull()
  })

  it('IDENTITY_PROFILES is exported', () => {
    expect(IDENTITY_PROFILES).toBeDefined()
    expect(IDENTITY_PROFILES.bythiagofigueiredo).toBeDefined()
  })
})
