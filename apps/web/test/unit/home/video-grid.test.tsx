import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { VideoGrid } from '../../../src/app/(public)/components/VideoGrid'
import type { HomeChannel, HomeVideo } from '../../../lib/home/types'

const mockT: Record<string, string> = {
  'home.youtube.title': 'YouTube', 'home.youtube.subtitle': 'the 3 most recent',
  'home.youtube.viewAll': 'see all on YouTube →', 'home.youtube.subscribe': '▶ subscribe on yt',
  'home.youtube.comingSoon': 'Videos coming soon',
  'home.youtube.comingSoonSub': 'Subscribe to be notified',
}
const mockChannels: HomeChannel[] = [
  { id: 'ch1', locale: 'en', handle: '@test', url: 'https://youtube.com/@test', flag: '🌎', name: 'Test Channel', subscriberCount: 100, thumbnailUrl: null },
]
const makeVideo = (i: number): HomeVideo => ({
  id: `v${i}`, locale: 'en' as const, title: `Video ${i}`,
  description: `Desc ${i}`, thumbnailUrl: null, duration: `${10+i}:00`,
  viewCount: 1200, publishedAt: `2026-05-0${i}`, categoryName: 'Dev',
  categoryColor: null, youtubeUrl: 'https://youtube.com/@test',
  channelHandle: '@test', youtubeVideoId: `yt${i}`, isPinned: false,
})

describe('VideoGrid', () => {
  it('renders nothing when no channels', () => {
    const { container } = render(<VideoGrid videos={[makeVideo(1)]} channels={[]} hasVideos={true} locale="en" t={mockT} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders coming-soon when hasVideos=false', () => {
    const { getByText } = render(<VideoGrid videos={[]} channels={mockChannels} hasVideos={false} locale="en" t={mockT} />)
    expect(getByText('Videos coming soon')).toBeDefined()
  })

  it('renders cards', () => {
    const { getAllByRole } = render(<VideoGrid videos={[1,2,3].map(makeVideo)} channels={mockChannels} hasVideos={true} locale="en" t={mockT} />)
    expect(getAllByRole('heading', { level: 3 }).length).toBe(3)
  })

  it('renders subscribe CTA', () => {
    const { getByText } = render(<VideoGrid videos={[makeVideo(1)]} channels={mockChannels} hasVideos={true} locale="en" t={mockT} />)
    expect(getByText(/subscribe on yt/i)).toBeDefined()
  })
})
