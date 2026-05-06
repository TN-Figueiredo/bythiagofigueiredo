import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedirectResolver } from './redirect-resolver.js'
import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { TrackedLink, RedirectResult, RedirectGuardFailure } from '../types.js'

function makeLink(overrides: Partial<TrackedLink> = {}): TrackedLink {
  return {
    id: 'link-1',
    siteId: 'site-1',
    code: 'abc123',
    slug: null,
    destinationUrl: 'https://example.com/target',
    title: null,
    tags: [],
    status: 'active',
    expiresAt: null,
    passwordHash: null,
    clickLimit: null,
    totalClicks: 0,
    uniqueClicks: 0,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    qrCodeUrl: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockRepo(link: TrackedLink | null = null): ILinkRepository {
  return {
    findByCode: vi.fn(async () => link),
    findBySlug: vi.fn(async () => link),
    findById: vi.fn(async () => link),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    softDelete: vi.fn(),
    isCodeAvailable: vi.fn(),
    isSlugAvailable: vi.fn(),
    incrementClicks: vi.fn(),
  }
}

describe('RedirectResolver', () => {
  let resolver: RedirectResolver

  describe('resolve by code', () => {
    it('returns redirect result for an active link', async () => {
      const link = makeLink()
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect(result).not.toBeNull()
      const r = result as RedirectResult
      expect(r.url).toBe('https://example.com/target')
      expect(r.statusCode).toBe(307)
      expect(r.link.id).toBe('link-1')
    })

    it('returns not_found failure when code does not exist', async () => {
      const repo = makeMockRepo(null)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('nonexistent')
      expect(result).not.toBeNull()
      expect((result as RedirectGuardFailure).reason).toBe('not_found')
    })

    it('returns deleted failure for deleted link', async () => {
      const link = makeLink({ status: 'deleted' })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectGuardFailure).reason).toBe('deleted')
    })

    it('returns paused failure for paused link', async () => {
      const link = makeLink({ status: 'paused' })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectGuardFailure).reason).toBe('paused')
    })

    it('returns expired failure for expired link', async () => {
      const link = makeLink({ expiresAt: new Date('2020-01-01') })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectGuardFailure).reason).toBe('expired')
    })

    it('passes for future expiry', async () => {
      const link = makeLink({ expiresAt: new Date('2030-01-01') })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectResult).url).toBe('https://example.com/target')
    })

    it('returns click_limit failure when limit reached', async () => {
      const link = makeLink({ clickLimit: 100, totalClicks: 100 })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectGuardFailure).reason).toBe('click_limit')
    })

    it('returns password_required when link has password', async () => {
      const link = makeLink({ passwordHash: 'hashed' })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectGuardFailure).reason).toBe('password_required')
    })

    it('passes password guard when password provided', async () => {
      const link = makeLink({ passwordHash: 'hashed' })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123', { passwordHash: 'hashed' })
      expect((result as RedirectResult).url).toBe('https://example.com/target')
    })
  })

  describe('UTM append', () => {
    it('appends link-level UTMs to destination URL', async () => {
      const link = makeLink({
        utmSource: 'mylink',
        utmMedium: 'shorturl',
        utmCampaign: 'spring',
      })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123') as RedirectResult
      const url = new URL(result.url)
      expect(url.searchParams.get('utm_source')).toBe('mylink')
      expect(url.searchParams.get('utm_medium')).toBe('shorturl')
      expect(url.searchParams.get('utm_campaign')).toBe('spring')
    })

    it('does not overwrite existing UTMs on destination', async () => {
      const link = makeLink({
        destinationUrl: 'https://example.com?utm_source=existing',
        utmSource: 'overwrite-attempt',
      })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123') as RedirectResult
      const url = new URL(result.url)
      expect(url.searchParams.get('utm_source')).toBe('existing')
    })
  })

  describe('guard order', () => {
    it('checks deleted before expired', async () => {
      const link = makeLink({ status: 'deleted', expiresAt: new Date('2020-01-01') })
      const repo = makeMockRepo(link)
      resolver = new RedirectResolver(repo)

      const result = await resolver.resolve('abc123')
      expect((result as RedirectGuardFailure).reason).toBe('deleted')
    })
  })
})
