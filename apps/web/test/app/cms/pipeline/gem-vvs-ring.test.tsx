import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GemVvsRing } from '@/app/cms/(authed)/pipeline/_components/gem-vvs-ring'

describe('GemVvsRing', () => {
  it('renders SVG with score label', () => {
    render(<GemVvsRing score={75} size={26} />)
    expect(screen.getByText('75')).toBeDefined()
  })

  it('renders large variant', () => {
    const { container } = render(<GemVvsRing score={92} size={48} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('48')
  })

  it('applies correct color for low score', () => {
    const { container } = render(<GemVvsRing score={20} size={26} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#ef4444')
  })

  it('applies correct color for max score', () => {
    const { container } = render(<GemVvsRing score={95} size={26} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#6366f1')
  })
})
