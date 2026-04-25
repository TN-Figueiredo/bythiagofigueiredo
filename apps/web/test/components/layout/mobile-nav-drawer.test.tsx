import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNavDrawer } from '../../../src/components/layout/mobile-nav-drawer'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))

const defaultProps = {
  locale: 'pt-BR' as const,
  currentTheme: 'dark' as const,
  current: 'home' as const,
  variant: 'full' as const,
  ctas: 'home' as const,
  t: {
    'nav.home': 'Início',
    'nav.writing': 'Escritos',
    'nav.videos': 'Vídeos',
    'nav.newsletter': 'Newsletter',
    'nav.about': 'Sobre',
    'nav.contact': 'Contato',
    'header.subscribe': 'Inscrever no YouTube',
    'header.newsletter': 'Receber newsletter',
  },
}

describe('MobileNavDrawer', () => {
  it('renders hamburger button', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    const btn = screen.getByLabelText('Open menu')
    expect(btn).toBeTruthy()
  })

  it('hamburger button has aria-expanded=false initially', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    const btn = screen.getByLabelText('Open menu')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens drawer on hamburger click', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByLabelText('Close menu')).toBeTruthy()
  })

  it('shows all full nav items when open', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Início')).toBeTruthy()
    expect(screen.getByText('Escritos')).toBeTruthy()
    expect(screen.getByText('Sobre')).toBeTruthy()
    expect(screen.getByText('Contato')).toBeTruthy()
  })

  it('shows reduced nav items in reduced variant', () => {
    render(<MobileNavDrawer {...defaultProps} variant="reduced" />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Início')).toBeTruthy()
    expect(screen.queryByText('Contato')).toBeNull()
  })

  it('marks active item with data-active', () => {
    const { container } = render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    const activeItem = container.querySelector('[data-active="true"]')
    expect(activeItem).toBeTruthy()
    expect(activeItem!.textContent).toBe('Início')
  })

  it('shows tagline in drawer', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('— blog + canal —')).toBeTruthy()
  })

  it('closes on close button click', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByLabelText('Close menu'))
    expect(screen.getByLabelText('Open menu')).toBeTruthy()
  })
})
