// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => icon(prop),
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
    expect(screen.getByText('Dia 7')).toBeTruthy()
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
    const thumbs = container.querySelectorAll('[data-variant-thumb]')
    expect(thumbs.length).toBe(2)
    // Leader thumb should have boxShadow ring
    const leaderThumb = Array.from(thumbs).find(t => t.getAttribute('style')?.includes('box-shadow'))
    expect(leaderThumb).toBeTruthy()
  })

  it('shows Playoff badge when hasPlayoff is true', () => {
    const test = makeCardView({ hasPlayoff: true })
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
  it('renders as a link to test detail', () => {
    const test = makeCompleted()
    const { container } = render(<CompletedRow test={test} onOpen={vi.fn()} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe(`/cms/youtube/ab-lab/${test.id}`)
  })

  it('shows winner VChip and positive lift', () => {
    const test = makeCompleted({ lift: 15 })
    render(<CompletedRow test={test} onOpen={vi.fn()} />)
    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByText(/\+15\.0%/)).toBeTruthy()
  })

  it('shows Inconclusive badge for zero lift and low confidence', () => {
    const test = makeCompleted({ lift: 0 })
    test.confidence = 50
    render(<CompletedRow test={test} onOpen={vi.fn()} />)
    expect(screen.getByText('Inconclusive')).toBeTruthy()
  })

  it('calls onOpen on click', () => {
    const test = makeCompleted()
    const onOpen = vi.fn()
    const { container } = render(<CompletedRow test={test} onOpen={onOpen} />)
    fireEvent.click(container.querySelector('a')!)
    expect(onOpen).toHaveBeenCalledWith(test.id)
  })
})

/* ============================================================
 * DraftsBlock
 * ============================================================ */
describe('DraftsBlock', () => {
  it('renders nothing when draft is null', () => {
    const { container } = render(<DraftsBlock draft={null} onContinue={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders draft info when provided', () => {
    const draft = makeDraft({ step: 3 })
    render(<DraftsBlock draft={draft} onContinue={vi.fn()} />)
    expect(screen.getByText(draft.name)).toBeTruthy()
    expect(screen.getByText(/Parou no passo 3 de 5/)).toBeTruthy()
  })

  it('collapses and expands on trigger button click', () => {
    const draft = makeDraft()
    render(<DraftsBlock draft={draft} onContinue={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /Rascunhos/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Continuar configuração')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByText('Continuar configuração')).toBeTruthy()
  })

  it('calls onContinue when CTA clicked', () => {
    const draft = makeDraft()
    const onContinue = vi.fn()
    render(<DraftsBlock draft={draft} onContinue={onContinue} />)
    fireEvent.click(screen.getByText('Continuar configuração'))
    expect(onContinue).toHaveBeenCalledWith(draft.id)
  })
})

/* ============================================================
 * LearningsPanel
 * ============================================================ */
describe('LearningsPanel', () => {
  it('shows empty message when learnings is null', () => {
    render(<LearningsPanel learnings={null} />)
    expect(screen.getByText(/Complete 3\+ testes para desbloquear insights/)).toBeTruthy()
  })

  it('renders tag rows with win bars', () => {
    const data = makeLearnings({ tags: 5 })
    const { container } = render(<LearningsPanel learnings={data} />)
    const rows = container.querySelectorAll('[data-tag-row]')
    expect(rows.length).toBe(5)
  })

  it('renders win bar with role="meter"', () => {
    const data = makeLearnings({ tags: 1 })
    const { container } = render(<LearningsPanel learnings={data} />)
    const meters = container.querySelectorAll('[role="meter"]')
    expect(meters.length).toBeGreaterThanOrEqual(1)
  })

  it('applies line-through to negative tags', () => {
    const data = makeLearnings({ tags: 3, negativeTag: true })
    const { container } = render(<LearningsPanel learnings={data} />)
    const rows = container.querySelectorAll('[data-tag-row]')
    const firstRow = rows[0]
    const tagLabel = firstRow?.querySelector('span')
    expect(tagLabel?.className).toContain('line-through')
  })

  it('shows insight text', () => {
    const data = makeLearnings()
    const { container } = render(<LearningsPanel learnings={data} />)
    const insight = container.querySelector('[data-insight]')
    expect(insight?.textContent).toBe('Close-up faces perform 23% better on average.')
  })

  it('shows first 20 tags and "Show N more" when > 20', () => {
    const data = makeLearnings({ tags: 25 })
    const { container } = render(<LearningsPanel learnings={data} />)
    const rows = container.querySelectorAll('[data-tag-row]')
    expect(rows.length).toBe(20)
    expect(screen.getByText('Mostrar mais 5')).toBeTruthy()
  })

  it('expands to show all tags on "Show N more" click', () => {
    const data = makeLearnings({ tags: 25 })
    const { container } = render(<LearningsPanel learnings={data} />)
    fireEvent.click(screen.getByText('Mostrar mais 5'))
    const rows = container.querySelectorAll('[data-tag-row]')
    expect(rows.length).toBe(25)
  })
})

/* ============================================================
 * SuggestedCard
 * ============================================================ */
describe('SuggestedCard', () => {
  it('renders video title and grade pill', () => {
    const video = makeSuggestion({ grade: 'D' })
    const { container } = render(<SuggestedCard video={video} onCreate={vi.fn()} />)
    expect(screen.getByText(video.title)).toBeTruthy()
    const grade = container.querySelector('[data-grade]')
    expect(grade?.textContent).toBe('D')
  })

  it('shows red background for D/F grades', () => {
    const video = makeSuggestion({ grade: 'F' })
    const { container } = render(<SuggestedCard video={video} onCreate={vi.fn()} />)
    const grade = container.querySelector('[data-grade]')
    expect(grade?.className).toContain('red')
  })

  it('renders reason text', () => {
    const video = makeSuggestion({ reason: 'CTR very low' })
    const { container } = render(<SuggestedCard video={video} onCreate={vi.fn()} />)
    const reason = container.querySelector('[data-reason]')
    expect(reason?.textContent).toBe('CTR very low')
  })

  it('calls onCreate with video id and suggest type on CTA click', () => {
    const video = makeSuggestion({ suggest: 'title' })
    const onCreate = vi.fn()
    render(<SuggestedCard video={video} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('Testar Título'))
    expect(onCreate).toHaveBeenCalledWith(video.id, 'title')
  })
})

/* ============================================================
 * EmptyState
 * ============================================================ */
describe('EmptyState', () => {
  it('renders single CTA when no suggestions', () => {
    const { container } = render(<EmptyState suggested={[]} onCreate={vi.fn()} />)
    expect(screen.getByText('+ Novo teste')).toBeTruthy()
    expect(container.querySelector('[data-hero]')).toBeTruthy()
  })

  it('renders hero + cards when suggestions >= 3', () => {
    const suggested = makeSuggestions(3)
    const { container } = render(<EmptyState suggested={suggested} onCreate={vi.fn()} />)
    expect(container.querySelector('[data-hero]')).toBeTruthy()
    // 3 suggestion cards
    const articles = container.querySelectorAll('article')
    expect(articles.length).toBe(3)
  })

  it('renders hero + available cards when 1-2 suggestions', () => {
    const suggested = makeSuggestions(2)
    const { container } = render(<EmptyState suggested={suggested} onCreate={vi.fn()} />)
    expect(container.querySelector('[data-hero]')).toBeTruthy()
    const articles = container.querySelectorAll('article')
    expect(articles.length).toBe(2)
  })

  it('limits to 3 suggestion cards even if more provided', () => {
    const suggested = makeSuggestions(5)
    const { container } = render(<EmptyState suggested={suggested} onCreate={vi.fn()} />)
    const articles = container.querySelectorAll('article')
    expect(articles.length).toBe(3)
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
  const baseStats: DashboardStats = { activeTests: 2, avgConfidence: 92, winRate: 75, avgLift: 8.5 }
  const baseSettings: AbTestSiteSettings = { ...AB_SITE_SETTINGS_DEFAULTS }

  beforeEach(() => {
    mockRouterPush.mockClear()
  })

  it('renders KPI strip when completed tests exist', () => {
    const completed = [makeCompleted()]
    const { container } = render(
      <AbLabDashboard
        stats={baseStats}
        cards={[makeCardView()]}
        draft={null}
        completed={completed}
        paused={[]}
        learnings={null}
        suggested={[]}
        settings={baseSettings}
        siteId="site-1"
      />,
    )
    const kpiStrip = container.querySelector('[data-kpi-strip]')
    expect(kpiStrip).toBeTruthy()
    expect(screen.getAllByText('Testes ativos').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Confiança média')).toBeTruthy()
    expect(screen.getByText('Taxa de vitória')).toBeTruthy()
    expect(screen.getByText('Lift médio')).toBeTruthy()
  })

  it('renders EmptyState when no active tests and no draft', () => {
    render(
      <AbLabDashboard
        stats={{ activeTests: 0, avgConfidence: 0, winRate: 0, avgLift: 0 }}
        cards={[]}
        draft={null}
        completed={[]}
        paused={[]}
        learnings={null}
        suggested={[]}
        settings={baseSettings}
        siteId="site-1"
      />,
    )
    expect(screen.getByText('+ Novo teste')).toBeTruthy()
  })

  it('opens Settings drawer when Settings button is clicked', () => {
    render(
      <AbLabDashboard
        stats={baseStats}
        cards={[makeCardView()]}
        draft={null}
        completed={[]}
        paused={[]}
        learnings={null}
        suggested={[]}
        settings={baseSettings}
        siteId="site-1"
      />,
    )
    // Initially no dialog
    expect(screen.queryByRole('dialog')).toBeNull()
    // Click settings
    fireEvent.click(screen.getByLabelText('Settings'))
    // Dialog should appear
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('renders active cards in a 2-col grid', () => {
    const cards = [makeCardView(), makeCardView()]
    const { container } = render(
      <AbLabDashboard
        stats={baseStats}
        cards={cards}
        draft={null}
        completed={[]}
        paused={[]}
        learnings={null}
        suggested={[]}
        settings={baseSettings}
        siteId="site-1"
      />,
    )
    const grid = container.querySelector('[data-active-grid]')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('lg:grid-cols-2')
    // Should have 2 articles
    const articles = grid?.querySelectorAll('article')
    expect(articles?.length).toBe(2)
  })

  it('has animate-ab-fade-up on root element', () => {
    const { container } = render(
      <AbLabDashboard
        stats={baseStats}
        cards={[]}
        draft={null}
        completed={[]}
        paused={[]}
        learnings={null}
        suggested={[]}
        settings={baseSettings}
        siteId="site-1"
      />,
    )
    const root = container.querySelector('[data-dashboard-root]')
    expect(root).toBeTruthy()
    expect(root?.className).toContain('animate-ab-fade-up')
  })
})
