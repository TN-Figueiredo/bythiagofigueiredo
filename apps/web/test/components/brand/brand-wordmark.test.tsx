import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BrandWordmark } from '../../../src/components/brand/brand-wordmark'

describe('BrandWordmark', () => {
  it('renders a span wrapper with data-testid', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    expect(container.querySelector('[data-testid="brand-wordmark"]')).toBeTruthy()
  })

  it('renders the asterisk SVG', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const asteriskSpan = container.querySelector('[data-testid="brand-asterisk"]')
    expect(asteriskSpan!.querySelector('svg')).toBeTruthy()
  })

  it('uses light color (#EFE6D2) for dark theme', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const wrapper = container.querySelector('[data-testid="brand-wordmark"]') as HTMLElement
    expect(wrapper.style.color).toContain('EFE6D2')
  })

  it('uses dark color (#1A140C) for light theme', () => {
    const { container } = render(<BrandWordmark theme="light" />)
    const wrapper = container.querySelector('[data-testid="brand-wordmark"]') as HTMLElement
    expect(wrapper.style.color).toContain('1A140C')
  })

  it('uses accent orange (#FF8240) asterisk for dark theme', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const asteriskG = container.querySelector('[data-testid="brand-asterisk"] svg g')
    expect(asteriskG!.getAttribute('fill')).toBe('#FF8240')
  })

  it('uses accent rust (#C14513) asterisk for light theme', () => {
    const { container } = render(<BrandWordmark theme="light" />)
    const asteriskG = container.querySelector('[data-testid="brand-asterisk"] svg g')
    expect(asteriskG!.getAttribute('fill')).toBe('#C14513')
  })

  it('defaults to size 22', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const name = container.querySelector('[data-testid="brand-name"]') as HTMLElement
    expect(name.style.fontSize).toBe('22px')
  })

  it('accepts custom size', () => {
    const { container } = render(<BrandWordmark theme="dark" size={18} />)
    const name = container.querySelector('[data-testid="brand-name"]') as HTMLElement
    expect(name.style.fontSize).toBe('18px')
  })

  it('contains "by" and "Thiago Figueiredo" text', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const by = container.querySelector('[data-testid="brand-by"]')
    const name = container.querySelector('[data-testid="brand-name"]')
    expect(by!.textContent).toBe('by')
    expect(name!.textContent).toContain('Thiago')
    expect(name!.textContent).toContain('Figueiredo')
  })
})
