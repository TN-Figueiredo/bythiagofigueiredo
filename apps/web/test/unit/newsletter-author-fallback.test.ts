import { describe, it, expect } from 'vitest'

/**
 * Tests the author fallback resolution logic extracted from the landing page.
 * This is a pure function test — no DB, no React, no mocks needed.
 */

interface AuthorRecord {
  id: string
  name: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  social_links: Record<string, string> | null
}

interface IdentityProfile {
  name: string
}

interface AuthorData {
  name: string
  bio: string
  avatarUrl: string
  socialLinks: Record<string, string>
}

/**
 * Resolves the author data for the landing page using a 3-tier fallback:
 * 1. DB author (via newsletter_types.author_id FK)
 * 2. IDENTITY_PROFILES static config
 * 3. i18n strings (hardcoded fallback)
 */
function resolveAuthorData(
  author: AuthorRecord | null,
  profile: IdentityProfile | null,
  i18nBio: string,
): AuthorData {
  // Tier 1: DB author with non-empty bio
  if (author?.bio) {
    return {
      name: author.display_name ?? author.name,
      bio: author.bio,
      avatarUrl: author.avatar_url ?? '/identity/thiago.jpg',
      socialLinks: author.social_links ?? {},
    }
  }

  // Tier 2 + 3: IDENTITY_PROFILES name or hardcoded, with i18n bio
  return {
    name: profile?.name ?? 'Thiago Figueiredo',
    bio: i18nBio,
    avatarUrl: '/identity/thiago.jpg',
    socialLinks: {},
  }
}

describe('resolveAuthorData', () => {
  const fullAuthor: AuthorRecord = {
    id: 'a1',
    name: 'Thiago Figueiredo',
    display_name: 'Thiago N. Figueiredo',
    bio: 'A developer building things.',
    avatar_url: '/identity/thiago.jpg',
    social_links: { twitter: 'https://twitter.com/tnfigueiredo' },
  }

  const profile: IdentityProfile = {
    name: 'Thiago Figueiredo',
  }

  const i18nBio = 'Fallback bio from i18n strings.'

  it('uses DB author when bio is present (tier 1)', () => {
    const result = resolveAuthorData(fullAuthor, profile, i18nBio)
    expect(result.name).toBe('Thiago N. Figueiredo')
    expect(result.bio).toBe('A developer building things.')
    expect(result.avatarUrl).toBe('/identity/thiago.jpg')
    expect(result.socialLinks).toEqual({ twitter: 'https://twitter.com/tnfigueiredo' })
  })

  it('prefers display_name over name from DB author', () => {
    const result = resolveAuthorData(fullAuthor, profile, i18nBio)
    expect(result.name).toBe('Thiago N. Figueiredo')
  })

  it('falls back to name when display_name is null', () => {
    const authorNoDisplay = { ...fullAuthor, display_name: null }
    const result = resolveAuthorData(authorNoDisplay, profile, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
  })

  it('falls back to IDENTITY_PROFILES when author bio is null (tier 2)', () => {
    const authorNoBio = { ...fullAuthor, bio: null }
    const result = resolveAuthorData(authorNoBio, profile, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
    expect(result.bio).toBe(i18nBio)
  })

  it('falls back to IDENTITY_PROFILES when author is null (tier 2)', () => {
    const result = resolveAuthorData(null, profile, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
    expect(result.bio).toBe(i18nBio)
    expect(result.avatarUrl).toBe('/identity/thiago.jpg')
    expect(result.socialLinks).toEqual({})
  })

  it('falls back to hardcoded name when both author and profile are null (tier 3)', () => {
    const result = resolveAuthorData(null, null, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
    expect(result.bio).toBe(i18nBio)
  })

  it('uses default avatar when author avatar_url is null', () => {
    const authorNoAvatar = { ...fullAuthor, avatar_url: null }
    const result = resolveAuthorData(authorNoAvatar, profile, i18nBio)
    expect(result.avatarUrl).toBe('/identity/thiago.jpg')
  })

  it('uses empty socialLinks when author social_links is null', () => {
    const authorNoSocial = { ...fullAuthor, social_links: null }
    const result = resolveAuthorData(authorNoSocial, profile, i18nBio)
    expect(result.socialLinks).toEqual({})
  })

  it('falls back to i18n bio when author bio is empty string', () => {
    const authorEmptyBio = { ...fullAuthor, bio: '' }
    const result = resolveAuthorData(authorEmptyBio, profile, i18nBio)
    // Empty string is falsy, so falls to tier 2
    expect(result.bio).toBe(i18nBio)
  })
})
