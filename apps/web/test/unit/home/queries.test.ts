import { describe, it, expect } from 'vitest'
import type { HomeTag, HomeVideo } from '../../../lib/home/types'

describe('HomeTag type', () => {
  it('has required fields', () => {
    const tag: HomeTag = {
      id: 'uuid-1', name: 'tech', slug: 'tech',
      color: '#6366f1', colorDark: '#818cf8', postCount: 3,
    }
    expect(tag.id).toBe('uuid-1')
    expect(tag.name).toBe('tech')
    expect(tag.postCount).toBe(3)
  })

  it('allows null colorDark', () => {
    const tag: HomeTag = {
      id: 'uuid-2', name: 'vida', slug: 'vida',
      color: '#22c55e', colorDark: null, postCount: 1,
    }
    expect(tag.colorDark).toBeNull()
  })
})

describe('HomeVideo type', () => {
  it('includes isPinned field', () => {
    const video: HomeVideo = {
      id: 'v1', locale: 'en', title: 'Test', description: 'desc',
      thumbnailUrl: null, duration: '5:00', viewCount: 100,
      publishedAt: '2026-01-01', categoryName: null, categoryColor: null,
      youtubeUrl: 'https://youtube.com/watch?v=abc', channelHandle: '@test',
      youtubeVideoId: 'abc', isPinned: true,
    }
    expect(video.isPinned).toBe(true)
  })

  it('isPinned defaults to false for unpinned videos', () => {
    const video: HomeVideo = {
      id: 'v2', locale: 'pt-BR', title: 'Test PT', description: '',
      thumbnailUrl: null, duration: '3:00', viewCount: 50,
      publishedAt: '2026-01-02', categoryName: null, categoryColor: null,
      youtubeUrl: 'https://youtube.com/watch?v=def', channelHandle: '@test',
      youtubeVideoId: 'def', isPinned: false,
    }
    expect(video.isPinned).toBe(false)
  })
})
