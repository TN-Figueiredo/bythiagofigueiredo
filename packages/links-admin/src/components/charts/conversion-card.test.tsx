import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConversionCard } from './conversion-card'

describe('ConversionCard', () => {
  it('renders goal name', () => {
    render(<ConversionCard name="Newsletter Signup" rate={25} progress={0.25} label="25.0%" views={1000} conversions={250} />)
    expect(screen.getByText('Newsletter Signup')).toBeTruthy()
  })

  it('renders conversion rate label', () => {
    render(<ConversionCard name="Test" rate={15} progress={0.15} label="15.0%" views={200} conversions={30} />)
    expect(screen.getByText('15.0%')).toBeTruthy()
  })

  it('renders progress bar', () => {
    const { container } = render(<ConversionCard name="Test" rate={50} progress={0.5} label="50.0%" views={100} conversions={50} />)
    const bar = container.querySelector('[data-progress-fill]')
    expect(bar).toBeTruthy()
    expect(bar?.getAttribute('style')).toContain('50%')
  })

  it('renders views and conversions counts', () => {
    const { container } = render(<ConversionCard name="Test" rate={10} progress={0.1} label="10.0%" views={5000} conversions={500} />)
    expect(container.textContent).toContain('5000')
    expect(container.textContent).toContain('500')
  })

  it('renders as a card with data-conversion marker', () => {
    const { container } = render(<ConversionCard name="Test" rate={0} progress={0} label="0.0%" views={0} conversions={0} />)
    expect(container.querySelector('[data-conversion]')).toBeTruthy()
  })
})
