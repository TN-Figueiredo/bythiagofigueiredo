import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UtmPanel } from './utm-panel'

describe('UtmPanel', () => {
  const data = [
    { key: 'google', clicks: 100, pct: 50 },
    { key: 'twitter', clicks: 60, pct: 30 },
    { key: '(direct)', clicks: 40, pct: 20 },
  ]

  it('renders title "UTM Attribution"', () => {
    render(<UtmPanel data={data} />)
    expect(screen.getByText('UTM Attribution')).toBeTruthy()
  })

  it('renders 3 dimension tabs', () => {
    render(<UtmPanel data={data} />)
    expect(screen.getByText('Source')).toBeTruthy()
    expect(screen.getByText('Medium')).toBeTruthy()
    expect(screen.getByText('Campaign')).toBeTruthy()
  })

  it('renders data rows', () => {
    render(<UtmPanel data={data} />)
    expect(screen.getByText('google')).toBeTruthy()
    expect(screen.getByText('twitter')).toBeTruthy()
  })

  it('calls onDimensionChange when tab clicked', () => {
    const onChange = vi.fn()
    render(<UtmPanel data={data} onDimensionChange={onChange} />)
    fireEvent.click(screen.getByText('Medium'))
    expect(onChange).toHaveBeenCalledWith('medium')
  })

  it('renders empty state when no data', () => {
    render(<UtmPanel data={[]} />)
    expect(screen.getByText(/sem dados/i)).toBeTruthy()
  })

  it('shows percentages', () => {
    const { container } = render(<UtmPanel data={data} />)
    expect(container.textContent).toContain('50%')
  })
})
