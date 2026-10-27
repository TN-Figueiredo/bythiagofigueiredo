// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { placarVazio } from '../helpers/ab-placar-fixture'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { EarlyDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/early-detail'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
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

describe('M7d T3b: barra de ações no cabeçalho', () => {
  it('Pausar vem antes do placar e "Abrir no YouTube" está no header', () => {
    const { container } = render(<ActiveDetail view={makeActiveView({ youtubeVideoId: 'abc123' })} {...ACOES} />)
    const pausar = screen.getByRole('button', { name: 'Pausar' })
    const placar = container.querySelector('[data-section="variant-performance"]')!
    expect(pausar.compareDocumentPosition(placar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('header')!.contains(screen.getByTestId('abrir-no-youtube'))).toBe(true)
  })
  it('sem "Configurações" e sem "Forçar rotação" no cabeçalho', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    expect(screen.queryByRole('button', { name: 'Configurações' })).toBeNull()
    expect(container.querySelector('header')!.textContent).not.toContain('Forçar rotação')
    expect(container.querySelector('[data-section="acoes"]')).toBeNull()
  })
  it('escrevendo: Pausar e Encerrar com aria-disabled, apoio com role=status, clique sem efeito', () => {
    render(<ActiveDetail view={makeActiveView()} escrevendo {...ACOES} />)
    for (const n of ['Pausar', 'Encerrar']) {
      const b = screen.getByRole('button', { name: n })
      expect(b.getAttribute('aria-disabled')).toBe('true')
      expect(b.getAttribute('aria-describedby')).toBe('apoio-acoes')
    }
    const apoio = document.getElementById('apoio-acoes')!
    expect(apoio.getAttribute('role')).toBe('status')
    expect(apoio.textContent).toBe('Gravando no YouTube. Pausar e Encerrar voltam em instantes.')
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('sem escrevendo: Pausar sem aria-disabled', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    expect(screen.getByRole('button', { name: 'Pausar' }).getAttribute('aria-disabled')).toBeNull()
    expect(document.getElementById('apoio-acoes')).toBeNull()
  })
  it('pausado comum: Retomar no cabeçalho chama retomar com restoreSeq', () => {
    const retomar = vi.fn()
    const { container } = render(<ActiveDetail view={makeActiveView({ status: 'paused', restoreSeq: 7 })} encerrar={vi.fn()} pausar={vi.fn()} retomar={retomar} />)
    const b = screen.getByRole('button', { name: 'Retomar' })
    expect(container.querySelector('header')!.contains(b)).toBe(true)
    expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull()
    fireEvent.click(b)
    expect(retomar).toHaveBeenCalledWith(7)
  })
  it('EarlyDetail pausado também tem Retomar', () => {
    const retomar = vi.fn()
    render(<EarlyDetail view={makeActiveView({ status: 'paused', restoreSeq: 3 })} encerrar={vi.fn()} pausar={vi.fn()} retomar={retomar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retomar' }))
    expect(retomar).toHaveBeenCalledWith(3)
  })
  it('deriva: sem Retomar no cabeçalho, com "Reconhecer e Retomar"', () => {
    render(<ActiveDetail view={makeActiveView({ status: 'paused', statusNote: DRIFT_STATUS_NOTE })} {...ACOES} />)
    expect(screen.queryByRole('button', { name: 'Retomar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Reconhecer e Retomar' })).toBeTruthy()
  })
  it('pausa por teste do YouTube com retomarDesabilitado: Retomar aria-disabled e não chama', () => {
    const retomar = vi.fn()
    render(<ActiveDetail view={makeActiveView({ status: 'paused', pausaYoutube: { aberto: true, ate: null } })} encerrar={vi.fn()} pausar={vi.fn()} retomar={retomar} />)
    const b = screen.getByRole('button', { name: 'Retomar' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(b)
    expect(retomar).not.toHaveBeenCalled()
  })
  it('Encerrar com dhl-bt--dest só quando o freio é completo', () => {
    const dia = (estado: string) => ({ estado, day_pt: '2026-10-21', variante: 'A', impressoes: 1, ctr: 0.1, motivo: null }) as never
    const completo = render(<ActiveDetail view={makeActiveView({ dayOf: 13, durationDays: 14, faixa_dias: [dia('medido')] as never })} {...ACOES} />)
    expect(screen.getByRole('button', { name: 'Encerrar' }).className).toContain('dhl-bt--dest')
    completo.unmount()
    render(<ActiveDetail view={makeActiveView({ dayOf: 5, durationDays: 14, faixa_dias: [dia('medido')] as never })} {...ACOES} />)
    expect(screen.getByRole('button', { name: 'Encerrar' }).className).not.toContain('dhl-bt--dest')
  })
})
