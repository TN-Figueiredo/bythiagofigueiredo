import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandWordmark } from '../../../src/components/brand/brand-wordmark'

describe('BrandWordmark', () => {
  it('renders an SVG element', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('has aria-label "by Thiago Figueiredo"', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('aria-label')).toBe('by Thiago Figueiredo')
  })

  it('uses light fill (#EFE6D2) for dark theme', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const g = container.querySelector('g[data-testid="brand-text"]')
    expect(g!.getAttribute('fill')).toBe('#EFE6D2')
  })

  it('uses dark fill (#1A140C) for light theme', () => {
    const { container } = render(<BrandWordmark theme="light" />)
    const g = container.querySelector('g[data-testid="brand-text"]')
    expect(g!.getAttribute('fill')).toBe('#1A140C')
  })

  it('uses accent orange (#FF8240) asterisk for dark theme', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const asteriskG = container.querySelector('g[data-testid="brand-asterisk"]')
    const paths = asteriskG!.querySelectorAll('path')
    expect(paths[0].getAttribute('fill')).toBe('#FF8240')
  })

  it('uses accent rust (#C14513) asterisk for light theme', () => {
    const { container } = render(<BrandWordmark theme="light" />)
    const asteriskG = container.querySelector('g[data-testid="brand-asterisk"]')
    const paths = asteriskG!.querySelectorAll('path')
    expect(paths[0].getAttribute('fill')).toBe('#C14513')
  })

  it('defaults to height 28', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('height')).toBe('28')
  })

  it('accepts custom height', () => {
    const { container } = render(<BrandWordmark theme="dark" height={22} />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('height')).toBe('22')
  })

  it('contains "by" and "Thiago Figueiredo" text elements', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const texts = container.querySelectorAll('text')
    const allText = Array.from(texts).map((t) => t.textContent).join(' ')
    expect(allText).toContain('by')
    expect(allText).toContain('Thiago Figueiredo')
  })
})
