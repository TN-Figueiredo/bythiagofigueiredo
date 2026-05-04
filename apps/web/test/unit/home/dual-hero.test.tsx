import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DualHero } from '../../../src/app/(public)/components/DualHero'

const mockT: Record<string, string> = {
  'hero.post.mustRead': '← must-read',
  'hero.video.fresh': 'fresh →',
  'hero.comingSoon': 'Coming soon',
}

const mockPost = {
  id: '1', slug: 'test', locale: 'en', title: 'Test Post',
  excerpt: 'An excerpt', publishedAt: '2026-05-01', category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: true,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: '#818cf8',
}

const mockVideo = {
  id: 'v1', locale: 'en' as const, title: 'Test Video',
  description: 'A video', thumbnailUrl: null, duration: '18:42',
  viewCount: '1.2k', publishedAt: '2026-05-01', series: 'Dev Diary',
  youtubeUrl: 'https://youtube.com/watch?v=test',
}

describe('DualHero', () => {
  it('renders nothing when no post and no video', () => {
    const { container } = render(
      <DualHero post={null} video={null} locale="en" t={mockT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders post card with tag name', () => {
    const { getByText } = render(
      <DualHero post={mockPost} video={null} locale="en" t={mockT} />
    )
    expect(getByText('Test Post')).toBeDefined()
    expect(getByText('tech')).toBeDefined()
  })

  it('renders video card', () => {
    const { getByText } = render(
      <DualHero post={null} video={mockVideo} locale="en" t={mockT} />
    )
    expect(getByText('Test Video')).toBeDefined()
    expect(getByText('18:42')).toBeDefined()
  })

  it('renders both cards', () => {
    const { getByText } = render(
      <DualHero post={mockPost} video={mockVideo} locale="en" t={mockT} />
    )
    expect(getByText('Test Post')).toBeDefined()
    expect(getByText('Test Video')).toBeDefined()
  })
})
