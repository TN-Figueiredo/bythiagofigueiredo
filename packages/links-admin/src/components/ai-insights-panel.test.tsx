import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiInsightsPanel } from './ai-insights-panel'
import type { Insight } from '../types'

describe('AiInsightsPanel', () => {
  const insights: Insight[] = [
    {
      id: '1',
      severity: 'positive',
      title: 'Traffic Growing',
      description: '+50% clicks this week vs last week.',
      confidence: 0.85,
    },
    {
      id: '2',
      severity: 'warning',
      title: 'Source Concentration',
      description: 'Twitter drives 70% of traffic.',
      confidence: 0.72,
    },
    {
      id: '3',
      severity: 'info',
      title: 'Peak Hour',
      description: 'Most clicks happen between 14-18h UTC.',
      confidence: 0.91,
    },
  ]

  it('renders all insight cards', () => {
    render(<AiInsightsPanel insights={insights} isLoading={false} />)
    expect(screen.getByText('Traffic Growing')).toBeInTheDocument()
    expect(screen.getByText('Source Concentration')).toBeInTheDocument()
    expect(screen.getByText('Peak Hour')).toBeInTheDocument()
  })

  it('renders insight descriptions', () => {
    render(<AiInsightsPanel insights={insights} isLoading={false} />)
    expect(screen.getByText(/\+50% clicks/)).toBeInTheDocument()
    expect(screen.getByText(/Twitter drives 70%/)).toBeInTheDocument()
  })

  it('shows confidence indicator', () => {
    render(<AiInsightsPanel insights={insights} isLoading={false} />)
    expect(screen.getByText(/85%/)).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading is true', () => {
    render(<AiInsightsPanel insights={[]} isLoading={true} />)
    expect(screen.getByTestId('insights-loading')).toBeInTheDocument()
  })

  it('shows empty state when no insights and not loading', () => {
    render(<AiInsightsPanel insights={[]} isLoading={false} />)
    expect(screen.getByText(/no insights/i)).toBeInTheDocument()
  })

  it('limits display to 5 insights maximum', () => {
    const many: Insight[] = Array.from({ length: 8 }, (_, i) => ({
      id: `${i}`,
      severity: 'info' as const,
      title: `Insight ${i}`,
      description: `Description ${i}`,
      confidence: 0.5,
    }))
    render(<AiInsightsPanel insights={many} isLoading={false} />)
    expect(screen.getByText('Insight 0')).toBeInTheDocument()
    expect(screen.getByText('Insight 4')).toBeInTheDocument()
    expect(screen.queryByText('Insight 5')).not.toBeInTheDocument()
  })

  it('applies correct color for positive severity', () => {
    render(<AiInsightsPanel insights={[insights[0]]} isLoading={false} />)
    const card = screen.getByText('Traffic Growing').closest('[data-testid="insight-card"]')
    expect(card?.className).toContain('green')
  })

  it('applies correct color for warning severity', () => {
    render(<AiInsightsPanel insights={[insights[1]]} isLoading={false} />)
    const card = screen
      .getByText('Source Concentration')
      .closest('[data-testid="insight-card"]')
    expect(card?.className).toContain('amber')
  })
})
