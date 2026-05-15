import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlogHealthSection, type BlogHealthData } from '@/app/cms/(authed)/_components/dashboard-blog-health'

describe('BlogHealthSection', () => {
  const mockData: BlogHealthData = {
    totalPosts: 12,
    totalPostsTrend: 15.2,
    published: 8,
    publishedTrend: 20.0,
    avgReadingTime: 6,
    avgReadingTimeTrend: -5.3,
    draftBacklog: 4,
    draftBacklogTrend: 10.0,
    tagBreakdown: [
      { tagName: 'Behind the Scenes', tagColor: '#ef4444', count: 5 },
      { tagName: 'Control', tagColor: '#3b82f6', count: 3 },
    ],
    velocitySparkline: [2, 3, 1, 4, 3, 2, 5, 4],
    recentPublications: [
      { id: '1', title: 'Test Post', tagName: 'BtS', tagColor: '#ef4444', publishedAt: '2026-05-10T00:00:00Z' },
    ],
  }

  it('renders KPI values', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
  })

  it('renders tag breakdown', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('Behind the Scenes')).toBeTruthy()
    expect(screen.getByText('Control')).toBeTruthy()
  })

  it('renders recent publications', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('Test Post')).toBeTruthy()
  })

  it('renders the blog-health testid wrapper', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByTestId('blog-health')).toBeTruthy()
  })

  it('renders positive trend in green', () => {
    render(<BlogHealthSection data={mockData} />)
    // totalPostsTrend = +15.2% should appear with +
    expect(screen.getByText('+15.2%')).toBeTruthy()
  })

  it('renders negative trend in red', () => {
    render(<BlogHealthSection data={mockData} />)
    // avgReadingTimeTrend = -5.3%
    expect(screen.getByText('-5.3%')).toBeTruthy()
  })

  it('renders avg reading time with min suffix', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('6 min')).toBeTruthy()
  })

  it('renders draft backlog count', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('renders velocity sparkline section when data has >= 2 values', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('Velocity')).toBeTruthy()
  })

  it('does not render velocity section when sparkline has fewer than 2 values', () => {
    const data = { ...mockData, velocitySparkline: [3] }
    render(<BlogHealthSection data={data} />)
    expect(screen.queryByText('Velocity')).toBeNull()
  })

  it('does not render recent section when recentPublications is empty', () => {
    const data = { ...mockData, recentPublications: [] }
    render(<BlogHealthSection data={data} />)
    expect(screen.queryByText('Recent')).toBeNull()
  })
})
