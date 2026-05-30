import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GeoMap } from './geo-map'

describe('GeoMap', () => {
  const countries = [
    { code: 'BR', name: 'Brasil', v: 55 },
    { code: 'US', name: 'Estados Unidos', v: 25 },
    { code: 'PT', name: 'Portugal', v: 15 },
  ]

  it('renders SVG element', () => {
    const { container } = render(<GeoMap countries={countries} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders circle for each known country', () => {
    const { container } = render(<GeoMap countries={countries} />)
    const circles = container.querySelectorAll('circle[data-country]')
    expect(circles.length).toBe(3)
  })

  it('sizes circles proportionally to value', () => {
    const { container } = render(<GeoMap countries={countries} />)
    const circles = container.querySelectorAll('circle[data-country]')
    const brRadius = parseFloat(circles[0]?.getAttribute('r') || '0')
    const ptRadius = parseFloat(circles[2]?.getAttribute('r') || '0')
    expect(brRadius).toBeGreaterThan(ptRadius)
  })

  it('renders accessible aria-label on SVG', () => {
    const { container } = render(<GeoMap countries={countries} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toContain('Mapa')
  })

  it('handles empty countries', () => {
    const { container } = render(<GeoMap countries={[]} />)
    const circles = container.querySelectorAll('circle[data-country]')
    expect(circles.length).toBe(0)
  })

  it('skips unknown country codes', () => {
    const { container } = render(<GeoMap countries={[{ code: 'ZZ', name: 'Unknown', v: 10 }]} />)
    const circles = container.querySelectorAll('circle[data-country]')
    expect(circles.length).toBe(0)
  })

  it('renders country name in title for tooltip', () => {
    const { container } = render(<GeoMap countries={countries} />)
    const circle = container.querySelector('circle[data-country]')
    expect(circle?.querySelector('title')?.textContent).toContain('Brasil')
  })
})
