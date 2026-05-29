import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountryList } from './country-list'

describe('CountryList', () => {
  const countries = [
    { code: 'BR', name: 'Brasil', v: 55, cities: ['Sao Paulo', 'Rio'] },
    { code: 'PT', name: 'Portugal', v: 25, cities: ['Lisboa'] },
    { code: 'US', name: 'Estados Unidos', v: 15, cities: [] },
    { code: 'XX', name: 'Outros', v: 5, cities: [] },
  ]

  it('renders one entry per country', () => {
    const { container } = render(<CountryList countries={countries} />)
    const entries = container.querySelectorAll('[data-country]')
    expect(entries.length).toBe(4)
  })

  it('renders flag emoji for known countries', () => {
    const { container } = render(<CountryList countries={countries} />)
    expect(container.textContent).toContain('\u{1F1E7}\u{1F1F7}')
    expect(container.textContent).toContain('\u{1F1F5}\u{1F1F9}')
  })

  it('renders fallback globe for unknown country codes', () => {
    const { container } = render(<CountryList countries={[{ code: 'XX', name: 'Outros', v: 5, cities: [] }]} />)
    expect(container.textContent).toContain('\u{1F30E}')
  })

  it('renders country name and percentage', () => {
    render(<CountryList countries={countries} />)
    expect(screen.getByText('Brasil')).toBeTruthy()
    expect(screen.getByText('55%')).toBeTruthy()
  })

  it('renders progress bar for each country', () => {
    const { container } = render(<CountryList countries={countries} />)
    const bars = container.querySelectorAll('[data-country-bar]')
    expect(bars.length).toBe(4)
  })

  it('renders cities when present', () => {
    render(<CountryList countries={countries} />)
    expect(screen.getByText(/Sao Paulo/)).toBeTruthy()
    expect(screen.getByText(/Rio/)).toBeTruthy()
  })

  it('does not render cities section when cities is empty', () => {
    const { container } = render(
      <CountryList countries={[{ code: 'US', name: 'USA', v: 100, cities: [] }]} />,
    )
    const citiesEl = container.querySelector('[data-cities]')
    expect(citiesEl).toBeFalsy()
  })

  it('handles empty countries array', () => {
    const { container } = render(<CountryList countries={[]} />)
    const entries = container.querySelectorAll('[data-country]')
    expect(entries.length).toBe(0)
  })

  it('sets bar width proportional to max value', () => {
    const { container } = render(
      <CountryList countries={[{ code: 'BR', name: 'BR', v: 100, cities: [] }, { code: 'US', name: 'US', v: 50, cities: [] }]} />,
    )
    const bars = container.querySelectorAll('[data-country-bar-fill]')
    expect(bars[0]?.getAttribute('style')).toContain('100%')
    expect(bars[1]?.getAttribute('style')).toContain('50%')
  })
})
