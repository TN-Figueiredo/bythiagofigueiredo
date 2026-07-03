import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  postToPage,
  postPhotoToPage,
  warmOGCache,
  deletePagePost,
} from './facebook.js'

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

function errRes(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('postToPage', () => {
  it('posts a message-only payload and derives the post URL from the composite id', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'PAGE9_POST42' }))

    const result = await postToPage('PAGE9', 'page-token', { message: 'hello world' })

    expect(result).toEqual({
      id: 'PAGE9_POST42',
      url: 'https://facebook.com/PAGE9/posts/POST42',
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/PAGE9/feed')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer page-token')
    expect(JSON.parse(init.body as string)).toEqual({ message: 'hello world' })
  })

  it('includes the link field when provided', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'P_1' }))
    await postToPage('P', 'tok', { message: 'm', link: 'https://x.com/a' })
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
      message: 'm',
      link: 'https://x.com/a',
    })
  })

  it('falls back to the raw id when it is not composite', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'nocomposite' }))
    const result = await postToPage('P', 'tok', { message: 'm' })
    expect(result.url).toBe('https://facebook.com/P/posts/nocomposite')
  })

  it('throws with status + body on failure', async () => {
    fetchMock.mockResolvedValue(errRes(401, 'expired'))
    await expect(postToPage('P', 'tok', { message: 'm' })).rejects.toThrow(
      /Facebook post failed \(401\): expired/,
    )
  })
})

describe('postPhotoToPage', () => {
  it('sends url + message and prefers post_id for the URL', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'PHOTO1', post_id: 'POST7' }))

    const result = await postPhotoToPage('PAGE1', 'tok', 'https://cdn/x.png', 'caption')

    expect(result).toEqual({
      id: 'PHOTO1',
      url: 'https://facebook.com/PAGE1/posts/POST7',
    })
    expect(fetchMock.mock.calls[0]![0]).toContain('/PAGE1/photos')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
      url: 'https://cdn/x.png',
      message: 'caption',
    })
  })

  it('falls back to id when post_id is absent', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'PHOTO1' }))
    const result = await postPhotoToPage('PAGE1', 'tok', 'https://cdn/x.png', 'c')
    expect(result.url).toBe('https://facebook.com/PAGE1/posts/PHOTO1')
  })

  it('throws on failure', async () => {
    fetchMock.mockResolvedValue(errRes(400, 'bad image'))
    await expect(postPhotoToPage('P', 't', 'u', 'm')).rejects.toThrow(
      /Facebook photo post failed \(400\): bad image/,
    )
  })
})

describe('warmOGCache', () => {
  it('returns true immediately when the scrape yields an image on the first attempt', async () => {
    fetchMock.mockResolvedValue(okJson({ og_object: { image: [{ url: 'https://cdn/og.png' }] } }))

    await expect(warmOGCache('https://x.com/a', 'tok')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('scrape=true')
    expect(url).toContain(encodeURIComponent('https://x.com/a'))
    expect(init.method).toBe('POST')
  })

  it('retries up to 3 times and returns false when no image ever appears', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(okJson({ og_object: {} }))

    const promise = warmOGCache('https://x.com/a', 'tok')
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('deletePagePost', () => {
  it('issues a DELETE with the page token', async () => {
    fetchMock.mockResolvedValue(okJson({ success: true }))
    await deletePagePost('POST9', 'page-token')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/POST9?access_token=page-token')
    expect(init.method).toBe('DELETE')
  })

  it('throws on failure', async () => {
    fetchMock.mockResolvedValue(errRes(404, 'not found'))
    await expect(deletePagePost('X', 't')).rejects.toThrow(/Facebook delete failed \(404\): not found/)
  })
})
