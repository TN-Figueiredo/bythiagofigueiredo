import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ScoreGauge } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge'

describe('ScoreGauge', () => {
  it('renders SVG with correct percentage text', () => {
    const { container } = render(<ScoreGauge score={26} max={34} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('76%')
  })

  it('renders green stroke for high score', () => {
    const { container } = render(<ScoreGauge score={30} max={34} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#10b981')
  })

  it('renders amber stroke for mid score', () => {
    const { container } = render(<ScoreGauge score={18} max={34} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#f59e0b')
  })

  it('renders without crashing for 0 score', () => {
    const { container } = render(<ScoreGauge score={0} max={34} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('0%')
  })

  it('applies size prop', () => {
    const { container } = render(<ScoreGauge score={20} max={34} size={48} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('48')
  })
})
