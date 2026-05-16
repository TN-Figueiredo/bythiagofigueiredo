import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WaveformDisplay } from '@/app/cms/(authed)/pipeline/audio/_components/waveform-display'

describe('WaveformDisplay', () => {
  describe('variant="table"', () => {
    it('renders SVG with correct dimensions', () => {
      const { container } = render(
        <WaveformDisplay variant="table" peaks={[0.5, 0.8, 0.3]} />
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg?.getAttribute('width')).toBe('56')
      expect(svg?.getAttribute('height')).toBe('20')
    })

    it('renders flat line shimmer when peaks empty', () => {
      const { container } = render(
        <WaveformDisplay variant="table" peaks={[]} />
      )
      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBe(1)
    })

    it('renders 14 bar groups when peaks provided', () => {
      const peaks = Array.from({ length: 50 }, (_, i) => i / 50)
      const { container } = render(
        <WaveformDisplay variant="table" peaks={peaks} />
      )
      const groups = container.querySelectorAll('g')
      expect(groups.length).toBe(14)
    })
  })

  describe('variant="card"', () => {
    it('renders shimmer bars when peaks empty', () => {
      const { container } = render(
        <WaveformDisplay variant="card" peaks={[]} />
      )
      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBe(17) // SHIMMER_HEIGHTS_CARD length
    })

    it('renders waveform bars when peaks provided', () => {
      const peaks = Array.from({ length: 50 }, (_, i) => i / 50)
      const { container } = render(
        <WaveformDisplay variant="card" peaks={peaks} />
      )
      const groups = container.querySelectorAll('g')
      expect(groups.length).toBe(32) // defaultBars for card
    })

    it('applies energy gradient background', () => {
      const { container } = render(
        <WaveformDisplay variant="card" peaks={[0.5, 0.8]} energy={5} />
      )
      const wrapper = container.firstElementChild as HTMLElement
      expect(wrapper.style.background).toContain('#ef4444')
    })
  })

  describe('variant="detail"', () => {
    it('renders mirrored bars (2 rects per peak)', () => {
      const peaks = Array.from({ length: 80 }, (_, i) => i / 80)
      const { container } = render(
        <WaveformDisplay variant="detail" peaks={peaks} />
      )
      const rects = container.querySelectorAll('rect')
      // 60 bars × 2 rects each = 120
      expect(rects.length).toBe(120)
    })

    it('shows duration label when provided', () => {
      const { container } = render(
        <WaveformDisplay variant="detail" peaks={[0.5]} duration={185} />
      )
      expect(container.textContent).toContain('3:05')
    })

    it('shows download message for empty peaks', () => {
      const { container } = render(
        <WaveformDisplay variant="detail" peaks={[]} />
      )
      expect(container.textContent).toContain('Waveform available after download')
    })
  })
})
