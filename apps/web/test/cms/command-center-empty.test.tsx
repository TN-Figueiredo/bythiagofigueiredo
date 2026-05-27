// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((c: string, p: number) => `rgba(0,0,0,${p / 100})`),
  getFormatIcon: vi.fn(() => ({ icon: '📹', bgClass: '', label: 'Video' })),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

import { CommandCenterEmpty } from '../../src/app/cms/(authed)/pipeline/_components/command-center-empty'

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('CommandCenterEmpty', () => {
  it('renders first-run variant with correct title and CTA', () => {
    render(<CommandCenterEmpty variant="first-run" />)

    expect(screen.getByText('Command Center vazio')).toBeTruthy()
    expect(screen.getByText(/Configure seus canais do YouTube/)).toBeTruthy()
    expect(screen.getByText('Configurar YouTube')).toBeTruthy()
  })

  it('CTA link has correct href for first-run', () => {
    render(<CommandCenterEmpty variant="first-run" />)

    const link = screen.getByText('Configurar YouTube')
    expect(link.getAttribute('href')).toBe('/cms/settings/youtube')
  })

  it('renders rest-day variant with nextActionDay text', () => {
    render(<CommandCenterEmpty variant="rest-day" nextActionDay="segunda-feira" />)

    expect(screen.getByText('Dia de descanso')).toBeTruthy()
    expect(screen.getByText(/Nenhum slot programado para hoje/)).toBeTruthy()
    expect(screen.getByText(/Próximo slot: segunda-feira\./)).toBeTruthy()
  })

  it('rest-day variant has no CTA', () => {
    render(<CommandCenterEmpty variant="rest-day" />)

    // No links should be rendered
    const links = screen.queryAllByRole('link')
    expect(links).toHaveLength(0)
  })

  it('renders all-done variant with correct message', () => {
    render(<CommandCenterEmpty variant="all-done" />)

    expect(screen.getByText('Tudo pronto!')).toBeTruthy()
    expect(screen.getByText(/Nada pendente esta semana/)).toBeTruthy()
    expect(screen.getByText('Nova ideia')).toBeTruthy()
  })

  it('all-done CTA links to new item page', () => {
    render(<CommandCenterEmpty variant="all-done" />)

    const link = screen.getByText('Nova ideia')
    expect(link.getAttribute('href')).toBe('/cms/pipeline/items/new')
  })

  it('does not show nextActionDay text on non rest-day variants', () => {
    render(<CommandCenterEmpty variant="first-run" nextActionDay="terça-feira" />)

    expect(screen.queryByText(/Próximo slot/)).toBeNull()
  })
})
