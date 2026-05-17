import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PeriodSelector } from '@/app/cms/(authed)/analytics/_components/period-selector'

describe('PeriodSelector', () => {
  it('renders all period options with correct aria attributes', () => {
    render(
      <PeriodSelector
        activePeriod="30d"
        compareEnabled={true}
        onPeriodChange={() => {}}
        onCompareToggle={() => {}}
      />
    )

    expect(screen.getByRole('group', { name: /time period/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /7 days/i }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /30 days/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('switch', { name: /compare/i }).getAttribute('aria-checked')).toBe('true')
  })

  it('renders date range text', () => {
    render(
      <PeriodSelector
        activePeriod="30d"
        compareEnabled={false}
        onPeriodChange={() => {}}
        onCompareToggle={() => {}}
      />
    )

    expect(screen.getByText(/–/)).toBeTruthy()
  })
})
