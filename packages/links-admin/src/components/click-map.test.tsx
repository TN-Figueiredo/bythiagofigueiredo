import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClickMap } from './click-map'
import type { GeoDataItem } from '../types'

describe('ClickMap', () => {
  const geoData: GeoDataItem[] = [
    { country: 'BR', count: 500 },
    { country: 'US', count: 200 },
    { country: 'DE', count: 100 },
    { country: 'JP', count: 50 },
  ]

  it('renders SVG world map container', () => {
    render(<ClickMap geoData={geoData} />)
    expect(screen.getByTestId('click-map')).toBeInTheDocument()
    expect(screen.getByTestId('click-map').tagName.toLowerCase()).toBe('svg')
  })

  it('highlights countries with data', () => {
    render(<ClickMap geoData={geoData} />)
    const map = screen.getByTestId('click-map')
    const highlighted = map.querySelectorAll('[data-country]')
    const countryIds = Array.from(highlighted).map((el) => el.getAttribute('data-country'))
    expect(countryIds).toContain('BR')
    expect(countryIds).toContain('US')
  })

  it('applies intensity-based fill to countries', () => {
    render(<ClickMap geoData={geoData} />)
    const map = screen.getByTestId('click-map')
    const br = map.querySelector('[data-country="BR"]')
    const jp = map.querySelector('[data-country="JP"]')
    const brOpacity = br?.getAttribute('fill-opacity')
    const jpOpacity = jp?.getAttribute('fill-opacity')
    expect(Number(brOpacity)).toBeGreaterThan(Number(jpOpacity))
  })

  it('shows tooltip on country hover with count', () => {
    render(<ClickMap geoData={geoData} />)
    const map = screen.getByTestId('click-map')
    const br = map.querySelector('[data-country="BR"]')!
    fireEvent.mouseEnter(br)
    expect(screen.getByText(/BR: 500 clicks/)).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', () => {
    render(<ClickMap geoData={geoData} />)
    const map = screen.getByTestId('click-map')
    const br = map.querySelector('[data-country="BR"]')!
    fireEvent.mouseEnter(br)
    expect(screen.getByText(/BR: 500 clicks/)).toBeInTheDocument()
    fireEvent.mouseLeave(br)
    expect(screen.queryByText(/BR: 500 clicks/)).not.toBeInTheDocument()
  })

  it('renders gracefully with empty data', () => {
    render(<ClickMap geoData={[]} />)
    expect(screen.getByTestId('click-map')).toBeInTheDocument()
  })

  it('renders legend with min/max labels', () => {
    render(<ClickMap geoData={geoData} />)
    const legendTexts = screen.getAllByText(/^(0|500)$/)
    expect(legendTexts.length).toBeGreaterThanOrEqual(2)
  })
})
