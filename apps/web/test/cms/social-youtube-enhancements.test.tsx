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
    expect(screen.getByText('1,000 views')).toBeDefined()
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
})
