import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @vercel/og
vi.mock('@vercel/og', () => ({
  ImageResponse: class MockImageResponse {
    private body: ReadableStream
    constructor(element: React.ReactElement, options?: { width?: number; height?: number }) {
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ])
      this.body = new ReadableStream({
        start(controller) {
          controller.enqueue(pngHeader)
          controller.close()
        },
      })
      ;(this as Record<string, unknown>)._width = options?.width
      ;(this as Record<string, unknown>)._height = options?.height
    }
    async arrayBuffer(): Promise<ArrayBuffer> {
      const reader = this.body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      while (!done) {
        const result = await reader.read()
        if (result.value) chunks.push(result.value)
        done = result.done
      }
      const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      return combined.buffer
    }
  },
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({
    url: 'https://blob.vercel-storage.com/stories/test.png',
    pathname: 'stories/test.png',
  }),
}))

import { generateStoryImage, type StoryTemplate, type StoryData } from '@/lib/social/story-generator'

const baseData: StoryData = {
  title: 'AI Empire: O Que Vem Por Ai',
  description: 'O futuro da inteligencia artificial',
  domain: 'bythiagofigueiredo.com',
  shortUrl: 'go.bythiagofigueiredo.com/ai-empire',
}

describe('generateStoryImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generates a Buffer for "minimal" template', async () => {
    const result = await generateStoryImage('minimal', baseData)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('generates a Buffer for "card" template', async () => {
    const result = await generateStoryImage('card', baseData)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('generates a Buffer for "bold" template', async () => {
    const result = await generateStoryImage('bold', baseData)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('accepts optional coverImageUrl', async () => {
    const dataWithCover: StoryData = {
      ...baseData,
      coverImageUrl: 'https://example.com/cover.jpg',
    }
    const result = await generateStoryImage('card', dataWithCover)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('accepts optional logoUrl', async () => {
    const dataWithLogo: StoryData = {
      ...baseData,
      logoUrl: 'https://example.com/logo.png',
    }
    const result = await generateStoryImage('minimal', dataWithLogo)
    expect(result).toBeInstanceOf(Buffer)
  })

  it('returns PNG data starting with PNG signature', async () => {
    const result = await generateStoryImage('minimal', baseData)
    expect(result[0]).toBe(0x89)
    expect(result[1]).toBe(0x50)
    expect(result[2]).toBe(0x4e)
    expect(result[3]).toBe(0x47)
  })

  it('passes 1080x1920 dimensions to ImageResponse', async () => {
    const { ImageResponse } = await import('@vercel/og')
    const spy = vi.spyOn(ImageResponse.prototype, 'arrayBuffer')
    await generateStoryImage('card', baseData)
    const instance = spy.mock.instances[0] as Record<string, unknown>
    expect(instance._width).toBe(1080)
    expect(instance._height).toBe(1920)
    spy.mockRestore()
  })

  it('uses fallback background when coverImageUrl is absent', async () => {
    const dataWithoutCover: StoryData = { ...baseData, coverImageUrl: undefined }
    await expect(generateStoryImage('minimal', dataWithoutCover)).resolves.toBeInstanceOf(Buffer)
  })

  it('throws when an invalid template type is provided', async () => {
    await expect(
      generateStoryImage('invalid-template' as StoryTemplate, baseData),
    ).rejects.toThrow()
  })
})
