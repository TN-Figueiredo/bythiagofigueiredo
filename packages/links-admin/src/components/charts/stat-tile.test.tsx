import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatTile } from './stat-tile'

describe('StatTile', () => {
  it('renders label and value', () => {
    render(<StatTile label="Cliques" value="1,234" />)
    expect(screen.getByText('Cliques')).toBeTruthy()
    expect(screen.getByText('1,234')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<StatTile label="CTR" value="4.2%" sub="cliques / pageviews" />)
    expect(screen.getByText('cliques / pageviews')).toBeTruthy()
  })

  it('renders icon container with tint background', () => {
    const { container } = render(
      <StatTile label="Cliques" value="100" icon="links" iconTint="#F2683C" />,
    )
    const iconWrap = container.querySelector('[data-icon]')
    expect(iconWrap).toBeTruthy()
    const style = iconWrap?.getAttribute('style') ?? ''
    expect(style.includes('#F2683C') || style.includes('242, 104, 60')).toBe(true)
  })

  it('renders delta slot when provided', () => {
    const delta = <span data-testid="delta">+15%</span>
    render(<StatTile label="Cliques" value="100" delta={delta} />)
    expect(screen.getByTestId('delta')).toBeTruthy()
  })

  it('renders sparkline slot when provided', () => {
    const spark = <svg data-testid="spark" />
    render(<StatTile label="Cliques" value="100" spark={spark} />)
    expect(screen.getByTestId('spark')).toBeTruthy()
  })

  it('renders without optional props', () => {
    const { container } = render(<StatTile label="Links" value="42" />)
    expect(container.querySelector('[data-icon]')).toBeFalsy()
  })

  it('renders as a card with data-stat-tile marker', () => {
    const { container } = render(<StatTile label="Test" value="0" />)
    expect(container.querySelector('[data-stat-tile]')).toBeTruthy()
  })
})
