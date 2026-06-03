import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Axis } from '@/lib/youtube/scoring-types'

const { pushMock, toastSuccess } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}))

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import after mocks
import { YtHealthCoach } from '@/app/cms/(authed)/youtube/analytics/_components/yt-health-coach'

interface CoachingCard {
  axis: Axis
  score: number
  benchmark: number
  channelValue: number
  diagnosis: string
  action: string
  source: 'cowork' | 'fallback'
}

function makeCard(overrides: Partial<CoachingCard> & { axis: Axis }): CoachingCard {
  return {
    score: 2,
    benchmark: 7,
    channelValue: 3,
    diagnosis: 'Diagnostico de teste',
    action: 'Acao recomendada',
    source: 'fallback',
    ...overrides,
  }
}

const baseProps = {
  healthScore: 60,
  radarData: [{ label: 'CTR', value: 5, grade: 'B' }],
  coachingCards: [] as CoachingCard[],
  videoCount: 10,
  lastAnalysisAt: '2026-01-01T00:00:00Z',
  analysisState: 'idle' as const,
}

describe('YtHealthCoach', () => {
  beforeEach(() => {
    pushMock.mockClear()
    toastSuccess.mockClear()
  })

  it('shows empty state message when no coaching cards', () => {
    render(<YtHealthCoach {...baseProps} videoCount={0} coachingCards={[]} />)
    expect(screen.getByText('Nenhuma analise de inteligencia disponivel ainda.')).toBeDefined()
    expect(screen.getByText(/Health Coach usa dados de performance/)).toBeDefined()
  })

  it('renders coaching cards sorted by score ascending', () => {
    const cards = [
      makeCard({ axis: 'reach', score: 6 }),
      makeCard({ axis: 'ctr', score: 1 }),
      makeCard({ axis: 'engagement', score: 4 }),
    ]
    const { container } = render(
      <YtHealthCoach {...baseProps} coachingCards={cards} />,
    )
    const cardEls = container.querySelectorAll('.coach-item')
    expect(cardEls.length).toBe(3)
    // First card should be CTR (score 1), then Engagement (score 4), then Reach (score 6)
    expect(cardEls[0]!.textContent).toContain('CTR')
    expect(cardEls[1]!.textContent).toContain('Engajamento')
    expect(cardEls[2]!.textContent).toContain('Alcance')
  })

  it('shows correct severity styling — critical when score < 3', () => {
    const cards = [makeCard({ axis: 'ctr', score: 2 })]
    render(<YtHealthCoach {...baseProps} coachingCards={cards} />)
    expect(screen.getByText('Alta')).toBeDefined()
  })

  it('shows correct severity styling — warning when score < 5', () => {
    const cards = [makeCard({ axis: 'retention', score: 4 })]
    render(<YtHealthCoach {...baseProps} coachingCards={cards} />)
    expect(screen.getByText('Media')).toBeDefined()
  })

  it('CTR card button says "Criar A/B Test"', () => {
    const cards = [makeCard({ axis: 'ctr', score: 2 })]
    render(<YtHealthCoach {...baseProps} coachingCards={cards} />)
    expect(screen.getByRole('button', { name: /Criar A\/B Test/ })).toBeDefined()
  })

  it('CTR card button navigates to /cms/youtube/ab-lab/new', () => {
    const cards = [makeCard({ axis: 'ctr', score: 2 })]
    render(<YtHealthCoach {...baseProps} coachingCards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /Criar A\/B Test/ }))
    expect(pushMock).toHaveBeenCalledWith('/cms/youtube/ab-lab/new')
  })

  it('non-CTR card button shows honest "Ação anotada" toast', () => {
    const cards = [makeCard({ axis: 'engagement', score: 3, action: 'Melhorar CTA' })]
    render(<YtHealthCoach {...baseProps} coachingCards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /Melhorar CTA/ }))
    expect(toastSuccess).toHaveBeenCalledWith('Ação anotada: "Melhorar CTA"')
  })

  it('shows "Solicitar Nova Analise" button when onRequestAnalysis provided', () => {
    const fn = vi.fn()
    render(
      <YtHealthCoach {...baseProps} onRequestAnalysis={fn} />,
    )
    const btn = screen.getByRole('button', { name: 'Solicitar Nova Analise' })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('disables analysis button when analysisState is not idle', () => {
    const fn = vi.fn()
    render(
      <YtHealthCoach {...baseProps} onRequestAnalysis={fn} analysisState="pending" />,
    )
    const btn = screen.getByRole('button', { name: 'Em fila...' })
    expect(btn).toBeDefined()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
