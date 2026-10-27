// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { placarVazio } from '../helpers/ab-placar-fixture'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { ForcarRotacao } from '@/app/cms/(authed)/youtube/ab-lab/_components/forcar-rotacao'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

const ACOES = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(), acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: vi.fn(() => ({ data: null, loading: false })),
}))
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Activity: icon('Activity'), BarChart3: icon('BarChart3'), ChevronDown: icon('ChevronDown'),
    ChevronLeft: icon('ChevronLeft'), ChevronRight: icon('ChevronRight'), Crosshair: icon('Crosshair'),
    Eye: icon('Eye'), LayoutGrid: icon('LayoutGrid'), ExternalLink: icon('ExternalLink'), FileText: icon('FileText'), Filter: icon('Filter'), Image: icon('Image'),
    Layers: icon('Layers'), Lock: icon('Lock'), Minus: icon('Minus'), Pause: icon('Pause'), Play: icon('Play'),
    RefreshCw: icon('RefreshCw'), Settings: icon('Settings'), Square: icon('Square'), Timer: icon('Timer'), Check: icon('Check'),
    Swords: icon('Swords'), TrendingDown: icon('TrendingDown'), TrendingUp: icon('TrendingUp'),
    Type: icon('Type'), X: icon('X'), Zap: icon('Zap'),
  }
})
afterEach(cleanup)

function makeActiveView(overrides?: Partial<AbTestActiveView>): AbTestActiveView {
  return {
    id: 'test-1', videoTitle: 'My YouTube Video', flag: 'thumbnail', status: 'active',
    variants: [
      { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000, clicks: 500, pBest: 0.3 },
      { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000, clicks: 700, pBest: 0.7 },
    ],
    variantThumbs: [
      { label: 'A', color: '#8A8F98', thumbUrl: null, isOriginal: true },
      { label: 'B', color: '#E8823C', thumbUrl: 'https://example.com/b.jpg', isOriginal: false },
    ],
    confTrend: [50, 65, 78, 85, 88],
    daily: { A: [5.0, 5.1, 4.9], B: [6.0, 6.5, 7.0] } as Record<DisplayLabel, number[]>,
    abbaSeq: ['A', 'B', 'B', 'A', 'A', 'B'] as DisplayLabel[],
    cycles: { total: 6, done: 4 },
    dayOf: 4,
    durationDays: 14,
    confidenceTarget: 0.95,
    totalRounds: 1,
    hasPlayoff: false,
    gates: [
      { name: 'confidence', passed: true, value: '88%' },
      { name: 'min_impressions', passed: true, value: '10,000 min' },
      { name: 'min_duration', passed: true, value: '10 / 7 days' },
      { name: 'min_cycles', passed: true, value: '16 / 14 cycles' },
      { name: 'burn_in', passed: true, value: '14 eligible' },
      { name: 'stability', passed: false, value: '2 / 3 consecutive' },
    ],
    confirmedData: { confidence: 88, leader: 'B' as DisplayLabel, leaderColor: '#E8823C', lift: 12.3 },
    // Fixture legada da F2: hero e faixa só abrem com estatística calculada (D-F3-2); a F4 os reativa na tela real.
    placar: placarVazio({ estatistica: 'calculada' }),
    ...overrides,
  } as AbTestActiveView
}

const NOTA_GENERICA = 'O ritmo normal da rotação continua depois disso.'
const clicar = () => fireEvent.click(screen.getByRole('button', { name: 'Forçar rotação' }))

describe('M7d T5: ForcarRotacao', () => {
  it('abre o diálogo com título e nota exatos (atual A, próxima B); confirm nativo nunca é chamado', () => {
    const confirmar = vi.spyOn(window, 'confirm')
    render(<ForcarRotacao testId="t1" atual="A" proxima="B" escrevendo={false} forcar={vi.fn()} />)
    clicar()
    const d = screen.getByRole('alertdialog')
    expect(d.textContent).toContain('Forçar rotação agora?')
    expect(d.textContent).toContain('A versão atual será trocada no YouTube agora.')
    expect(d.textContent).toContain(`A versão A sai do ar e a B entra. ${NOTA_GENERICA}`)
    expect(confirmar).not.toHaveBeenCalled()
  })
  it('proxima nula: nota genérica', () => {
    render(<ForcarRotacao testId="t1" atual="A" proxima={null} escrevendo={false} forcar={vi.fn()} />)
    clicar()
    const d = screen.getByRole('alertdialog')
    expect(d.textContent).toContain(NOTA_GENERICA)
    expect(d.textContent).not.toContain('sai do ar')
  })
  it('confirmar chama forcar uma vez com o id', async () => {
    const forcar = vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })
    render(<ForcarRotacao testId="t1" atual="A" proxima="B" escrevendo={false} forcar={forcar} />)
    clicar()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Forçar rotação' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(forcar).toHaveBeenCalledTimes(1)
    expect(forcar).toHaveBeenCalledWith('t1')
  })
  it('recusa mostra o erro no diálogo', async () => {
    const forcar = vi.fn().mockResolvedValue({ ok: false, resultado: 'erro', error: 'x' })
    render(<ForcarRotacao testId="t1" atual="A" proxima="B" escrevendo={false} forcar={forcar} />)
    clicar()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Forçar rotação' }))
    expect((await screen.findByRole('alert')).textContent).toContain('x')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })
  it('escrevendo: aria-disabled, apoio com role=status e clique sem efeito', () => {
    render(<ForcarRotacao testId="t1" atual="A" proxima="B" escrevendo forcar={vi.fn()} />)
    const b = screen.getByRole('button', { name: 'Forçar rotação' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.getAttribute('aria-describedby')).toBe('apoio-rot')
    const apoio = document.getElementById('apoio-rot')!
    expect(apoio.getAttribute('role')).toBe('status')
    expect(apoio.textContent).toBe('Gravando no YouTube. A rotação volta em instantes.')
    fireEvent.click(b)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('M7d T5: no ActiveDetail', () => {
  it('a próxima vem de view.proximaNaRotacao, não de abbaSeq[done]', () => {
    // abbaSeq[done=4] seria 'A'; proximaNaRotacao diz 'B'.
    render(<ActiveDetail view={makeActiveView({ proximaNaRotacao: 'B', activeNow: 'A' } as Partial<AbTestActiveView>)} {...ACOES} />)
    clicar()
    expect(screen.getByRole('alertdialog').textContent).toContain('A versão A sai do ar e a B entra.')
  })
  it('random (proximaNaRotacao nula): nota genérica', () => {
    render(<ActiveDetail view={makeActiveView({ proximaNaRotacao: null, activeNow: 'A' } as Partial<AbTestActiveView>)} {...ACOES} />)
    clicar()
    expect(screen.getByRole('alertdialog').textContent).not.toContain('sai do ar')
  })
  it('sem administrar o site: nenhum "Forçar rotação", fica o AdminOnlyNote', () => {
    siteAdmin.value = false
    try {
      render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
      expect(screen.queryByRole('button', { name: 'Forçar rotação' })).toBeNull()
      expect(screen.getByTestId('admin-only-note').textContent).toBe('Só quem administra o site pode forçar rotação.')
    } finally { siteAdmin.value = true }
  })
  it('pausado: sem botão e com a linha da rotação parada', () => {
    render(<ActiveDetail view={makeActiveView({ status: 'paused' })} {...ACOES} />)
    expect(screen.queryByRole('button', { name: 'Forçar rotação' })).toBeNull()
    expect(screen.getByText('A rotação está parada enquanto o teste está pausado.')).toBeTruthy()
  })
})
