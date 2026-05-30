import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Spark } from './spark'
import { BarChart } from './bar-chart'
import { Donut } from './donut'
import { HBars } from './hbars'
import { Delta } from './delta'
import { Heatmap } from './heatmap'
import { CountryList } from './country-list'
import { FunnelChart } from './funnel-chart'

describe('Chart edge cases', () => {
  describe('Spark with extreme data', () => {
    it('handles negative values without crashing', () => {
      const { container } = render(<Spark data={[-10, 5, -3, 20]} color="#F2683C" />)
      expect(container.querySelector('svg')).toBeTruthy()
    })

    it('handles very large values', () => {
      const { container } = render(<Spark data={[1e9, 2e9, 1.5e9]} color="#F2683C" />)
      expect(container.querySelector('svg')).toBeTruthy()
    })

    it('handles NaN in data gracefully', () => {
      const { container } = render(<Spark data={[1, NaN, 3]} color="#F2683C" />)
      expect(container.querySelector('svg')).toBeTruthy()
    })

    it('handles Infinity in data gracefully', () => {
      const { container } = render(<Spark data={[1, Infinity, 3]} color="#F2683C" />)
      expect(container.querySelector('svg')).toBeTruthy()
    })

    it('handles all-identical values', () => {
      const { container } = render(<Spark data={[42, 42, 42, 42]} color="#F2683C" />)
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      // rng = max - min || 1 = 0 || 1 = 1, so no division by zero
      expect(container.querySelector('circle')).toBeTruthy()
    })
  })

  describe('BarChart with extreme data', () => {
    it('handles negative values', () => {
      const { container } = render(<BarChart data={[-5, 10, -3]} />)
      const bars = container.querySelectorAll('[data-bar]')
      expect(bars.length).toBe(3)
    })

    it('handles single data point', () => {
      const { container } = render(<BarChart data={[42]} />)
      expect(container.querySelectorAll('[data-bar]').length).toBe(1)
    })

    it('handles mismatched prev length (shorter prev)', () => {
      const { container } = render(<BarChart data={[10, 20, 30]} prev={[5]} />)
      // Only prev[0] is non-null, so 1 prev bar + 3 data bars
      expect(container.querySelectorAll('[data-bar]').length).toBe(3)
      expect(container.querySelectorAll('[data-prev-bar]').length).toBe(1)
    })

    it('handles very large values without breaking layout', () => {
      const { container } = render(<BarChart data={[1e12, 2e12, 500]} />)
      expect(container.querySelectorAll('[data-bar]').length).toBe(3)
    })
  })

  describe('Donut with edge segments', () => {
    it('handles segment with value 0', () => {
      const segs = [
        { k: 'A', v: 100, color: '#f00' },
        { k: 'B', v: 0, color: '#0f0' },
      ]
      const { container } = render(<Donut segments={segs} />)
      expect(container.querySelectorAll('circle').length).toBe(2)
    })

    it('handles all-zero segments without division by zero', () => {
      const segs = [
        { k: 'A', v: 0, color: '#f00' },
        { k: 'B', v: 0, color: '#0f0' },
      ]
      const { container } = render(<Donut segments={segs} />)
      // total = 0 || 1 = 1, so no NaN
      expect(container.querySelector('svg')).toBeTruthy()
    })

    it('handles single segment covering full ring', () => {
      const segs = [{ k: 'Only', v: 100, color: '#f00' }]
      const { container } = render(<Donut segments={segs} />)
      const circle = container.querySelector('circle')
      expect(circle).toBeTruthy()
    })
  })

  describe('HBars edge cases', () => {
    it('handles all-zero values', () => {
      const { container } = render(
        <HBars rows={[{ k: 'A', v: 0 }, { k: 'B', v: 0 }]} />,
      )
      expect(container.querySelectorAll('[data-hbar-row]').length).toBe(2)
      // max = Math.max(0, 0, 1) = 1, so no division by zero
      const fills = container.querySelectorAll('[data-hbar-fill]')
      expect(fills[0]?.getAttribute('aria-valuenow')).toBe('0')
    })

    it('handles single row', () => {
      const { container } = render(<HBars rows={[{ k: 'Only', v: 50 }]} />)
      expect(container.querySelectorAll('[data-hbar-row]').length).toBe(1)
    })

    it('handles very large value', () => {
      const { container } = render(
        <HBars rows={[{ k: 'Big', v: 999999 }]} suffix="" />,
      )
      expect(container.textContent).toContain('999999')
    })
  })

  describe('Delta edge cases', () => {
    it('handles very large positive change', () => {
      const { container } = render(<Delta cur={10000} prev={1} />)
      expect(container.textContent).toContain('+')
    })

    it('handles very large negative change', () => {
      const { container } = render(<Delta cur={1} prev={10000} />)
      // pct = Math.round(((1-10000)/10000)*100) = -100
      expect(container.textContent).toContain('-')
    })

    it('handles equal values showing +0%', () => {
      const { container } = render(<Delta cur={50} prev={50} />)
      // pct = 0, up = true (>=0), so renders "+0%"
      expect(container.textContent).toContain('+0%')
    })

    it('handles cur=0 prev=0 as 100%', () => {
      // prev === 0 triggers special case: pct = 100
      const { container } = render(<Delta cur={0} prev={0} />)
      expect(container.textContent).toContain('+100%')
    })

    it('handles fractional results rounding', () => {
      // (153-100)/100 * 100 = 53
      const { container } = render(<Delta cur={153} prev={100} />)
      expect(container.textContent).toContain('+53%')
    })
  })

  describe('Heatmap edge cases', () => {
    it('handles grid with fewer than 7 rows', () => {
      const grid = Array.from({ length: 3 }, () =>
        Array.from({ length: 24 }, () => 0),
      )
      const { container } = render(<Heatmap grid={grid} />)
      expect(container.querySelectorAll('[data-day-row]').length).toBe(3)
    })

    it('handles grid with fewer than 24 cols', () => {
      const grid = [Array.from({ length: 12 }, () => 1)]
      const { container } = render(<Heatmap grid={grid} />)
      expect(container.querySelectorAll('[data-cell]').length).toBe(12)
    })

    it('handles grid with values exceeding shade range', () => {
      // SHADES has indices 0..4, values > 4 hit Math.min(v, 4)
      const grid = [[10, 999, ...Array(22).fill(0)]]
      const { container } = render(<Heatmap grid={grid} />)
      const cells = container.querySelectorAll('[data-cell]')
      expect(cells.length).toBe(24)
    })

    it('handles single-cell grid', () => {
      const grid = [[2]]
      const { container } = render(<Heatmap grid={grid} />)
      expect(container.querySelectorAll('[data-cell]').length).toBe(1)
    })
  })

  describe('CountryList edge cases', () => {
    it('handles unknown country code with globe fallback', () => {
      const { container } = render(
        <CountryList
          countries={[{ code: 'ZZ', name: 'Unknown', v: 10, cities: [] }]}
        />,
      )
      expect(container.textContent).toContain('\u{1F30E}')
    })

    it('handles many cities gracefully', () => {
      const cities = Array.from({ length: 20 }, (_, i) => `City${i}`)
      const { container } = render(
        <CountryList
          countries={[{ code: 'BR', name: 'Brasil', v: 100, cities }]}
        />,
      )
      expect(container.querySelector('[data-cities]')).toBeTruthy()
      // Cities are joined with ' . '
      expect(container.textContent).toContain('City0')
      expect(container.textContent).toContain('City19')
    })

    it('handles country with v=0', () => {
      const { container } = render(
        <CountryList
          countries={[{ code: 'BR', name: 'Brasil', v: 0, cities: [] }]}
        />,
      )
      // max = Math.max(0, 1) = 1, so no division by zero
      expect(container.querySelector('[data-country]')).toBeTruthy()
    })
  })

  describe('FunnelChart edge cases', () => {
    it('handles reversed funnel (step N > step N-1)', () => {
      const steps = [
        { label: 'A', value: 50, pct: 100 },
        { label: 'B', value: 100, pct: 200 },
        { label: 'C', value: 10, pct: 20 },
      ]
      const { container } = render(<FunnelChart steps={steps} />)
      expect(container.querySelectorAll('[data-funnel-bar]').length).toBe(3)
    })

    it('handles all steps at 0', () => {
      const steps = [
        { label: 'A', value: 0, pct: 0 },
        { label: 'B', value: 0, pct: 0 },
      ]
      const { container } = render(<FunnelChart steps={steps} />)
      expect(container.querySelectorAll('[data-funnel-bar]').length).toBe(2)
    })

    it('does not render percentage label inside bar when pct <= 15', () => {
      const steps = [{ label: 'Tiny', value: 5, pct: 10 }]
      const { container } = render(<FunnelChart steps={steps} />)
      const bar = container.querySelector('[data-funnel-bar]')
      // pct is 10 <= 15, so no percentage text inside bar
      expect(bar?.textContent).toBe('')
    })
  })
})
