import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DualClockCards } from '../../src/app/cms/(authed)/settings/_components/dual-clock-cards'

describe('DualClockCards', () => {
  it('renders without crashing', () => {
    render(<DualClockCards siteTimezone="America/Sao_Paulo" />)
    expect(screen.queryByTestId('dual-clock-cards')).not.toBeNull()
  })

  it('shows site time and your time labels', () => {
    render(<DualClockCards siteTimezone="America/Sao_Paulo" />)
    expect(screen.queryByText('Site time now')).not.toBeNull()
    expect(screen.queryByText('Your time now')).not.toBeNull()
  })

  it('shows offset message when timezones differ', () => {
    render(<DualClockCards siteTimezone="Asia/Tokyo" />)
    const container = screen.getByTestId('dual-clock-cards')
    const text = container.textContent ?? ''
    expect(text).toMatch(/ahead|behind|matches/)
  })

  it('renders with UTC timezone', () => {
    render(<DualClockCards siteTimezone="UTC" />)
    expect(screen.queryByTestId('dual-clock-cards')).not.toBeNull()
    expect(screen.queryByText('Site time now')).not.toBeNull()
  })
})
