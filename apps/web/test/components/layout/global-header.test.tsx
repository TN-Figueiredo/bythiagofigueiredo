import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GlobalHeader } from '../../../src/components/layout/global-header'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))

const defaultT: Record<string, string> = {
  'nav.home': 'Início',
  'nav.writing': 'Escritos',
  'nav.videos': 'Vídeos',
  'nav.newsletter': 'Newsletter',
  'nav.about': 'Sobre',
  'nav.contact': 'Contato',
  'nav.devSite': 'Site Dev',
  'header.subscribe': 'Inscrever no YouTube',
  'header.newsletter': 'Receber newsletter',
}

const defaultProps = {
  locale: 'pt-BR' as const,
  currentTheme: 'dark' as const,
  current: 'home' as const,
  variant: 'full' as const,
  ctas: 'home' as const,
  t: defaultT,
}

describe('GlobalHeader', () => {
  it('renders a header element', () => {
    render(<GlobalHeader {...defaultProps} />)
    expect(document.querySelector('header')).toBeTruthy()
  })

  it('is sticky and positioned below the top strip (top: 44px)', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const header = container.querySelector('header')!
    expect(header.style.position).toBe('sticky')
    expect(header.style.top).toBe('44px')
  })

  it('renders the SVG brand wordmark', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const svg = container.querySelector('svg[aria-label="by Thiago Figueiredo"]')
    expect(svg).toBeTruthy()
  })

  it('wraps brand in a link to home', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const brandLink = container.querySelector('a[aria-label="by Thiago Figueiredo"]')
    expect(brandLink).toBeTruthy()
    expect(brandLink!.getAttribute('href')).toBe('/pt-BR')
  })

  it('shows tagline', () => {
    render(<GlobalHeader {...defaultProps} />)
    expect(screen.getByText('— blog + canal —')).toBeTruthy()
  })

  it('renders desktop nav with main navigation label', () => {
    render(<GlobalHeader {...defaultProps} />)
    const nav = screen.getByLabelText('Main navigation')
    expect(nav).toBeTruthy()
  })

  it('renders 7 nav items in full variant', () => {
    render(<GlobalHeader {...defaultProps} />)
    const nav = screen.getByLabelText('Main navigation')
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(7)
  })

  it('renders 5 nav items in reduced variant', () => {
    render(<GlobalHeader {...defaultProps} variant="reduced" />)
    const nav = screen.getByLabelText('Main navigation')
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(5)
  })

  it('marks active nav item with data-active', () => {
    const { container } = render(<GlobalHeader {...defaultProps} current="home" />)
    const activeLink = container.querySelector('nav a[data-active="true"]')
    expect(activeLink).toBeTruthy()
    expect(activeLink!.textContent).toBe('Início')
  })

  it('shows arrow on external links', () => {
    render(<GlobalHeader {...defaultProps} />)
    const nav = screen.getByLabelText('Main navigation')
    const allText = nav.textContent ?? ''
    expect(allText).toContain('↗')
  })

  it('renders theme toggle', () => {
    render(<GlobalHeader {...defaultProps} />)
    const toggles = screen.getAllByLabelText('Switch to light mode')
    expect(toggles.length).toBeGreaterThanOrEqual(1)
  })

  it('has bottom border set', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const header = container.querySelector('header')!
    const styleAttr = header.getAttribute('style') ?? ''
    // happy-dom splits shorthand border-bottom into sub-properties
    expect(styleAttr).toContain('border-bottom')
  })

  it('renders en locale brand link to /', () => {
    const { container } = render(<GlobalHeader {...defaultProps} locale="en" />)
    const brandLink = container.querySelector('a[aria-label="by Thiago Figueiredo"]')
    expect(brandLink!.getAttribute('href')).toBe('/')
  })
})
