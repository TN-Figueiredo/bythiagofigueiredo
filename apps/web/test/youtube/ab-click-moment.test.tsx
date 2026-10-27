import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ClickMomentVariant } from '@/lib/youtube/ab-wizard-adapter'

// TODO: Tests broken by component redesign — fix when stabilized

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'), Smartphone: icon('Smartphone'),
    Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'), Lock: icon('Lock'), Plus: icon('Plus'),
    Trash2: icon('Trash2'), Sparkles: icon('Sparkles'), CheckCircle: icon('CheckCircle'), Play: icon('Play'),
    ChevronDown: icon('ChevronDown'), X: icon('X'), ArrowLeft: icon('ArrowLeft'),
    MousePointerClick: icon('MousePointerClick'),
  }
})

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}))

/* ── YTThumb ── */
import { YTThumb } from '@/app/cms/(authed)/youtube/ab-lab/_components/yt-thumb'

describe('YTThumb', () => {
  it('renders img when thumbUrl provided', () => {
    const { container } = render(<YTThumb thumbUrl="https://example.com/thumb.jpg" />)
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders gradient when thumbBg provided without thumbUrl', () => {
    const { container } = render(<YTThumb thumbBg="#E8823C" overlayText="Test" />)
    expect(container.querySelector('[style]')).toBeTruthy()
  })

  it('renders solid fallback when both missing', () => {
    const { container } = render(<YTThumb />)
    expect(container.querySelector('.bg-\\[\\#1a1814\\]')).toBeTruthy()
  })

  it('hides overlay and duration in mini mode', () => {
    const { container } = render(<YTThumb thumbBg="#E8823C" overlayText="Hidden" duration="12:34" mini />)
    expect(container.textContent).not.toContain('Hidden')
    expect(container.textContent).not.toContain('12:34')
  })

  it('shows duration chip', () => {
    render(<YTThumb thumbUrl="https://example.com/thumb.jpg" duration="12:34" />)
    expect(screen.getByText('12:34')).toBeTruthy()
  })

  it('shows label badge', () => {
    render(<YTThumb thumbUrl="https://example.com/thumb.jpg" label="Winner" />)
    expect(screen.getByText('Winner')).toBeTruthy()
  })
})

/* ── BehaviorStrip ── */
import { BehaviorStrip } from '@/app/cms/(authed)/youtube/ab-lab/_components/behavior-strip'

describe('BehaviorStrip', () => {
  it('renders VChip with label', () => {
    render(<BehaviorStrip label="A" color="#8A8F98" ctr={5.0} maxCtr={7.0} />)
    expect(screen.getByLabelText('Variante A')).toBeTruthy()
  })

  it('shows CTR value', () => {
    render(<BehaviorStrip label="B" color="#E8823C" ctr={6.5} maxCtr={7.0} />)
    expect(screen.getByText((t) => /6[.,]50\s*%/.test(t))).toBeTruthy()
  })

  it('shows green delta for positive lift', () => {
    const { container } = render(<BehaviorStrip label="B" color="#E8823C" ctr={6.0} maxCtr={7.0} delta={20} />)
    expect(container.querySelector('.text-cms-green')).toBeTruthy()
    expect(screen.getByText('+20%')).toBeTruthy()
  })

  it('shows red delta for negative lift', () => {
    const { container } = render(<BehaviorStrip label="C" color="#3FA9C0" ctr={4.0} maxCtr={7.0} delta={-15} />)
    expect(container.querySelector('.text-red-400')).toBeTruthy()
  })

  it('hides delta for baseline', () => {
    const { container } = render(<BehaviorStrip label="A" color="#8A8F98" ctr={5.0} maxCtr={7.0} isBaseline delta={0} />)
    expect(container.querySelectorAll('.text-cms-green, .text-red-400').length).toBe(0)
  })

  it('renders leader ring on VChip', () => {
    render(<BehaviorStrip label="B" color="#E8823C" ctr={7.0} maxCtr={7.0} isLeader />)
    const chip = screen.getByLabelText('Variante B')
    expect(chip.getAttribute('style')).toContain('box-shadow')
  })
})

/* ── ClickMoment ── */
import { ClickMoment } from '@/app/cms/(authed)/youtube/ab-lab/_components/click-moment'

const mockVariants = [
  { label: 'A' as const, color: '#8A8F98', thumbUrl: 'https://example.com/a.jpg', title: 'Original Title', ctr: 5.0 },
  { label: 'B' as const, color: '#E8823C', thumbUrl: 'https://example.com/b.jpg', title: 'Variant B Title', ctr: 7.0 },
]
const metaNula = { canal: null, publicadoEm: null, duracao: null }

describe('ClickMoment', () => {
  const props = { winnerLabel: 'B' as const, winnerColor: '#E8823C', meta: metaNula, descricao: 'Neste teste o título e a miniatura mudam juntos.' }

  it('renderiza o cabeçalho e a frase do tipo, sem seletor Comparar/No feed', () => {
    const { container } = render(<ClickMoment variants={mockVariants} {...props} semCtr semVencedor />)
    expect(screen.getByText('O momento de clique')).toBeTruthy()
    expect(container.textContent).toContain('É assim que cada variante aparece para o espectador. Neste teste o título e a miniatura mudam juntos.')
    expect(container.textContent).not.toMatch(/Comparar|No feed/)
  })

  it('um cartão por variante, com chip, rótulo e título próprio', () => {
    const { container } = render(<ClickMoment variants={mockVariants} {...props} semCtr semVencedor />)
    expect(screen.getAllByLabelText('Variante A').length).toBe(1)
    expect(screen.getAllByLabelText('Variante B').length).toBe(1)
    expect(container.textContent).toContain('Original')
    expect(container.textContent).toContain('Variante B')
    expect(container.textContent).toContain('Variant B Title')
  })

  it('pills de contexto têm aria-pressed e 44 px', () => {
    render(<ClickMoment variants={mockVariants} {...props} semCtr semVencedor />)
    const home = screen.getByRole('button', { name: 'Home' })
    expect(home.getAttribute('aria-pressed')).toBe('true')
    expect(home.style.minHeight).toBe('44px')
    fireEvent.click(screen.getByRole('button', { name: 'Busca' }))
    expect(screen.getByRole('button', { name: 'Busca' }).getAttribute('aria-pressed')).toBe('true')
    expect(home.getAttribute('aria-pressed')).toBe('false')
  })

  it('sem vencedor, todos os contextos mostram todas as variantes', () => {
    const tres = [...mockVariants, { label: 'C' as const, color: '#3C8', thumbUrl: null, title: 'TC', ctr: null }]
    render(<ClickMoment variants={tres} {...props} semCtr semVencedor />)
    for (const nome of ['Busca', 'Sugeridos', 'Mobile']) {
      fireEvent.click(screen.getByRole('button', { name: nome }))
      expect(screen.getAllByLabelText(/^Variante [ABC]$/).length).toBe(3)
    }
  })

  it('sem miniatura: "Sem miniatura" e botão da Biblioteca só nas não originais', () => {
    const onEscolher = vi.fn()
    render(<ClickMoment variants={[
      { label: 'A', color: '#8A8F98', thumbUrl: null, title: 'TA', ctr: null },
      { label: 'B', color: '#E8823C', thumbUrl: null, title: 'TB', ctr: null },
    ]} {...props} semCtr semVencedor onEscolherDaBiblioteca={onEscolher} />)
    expect(screen.getAllByText('Sem miniatura').length).toBe(2)
    const botoes = screen.getAllByRole('button', { name: 'Escolher da Biblioteca' })
    expect(botoes.length).toBe(1)
    fireEvent.click(botoes[0]!)
    expect(onEscolher).toHaveBeenCalledWith('B')
  })

  it('meta real aparece; meta nula não inventa nada', () => {
    const { container, rerender } = render(<ClickMoment variants={mockVariants} {...props} semCtr semVencedor meta={{ canal: 'bythiago', publicadoEm: '21 out 2026', duracao: '12:48' }} />)
    expect(container.textContent).toContain('@bythiago')
    expect(container.textContent).not.toContain('@@')
    expect(container.textContent).toContain('Publicado em 21 out 2026')
    expect(container.textContent).toContain('12:48')
    rerender(<ClickMoment variants={mockVariants} {...props} semCtr semVencedor />)
    expect(container.textContent).not.toMatch(/@|Publicado em|12:48/)
  })
})

/* ── FeedView ── */
import { FeedView } from '@/app/cms/(authed)/youtube/ab-lab/_components/feed-view'

describe('FeedView', () => {
  const variants: ClickMomentVariant[] = [
    { label: 'A', color: '#8A8F98', thumbUrl: null, title: 'Test Video', ctr: 5.0 },
    { label: 'B', color: '#E8823C', thumbUrl: null, title: 'Variante B', ctr: 7.0 },
  ]

  it('renders decoy videos', () => {
    const { container } = render(<FeedView variants={variants} />)
    const hidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThanOrEqual(5)
  })

  it('shows "Your video" badge', () => {
    render(<FeedView variants={variants} />)
    expect(screen.getByText('Seu vídeo')).toBeTruthy()
  })

  it('renders variant selector', () => {
    render(<FeedView variants={variants} />)
    expect(screen.getByRole('radiogroup', { name: 'Selecionar variante para pré-visualizar' })).toBeTruthy()
  })

  it('returns null for empty variants', () => {
    const { container } = render(<FeedView variants={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

/* P2 conserto final: prévia do wizard e tela do vencedor sem CTR inventado */
describe('ClickMoment (P2: semCtr / semVencedor)', () => {
  const vs = [
    { label: 'A' as const, color: '#8A8F98', thumbUrl: null, title: 'TA', ctr: 4.2 },
    { label: 'B' as const, color: '#E8823C', thumbUrl: null, title: 'TB', ctr: 5.3 },
  ]
  const meta = { canal: null, publicadoEm: null, duracao: null }
  const descricao = 'Neste teste o título e a miniatura mudam juntos.'
  it('prévia do wizard: sem selo de vencedor, sem CTR nem lift', () => {
    const { container } = render(<ClickMoment winnerLabel="B" winnerColor="#E8823C" variants={vs} semCtr semVencedor meta={meta} descricao={descricao} />)
    expect(container.textContent).not.toMatch(/vencedor/i)
    expect(container.textContent).not.toMatch(/\+26%/)
    expect(container.textContent).not.toMatch(/5,3%/)
  })
  it('sem as flags (comportamento antigo), o CTR aparece', () => {
    const { container } = render(<ClickMoment winnerLabel="B" winnerColor="#E8823C" variants={vs} meta={meta} descricao={descricao} />)
    expect(container.textContent).toMatch(/5,3%/)
  })
})
