import { describe, it, expect, vi } from 'vitest'
import {
  computeContentHash,
  checkDedup,
  buildBlobPathname,
} from '../../../lib/media/hash'
import { mimeToExt } from '../../../lib/media/types'

describe('computeContentHash', () => {
  it('returns a 64-char hex string', () => {
    const hash = computeContentHash(Buffer.from('hello'))
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it('returns the same hash for the same content', () => {
    const buf = Buffer.from('deterministic-content')
    expect(computeContentHash(buf)).toBe(computeContentHash(buf))
  })
  it('returns different hashes for different content', () => {
    const h1 = computeContentHash(Buffer.from('image-a'))
    const h2 = computeContentHash(Buffer.from('image-b'))
    expect(h1).not.toBe(h2)
  })
  it('produces known SHA-256 for known input', () => {
    const hash = computeContentHash(Buffer.from(''))
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('checkDedup', () => {
  const mockRow = {
    id: 'asset-1',
    site_id: 'site-1',
    blob_url: 'https://example.blob.vercel-storage.com/test.jpg',
    blob_pathname: 'site-1/blog/abc123.jpg',
    filename: 'test.jpg',
    alt_text: null,
    width: 100,
    height: 100,
    mime_type: 'image/jpeg',
    file_size: 5000,
    content_hash: 'abcd1234'.repeat(8),
    folder: 'blog',
    tags: [],
    uploaded_by: 'user-1',
    created_at: '2026-05-06T00:00:00Z',
    updated_at: '2026-05-06T00:00:00Z',
    deleted_at: null,
  }

  it('returns existing asset row when hash matches', async () => {
    const selectMock = vi.fn()
    const eqSiteMock = vi.fn()
    const eqHashMock = vi.fn()
    const isMock = vi.fn()
    const limitMock = vi.fn()
    const singleMock = vi.fn()

    selectMock.mockReturnValue({ eq: eqSiteMock })
    eqSiteMock.mockReturnValue({ eq: eqHashMock })
    eqHashMock.mockReturnValue({ is: isMock })
    isMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: mockRow, error: null })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    }

    const result = await checkDedup(mockSupabase as any, 'site-1', 'abcd1234'.repeat(8))
    expect(result).toEqual(mockRow)
    expect(mockSupabase.from).toHaveBeenCalledWith('media_assets')
  })

  it('returns null when no match', async () => {
    const selectMock = vi.fn()
    const eqSiteMock = vi.fn()
    const eqHashMock = vi.fn()
    const isMock = vi.fn()
    const limitMock = vi.fn()
    const singleMock = vi.fn()

    selectMock.mockReturnValue({ eq: eqSiteMock })
    eqSiteMock.mockReturnValue({ eq: eqHashMock })
    eqHashMock.mockReturnValue({ is: isMock })
    isMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: null, error: null })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    }

    const result = await checkDedup(mockSupabase as any, 'site-1', 'nonexistent'.repeat(6).slice(0, 64))
    expect(result).toBeNull()
  })

  it('returns null on query error (fail open)', async () => {
    const selectMock = vi.fn()
    const eqSiteMock = vi.fn()
    const eqHashMock = vi.fn()
    const isMock = vi.fn()
    const limitMock = vi.fn()
    const singleMock = vi.fn()

    selectMock.mockReturnValue({ eq: eqSiteMock })
    eqSiteMock.mockReturnValue({ eq: eqHashMock })
    eqHashMock.mockReturnValue({ is: isMock })
    isMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: null, error: { message: 'connection failed' } })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    }

    const result = await checkDedup(mockSupabase as any, 'site-1', 'a'.repeat(64))
    expect(result).toBeNull()
  })
})

describe('mimeToExt', () => {
  it('maps image/jpeg → jpg', () => expect(mimeToExt('image/jpeg')).toBe('jpg'))
  it('maps image/png → png', () => expect(mimeToExt('image/png')).toBe('png'))
  it('maps image/webp → webp', () => expect(mimeToExt('image/webp')).toBe('webp'))
  it('maps image/gif → gif', () => expect(mimeToExt('image/gif')).toBe('gif'))
  it('maps image/svg+xml → svg', () => expect(mimeToExt('image/svg+xml')).toBe('svg'))
  it('returns bin for unknown MIME', () => expect(mimeToExt('application/octet-stream')).toBe('bin'))
})

describe('buildBlobPathname', () => {
  it('constructs pathname with truncated hash', () => {
    const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    expect(buildBlobPathname('site-1', 'blog', hash, 'jpg')).toBe('site-1/blog/abcdef0123456789abcdef0123456789.jpg')
  })
  it('uses first 32 chars of hash', () => {
    const hash = '1234567890abcdef1234567890abcdef' + '0'.repeat(32)
    expect(buildBlobPathname('s1', 'authors', hash, 'png')).toBe('s1/authors/1234567890abcdef1234567890abcdef.png')
  })
  it('includes folder in path', () => {
    const hash = 'f'.repeat(64)
    expect(buildBlobPathname('s1', 'newsletters', hash, 'webp')).toBe('s1/newsletters/ffffffffffffffffffffffffffffffff.webp')
  })
})
