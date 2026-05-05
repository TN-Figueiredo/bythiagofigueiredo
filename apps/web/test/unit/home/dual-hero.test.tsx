import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DualHero } from '../../../src/app/(public)/components/DualHero'
import type { HomeChannel, HomeVideo } from '../../../lib/home/types'

const mockT: Record<string, string> = {
  'hero.post.mustRead': '← must-read',
  'hero.video.fresh': 'fresh →',
  'home.youtube.comingSoon': 'Coming soon',
  'home.youtube.comingSoonSub': 'Subscribe to be notified',
  'home.youtube.subscribe': 'Subscribe',
}

const mockPost = {
  id: '1', slug: 'test', locale: 'en', title: 'Test Post',
  excerpt: 'An excerpt', publishedAt: '2026-05-01', category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: true,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: '#818cf8',
}

const mockVideo: HomeVideo = {
  id: 'v1', locale: 'en' as const, title: 'Test Video',
  description: 'A video', thumbnailUrl: null, duration: '18:42',
  viewCount: 1200, publishedAt: '2026-05-01', categoryName: 'Dev Diary',
  categoryColor: null, youtubeUrl: 'https://youtube.com/watch?v=test',
  channelHandle: '@test', youtubeVideoId: 'test', isPinned: false,
}

const mockChannels: HomeChannel[] = [
  { id: 'ch1', locale: 'en', handle: '@test', url: 'https://youtube.com/@test', flag: '🌎', name: 'Test Channel', subscriberCount: 100, thumbnailUrl: null },
]

describe('DualHero', () => {
  it('renders nothing when no post and no video and no channels', () => {
    const { container } = render(
      <DualHero post={null} video={null} channels={[]} hasVideos={false} locale="en" t={mockT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders post card with tag name', () => {
    const { getByText } = render(
      <DualHero post={mockPost} video={null} channels={[]} hasVideos={false} locale="en" t={mockT} />
    )
    expect(getByText('Test Post')).toBeDefined()
    expect(getByText('tech')).toBeDefined()
  })

  it('renders video card when channels exist', () => {
    const { getByText } = render(
      <DualHero post={null} video={mockVideo} channels={mockChannels} hasVideos={true} locale="en" t={mockT} />
    )
    expect(getByText('Test Video')).toBeDefined()
    expect(getByText('18:42')).toBeDefined()
  })

  it('renders both cards', () => {
    const { getByText } = render(
      <DualHero post={mockPost} video={mockVideo} channels={mockChannels} hasVideos={true} locale="en" t={mockT} />
    )
    expect(getByText('Test Post')).toBeDefined()
    expect(getByText('Test Video')).toBeDefined()
  })
})
