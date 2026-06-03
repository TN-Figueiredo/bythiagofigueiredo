import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/cms/youtube/videos'),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

import { VideosTab } from '@/app/cms/(authed)/youtube/_components/videos-tab'

const mockVideos = [
  { id: 'v1', youtubeVideoId: 'yt1', title: 'Test Video', channelId: 'ch1', channelLocale: 'pt' as const, categoryId: null, suggestedCategoryId: null, isFeatured: false, isHidden: false, pinnedUntil: null, viewCount: 1000, likeCount: 50, commentCount: 10, publishedAt: '2026-05-01T00:00:00Z' },
]

describe('VideosTab', () => {
  it('renders video list', () => {
    render(<VideosTab videos={mockVideos} />)
    expect(screen.getByText('Test Video')).toBeDefined()
  })

  it('shows view count', () => {
    render(<VideosTab videos={mockVideos} />)
    expect(screen.getByText((content, element) => {
      return element?.textContent?.replace(/\s+/g, ' ').trim() === '1.000 views'
    })).toBeDefined()
  })

  it('shows "Share on Social" action', () => {
    render(<VideosTab videos={mockVideos} />)
    expect(screen.getByText('Share')).toBeDefined()
  })
})

import { SeoBreakdown } from '@/app/cms/(authed)/youtube/_components/seo-breakdown'

describe('SeoBreakdown', () => {
  it('renders SEO score', () => {
    render(<SeoBreakdown title="Test Video" description="A long description here" tags={['tag1', 'tag2']} />)
    expect(screen.getByText(/SEO Score/)).toBeDefined()
  })

  it('calculates high score for optimized content', () => {
    // Title 30-60 chars, contains power word "best", tag match, long description with timestamp and link, 10 tags
    const title = 'The Best Guide to React Testing Library'
    const description = 'A'.repeat(200) + ' 0:00 introduction https://example.com'
    const tags = ['react', 'testing', 'library', 'guide', 'javascript', 'frontend', 'vitest', 'best', 'tutorial', 'web']
    render(<SeoBreakdown title={title} description={description} tags={tags} />)
    // All rules pass: 15+15+15+10+7+5+10 = 77/77 = 100
    expect(screen.getByText('100/100')).toBeDefined()
  })

  it('calculates low score for poor content', () => {
    // Short title (< 30 chars), no timestamps, no matching tags, short desc, no power words, no links, few tags
    const title = 'Short'
    const description = 'Nothing here'
    const tags = ['unrelated']
    render(<SeoBreakdown title={title} description={description} tags={tags} />)
    // All rules fail: 0/77 = 0
    expect(screen.getByText('0/100')).toBeDefined()
  })

  it('shows pass/fail indicators for each rule', () => {
    render(<SeoBreakdown title="Test" description="Short" tags={['tag1']} />)
    // Each rule is rendered with a label
    expect(screen.getByText('Title length 30-60 chars')).toBeDefined()
    expect(screen.getByText('Description has timestamps')).toBeDefined()
    expect(screen.getByText('Keywords in title match tags')).toBeDefined()
    expect(screen.getByText('Description 200+ chars')).toBeDefined()
    expect(screen.getByText('Power words in title')).toBeDefined()
    expect(screen.getByText('Links in description')).toBeDefined()
    expect(screen.getByText('8-15 tags')).toBeDefined()
  })
})

describe('VideosTab — empty list', () => {
  it('renders no video rows when list is empty', () => {
    render(<VideosTab videos={[]} />)
    // Column headers should still appear
    expect(screen.getByText('Video')).toBeDefined()
    expect(screen.getByText('Stats')).toBeDefined()
    // But no video titles
    expect(screen.queryByText('Test Video')).toBeNull()
  })
})

describe('VideosTab — grade badges', () => {
  it('shows A+ grade for video with >10000 views', () => {
    const video = { ...mockVideos[0], id: 'v-high', viewCount: 15000 }
    render(<VideosTab videos={[video]} />)
    expect(screen.getByText('A+')).toBeDefined()
  })

  it('shows B+ grade for video with 1001-10000 views', () => {
    const video = { ...mockVideos[0], id: 'v-mid', viewCount: 5000 }
    render(<VideosTab videos={[video]} />)
    expect(screen.getByText('B+')).toBeDefined()
  })

  it('shows C grade for video with ≤1000 views', () => {
    const video = { ...mockVideos[0], id: 'v-low', viewCount: 500 }
    render(<VideosTab videos={[video]} />)
    expect(screen.getByText('C')).toBeDefined()
  })
})
