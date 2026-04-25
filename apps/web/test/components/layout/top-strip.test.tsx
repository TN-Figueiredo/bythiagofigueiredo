import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { TopStrip } from '../../../src/components/layout/top-strip'

describe('TopStrip', () => {
  it('renders language pill with PT and EN buttons', () => {
    mockPathname = '/'
    render(<TopStrip />)
    expect(screen.getByText('PT')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('marks PT active when pathname starts with /pt', () => {
    mockPathname = '/pt/privacy'
    const { container } = render(<TopStrip />)
    const activeBtn = container.querySelector('[data-active="true"]')
    expect(activeBtn).toBeTruthy()
    expect(activeBtn!.textContent).toBe('PT')
  })

  it('marks EN active when pathname has no /pt prefix', () => {
    mockPathname = '/privacy'
    const { container } = render(<TopStrip />)
    const activeBtn = container.querySelector('[data-active="true"]')
    expect(activeBtn).toBeTruthy()
    expect(activeBtn!.textContent).toBe('EN')
  })

  it('preserves path for static pages (privacy, contact, etc.)', () => {
    mockPathname = '/privacy'
    render(<TopStrip />)
    const ptLink = screen.getByText('PT').closest('a')
    expect(ptLink!.getAttribute('href')).toBe('/pt/privacy')
  })

  it('EN link preserves path for static pages', () => {
    mockPathname = '/pt/contact'
    render(<TopStrip />)
    const enLink = screen.getByText('EN').closest('a')
    expect(enLink!.getAttribute('href')).toBe('/contact')
  })

  it('falls back to home for content paths (blog posts)', () => {
    mockPathname = '/blog/my-post'
    render(<TopStrip />)
    const ptLink = screen.getByText('PT').closest('a')
    expect(ptLink!.getAttribute('href')).toBe('/pt')
  })

  it('falls back to home for PT content paths', () => {
    mockPathname = '/pt/blog/meu-post'
    render(<TopStrip />)
    const enLink = screen.getByText('EN').closest('a')
    expect(enLink!.getAttribute('href')).toBe('/')
  })

  it('falls back to home for campaign paths', () => {
    mockPathname = '/pt/campaigns/minha-campanha'
    render(<TopStrip />)
    const enLink = screen.getByText('EN').closest('a')
    expect(enLink!.getAttribute('href')).toBe('/')
  })

  it('EN link goes to / when stripping /pt from root', () => {
    mockPathname = '/pt'
    render(<TopStrip />)
    const enLink = screen.getByText('EN').closest('a')
    expect(enLink!.getAttribute('href')).toBe('/')
  })

  it('PT link from home goes to /pt', () => {
    mockPathname = '/'
    render(<TopStrip />)
    const ptLink = screen.getByText('PT').closest('a')
    expect(ptLink!.getAttribute('href')).toBe('/pt')
  })

  it('has fixed positioning', () => {
    mockPathname = '/'
    const { container } = render(<TopStrip />)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.style.position).toBe('fixed')
  })

  it('has lang-pill testid', () => {
    mockPathname = '/'
    const { container } = render(<TopStrip />)
    const pill = container.querySelector('[data-testid="lang-pill"]')
    expect(pill).toBeTruthy()
  })
})
