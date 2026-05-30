import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepRevisar } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import type { ReviewVariant } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import type { TestType } from '@/lib/youtube/ab-types'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'

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
    TrendingDown: icon('TrendingDown'), MousePointerClick: icon('MousePointerClick'),
  }
})

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/click-moment', () => ({
  ClickMoment: (props: Record<string, unknown>) => <div data-testid="click-moment" data-variants={JSON.stringify(props.variants)} />,
}))

const defaultConfig: WizardConfig = {
  confidence: 95,
  duration: 14,
  autoApply: true,
  burnIn: 1,
  rotation: 'abba' as const,
  playoff: true,
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
  videoTitle?: string
}) {
  return render(
    <StepRevisar
      type={overrides?.type ?? 'thumbnail'}
      variants={overrides?.variants ?? defaultVariants}
      config={{ ...defaultConfig, ...overrides?.config }}
      videoTitle={overrides?.videoTitle ?? 'My Great YouTube Video About Testing'}
    />
  )
}

describe('StepRevisar', () => {
  it('shows "Tudo pronto" success banner with CheckCircle icon', () => {
    renderRevisar()
    expect(screen.getByText('Tudo pronto.')).toBeDefined()
    expect(screen.getByTestId('icon-CheckCircle')).toBeDefined()
  })

  it('success banner shows one-liner summary with variant count, type, rotation, duration, confidence, playoff', () => {
    renderRevisar({ type: 'combo', config: { rotation: 'abba', duration: 14, confidence: 95, playoff: true } })
    // "3 variantes combo · rotação ABBA · 14 dias · confiança 95% · playoff on"
    const summary = screen.getByText(/3 variantes combo/)
    expect(summary.textContent).toContain('rotação ABBA')
    expect(summary.textContent).toContain('14 dias')
    expect(summary.textContent).toContain('confiança 95%')
    expect(summary.textContent).toContain('playoff on')
  })

  it('summary shows playoff off when disabled', () => {
    renderRevisar({ config: { playoff: false } })
    const summary = screen.getByText(/playoff off/)
    expect(summary).toBeDefined()
  })

  it('variant mini cards render for each variant', () => {
    renderRevisar()
    expect(screen.getByLabelText('Variant A')).toBeDefined()
    expect(screen.getByLabelText('Variant B')).toBeDefined()
    expect(screen.getByLabelText('Variant C')).toBeDefined()
  })

  it('original variant shows "Original" badge', () => {
    renderRevisar()
    expect(screen.getByText('Original')).toBeDefined()
  })

  it('missing thumbnail shows gradient placeholder with Portuguese aria-label', () => {
    renderRevisar()
    const placeholder = screen.getByLabelText('Sem thumbnail para variante C')
    expect(placeholder).toBeDefined()
    expect(placeholder.style.background).toContain('linear-gradient')
  })

  it('variant with no title shows "Sem título"', () => {
    renderRevisar({
      variants: [
        { label: 'A', thumbUrl: null, title: '', isOriginal: true },
        { label: 'B', thumbUrl: null, title: '', isOriginal: false },
      ],
    })
    const items = screen.getAllByText('Sem título')
    expect(items.length).toBeGreaterThanOrEqual(1)
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

  it('shows "Variantes" section header in Portuguese', () => {
    renderRevisar()
    expect(screen.getByText('Variantes')).toBeDefined()
  })

  it('renders correct rotation labels in Portuguese', () => {
    renderRevisar({ config: { rotation: 'round_robin' } })
    expect(screen.getByText(/rotação sequencial/)).toBeDefined()
  })
})
