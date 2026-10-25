import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepRevisar } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import type { ReviewVariant } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import type { TestType } from '@/lib/youtube/ab-types'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { textoAvisoOriginalBaixa, AVISO_INDISPONIVEL } from '@/lib/youtube/ab-original-resolucao'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Lock: icon('Lock'), Plus: icon('Plus'), Trash2: icon('Trash2'), Sparkles: icon('Sparkles'),
    CheckCircle: icon('CheckCircle'), Play: icon('Play'), ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'), ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'),
    Download: icon('Download'), Pause: icon('Pause'), Square: icon('Square'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'),
    Smartphone: icon('Smartphone'), Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'), MousePointerClick: icon('MousePointerClick'), AlertTriangle: icon('AlertTriangle'), CircleHelp: icon('CircleHelp'),
  }
})

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/click-moment', () => ({
  ClickMoment: (props: Record<string, unknown>) => <div data-testid="click-moment" data-variants={JSON.stringify(props.variants)} />,
}))

const defaultConfig: WizardConfig = {
  confidence: 95,
  duration: 14,
  burnIn: 1,
  rotation: 'abba' as const,
}

const defaultVariants: ReviewVariant[] = [
  { label: 'A', thumbUrl: 'https://img.example.com/a.jpg', title: 'Original Title', isOriginal: true },
  { label: 'B', thumbUrl: 'https://img.example.com/b.jpg', title: 'Challenger B Title', isOriginal: false },
  { label: 'C', thumbUrl: null, title: 'Challenger C Title', isOriginal: false },
]

function renderRevisar(overrides?: {
  type?: TestType
  variants?: ReviewVariant[]
  config?: Partial<WizardConfig>
}) {
  return render(
    <StepRevisar
      type={overrides?.type ?? 'thumbnail'}
      variants={overrides?.variants ?? defaultVariants}
      config={{ ...defaultConfig, ...overrides?.config }}
      meta={{ canal: null, publicadoEm: null, duracao: null }}
    />
  )
}

describe('StepRevisar', () => {
  it('shows "Tudo pronto" success banner with CheckCircle icon', () => {
    renderRevisar()
    expect(screen.getByText('Tudo pronto.')).toBeDefined()
    expect(screen.getByTestId('icon-CheckCircle')).toBeDefined()
  })

  it('success banner shows one-liner summary with variant count, type, rotation, duration', () => {
    renderRevisar({ type: 'combo', config: { rotation: 'abba', duration: 14, confidence: 95, durationTouched: true } })
    // "3 variantes título + thumbnail · rotação ABBA · Duração: 17 dias; mínimo 16"
    const summary = screen.getByText(/3 variantes título \+ thumbnail/)
    expect(summary.textContent).toContain('rotação ABBA')
    expect(summary.textContent).toContain('Duração: 17 dias; mínimo 16')
    expect(summary.textContent).not.toContain('confiança')
    expect(summary.textContent).not.toContain('playoff')
  })

  it('tipo antigo (description por cast): resumo usa o rótulo de reserva, não lança', () => {
    renderRevisar({ type: 'description' as TestType })
    expect(screen.getByText(/3 variantes tipo antigo/)).toBeDefined()
  })

  it('combo se lê "título + thumbnail" no resumo', () => {
    renderRevisar({ type: 'combo' })
    expect(screen.getByText(/3 variantes título \+ thumbnail/)).toBeDefined()
  })

  it('ClickMoment renders when 2+ variants', () => {
    renderRevisar()
    expect(screen.getByTestId('click-moment')).toBeDefined()
  })

  it('ClickMoment does NOT render with fewer than 2 variants', () => {
    renderRevisar({
      variants: [{ label: 'A', thumbUrl: null, title: 'Solo', isOriginal: true }],
    })
    expect(screen.queryByTestId('click-moment')).toBeNull()
  })

  it('bottom note mentions "Ativar teste" in Portuguese', () => {
    renderRevisar()
    expect(screen.getByText('Ativar teste')).toBeDefined()
  })

  it('renders correct rotation labels in Portuguese', () => {
    renderRevisar({ config: { rotation: 'round_robin' } })
    expect(screen.getByText(/rotação sequencial/)).toBeDefined()
  })
})

const base = {
  type: 'thumbnail' as TestType,
  variants: defaultVariants,
  config: defaultConfig,
  videoTitle: 'My Great YouTube Video About Testing',
}

describe('StepRevisar: aviso da original (D12, r5)', () => {
  it('baixa: faixa com selo abaixo do banner; título "Pronto para ativar, com um aviso abaixo."', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} />)
    expect(screen.getByRole('status').textContent).toContain('480×360')
    expect(screen.getByText('Baixa resolução')).toBeTruthy()
    expect(screen.getByText('Pronto para ativar, com um aviso abaixo.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
    expect(screen.queryByText(/Pronto para iniciar/)).toBeNull()
  })
  it('a faixa vem DEPOIS do banner no DOM (Logan L1)', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} />)
    const banner = screen.getByText('Pronto para ativar, com um aviso abaixo.')
    const faixa = screen.getByRole('status')
    expect(banner.compareDocumentPosition(faixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('não medida: selo "Resolução não medida" e título com aviso, sem "Baixa resolução"', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa(null, false)} />)
    expect(screen.getByText('Resolução não medida')).toBeTruthy()
    expect(screen.getByText('Pronto para ativar, com um aviso abaixo.')).toBeTruthy()
    expect(screen.queryByText('Baixa resolução')).toBeNull()
  })
  it('leitura falhou: linha neutra, sem selo, título "Pronto para ativar."', () => {
    render(<StepRevisar {...base} avisoOriginal={AVISO_INDISPONIVEL} />)
    expect(screen.getByRole('status').textContent).toBe('Não consegui conferir a resolução da original agora. Isso não impede de ativar.')
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Baixa resolução')).toBeNull()
  })
  it('C5: leitura pendente: "Pronto para ativar.", esqueleto com aria-busy, nenhum role=status, nunca "Tudo pronto."', () => {
    const { container } = render(<StepRevisar {...base} avisoOriginal="pendente" />)
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    const esqueleto = container.querySelector('[aria-busy="true"]') as HTMLElement
    expect(esqueleto).toBeTruthy()
    expect(esqueleto.querySelector('[class*="h-5"]')).toBeTruthy()   // 20 px
  })
  it('role="status" entra junto com o conteúdo, nunca vazio (Naksu S3)', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} />)
    expect(screen.getByRole('status').textContent?.length).toBeGreaterThan(20)
  })
  it('sem aviso (null ou ausente): nada na tela e o banner segue "Tudo pronto."; nota "para começar"', () => {
    const { unmount } = render(<StepRevisar {...base} avisoOriginal={null} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Tudo pronto.')).toBeTruthy()
    expect(screen.getByText(/Clique em/).textContent).toContain('para começar')
    unmount()
    render(<StepRevisar {...base} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('o fonte não usa as cores e classes velhas (tokens por tema)', () => {
    const fonte = readFileSync(join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components/step-revisar.tsx'), 'utf8')
    for (const proibido of ['#4ade80', '#22c55e', 'tone="amber"', '-subtle', 'color-mix(']) {
      expect(fonte.toLowerCase()).not.toContain(proibido)
    }
  })
})
