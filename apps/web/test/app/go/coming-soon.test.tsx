import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'example.com']])),
}))

describe('ComingSoonPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('renders the title from searchParams', async () => {
    const { default: ComingSoonPage } = await import(
      '../../../src/app/go/coming-soon/page'
    )
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({ title: 'Meu Link Especial' }),
    })
    render(element)
    expect(screen.getByText('Meu Link Especial')).toBeTruthy()
    expect(screen.getByText(/Este link ainda não está ativo/)).toBeTruthy()
  })

  it('renders activation date in pt-BR locale', async () => {
    const { default: ComingSoonPage } = await import(
      '../../../src/app/go/coming-soon/page'
    )
    // 2026-06-15T14:30:00Z — a fixed date
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({
        title: 'Promo',
        activates: '2026-06-15T14:30:00Z',
      }),
    })
    render(element)
    // Should contain "Disponível a partir de"
    expect(screen.getByText(/Disponível a partir de/)).toBeTruthy()
    // The <time> element should have the ISO datetime attribute
    const timeEl = document.querySelector('time')
    expect(timeEl).toBeTruthy()
    expect(timeEl!.getAttribute('datetime')).toContain('2026-06-15')
    // Should render the date in pt-BR format (e.g., "15 de junho de 2026")
    expect(timeEl!.textContent).toMatch(/junho/)
    expect(timeEl!.textContent).toMatch(/2026/)
  })

  it('defaults to "Este link" when no title param', async () => {
    const { default: ComingSoonPage } = await import(
      '../../../src/app/go/coming-soon/page'
    )
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({}),
    })
    render(element)
    expect(screen.getByText('Este link')).toBeTruthy()
  })

  it('does not render activation date when activates param is absent', async () => {
    const { default: ComingSoonPage } = await import(
      '../../../src/app/go/coming-soon/page'
    )
    const element = await ComingSoonPage({
      searchParams: Promise.resolve({ title: 'No Date' }),
    })
    render(element)
    expect(screen.getByText('No Date')).toBeTruthy()
    expect(screen.queryByText(/Disponível a partir de/)).toBeNull()
    expect(document.querySelector('time')).toBeNull()
  })
})
