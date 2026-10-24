import { describe, it, expect, vi, afterEach } from 'vitest'
import { placarVazio } from '../helpers/ab-placar-fixture'

// Degrau "administrar o site": por padrão estes testes rodam como quem administra (o dono).
const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen } from '@testing-library/react'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

const ACOES = { encerrar: vi.fn(), pausar: vi.fn() }

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(),
  applyWinnerNow: vi.fn(),
  cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(),
  resumeAbTest: vi.fn(),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: vi.fn(() => ({ data: null, loading: false })),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Activity: icon('Activity'), BarChart3: icon('BarChart3'), ChevronDown: icon('ChevronDown'),
    ChevronLeft: icon('ChevronLeft'), ChevronRight: icon('ChevronRight'), Crosshair: icon('Crosshair'),
    Eye: icon('Eye'), FileText: icon('FileText'), Filter: icon('Filter'), Image: icon('Image'),
    Layers: icon('Layers'), Lock: icon('Lock'), Minus: icon('Minus'), Pause: icon('Pause'),
    RefreshCw: icon('RefreshCw'), Settings: icon('Settings'), Square: icon('Square'),
    Swords: icon('Swords'), TrendingDown: icon('TrendingDown'), TrendingUp: icon('TrendingUp'),
    Type: icon('Type'), X: icon('X'), Zap: icon('Zap'),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ─── Fixture ─── */

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

const SEM_IMP: Partial<AbTestActiveView> = {
  variants: [
    { label: 'A', color: '#8A8F98', ctr: 0, impressions: 0, clicks: 0, pBest: 0.5 },
    { label: 'B', color: '#E8823C', ctr: 0, impressions: 0, clicks: 0, pBest: 0.5 },
  ],
}

/* ─── Tests ─── */

describe('ActiveDetail', () => {
  it('renders key sections via data-section attributes', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    const sections = [
      'header', 'lock-countdown', 'hero-band', 'variant-performance',
    ]
    for (const s of sections) {
      expect(container.querySelector(`[data-section="${s}"]`), `missing section: ${s}`).not.toBeNull()
    }
  })

  it('quem administra o site vê "Forçar rotação"; a editora vê o motivo no lugar, e segue com Pausar/Encerrar', () => {
    const admin = render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    expect(admin.getByText('Forçar rotação')).toBeTruthy()
    expect(admin.queryByTestId('admin-only-note')).toBeNull()
    admin.unmount()

    siteAdmin.value = false
    try {
      const editor = render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
      expect(editor.queryByText('Forçar rotação')).toBeNull()
      expect(editor.getByText('Pausar')).toBeTruthy()
      expect(editor.getByText('Encerrar')).toBeTruthy()
      expect(editor.getByTestId('admin-only-note').textContent).toBe('Só quem administra o site pode forçar rotação.')
    } finally {
      siteAdmin.value = true
    }
  })

  it('não mostra watch time, comentários, compartilh., receita estimada nem Raio-X; mostra a frase fixa', () => {
    render(<ActiveDetail view={makeActiveView({ revenue: { low: 1200, high: 3600, currency: 'BRL', isDefault: false }, ...SEM_IMP } as Partial<AbTestActiveView>)} {...ACOES} />)
    for (const texto of [/watch time/i, /comentários/i, /compartilh/i, /receita estimada/i, /raio-x/i]) {
      expect(screen.queryAllByText(texto), String(texto)).toHaveLength(0)
    }
    expect(screen.getAllByText('CTR ainda não medido. Você decide o vencedor.').length).toBeGreaterThan(0)
  })

  it('o banner de carência não promete aplicação automática', () => {
    const view = makeActiveView({ graceExpiresAt: new Date(Date.now() + 5 * 3600000).toISOString(), winnerAppliedAt: null })
    render(<ActiveDetail view={view} {...ACOES} />)
    expect(screen.queryAllByText(/aplicação automática/i)).toHaveLength(0)
  })

  it('SignalCard renders "Sinal ao vivo" heading', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    expect(screen.getByText('Sinal ao vivo')).toBeDefined()
  })

  it('placar do teste ativo: ordem fixa por rótulo, sem ordenar por CTR e sem coluna de chance de vencer (S8-F3 T5)', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    expect(screen.getByText('Placar por variante')).toBeDefined()
    expect(screen.queryByText('ordenado por CTR')).toBeNull()
    expect(screen.queryByText(/chance de vencer/i)).toBeNull()
  })

  it('não mostra o painel de critérios nem "N / 3 consecutive"; a frase fixa ocupa o lugar', () => {
    const { container } = render(<ActiveDetail view={makeActiveView(SEM_IMP)} {...ACOES} />)
    expect(screen.queryAllByText(/\d+ ?\/ ?3/)).toHaveLength(0)
    expect(screen.queryAllByText(/consecutive/i)).toHaveLength(0)
    expect(screen.queryAllByText(/10,000 min/)).toHaveLength(0)
    expect(container.textContent).not.toContain('5/6 ok')
    expect(screen.queryAllByText(/Critérios de resolução automática/i)).toHaveLength(0)
    expect(screen.getAllByText('CTR ainda não medido. Você decide o vencedor.').length).toBeGreaterThan(0)
  })

  it('não mostra o bloco "Chance de vencer" (probabilidade sobre views)', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    expect(screen.queryAllByText('Chance de vencer')).toHaveLength(0)
    expect(screen.queryAllByText(/ordenado por chance de vencer/i)).toHaveLength(0)
    expect(screen.queryAllByText(/^(30|70)%$/)).toHaveLength(0)
    expect(screen.queryAllByText(/10 mil simulações/)).toHaveLength(0)
  })

  it('bloco de confiança saiu: sem curva, sem meta 95%, frase fixa com contraste legível', () => {
    const { container } = render(<ActiveDetail view={makeActiveView(SEM_IMP)} {...ACOES} />)
    expect(container.textContent).not.toMatch(/meta 95%/)
    expect(container.textContent).not.toMatch(/curva de confiança/i)
    expect(container.textContent).not.toMatch(/Confiança ao longo do tempo/)
    const frase = screen.getAllByText('CTR ainda não medido. Você decide o vencedor.')
    for (const el of frase) {
      expect(el.className).not.toMatch(/text-cms-text-(dim|muted)/)
    }
  })

  it('KPIs do topo: sem CONFIANÇA, sem "0%" de líder nem "0,0%" de lift; nulo mostra "—" e a frase', () => {
    const view = makeActiveView({ confirmedData: { confidence: 0, leader: 'A' as DisplayLabel, leaderColor: '#8A8F98', lift: 0 }, ...SEM_IMP })
    render(<ActiveDetail view={view} {...ACOES} />)
    const hero = screen.getByTestId('hero-band')
    expect(hero.textContent).not.toMatch(/Confiança/i)
    expect(hero.textContent).not.toMatch(/\b0\s?%/)
    expect(hero.textContent).not.toMatch(/0,0%/)
    expect(hero.textContent).not.toMatch(/chance de vencer/i)
    expect(hero.textContent).toContain('—')
    expect(hero.textContent).toContain('CTR ainda não medido. Você decide o vencedor.')
  })

  it('ABBATimeline receives seq data and renders cycle count', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    // ABBATimeline footer shows "done/total ciclos ABBA completos"
    expect(screen.getByText('4/6 ciclos ABBA completos')).toBeDefined()
  })

  it('LockCountdown section exists', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    const lockSection = container.querySelector('[data-section="lock-countdown"]')
    expect(lockSection).not.toBeNull()
    // Contains the lock text
    expect(lockSection?.textContent).toContain('Roda até 14 dias ou até você encerrar. Ao encerrar, você escolhe o vencedor.')
    expect(lockSection?.textContent).not.toContain('critérios de resolução')
  })

  it('HeroBand shows leader VChip for variant B', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    // Multiple VChips with "Variant B" exist (hero-band + variant-table)
    const chips = screen.getAllByLabelText('Variant B')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('ClickMoment component is rendered', () => {
    render(<ActiveDetail view={makeActiveView()} {...ACOES} />)
    // ClickMoment renders context buttons like "Home"
    expect(screen.getByText('Home')).toBeDefined()
  })

  it('title from view.videoTitle renders in header', () => {
    render(<ActiveDetail view={makeActiveView({ videoTitle: 'Special Test Video Title' })} {...ACOES} />)
    // Title may appear multiple times (header, variant table, click-moment, feed)
    const allTitles = screen.getAllByText('Special Test Video Title')
    expect(allTitles.length).toBeGreaterThanOrEqual(1)
  })
})
