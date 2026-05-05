import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeaderCTAs } from '../../../src/components/layout/header-ctas'

const ptBR = { 'header.subscribe': 'Inscrever no YouTube', 'header.newsletter': 'Receber newsletter' }
const en = { 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }

describe('HeaderCTAs', () => {
  describe('home variant', () => {
    it('renders YouTube and Newsletter buttons', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={ptBR} />)
      expect(screen.getByText(/Inscrever/)).toBeTruthy()
      expect(screen.getByText(/Newsletter/)).toBeTruthy()
    })

    it('shows 🇧🇷 flag for pt-BR locale', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={ptBR} />)
      expect(screen.getByText(/🇧🇷/)).toBeTruthy()
    })

    it('shows 🇺🇸 flag for en locale', () => {
      render(<HeaderCTAs variant="home" locale="en" t={en} />)
      expect(screen.getByText(/🇺🇸/)).toBeTruthy()
    })

    it('YouTube button links to correct channel', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={ptBR} />)
      const ytLink = screen.getByLabelText('Inscrever no YouTube')
      expect(ytLink.getAttribute('href')).toContain('bythiagofigueiredo')
    })

    it('Newsletter button has marker yellow background', () => {
      render(<HeaderCTAs variant="home" locale="en" t={en} />)
      const nlBtn = screen.getByText(/Newsletter/).closest('a')
      expect(nlBtn!.style.background).toBe('var(--pb-marker)')
    })
  })

  describe('archive variant', () => {
    it('renders single NEWSLETTER button with accent background', () => {
      const { container } = render(<HeaderCTAs variant="archive" locale="en" t={en} />)
      const btns = container.querySelectorAll('a')
      expect(btns).toHaveLength(1)
      expect(btns[0].textContent).toContain('NEWSLETTER')
    })

    it('uses JetBrains Mono font class', () => {
      const { container } = render(<HeaderCTAs variant="archive" locale="en" t={en} />)
      const btn = container.querySelector('a')
      expect(btn!.className).toContain('font-jetbrains')
    })
  })

  describe('post variant', () => {
    it('renders "Assinar" for pt-BR locale', () => {
      render(<HeaderCTAs variant="post" locale="pt-BR" t={ptBR} />)
      expect(screen.getByText('Assinar')).toBeTruthy()
    })

    it('renders "Subscribe" for en locale', () => {
      render(<HeaderCTAs variant="post" locale="en" t={en} />)
      expect(screen.getByText('Subscribe')).toBeTruthy()
    })

    it('links to /newsletters for en locale', () => {
      render(<HeaderCTAs variant="post" locale="en" t={en} />)
      const link = screen.getByText('Subscribe').closest('a')
      expect(link!.getAttribute('href')).toBe('/newsletters')
    })

    it('links to /pt/newsletters for pt-BR locale', () => {
      render(<HeaderCTAs variant="post" locale="pt-BR" t={ptBR} />)
      const link = screen.getByText('Assinar').closest('a')
      expect(link!.getAttribute('href')).toBe('/pt/newsletters')
    })
  })

  describe('locale-aware links', () => {
    it('home variant newsletter link uses locale prefix for pt-BR', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={ptBR} />)
      const nlBtn = screen.getByText(/Newsletter/).closest('a')
      expect(nlBtn!.getAttribute('href')).toBe('/pt/newsletters')
    })

    it('archive variant newsletter link uses locale prefix for pt-BR', () => {
      const { container } = render(<HeaderCTAs variant="archive" locale="pt-BR" t={ptBR} />)
      const btn = container.querySelector('a')
      expect(btn!.getAttribute('href')).toBe('/pt/newsletters')
    })
  })
})
