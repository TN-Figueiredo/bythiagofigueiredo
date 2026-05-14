import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBlobPut = vi.fn()
const mockBlobDel = vi.fn()
const mockIgMedia = vi.fn()
const mockIgPublish = vi.fn()
const mockIgStatus = vi.fn()

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockBlobPut(...args),
  del: (...args: unknown[]) => mockBlobDel(...args),
}))

import {
  prepareReelUpload,
  shouldSkipReel,
  publishReel,
  cleanupReelBlob,
} from '@/lib/social/reel-pipeline'

describe('reel-pipeline', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('shouldSkipReel', () => {
    it('returns false for video <= 90s', () => {
      expect(shouldSkipReel(90)).toBe(false)
    })

    it('returns true for video < 3s', () => {
      expect(shouldSkipReel(2)).toBe(true)
    })

    it('returns true for video > 90s', () => {
      expect(shouldSkipReel(91)).toBe(true)
    })

    it('returns true for video exactly 0s', () => {
      expect(shouldSkipReel(0)).toBe(true)
    })
  })

  describe('prepareReelUpload', () => {
    beforeEach(() => {
      mockBlobPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/reel-123.mp4' })
    })

    it('uploads video to Vercel Blob', async () => {
      const result = await prepareReelUpload(Buffer.from('fake-video-bytes'), 'post-123')
      expect(mockBlobPut).toHaveBeenCalledWith(
        'social/reels/post-123.mp4',
        expect.anything(),
        expect.objectContaining({ access: 'public', addRandomSuffix: true }),
      )
      expect(result.blobUrl).toBe('https://blob.vercel-storage.com/reel-123.mp4')
    })
  })

  describe('publishReel', () => {
    it('creates container, polls status, and publishes', async () => {
      mockIgMedia.mockResolvedValue({ id: 'container-1' })
      mockIgStatus
        .mockResolvedValueOnce({ status_code: 'IN_PROGRESS' })
        .mockResolvedValueOnce({ status_code: 'FINISHED' })
      mockIgPublish.mockResolvedValue({ id: 'reel-published-1' })

      const result = await publishReel({
        igUserId: 'ig-user-1',
        accessToken: 'token',
        blobUrl: 'https://blob.vercel-storage.com/reel-123.mp4',
        caption: 'Check this out!',
        createContainer: mockIgMedia,
        getContainerStatus: mockIgStatus,
        publishContainer: mockIgPublish,
        pollIntervalMs: 0,
      })

      expect(result.publishedId).toBe('reel-published-1')
      expect(mockIgMedia).toHaveBeenCalledWith(expect.objectContaining({
        media_type: 'REELS',
        video_url: 'https://blob.vercel-storage.com/reel-123.mp4',
      }))
      expect(mockIgStatus).toHaveBeenCalledTimes(2)
    })

    it('throws after max poll attempts', async () => {
      mockIgMedia.mockResolvedValue({ id: 'container-1' })
      mockIgStatus.mockResolvedValue({ status_code: 'IN_PROGRESS' })

      await expect(
        publishReel({
          igUserId: 'ig-user-1',
          accessToken: 'token',
          blobUrl: 'https://blob.vercel-storage.com/reel.mp4',
          caption: 'test',
          createContainer: mockIgMedia,
          getContainerStatus: mockIgStatus,
          publishContainer: mockIgPublish,
          maxPollAttempts: 3,
          pollIntervalMs: 10,
        }),
      ).rejects.toThrow(/container processing timed out/i)
    })
  })

  describe('cleanupReelBlob', () => {
    it('deletes blob by URL', async () => {
      mockBlobDel.mockResolvedValue(undefined)
      await cleanupReelBlob('https://blob.vercel-storage.com/reel-123.mp4')
      expect(mockBlobDel).toHaveBeenCalledWith('https://blob.vercel-storage.com/reel-123.mp4')
    })
  })
})
