import { describe, it, expect, vi, beforeEach } from 'vitest'

const putMock = vi.fn()
const delMock = vi.fn()
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => putMock(...args),
  del: (...args: unknown[]) => delMock(...args),
}))

const insertMock = vi.fn()
const selectMock = vi.fn()
const deleteMock = vi.fn()
const eqMock = vi.fn()
const isMock = vi.fn()
const limitMock = vi.fn()
const singleMock = vi.fn()

function buildChain(resolvedData: unknown) {
  selectMock.mockReturnValue({ eq: eqMock })
  deleteMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  eqMock.mockReturnValue({ eq: eqMock, is: isMock })
  isMock.mockReturnValue({ limit: limitMock })
  limitMock.mockReturnValue({ single: singleMock })
  singleMock.mockResolvedValue({ data: resolvedData, error: null })
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'media_assets') {
        return {
          select: selectMock,
          insert: insertMock,
          delete: deleteMock,
        }
      }
      return { select: vi.fn() }
    }),
  }),
}))

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    rotate: vi.fn().mockReturnThis(),
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 80 }),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from('processed'),
      info: { width: 100, height: 80, format: 'jpeg', size: 500, channels: 3 },
    }),
  }))
  return { default: mockSharp }
})

vi.mock('../../../lib/media/sanitize-svg', () => ({
  sanitizeSvg: vi.fn((input: string) => input),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { uploadMediaAsset, uploadMediaAssets } from '../../../lib/media/upload'
import type { UploadMediaInput } from '../../../lib/media/types'

const validInput: UploadMediaInput = {
  file: Buffer.from('fake-jpeg-data'),
  filename: 'photo.jpg',
  folder: 'blog',
  siteId: 'site-1',
  uploadedBy: 'user-1',
  altText: 'A test image',
  tags: ['test'],
}

const mockAssetRow = {
  id: 'asset-uuid',
  site_id: 'site-1',
  blob_url: 'https://abc.public.blob.vercel-storage.com/site-1/blog/aabbccdd.jpg',
  blob_pathname: 'site-1/blog/aabbccdd.jpg',
  filename: 'photo.jpg',
  alt_text: 'A test image',
  width: 100,
  height: 80,
  mime_type: 'image/jpeg',
  file_size: 14,
  content_hash: 'a'.repeat(64),
  folder: 'blog',
  tags: ['test'],
  uploaded_by: 'user-1',
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T00:00:00Z',
  deleted_at: null,
}

describe('uploadMediaAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    putMock.mockResolvedValue({
      url: 'https://abc.public.blob.vercel-storage.com/site-1/blog/aabbccdd.jpg',
      pathname: 'site-1/blog/aabbccdd.jpg',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
  })

  it('rejects unsupported MIME type', async () => {
    const result = await uploadMediaAsset({
      ...validInput,
      file: Buffer.from('%PDF-1.4 fake'),
      filename: 'document.pdf',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unsupported_format')
    }
  })

  it('rejects file over size limit', async () => {
    const bigBuffer = Buffer.alloc(6_000_000)
    const result = await uploadMediaAsset({
      ...validInput,
      file: bigBuffer,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('file_too_large')
    }
  })

  it('returns deduplicated asset when content hash matches existing', async () => {
    buildChain(mockAssetRow)

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deduplicated).toBe(true)
      expect(result.asset.blobUrl).toBe(mockAssetRow.blob_url)
    }
    expect(putMock).not.toHaveBeenCalled()
  })

  it('calls Blob put() with correct pathname and options for new file', async () => {
    buildChain(null)
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockAssetRow, error: null }),
      }),
    })

    const result = await uploadMediaAsset(validInput)

    expect(putMock).toHaveBeenCalledTimes(1)
    const [pathname, _buffer, options] = putMock.mock.calls[0]
    expect(pathname).toMatch(/^site-1\/blog\/[a-f0-9]{32}\.jpg$/)
    expect(options.access).toBe('public')
    expect(options.addRandomSuffix).toBe(false)
    expect(options.contentType).toBe('image/jpeg')
  })

  it('returns ok:true with asset for successful new upload', async () => {
    buildChain(null)
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockAssetRow, error: null }),
      }),
    })

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deduplicated).toBe(false)
      expect(result.asset.id).toBe('asset-uuid')
      expect(result.asset.filename).toBe('photo.jpg')
      expect(result.asset.folder).toBe('blog')
    }
  })

  it('attempts Blob cleanup on DB insert failure', async () => {
    buildChain(null)
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'unique constraint violation' },
        }),
      }),
    })

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('db_insert_failed')
    }
    expect(delMock).toHaveBeenCalledTimes(1)
  })

  it('handles Blob upload failure gracefully', async () => {
    buildChain(null)
    putMock.mockRejectedValue(new Error('Blob storage unavailable'))

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('blob_upload_failed')
    }
  })
})

describe('uploadMediaAssets (batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
    buildChain(mockAssetRow)
  })

  it('processes multiple inputs and returns per-item results', async () => {
    const inputs = [
      { ...validInput, filename: 'a.jpg' },
      { ...validInput, filename: 'b.jpg' },
      { ...validInput, filename: 'c.jpg' },
    ]

    const results = await uploadMediaAssets(inputs, 2)

    expect(results).toHaveLength(3)
    results.forEach((r) => expect(r.ok).toBe(true))
  })

  it('returns individual errors without failing entire batch', async () => {
    const inputs = [
      { ...validInput, file: Buffer.alloc(6_000_000), filename: 'big.jpg' },
      { ...validInput, filename: 'ok.jpg' },
    ]

    const results = await uploadMediaAssets(inputs, 2)

    expect(results).toHaveLength(2)
    expect(results[0].ok).toBe(false)
    expect(results[1].ok).toBe(true)
  })
})
