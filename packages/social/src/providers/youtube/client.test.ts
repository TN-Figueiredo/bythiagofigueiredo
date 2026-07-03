import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockVideosUpdate = vi.fn()
const mockVideosList = vi.fn()
const mockVideosDelete = vi.fn()
const mockSearchList = vi.fn()
const youtubeFactory = vi.fn((..._args: unknown[]) => ({
  videos: { update: mockVideosUpdate, list: mockVideosList, delete: mockVideosDelete },
  search: { list: mockSearchList },
}))

vi.mock('@googleapis/youtube', () => ({
  youtube: (...args: unknown[]) => youtubeFactory(...args),
}))

import {
  createUploadSession,
  updateVideoMetadata,
  setThumbnail,
  setPrivacyStatus,
  getVideo,
  deleteVideo,
  listVideos,
} from './client.js'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createUploadSession', () => {
  it('initiates a resumable upload and returns the location header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ location: 'https://upload.googleapis.com/session/abc' }),
      text: async () => '',
    } as unknown as Response)

    const uri = await createUploadSession(
      { accessToken: 'tok' },
      { title: 'Vid', privacyStatus: 'private' },
    )

    expect(uri).toBe('https://upload.googleapis.com/session/abc')
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    const body = JSON.parse(init.body as string)
    expect(body.snippet.title).toBe('Vid')
    expect(body.snippet.categoryId).toBe('22') // default
    expect(body.status.selfDeclaredMadeForKids).toBe(false)
  })

  it('throws when the init call fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      text: async () => 'quota exceeded',
    } as unknown as Response)

    await expect(
      createUploadSession({ accessToken: 't' }, { title: 'V', privacyStatus: 'private' }),
    ).rejects.toThrow(/resumable upload init failed \(403\): quota exceeded/)
  })

  it('throws when the response omits the location header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '',
    } as unknown as Response)

    await expect(
      createUploadSession({ accessToken: 't' }, { title: 'V', privacyStatus: 'private' }),
    ).rejects.toThrow(/no location header/)
  })
})

describe('updateVideoMetadata', () => {
  it('updates snippet only (part=[snippet]) when no privacyStatus is given', async () => {
    mockVideosUpdate.mockResolvedValue({})
    const result = await updateVideoMetadata({ accessToken: 'tok' }, 'VID1', {
      title: 'New',
      tags: ['x'],
    })

    expect(result).toEqual({ id: 'VID1', url: 'https://youtube.com/watch?v=VID1' })
    const arg = mockVideosUpdate.mock.calls[0]![0]
    expect(arg.part).toEqual(['snippet'])
    expect(arg.requestBody.id).toBe('VID1')
    expect(arg.requestBody.snippet.title).toBe('New')
    expect(arg.requestBody.status).toBeUndefined()
  })

  it('adds the status part when privacyStatus is provided', async () => {
    mockVideosUpdate.mockResolvedValue({})
    await updateVideoMetadata({ accessToken: 'tok' }, 'VID2', { privacyStatus: 'public' })
    const arg = mockVideosUpdate.mock.calls[0]![0]
    expect(arg.part).toEqual(['snippet', 'status'])
    expect(arg.requestBody.status.privacyStatus).toBe('public')
  })
})

describe('setThumbnail', () => {
  it('uploads the image buffer with the given mime type', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' } as unknown as Response)
    await setThumbnail({ accessToken: 'tok' }, 'VID1', new Uint8Array([1, 2, 3]), 'image/png')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('thumbnails/set?videoId=VID1')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('image/png')
  })

  it('throws on failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'too big' } as unknown as Response)
    await expect(
      setThumbnail({ accessToken: 't' }, 'V', new Uint8Array(), 'image/png'),
    ).rejects.toThrow(/set thumbnail failed \(400\): too big/)
  })
})

describe('setPrivacyStatus', () => {
  it('updates only the status part', async () => {
    mockVideosUpdate.mockResolvedValue({})
    await setPrivacyStatus({ accessToken: 'tok' }, 'VID1', 'unlisted')
    const arg = mockVideosUpdate.mock.calls[0]![0]
    expect(arg.part).toEqual(['status'])
    expect(arg.requestBody).toEqual({ id: 'VID1', status: { privacyStatus: 'unlisted' } })
  })
})

describe('getVideo', () => {
  it('maps the Google video schema to the domain shape', async () => {
    mockVideosList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'VID1',
            snippet: {
              title: 'Title',
              description: 'Desc',
              tags: ['a', 'b'],
              categoryId: '22',
              publishedAt: '2026-01-01T00:00:00Z',
              thumbnails: {
                default: { url: 'https://t/d.jpg', width: 120, height: 90 },
                broken: { url: 'https://t/x.jpg' }, // missing dims → dropped
              },
            },
            status: { privacyStatus: 'public' },
            contentDetails: { duration: 'PT1M30S' },
            statistics: { viewCount: '4200' },
          },
        ],
      },
    })

    const video = await getVideo({ accessToken: 'tok' }, 'VID1')
    expect(video).toMatchObject({
      id: 'VID1',
      title: 'Title',
      description: 'Desc',
      tags: ['a', 'b'],
      privacyStatus: 'public',
      duration: 'PT1M30S',
      viewCount: 4200,
    })
    expect(video?.thumbnails.default).toEqual({ url: 'https://t/d.jpg', width: 120, height: 90 })
    expect(video?.thumbnails.broken).toBeUndefined()
  })

  it('returns null when the video is not found', async () => {
    mockVideosList.mockResolvedValue({ data: { items: [] } })
    await expect(getVideo({ accessToken: 'tok' }, 'MISSING')).resolves.toBeNull()
  })

  it('defaults missing snippet fields and privacy to private', async () => {
    mockVideosList.mockResolvedValue({ data: { items: [{ id: 'V2' }] } })
    const video = await getVideo({ accessToken: 'tok' }, 'V2')
    expect(video).toMatchObject({
      id: 'V2',
      title: '',
      tags: [],
      privacyStatus: 'private',
      viewCount: 0,
    })
  })
})

describe('deleteVideo', () => {
  it('calls videos.delete with the id', async () => {
    mockVideosDelete.mockResolvedValue({})
    await deleteVideo({ accessToken: 'tok' }, 'VID1')
    expect(mockVideosDelete).toHaveBeenCalledWith({ id: 'VID1' })
  })
})

describe('listVideos', () => {
  it('searches the channel then hydrates the found ids', async () => {
    mockSearchList.mockResolvedValue({
      data: { items: [{ id: { videoId: 'A' } }, { id: { videoId: 'B' } }, { id: {} }] },
    })
    mockVideosList.mockResolvedValue({
      data: { items: [{ id: 'A' }, { id: 'B' }] },
    })

    const videos = await listVideos({ accessToken: 'tok' }, 'CHANNEL1', 5)
    expect(videos.map((v) => v.id)).toEqual(['A', 'B'])
    expect(mockSearchList.mock.calls[0]![0]).toMatchObject({ channelId: 'CHANNEL1', maxResults: 5 })
    expect(mockVideosList.mock.calls[0]![0].id).toEqual(['A', 'B'])
  })

  it('returns [] and skips the hydrate call when the search is empty', async () => {
    mockSearchList.mockResolvedValue({ data: { items: [] } })
    await expect(listVideos({ accessToken: 'tok' }, 'CHANNEL1')).resolves.toEqual([])
    expect(mockVideosList).not.toHaveBeenCalled()
  })
})
