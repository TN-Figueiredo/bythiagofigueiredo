// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  // `then` MUST resolve to undefined: vitest `await`s the factory result, and a
  // Proxy that returns a function for EVERY key (including `then`) is a thenable
  // whose `then` never settles — the lucide-react import deadlocks the fork at
  // 0% CPU and the whole suite hangs forever (this is what hung CI for 6h).
  // (`has` trap: vitest checks `export in mock` before reading it.)
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : icon(prop)),
    has: (_target, prop) => typeof prop === 'string' && prop !== 'then',
  })
})

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className }: { children: React.ReactNode; href: string; onClick?: React.MouseEventHandler; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}))

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: vi.fn() }),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  updateAbSiteSettings: vi.fn().mockResolvedValue({ ok: true }),
  batchStartTests: vi.fn().mockResolvedValue({ ok: true }),
}))

import { LearningsPanel } from '@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type { DashboardStats, AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import { makeCardView, makeCompleted, makeDraft, makeLearnings, makeSuggestion, makeSuggestions } from './helpers/ab-fixtures'
import { propsDoLab, paginaVazia } from './helpers/ab-lab-pagina-props'

afterEach(() => cleanup())

/* ============================================================
 * LearningsPanel
 * ============================================================ */
describe('LearningsPanel', () => {
  it('shows collecting-data message when learnings is null', () => {
    render(<LearningsPanel learnings={null} />)
    expect(screen.getByText(/Coletando dados/)).toBeTruthy()
    expect(screen.getByText(/0\/3 testes completados/)).toBeTruthy()
  })

  it('renders one win-bar meter per tag', () => {
    const data = makeLearnings({ tags: 5 })
    const { container } = render(<LearningsPanel learnings={data} />)
    const meters = container.querySelectorAll('[role="meter"]')
    expect(meters.length).toBe(5)
  })

  it('renders win bar with role="meter"', () => {
    const data = makeLearnings({ tags: 1 })
    const { container } = render(<LearningsPanel learnings={data} />)
    const meters = container.querySelectorAll('[role="meter"]')
    expect(meters.length).toBeGreaterThanOrEqual(1)
  })

  it('applies line-through to negative tags', () => {
    const data = makeLearnings({ tags: 3, negativeTag: true })
    render(<LearningsPanel learnings={data} />)
    const tagLabel = screen.getByText('no-text')
    expect(tagLabel.getAttribute('style')).toContain('line-through')
  })

  it('shows insight text', () => {
    const data = makeLearnings()
    render(<LearningsPanel learnings={data} />)
    expect(screen.getByText(/Close-up faces perform 23% better on average\./)).toBeTruthy()
  })

  it('renders all tags even when more than 20', () => {
    const data = makeLearnings({ tags: 25 })
    const { container } = render(<LearningsPanel learnings={data} />)
    const meters = container.querySelectorAll('[role="meter"]')
    expect(meters.length).toBe(25)
  })
})

/* ============================================================
 * AbLabDashboard (casca; a composição inteira está em ab-lab-pagina-composicao.test.tsx)
 * ============================================================ */
describe('AbLabDashboard', () => {
  beforeEach(() => {
    mockRouterPush.mockClear()
  })

  it('mostra a frase do topo do modelo', () => {
    render(<AbLabDashboard {...propsDoLab({ pagina: paginaVazia({ topo: { frase: 'Um teste rodando. Nada com você agora.' } }) })} />)
    expect(screen.getByRole('heading', { level: 1, name: 'A/B Lab' })).toBeTruthy()
    expect(screen.getByText('Um teste rodando. Nada com você agora.')).toBeTruthy()
  })

  it('menu de filtro usa o token --cms-surface (sem o inexistente surface-2)', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    fireEvent.click(screen.getByRole('button', { name: /Todos os tipos/ }))
    const opcao = screen.getAllByRole('button', { name: 'Título e miniatura' }).pop()!
    const menu = opcao.parentElement as HTMLElement
    expect(menu.getAttribute('style')).toContain('var(--cms-surface)')
    expect(menu.getAttribute('style')).not.toContain('surface-2')
  })

  it('opens Settings drawer when Settings button is clicked', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('Configurações'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('has animate-ab-fade-up on root element', () => {
    const { container } = render(<AbLabDashboard {...propsDoLab()} />)
    const root = container.querySelector('[data-dashboard-root]')
    expect(root).toBeTruthy()
    expect(root?.className).toContain('animate-ab-fade-up')
  })
})
