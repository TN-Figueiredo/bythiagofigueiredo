import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createMediaContainer,
  pollContainerStatus,
  publishContainer,
  publishInstagramMedia,
  publishMultiSlideStory,
  deleteInstagramMedia,
  InsufficientRateBudgetError,
} from './instagram.js'

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
})

describe('createMediaContainer', () => {
  it('defaults video posts to REELS media_type', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'container-1' }))
    await createMediaContainer('ig-1', 'tok', { video_url: 'https://cdn/v.mp4', caption: 'hi' })

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body).toEqual({
      caption: 'hi',
      video_url: 'https://cdn/v.mp4',
      media_type: 'REELS',
    })
  })

  it('honors an explicit REELS/STORIES media_type for video', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'c' }))
    await createMediaContainer('ig-1', 'tok', { video_url: 'https://cdn/v.mp4', media_type: 'STORIES' })
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body.media_type).toBe('STORIES')
  })

  it('sends image_url and only tags STORIES for images (no media_type for feed image)', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'c' }))
    await createMediaContainer('ig-1', 'tok', { image_url: 'https://cdn/i.png' })
    const feedBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(feedBody).toEqual({ image_url: 'https://cdn/i.png' })

    fetchMock.mockResolvedValue(okJson({ id: 'c' }))
    await createMediaContainer('ig-1', 'tok', { image_url: 'https://cdn/i.png', media_type: 'STORIES' })
    const storyBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string)
    expect(storyBody).toEqual({ image_url: 'https://cdn/i.png', media_type: 'STORIES' })
  })

  it('returns the container id', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'container-99' }))
    await expect(
      createMediaContainer('ig-1', 'tok', { image_url: 'https://cdn/i.png' }),
    ).resolves.toBe('container-99')
  })

  it('throws on failure', async () => {
    fetchMock.mockResolvedValue(errRes(400, 'invalid media'))
    await expect(
      createMediaContainer('ig-1', 'tok', { image_url: 'https://cdn/i.png' }),
    ).rejects.toThrow(/IG container creation failed \(400\): invalid media/)
  })
})

describe('pollContainerStatus', () => {
  it('resolves FINISHED as soon as the container is ready', async () => {
    fetchMock.mockResolvedValue(okJson({ status_code: 'FINISHED' }))
    await expect(pollContainerStatus('c', 'tok')).resolves.toBe('FINISHED')
  })

  it('resolves ERROR when the container reports ERROR', async () => {
    fetchMock.mockResolvedValue(okJson({ status_code: 'ERROR' }))
    await expect(pollContainerStatus('c', 'tok')).resolves.toBe('ERROR')
  })

  it('treats EXPIRED as ERROR', async () => {
    fetchMock.mockResolvedValue(okJson({ status_code: 'EXPIRED' }))
    await expect(pollContainerStatus('c', 'tok')).resolves.toBe('ERROR')
  })

  it('returns ERROR without polling once the timeout has already passed', async () => {
    await expect(pollContainerStatus('c', 'tok', 0)).resolves.toBe('ERROR')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('publishContainer', () => {
  it('publishes the creation_id and returns the media id', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'media-7' }))
    const result = await publishContainer('ig-1', 'tok', 'container-1')
    expect(result).toEqual({ id: 'media-7' })
    expect(fetchMock.mock.calls[0]![0]).toContain('/ig-1/media_publish')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
      creation_id: 'container-1',
    })
  })

  it('throws on failure', async () => {
    fetchMock.mockResolvedValue(errRes(500, 'server error'))
    await expect(publishContainer('ig-1', 'tok', 'c')).rejects.toThrow(
      /IG publish failed \(500\): server error/,
    )
  })
})

describe('publishInstagramMedia', () => {
  it('creates → polls FINISHED → publishes in sequence', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ id: 'container-1' })) // create
      .mockResolvedValueOnce(okJson({ status_code: 'FINISHED' })) // poll
      .mockResolvedValueOnce(okJson({ id: 'media-1' })) // publish

    const result = await publishInstagramMedia('ig-1', 'tok', { image_url: 'https://cdn/i.png' })
    expect(result).toEqual({ id: 'media-1' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws when container processing ends in ERROR (never publishes)', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ id: 'container-1' }))
      .mockResolvedValueOnce(okJson({ status_code: 'ERROR' }))

    await expect(
      publishInstagramMedia('ig-1', 'tok', { image_url: 'https://cdn/i.png' }),
    ).rejects.toThrow(/IG container container-1 failed processing/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('publishMultiSlideStory', () => {
  it('throws InsufficientRateBudgetError before any network call when budget is short', async () => {
    await expect(
      publishMultiSlideStory('ig-1', 'tok', ['a', 'b', 'c'], 4),
    ).rejects.toBeInstanceOf(InsufficientRateBudgetError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('publishes each slide as a STORIES post when budget is sufficient', async () => {
    // 1 slide → create/poll/publish = 3 fetches
    fetchMock
      .mockResolvedValueOnce(okJson({ id: 'container-1' }))
      .mockResolvedValueOnce(okJson({ status_code: 'FINISHED' }))
      .mockResolvedValueOnce(okJson({ id: 'media-1' }))

    const results = await publishMultiSlideStory('ig-1', 'tok', ['https://cdn/1.png'], 100)
    expect(results).toEqual([{ id: 'media-1' }])

    // container creation must request STORIES media_type
    const createBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(createBody.media_type).toBe('STORIES')
  })
})

describe('deleteInstagramMedia', () => {
  it('issues a DELETE with the token', async () => {
    fetchMock.mockResolvedValue(okJson({ success: true }))
    await deleteInstagramMedia('media-1', 'tok')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/media-1?access_token=tok')
    expect(init.method).toBe('DELETE')
  })

  it('throws on failure', async () => {
    fetchMock.mockResolvedValue(errRes(403, 'forbidden'))
    await expect(deleteInstagramMedia('m', 't')).rejects.toThrow(/IG delete failed \(403\): forbidden/)
  })
})

describe('InsufficientRateBudgetError', () => {
  it('carries the budget check and a descriptive message', () => {
    const err = new InsufficientRateBudgetError({ sufficient: false, remaining: 4, required: 6 })
    expect(err.name).toBe('InsufficientRateBudgetError')
    expect(err.budget.required).toBe(6)
    expect(err.message).toMatch(/Need 6 API calls, only 4 remaining/)
  })
})
