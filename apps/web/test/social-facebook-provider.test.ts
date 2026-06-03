import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Build the package before running tests — imports come from dist/
// Run: npm run build -w packages/social first

import {
  postPhotoToPage,
  formatFacebookContent,
} from '@tn-figueiredo/social/providers/meta'

describe('postPhotoToPage', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to /{pageId}/photos with image URL and message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'photo-123', post_id: 'post-456' }),
    })

    const result = await postPhotoToPage(
      'page-1',
      'tok-abc',
      'https://cdn.example.com/image.jpg',
      'Hello world',
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.facebook.com/v25.0/page-1/photos')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok-abc',
    })
    const body = JSON.parse(init.body as string)
    expect(body.url).toBe('https://cdn.example.com/image.jpg')
    expect(body.message).toBe('Hello world')

    expect(result.id).toBe('photo-123')
    expect(result.url).toBe('https://facebook.com/page-1/posts/post-456')
  })

  it('falls back to data.id when post_id is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'photo-999' }),
    })

    const result = await postPhotoToPage('page-2', 'tok', 'https://img.example.com/x.png', 'msg')
    expect(result.url).toBe('https://facebook.com/page-2/posts/photo-999')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    })

    await expect(
      postPhotoToPage('page-3', 'tok', 'https://img.example.com/x.png', 'msg'),
    ).rejects.toThrow('Facebook photo post failed (400): Bad Request')
  })
})

describe('formatFacebookContent', () => {
  it('does not duplicate text when title equals description', () => {
    const result = formatFacebookContent(
      { title: 'My Post', description: 'My Post' },
      63_206,
    )
    // title is omitted because it equals description; description is included once
    expect(result.message).toBe('My Post')
    expect(result.message).not.toContain('My Post\n\nMy Post')
  })

  it('includes both title and description when they differ', () => {
    const result = formatFacebookContent(
      { title: 'Title', description: 'Body copy here' },
      63_206,
    )
    expect(result.message).toBe('Title\n\nBody copy here')
  })

  it('appends hashtags after content', () => {
    const result = formatFacebookContent(
      { description: 'Look at this', hashtags: ['photo', 'art'] },
      63_206,
    )
    expect(result.message).toBe('Look at this\n\n#photo #art')
  })

  it('omits empty title and includes only description', () => {
    const result = formatFacebookContent(
      { title: '', description: 'Just a description' },
      63_206,
    )
    expect(result.message).toBe('Just a description')
  })

  it('truncates to the given limit with ellipsis', () => {
    const result = formatFacebookContent(
      { description: 'a'.repeat(10) },
      5,
    )
    expect(result.message).toHaveLength(5)
    expect(result.message.endsWith('…')).toBe(true)
  })

  it('returns the url as the link field', () => {
    const result = formatFacebookContent(
      { description: 'hello', url: 'https://example.com' },
      63_206,
    )
    expect(result.link).toBe('https://example.com')
  })
})
