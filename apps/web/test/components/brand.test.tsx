import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Brand } from '../../src/components/brand/brand'
import { Asterisk } from '../../src/components/brand/asterisk'

describe('Asterisk', () => {
  it('renders an SVG with 3 petals and a center circle', () => {
    const { container } = render(<Asterisk />)
    const svg = container.querySelector('svg')!
    expect(svg).toBeTruthy()
    expect(svg.querySelectorAll('path')).toHaveLength(3)
    expect(svg.querySelector('circle')).toBeTruthy()
  })

  it('defaults to 1em sizing when no size prop', () => {
    const { container } = render(<Asterisk />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('1em')
    expect(svg.getAttribute('height')).toBe('1em')
  })

  it('accepts explicit pixel size', () => {
    const { container } = render(<Asterisk size={24} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
  })

  it('is aria-hidden and not focusable', () => {
    const { container } = render(<Asterisk />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
  })

  it('applies className', () => {
    const { container } = render(<Asterisk className="text-red-500" />)
    expect(container.querySelector('svg')!.classList.contains('text-red-500')).toBe(true)
  })

  it('uses currentColor for fill', () => {
    const { container } = render(<Asterisk />)
    const paths = container.querySelectorAll('path')
    for (const p of paths) {
      expect(p.getAttribute('fill')).toBe('currentColor')
    }
    expect(container.querySelector('circle')!.getAttribute('fill')).toBe('currentColor')
  })
})

describe('Brand', () => {
  describe('wordmark (default)', () => {
    it('renders "by Thiago Figueiredo" with asterisk', () => {
      const { container } = render(<Brand />)
      expect(container.textContent).toContain('by')
      expect(container.textContent).toContain('Thiago')
      expect(container.textContent).toContain('Figueiredo')
      expect(container.querySelector('svg')).toBeTruthy()
    })

    it('has aria-label', () => {
      const { container } = render(<Brand />)
      expect(container.querySelector('[aria-label="by Thiago Figueiredo"]')).toBeTruthy()
    })

    it('has data-testid', () => {
      const { container } = render(<Brand />)
      expect(container.querySelector('[data-testid="brand-wordmark"]')).toBeTruthy()
    })

    it('applies className without trailing spaces', () => {
      const { container } = render(<Brand className="text-xl" />)
      const el = container.querySelector('[data-testid="brand-wordmark"]')!
      expect(el.className).not.toMatch(/\s$/)
      expect(el.classList.contains('text-xl')).toBe(true)
    })

    it('does not show tagline when variant is wordmark', () => {
      const { container } = render(<Brand tagline="TEST" />)
      expect(container.textContent).not.toContain('TEST')
    })
  })

  describe('wordmark-tagline', () => {
    it('renders tagline below the wordmark', () => {
      const { container } = render(
        <Brand variant="wordmark-tagline" tagline="ESCRITOS · VÍDEOS · CARTAS" />,
      )
      expect(container.textContent).toContain('ESCRITOS · VÍDEOS · CARTAS')
    })

    it('omits tagline span when tagline is empty', () => {
      const { container } = render(<Brand variant="wordmark-tagline" />)
      const spans = container.querySelectorAll('span')
      for (const s of spans) {
        expect(s.classList.contains('font-jetbrains')).toBe(false)
      }
    })

    it('uses flex-col layout for vertical stacking', () => {
      const { container } = render(
        <Brand variant="wordmark-tagline" tagline="test" />,
      )
      const root = container.querySelector('[data-testid="brand-wordmark"]')!
      expect(root.classList.contains('flex-col')).toBe(true)
    })
  })

  describe('monogram', () => {
    it('renders T and F letters', () => {
      const { container } = render(<Brand variant="monogram" />)
      expect(container.textContent).toContain('T')
      expect(container.textContent).toContain('F')
    })

    it('has role="img" and aria-label for assistive tech', () => {
      const { container } = render(<Brand variant="monogram" />)
      const el = container.querySelector('[aria-label="TF"]')!
      expect(el).toBeTruthy()
      expect(el.getAttribute('role')).toBe('img')
    })

    it('has data-testid', () => {
      const { container } = render(<Brand variant="monogram" />)
      expect(container.querySelector('[data-testid="brand-monogram"]')).toBeTruthy()
    })

    it('uses em-based letter-spacing for scalability', () => {
      const { container } = render(<Brand variant="monogram" />)
      const root = container.querySelector('[data-testid="brand-monogram"]') as HTMLElement
      expect(root.style.letterSpacing).toBe('-0.08em')
    })
  })

  describe('symbol', () => {
    it('renders only the asterisk SVG', () => {
      const { container } = render(<Brand variant="symbol" />)
      expect(container.querySelector('svg')).toBeTruthy()
      expect(container.textContent).toBe('')
    })

    it('has role="img" and aria-label for assistive tech', () => {
      const { container } = render(<Brand variant="symbol" />)
      const el = container.querySelector('[aria-label="Marginalia"]')!
      expect(el).toBeTruthy()
      expect(el.getAttribute('role')).toBe('img')
    })

    it('has data-testid', () => {
      const { container } = render(<Brand variant="symbol" />)
      expect(container.querySelector('[data-testid="brand-symbol"]')).toBeTruthy()
    })
  })
})
