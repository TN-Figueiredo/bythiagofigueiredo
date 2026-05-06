import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkService } from './link-service.js'
import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { IQrStorage } from '../interfaces/storage.js'
import type { TrackedLink, CreateLinkInput } from '../types.js'
import { CodeGenerator } from './code-generator.js'

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

function makeDeps() {
  const linkRepo: ILinkRepository = {
    create: vi.fn(async (input) => makeLink({ ...input })),
    update: vi.fn(async (id, input) => makeLink({ id, ...input })),
    findByCode: vi.fn(async () => null),
    findBySlug: vi.fn(async () => null),
    findById: vi.fn(async () => makeLink()),
    list: vi.fn(async () => ({ data: [], total: 0, limit: 20, offset: 0 })),
    softDelete: vi.fn(async () => {}),
    isCodeAvailable: vi.fn(async () => true),
    isSlugAvailable: vi.fn(async () => true),
    incrementClicks: vi.fn(async () => {}),
  }

  const qrStorage: IQrStorage = {
    upload: vi.fn(async () => 'https://storage.example.com/qr/abc.svg'),
    delete: vi.fn(async () => {}),
  }

  return { linkRepo, qrStorage }
}

describe('LinkService', () => {
  describe('createLink', () => {
    it('creates a link with auto-generated code', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      const input: CreateLinkInput = {
        siteId: 'site-1',
        destinationUrl: 'https://example.com/page',
      }

      const link = await service.createLink(input)
      expect(link).toBeDefined()
      expect(deps.linkRepo.create).toHaveBeenCalledTimes(1)
      // The create call should have a code
      const createArg = vi.mocked(deps.linkRepo.create).mock.calls[0]![0]
      expect(createArg.code).toBeDefined()
      expect(typeof createArg.code).toBe('string')
      expect(createArg.code.length).toBe(6)
    })

    it('creates a link with custom code', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      const input: CreateLinkInput = {
        siteId: 'site-1',
        destinationUrl: 'https://example.com/page',
        code: 'custom',
      }

      const link = await service.createLink(input)
      const createArg = vi.mocked(deps.linkRepo.create).mock.calls[0]![0]
      expect(createArg.code).toBe('custom')
    })

    it('validates destination URL format', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      await expect(
        service.createLink({ siteId: 'site-1', destinationUrl: 'not-a-url' }),
      ).rejects.toThrow(/invalid.*url/i)
    })

    it('checks code availability before creating', async () => {
      const deps = makeDeps()
      vi.mocked(deps.linkRepo.isCodeAvailable).mockResolvedValue(false)
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      await expect(
        service.createLink({ siteId: 'site-1', destinationUrl: 'https://example.com', code: 'taken' }),
      ).rejects.toThrow(/code.*taken|already.*exists|unavailable/i)
    })

    it('checks slug availability if slug provided', async () => {
      const deps = makeDeps()
      vi.mocked(deps.linkRepo.isSlugAvailable).mockResolvedValue(false)
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      await expect(
        service.createLink({
          siteId: 'site-1',
          destinationUrl: 'https://example.com',
          slug: 'taken-slug',
        }),
      ).rejects.toThrow(/slug.*taken|already.*exists|unavailable/i)
    })
  })

  describe('updateLink', () => {
    it('updates a link', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      const updated = await service.updateLink('link-1', { title: 'New Title' })
      expect(deps.linkRepo.update).toHaveBeenCalledWith('link-1', { title: 'New Title' })
    })

    it('validates destination URL on update if provided', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      await expect(
        service.updateLink('link-1', { destinationUrl: 'not-valid' }),
      ).rejects.toThrow(/invalid.*url/i)
    })
  })

  describe('softDelete', () => {
    it('soft deletes a link (preserves history)', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      await service.softDelete('link-1')
      expect(deps.linkRepo.softDelete).toHaveBeenCalledWith('link-1')
    })
  })

  describe('attachQr', () => {
    it('uploads QR SVG and updates link with URL', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      const qrUrl = await service.attachQr('link-1', '<svg>...</svg>')
      expect(deps.qrStorage.upload).toHaveBeenCalledTimes(1)
      expect(deps.linkRepo.update).toHaveBeenCalledWith('link-1', {
        qrCodeUrl: 'https://storage.example.com/qr/abc.svg',
      })
      expect(qrUrl).toBe('https://storage.example.com/qr/abc.svg')
    })
  })

  describe('getLink', () => {
    it('returns a link by id', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      const link = await service.getLink('link-1')
      expect(link).toBeDefined()
      expect(deps.linkRepo.findById).toHaveBeenCalledWith('link-1')
    })
  })

  describe('listLinks', () => {
    it('lists links with filters', async () => {
      const deps = makeDeps()
      const service = new LinkService(deps.linkRepo, deps.qrStorage)

      const result = await service.listLinks({ siteId: 'site-1' })
      expect(result).toEqual({ data: [], total: 0, limit: 20, offset: 0 })
    })
  })
})
