import { describe, it, expect } from 'vitest'
import {
  FOLDER_LIMITS,
  ALLOWED_MIME_TYPES,
  toMediaAsset,
  type MediaFolder,
  type MediaAssetRow,
} from '../../../lib/media/types'

describe('media types', () => {
  it('FOLDER_LIMITS has all 8 folders', () => {
    const folders: MediaFolder[] = [
      'authors', 'blog', 'newsletters', 'branding',
      'og', 'ads', 'links', 'general',
    ]
    for (const f of folders) {
      expect(FOLDER_LIMITS[f]).toBeDefined()
      expect(FOLDER_LIMITS[f].maxSizeBytes).toBeGreaterThan(0)
      expect(FOLDER_LIMITS[f].maxDimensionPx).toBeGreaterThan(0)
    }
  })

  it('ALLOWED_MIME_TYPES has 5 entries', () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(5)
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/webp')
    expect(ALLOWED_MIME_TYPES).toContain('image/gif')
    expect(ALLOWED_MIME_TYPES).toContain('image/svg+xml')
  })

  it('toMediaAsset maps snake_case row to camelCase', () => {
    const row: MediaAssetRow = {
      id: '00000000-0000-0000-0000-000000000001',
      site_id: '00000000-0000-0000-0000-000000000002',
      blob_url: 'https://example.public.blob.vercel-storage.com/test.jpg',
      blob_pathname: 'site/blog/abc123.jpg',
      filename: 'photo.jpg',
      alt_text: 'A photo',
      width: 800,
      height: 600,
      mime_type: 'image/jpeg',
      file_size: 123456,
      content_hash: 'a'.repeat(64),
      folder: 'blog',
      tags: ['hero', 'featured'],
      uploaded_by: '00000000-0000-0000-0000-000000000003',
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
      deleted_at: null,
    }

    const asset = toMediaAsset(row)

    expect(asset.id).toBe(row.id)
    expect(asset.siteId).toBe(row.site_id)
    expect(asset.blobUrl).toBe(row.blob_url)
    expect(asset.blobPathname).toBe(row.blob_pathname)
    expect(asset.filename).toBe(row.filename)
    expect(asset.altText).toBe(row.alt_text)
    expect(asset.width).toBe(800)
    expect(asset.height).toBe(600)
    expect(asset.mimeType).toBe(row.mime_type)
    expect(asset.fileSize).toBe(row.file_size)
    expect(asset.contentHash).toBe(row.content_hash)
    expect(asset.folder).toBe('blog')
    expect(asset.tags).toEqual(['hero', 'featured'])
    expect(asset.uploadedBy).toBe(row.uploaded_by)
    expect(asset.createdAt).toBe(row.created_at)
  })
})
