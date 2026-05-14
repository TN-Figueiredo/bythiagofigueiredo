import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockUploadBlob = vi.fn().mockResolvedValue({
  data: { blob: { ref: 'blob-ref-123', mimeType: 'image/jpeg', size: 1024 } },
})

const mockAgent = {
  uploadBlob: mockUploadBlob,
} as unknown

describe('buildExternalEmbed with ogData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    })
  })

  it('uses cached ogData instead of fetching when provided', async () => {
    const { buildExternalEmbed } = await import(
      '../../../../../packages/social/src/providers/bluesky/link-embed'
    )

    const ogData = {
      title: 'AI Empire',
      description: 'O futuro da AI',
      imageUrl: 'https://example.com/og.jpg',
    }

    const result = await buildExternalEmbed(
      mockAgent as Parameters<typeof buildExternalEmbed>[0],
      'https://bythiagofigueiredo.com/blog/ai-empire',
      ogData,
    )

    // Should NOT have fetched the page for OG tags (only the image)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![0]).toBe('https://example.com/og.jpg')

    expect(result.$type).toBe('app.bsky.embed.external')
    expect(result.external.title).toBe('AI Empire')
    expect(result.external.description).toBe('O futuro da AI')
  })

  it('falls back to fetching OG tags when ogData not provided', async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          '<html><head><meta property="og:title" content="Fetched Title"><meta property="og:description" content="Fetched Desc"><meta property="og:image" content="https://example.com/fetched.jpg"></head></html>',
        ),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    })

    const { buildExternalEmbed } = await import(
      '../../../../../packages/social/src/providers/bluesky/link-embed'
    )

    const result = await buildExternalEmbed(
      mockAgent as Parameters<typeof buildExternalEmbed>[0],
      'https://bythiagofigueiredo.com/blog/test',
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.external.title).toBe('Fetched Title')
  })

  it('handles missing imageUrl in ogData gracefully', async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)

    const { buildExternalEmbed } = await import(
      '../../../../../packages/social/src/providers/bluesky/link-embed'
    )

    const ogData = {
      title: 'No Image Post',
      description: 'A post without image',
    }

    const result = await buildExternalEmbed(
      mockAgent as Parameters<typeof buildExternalEmbed>[0],
      'https://example.com',
      ogData,
    )

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.external.title).toBe('No Image Post')
    expect(result.external.thumb).toBeUndefined()
  })
})
