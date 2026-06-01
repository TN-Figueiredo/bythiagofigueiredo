import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(() =>
    Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
  ),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

const mockUploadMediaAsset = vi.fn()
vi.mock('@/lib/media/upload', () => ({
  uploadMediaAsset: (...args: unknown[]) => mockUploadMediaAsset(...args),
}))

const mockListMediaAssets = vi.fn()
const mockGetMediaAsset = vi.fn()
const mockGetMediaStats = vi.fn()
const mockGetAssetUsageCount = vi.fn()
vi.mock('@/lib/media/queries', () => ({
  listMediaAssets: (...args: unknown[]) => mockListMediaAssets(...args),
  getMediaAsset: (...args: unknown[]) => mockGetMediaAsset(...args),
  getMediaStats: (...args: unknown[]) => mockGetMediaStats(...args),
  getAssetUsageCount: (...args: unknown[]) => mockGetAssetUsageCount(...args),
}))

const mockTrackMediaUsage = vi.fn()
const mockRemoveMediaUsage = vi.fn()
vi.mock('@/lib/media/track-usage', () => ({
  trackMediaUsage: (...args: unknown[]) => mockTrackMediaUsage(...args),
  removeMediaUsage: (...args: unknown[]) => mockRemoveMediaUsage(...args),
}))

// Chainable Supabase mock
function makeChainable(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(resolveValue))
  chain.then = (resolve: (v: unknown) => void) => resolve(resolveValue)
  return chain
}

const mockSupabase = {
  from: vi.fn(() => ({
    update: vi.fn(() => makeChainable({ data: { id: 'asset-1' }, error: null })),
    delete: vi.fn(() => makeChainable({ error: null })),
    insert: vi.fn(() => makeChainable({ data: { id: 'usage-1' }, error: null })),
  })),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import {
  listMediaAssetsAction,
  getMediaAssetAction,
  uploadMediaAction,
  updateMediaAssetAction,
  softDeleteMediaAssetAction,
  bulkDeleteMediaAssetsAction,
  restoreMediaAssetAction,
  getMediaStatsAction,
  trackMediaUsageAction,
  removeMediaUsageAction,
} from '@/app/cms/(authed)/media/actions'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('media server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listMediaAssetsAction', () => {
    it('returns paginated results from query module', async () => {
      mockListMediaAssets.mockResolvedValue({
        assets: [
          {
            id: '00000000-0000-4000-a000-000000000001',
            site_id: 'site-1',
            blob_url: 'https://blob.vercel-storage.com/test.jpg',
            blob_pathname: 'site-1/blog/abc.jpg',
            filename: 'test.jpg',
            alt_text: null,
            width: 100,
            height: 100,
            mime_type: 'image/jpeg',
            file_size: 1000,
            content_hash: 'abc',
            folder: 'blog',
            tags: [],
            uploaded_by: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            deleted_at: null,
          },
        ],
        nextCursor: null,
      })

      const result = await listMediaAssetsAction({ folder: 'blog' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.assets).toHaveLength(1)
        expect(result.nextCursor).toBeNull()
      }
      expect(mockListMediaAssets).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: 'site-1', folder: 'blog' }),
      )
    })
  })

  describe('getMediaAssetAction', () => {
    it('returns a single asset with usage count', async () => {
      mockGetMediaAsset.mockResolvedValue({
        id: '00000000-0000-4000-a000-000000000001',
        site_id: 'site-1',
        blob_url: 'https://blob.vercel-storage.com/test.jpg',
        blob_pathname: 'site-1/blog/abc.jpg',
        filename: 'test.jpg',
        alt_text: null,
        width: 100,
        height: 100,
        mime_type: 'image/jpeg',
        file_size: 1000,
        content_hash: 'abc',
        folder: 'blog',
        tags: [],
        uploaded_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      })
      mockGetAssetUsageCount.mockResolvedValue(3)

      const result = await getMediaAssetAction('00000000-0000-4000-a000-000000000001')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.asset.id).toBe('00000000-0000-4000-a000-000000000001')
        expect(result.usageCount).toBe(3)
      }
    })

    it('returns error when asset not found', async () => {
      mockGetMediaAsset.mockResolvedValue(null)

      const result = await getMediaAssetAction('00000000-0000-4000-a000-000000000099')
      expect(result.ok).toBe(false)
    })
  })

  describe('uploadMediaAction', () => {
    it('validates FormData and calls uploadMediaAsset', async () => {
      mockUploadMediaAsset.mockResolvedValue({
        ok: true,
        asset: {
          id: '00000000-0000-4000-a000-000000000001',
          siteId: 'site-1',
          blobUrl: 'https://blob.vercel-storage.com/test.jpg',
          blobPathname: 'site-1/blog/abc.jpg',
          filename: 'test.jpg',
          altText: 'Test image',
          width: 100,
          height: 100,
          mimeType: 'image/jpeg',
          fileSize: 1000,
          contentHash: 'abc',
          folder: 'blog',
          tags: [],
          uploadedBy: 'user-1',
          createdAt: '2026-01-01T00:00:00Z',
        },
        deduplicated: false,
      })

      const formData = new FormData()
      formData.set('file', new File(['pixels'], 'test.jpg', { type: 'image/jpeg' }))
      formData.set('folder', 'blog')
      formData.set('altText', 'Test image')

      const result = await uploadMediaAction(formData)

      expect(result.ok).toBe(true)
      expect(mockUploadMediaAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'blog',
          siteId: 'site-1',
          uploadedBy: 'user-1',
        }),
      )
    })

    it('rejects missing file', async () => {
      const formData = new FormData()

      const result = await uploadMediaAction(formData)
      expect(result.ok).toBe(false)
    })
  })

  describe('updateMediaAssetAction', () => {
    it('updates alt text and tags', async () => {
      const result = await updateMediaAssetAction('00000000-0000-4000-a000-000000000001', {
        altText: 'Updated alt',
        tags: ['hero'],
      })

      expect(result.ok).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('media_assets')
    })

    it('rejects invalid folder value', async () => {
      const result = await updateMediaAssetAction('00000000-0000-4000-a000-000000000001', {
        folder: 'INVALID' as 'blog',
      })

      expect(result.ok).toBe(false)
    })
  })

  describe('softDeleteMediaAssetAction', () => {
    it('sets deleted_at and warns about usages', async () => {
      mockGetAssetUsageCount.mockResolvedValue(2)

      const result = await softDeleteMediaAssetAction('00000000-0000-4000-a000-000000000001')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.usageWarning).toBe(2)
      }
    })
  })

  describe('bulkDeleteMediaAssetsAction', () => {
    it('enforces max 50 per call', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`)

      const result = await bulkDeleteMediaAssetsAction(ids)
      expect(result.ok).toBe(false)
    })
  })

  describe('restoreMediaAssetAction', () => {
    it('clears deleted_at', async () => {
      const result = await restoreMediaAssetAction('00000000-0000-4000-a000-000000000001')
      expect(result.ok).toBe(true)
    })
  })

  describe('getMediaStatsAction', () => {
    it('returns aggregated stats', async () => {
      mockGetMediaStats.mockResolvedValue({
        totalCount: 10,
        totalSizeBytes: 5_000_000,
        orphanCount: 2,
        softDeletedCount: 1,
        folderBreakdown: { blog: { count: 5, sizeBytes: 2_500_000 } },
      })

      const result = await getMediaStatsAction()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.stats.totalCount).toBe(10)
      }
    })
  })

  describe('trackMediaUsageAction', () => {
    it('delegates to trackMediaUsage module', async () => {
      const result = await trackMediaUsageAction(
        '00000000-0000-4000-a000-000000000001',
        'blog_post',
        '00000000-0000-4000-a000-000000000002',
        'cover_image_url',
      )

      expect(result.ok).toBe(true)
      expect(mockTrackMediaUsage).toHaveBeenCalledWith(
        '00000000-0000-4000-a000-000000000001',
        'blog_post',
        '00000000-0000-4000-a000-000000000002',
        'cover_image_url',
      )
    })
  })

  describe('removeMediaUsageAction', () => {
    it('delegates to removeMediaUsage module', async () => {
      const result = await removeMediaUsageAction(
        '00000000-0000-4000-a000-000000000001',
        'blog_post',
        '00000000-0000-4000-a000-000000000002',
        'cover_image_url',
      )

      expect(result.ok).toBe(true)
      expect(mockRemoveMediaUsage).toHaveBeenCalledWith(
        '00000000-0000-4000-a000-000000000001',
        'blog_post',
        '00000000-0000-4000-a000-000000000002',
        'cover_image_url',
      )
    })
  })
})
