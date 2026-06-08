import { describe, it, expect } from 'vitest'
import { abPublishCtaState } from '@/lib/pipeline/video-ab-precondition'

describe('abPublishCtaState (derived from content_pipeline ⋈ youtube_videos join)', () => {
  it('disabled + link tooltip when youtube_video_id is null', () => {
    const s = abPublishCtaState({ youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null }, 'pipe-1')
    expect(s.enabled).toBe(false)
    expect(s.tooltip).toBe('Vincule o vídeo do YouTube primeiro')
    expect(s.deepLink).toBe('/cms/youtube/ab-lab/new?pipeline=pipe-1')
  })
  it('disabled + sync-thumbnail tooltip when FK set but thumbnail null', () => {
    const s = abPublishCtaState({ youtubeVideoId: 'yt-1', thumbnailHqUrl: null, durationSeconds: 300 }, 'pipe-1')
    expect(s.enabled).toBe(false)
    expect(s.tooltip).toBe('Sincronize a thumbnail do YouTube primeiro')
    expect(s.deepLink).toBe('/cms/youtube/ab-lab/new?pipeline=pipe-1')
  })
  it('disabled + Short tooltip when duration <= 60', () => {
    const s = abPublishCtaState({ youtubeVideoId: 'yt-1', thumbnailHqUrl: 'https://x/t.jpg', durationSeconds: 60 }, 'pipe-1')
    expect(s.enabled).toBe(false)
    expect(s.tooltip).toBe('Testes A/B não se aplicam a Shorts (≤60s)')
    expect(s.deepLink).toBeNull()
  })
  it('enabled when all three preconditions pass (>60s, thumbnail present, FK set)', () => {
    const s = abPublishCtaState({ youtubeVideoId: 'yt-1', thumbnailHqUrl: 'https://x/t.jpg', durationSeconds: 61 }, 'pipe-1')
    expect(s.enabled).toBe(true)
    expect(s.tooltip).toBeNull()
    expect(s.deepLink).toBeNull()
  })
})
