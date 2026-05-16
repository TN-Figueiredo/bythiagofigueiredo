import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentFunnel } from '@/app/cms/(authed)/analytics/_components/content-funnel'
import type { FunnelData } from '@/app/cms/(authed)/analytics/types'

const mockFunnel: FunnelData = {
  views: 1000,
  read50: 400,
  clickedLink: 150,
  nlOpened: 80,
  subscribed: 25,
}

describe('ContentFunnel', () => {
  it('renders all 5 funnel stages', () => {
    render(<ContentFunnel funnel={mockFunnel} />)
    expect(screen.getByTestId('content-funnel')).toBeTruthy()
    expect(screen.getByTestId('funnel-stage-views')).toBeTruthy()
    expect(screen.getByTestId('funnel-stage-read50')).toBeTruthy()
    expect(screen.getByTestId('funnel-stage-clickedLink')).toBeTruthy()
    expect(screen.getByTestId('funnel-stage-nlOpened')).toBeTruthy()
    expect(screen.getByTestId('funnel-stage-subscribed')).toBeTruthy()
  })

  it('displays formatted values', () => {
    render(<ContentFunnel funnel={mockFunnel} />)
    expect(screen.getByTestId('funnel-stage-views').textContent).toContain('1.0k')
    expect(screen.getByTestId('funnel-stage-read50').textContent).toContain('400')
    expect(screen.getByTestId('funnel-stage-clickedLink').textContent).toContain('150')
  })

  it('shows drop-off percentages between stages', () => {
    const { container } = render(<ContentFunnel funnel={mockFunnel} />)
    // Views → Read50: (1000-400)/1000 = 60%
    expect(container.textContent).toContain('-60%')
  })

  it('handles zero values gracefully', () => {
    const zeroFunnel: FunnelData = { views: 0, read50: 0, clickedLink: 0, nlOpened: 0, subscribed: 0 }
    render(<ContentFunnel funnel={zeroFunnel} />)
    expect(screen.getByTestId('content-funnel')).toBeTruthy()
  })

  it('displays stage labels', () => {
    render(<ContentFunnel funnel={mockFunnel} />)
    expect(screen.getByText('Views')).toBeTruthy()
    expect(screen.getByText('Read 50%+')).toBeTruthy()
    expect(screen.getByText('Clicked Link')).toBeTruthy()
    expect(screen.getByText('NL Opened')).toBeTruthy()
    expect(screen.getByText('Subscribed')).toBeTruthy()
  })
})
