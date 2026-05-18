// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ComingSoonPage from '../../../src/app/go/coming-soon/page'

describe('ComingSoonPage', () => {
  afterEach(cleanup)
  it('renders the title from searchParams', async () => {
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({ title: 'Meu Link Especial' }),
    })
    render(element)
    expect(screen.getByText('Meu Link Especial')).toBeTruthy()
    expect(screen.getByText(/Este link ainda não está ativo/)).toBeTruthy()
  })

  it('renders activation date in pt-BR locale', async () => {
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({
        title: 'Promo',
        activates: '2026-06-15T14:30:00Z',
      }),
    })
    render(element)
    expect(screen.getByText(/Disponível a partir de/)).toBeTruthy()
    const timeEl = document.querySelector('time')
    expect(timeEl).toBeTruthy()
    expect(timeEl!.getAttribute('datetime')).toContain('2026-06-15')
    expect(timeEl!.textContent).toMatch(/junho/)
    expect(timeEl!.textContent).toMatch(/2026/)
  })

  it('defaults to "Este link" when no title param', async () => {
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({}),
    })
    render(element)
    expect(screen.getByText('Este link')).toBeTruthy()
  })

  it('does not render activation date when activates param is absent', async () => {
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({ title: 'No Date' }),
    })
    render(element)
    expect(screen.getByText('No Date')).toBeTruthy()
    expect(screen.queryByText(/Disponível a partir de/)).toBeNull()
    expect(document.querySelector('time')).toBeNull()
  })
})
