import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { VideoGrid } from '../../../src/app/(public)/components/VideoGrid'

const mockT: Record<string, string> = {
  'home.youtube.title': 'YouTube', 'home.youtube.subtitle': 'the 3 most recent',
  'home.youtube.viewAll': 'see all on YouTube →', 'home.youtube.subscribe': '▶ subscribe on yt',
}
const makeVideo = (i: number) => ({
  id: `v${i}`, locale: 'en' as const, title: `Video ${i}`,
  description: `Desc ${i}`, thumbnailUrl: null, duration: `${10+i}:00`,
  viewCount: '1.2k', publishedAt: `2026-05-0${i}`, series: 'Dev',
  youtubeUrl: 'https://youtube.com/@test',
})

describe('VideoGrid', () => {
  it('renders nothing when 0 videos', () => {
    const { container } = render(<VideoGrid videos={[]} locale="en" t={mockT} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders cards', () => {
    const { getAllByRole } = render(<VideoGrid videos={[1,2,3].map(makeVideo)} locale="en" t={mockT} />)
    expect(getAllByRole('heading', { level: 3 }).length).toBe(3)
  })

  it('renders subscribe CTA', () => {
    const { getByText } = render(<VideoGrid videos={[makeVideo(1)]} locale="en" t={mockT} />)
    expect(getByText('▶ subscribe on yt')).toBeDefined()
  })
})
