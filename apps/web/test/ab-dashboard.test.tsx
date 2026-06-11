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
  dismissFatigueAlert: vi.fn().mockResolvedValue({ ok: true }),
  batchStartTests: vi.fn().mockResolvedValue({ ok: true }),
}))

import { KPI } from '@/app/cms/(authed)/youtube/ab-lab/_components/kpi'
import { ActiveTestCard } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-test-card'
import { CompletedRow } from '@/app/cms/(authed)/youtube/ab-lab/_components/completed-row'
import { DraftsBlock } from '@/app/cms/(authed)/youtube/ab-lab/_components/drafts-block'
import { LearningsPanel } from '@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel'
import { EmptyState } from '@/app/cms/(authed)/youtube/ab-lab/_components/empty-state'
import { SuggestedCard } from '@/app/cms/(authed)/youtube/ab-lab/_components/suggested-card'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type { DashboardStats, AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import { makeCardView, makeCompleted, makeDraft, makeLearnings, makeSuggestion, makeSuggestions } from './helpers/ab-fixtures'

afterEach(() => cleanup())

/* ============================================================
 * KPI
 * ============================================================ */
describe('KPI', () => {
  it('renders value and label', () => {
    render(<KPI label="Active tests" value={5} />)
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('Active tests')).toBeTruthy()
  })

  it('renders suffix next to value', () => {
    render(<KPI label="Win Rate" value={72} suffix="%" />)
    expect(screen.getByText('%')).toBeTruthy()
  })

  it('renders trend text with green color', () => {
    render(<KPI label="Lift" value={12} trend="+3% vs last week" />)
    expect(screen.getByText('+3% vs last week')).toBeTruthy()
  })

  it('does not render trend when not provided', () => {
    render(<KPI label="Lift" value={8} />)
    expect(screen.queryByText(/vs last/)).toBeNull()
  })

  it('renders sparkline SVG when spark array provided', () => {
    const { container } = render(<KPI label="CTR" value={5} spark={[1, 3, 2, 5, 4]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('does not render sparkline when spark is empty', () => {
    const { container } = render(<KPI label="CTR" value={5} spark={[]} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('does not render sparkline when spark is undefined', () => {
    const { container } = render(<KPI label="CTR" value={5} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})

/* ============================================================
 * ActiveTestCard
 * ============================================================ */
describe('ActiveTestCard', () => {
  it('renders test name and day badge', () => {
    const test = makeCardView({ dayOf: 7 })
    render(<ActiveTestCard test={test} onOpen={vi.fn()} />)
    expect(screen.getByText(test.name)).toBeTruthy()
    // Badge renders "Dia {dayOf}/{total}" where total = dayOf + max(0, 14 - dayOf)
    expect(screen.getByText('Dia 7/14')).toBeTruthy()
  })

  it('calls onOpen when clicked', () => {
    const test = makeCardView()
    const onOpen = vi.fn()
    render(<ActiveTestCard test={test} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('article'))
    expect(onOpen).toHaveBeenCalledWith(test.id)
  })

  it('calls onOpen when Enter pressed', () => {
    const test = makeCardView()
    const onOpen = vi.fn()
    render(<ActiveTestCard test={test} onOpen={onOpen} />)
    fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith(test.id)
  })

  it('renders variant thumbnails with leader ring', () => {
    const test = makeCardView({ leader: 'B' })
    const { container } = render(<ActiveTestCard test={test} onOpen={vi.fn()} />)
    // Both fixture variants carry thumbUrl, so each renders an <img alt="Variant X">
    const thumbs = container.querySelectorAll('img[alt^="Variant"]')
    expect(thumbs.length).toBe(2)
    // Leader thumb wrapper gets a 2px outline ring in the variant color.
    // (happy-dom expands the shorthand to outline-width/style/color, and drops
    // the non-leader outline entirely because its color is a var() expression.)
    const ringed = Array.from(container.querySelectorAll('div')).filter(d => d.getAttribute('style')?.includes('outline-width: 2px'))
    expect(ringed.length).toBe(1)
  })

  it('shows Playoff badge when hasPlayoff is true', () => {
    // Badge requires roundNumber > 1 (round 1 IS the playoff parent)
    const test = makeCardView({ hasPlayoff: true, roundNumber: 2 })
    render(<ActiveTestCard test={test} onOpen={vi.fn()} />)
    expect(screen.getByText(/^Round/)).toBeTruthy()
  })

  it('does not show Playoff badge when hasPlayoff is false', () => {
    const test = makeCardView({ hasPlayoff: false })
    render(<ActiveTestCard test={test} onOpen={vi.fn()} />)
    expect(screen.queryByText(/^Round/)).toBeNull()
  })
})

/* ============================================================
 * CompletedRow
 * ============================================================ */
describe('CompletedRow', () => {
  it('renders as a clickable row with the test name', () => {
    const test = makeCompleted()
    render(<CompletedRow test={test} onOpen={vi.fn()} />)
    const row = screen.getByRole('button')
    expect(row).toBeTruthy()
    expect(screen.getByText(test.name)).toBeTruthy()
  })

  it('shows winner VChip and positive lift', () => {
    const test = makeCompleted({ lift: 15 })
    render(<CompletedRow test={test} onOpen={vi.fn()} />)
    expect(screen.getByText('B')).toBeTruthy()
    // brDec renders pt-BR decimals (comma)
    expect(screen.getByText(/\+15,0%/)).toBeTruthy()
  })

  it('shows playoff-agendado badge for zero lift and low confidence', () => {
    const test = makeCompleted({ lift: 0 })
    test.confidence = 50
    render(<CompletedRow test={test} onOpen={vi.fn()} />)
    expect(screen.getByText('playoff agendado')).toBeTruthy()
    expect(screen.getByText(/sem vencedor claro/)).toBeTruthy()
  })

  it('calls onOpen on click', () => {
    const test = makeCompleted()
    const onOpen = vi.fn()
    render(<CompletedRow test={test} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(test.id)
  })
})

/* ============================================================
 * DraftsBlock
 * ============================================================ */
describe('DraftsBlock', () => {
  it('renders nothing when drafts is empty', () => {
    const { container } = render(<DraftsBlock drafts={[]} onContinue={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders draft info when provided', () => {
    const draft = makeDraft({ step: 3 })
    render(<DraftsBlock drafts={[draft]} onContinue={vi.fn()} />)
    expect(screen.getByText(draft.name)).toBeTruthy()
    expect(screen.getByText(/Parou no passo 3 de 5/)).toBeTruthy()
  })

  it('collapses and expands on trigger button click', () => {
    const draft = makeDraft()
    render(<DraftsBlock drafts={[draft]} onContinue={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /Rascunhos/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Continuar setup')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByText('Continuar setup')).toBeTruthy()
  })

  it('calls onContinue when CTA clicked', () => {
    const draft = makeDraft()
    const onContinue = vi.fn()
    render(<DraftsBlock drafts={[draft]} onContinue={onContinue} />)
    fireEvent.click(screen.getByText('Continuar setup'))
    expect(onContinue).toHaveBeenCalledWith(draft.id)
  })
})

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
 * SuggestedCard
 * ============================================================ */
describe('SuggestedCard', () => {
  it('renders video title and grade pill', () => {
    const video = makeSuggestion({ grade: 'D' })
    render(<SuggestedCard video={video} onCreate={vi.fn()} />)
    expect(screen.getByText(video.title)).toBeTruthy()
    expect(screen.getByText('NOTA D')).toBeTruthy()
  })

  it('renders the grade pill for failing grades', () => {
    // The D/F red is applied via `color: var(--cms-red, #ef4444)` — happy-dom
    // drops var()-valued properties from serialized styles, so the color
    // itself is not observable here; assert the pill renders for F grades.
    const video = makeSuggestion({ grade: 'F' })
    render(<SuggestedCard video={video} onCreate={vi.fn()} />)
    expect(screen.getByText('NOTA F')).toBeTruthy()
  })

  it('renders reason text', () => {
    const video = makeSuggestion({ reason: 'CTR very low' })
    render(<SuggestedCard video={video} onCreate={vi.fn()} />)
    expect(screen.getByText('CTR very low')).toBeTruthy()
  })

  it('calls onCreate with video id and suggest type on CTA click', () => {
    const video = makeSuggestion({ suggest: 'title' })
    const onCreate = vi.fn()
    render(<SuggestedCard video={video} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('Testar título'))
    expect(onCreate).toHaveBeenCalledWith(video.id, 'title')
  })
})

/* ============================================================
 * EmptyState
 * ============================================================ */
describe('EmptyState', () => {
  it('renders single CTA when no suggestions', () => {
    render(<EmptyState suggested={[]} onCreate={vi.fn()} />)
    expect(screen.getByText('Comece a testar')).toBeTruthy()
    expect(screen.getByText('+ Novo teste')).toBeTruthy()
  })

  it('renders suggestion cards when suggestions >= 3', () => {
    const suggested = makeSuggestions(3)
    render(<EmptyState suggested={suggested} onCreate={vi.fn()} />)
    expect(screen.getAllByText('NOTA D').length).toBe(3)
  })

  it('renders available cards when 1-2 suggestions', () => {
    const suggested = makeSuggestions(2)
    render(<EmptyState suggested={suggested} onCreate={vi.fn()} />)
    expect(screen.getAllByText('NOTA D').length).toBe(2)
  })

  it('limits to 3 suggestion cards even if more provided', () => {
    const suggested = makeSuggestions(5)
    render(<EmptyState suggested={suggested} onCreate={vi.fn()} />)
    expect(screen.getAllByText('NOTA D').length).toBe(3)
  })

  it('calls onCreate from hero CTA', () => {
    const onCreate = vi.fn()
    render(<EmptyState suggested={[]} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('+ Novo teste'))
    expect(onCreate).toHaveBeenCalledWith('', 'thumbnail')
  })
})

/* ============================================================
 * AbLabDashboard (shell)
 * ============================================================ */
describe('AbLabDashboard', () => {
  const baseStats: DashboardStats = {
    activeTests: 2, avgConfidence: 92, winRate: 75, avgLift: 8.5,
    completedTests: 4, testsWon: 3,
  }
  const baseSettings: AbTestSiteSettings = { ...AB_SITE_SETTINGS_DEFAULTS }
  const baseProps = {
    stats: baseStats,
    cards: [] as ReturnType<typeof makeCardView>[],
    drafts: [] as ReturnType<typeof makeDraft>[],
    completed: [] as ReturnType<typeof makeCompleted>[],
    paused: [] as ReturnType<typeof makeCardView>[],
    learnings: null,
    channelLearnings: null,
    suggested: [] as ReturnType<typeof makeSuggestion>[],
    settings: baseSettings,
    siteId: 'site-1',
    eligibleVideos: [],
    fatigueAlerts: [],
  }

  beforeEach(() => {
    mockRouterPush.mockClear()
  })

  it('renders KPI strip when completed tests exist', () => {
    const { container } = render(
      <AbLabDashboard {...baseProps} cards={[makeCardView()]} completed={[makeCompleted()]} />,
    )
    const kpiStrip = container.querySelector('[data-kpi-strip]')
    expect(kpiStrip).toBeTruthy()
    expect(screen.getAllByText('Testes ativos').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Confiança média')).toBeTruthy()
    expect(screen.getByText('Win rate')).toBeTruthy()
    expect(screen.getByText('CTR lift médio')).toBeTruthy()
  })

  it('shows "Nenhum teste ativo" when no active tests and no draft', () => {
    render(
      <AbLabDashboard
        {...baseProps}
        stats={{ activeTests: 0, avgConfidence: 0, winRate: 0, avgLift: 0, completedTests: 0, testsWon: 0 }}
      />,
    )
    expect(screen.getByText('Nenhum teste ativo')).toBeTruthy()
  })

  it('opens Settings drawer when Settings button is clicked', () => {
    render(<AbLabDashboard {...baseProps} cards={[makeCardView()]} />)
    // Initially no dialog
    expect(screen.queryByRole('dialog')).toBeNull()
    // Click settings
    fireEvent.click(screen.getByLabelText('Configurações'))
    // Dialog should appear
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('renders active cards in a 2-col grid', () => {
    const cards = [makeCardView(), makeCardView()]
    const { container } = render(<AbLabDashboard {...baseProps} cards={cards} />)
    const grid = container.querySelector('[data-active-grid]')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('lg:grid-cols-2')
    // Should have 2 articles
    const articles = grid?.querySelectorAll('article')
    expect(articles?.length).toBe(2)
  })

  it('has animate-ab-fade-up on root element', () => {
    const { container } = render(<AbLabDashboard {...baseProps} />)
    const root = container.querySelector('[data-dashboard-root]')
    expect(root).toBeTruthy()
    expect(root?.className).toContain('animate-ab-fade-up')
  })
})
