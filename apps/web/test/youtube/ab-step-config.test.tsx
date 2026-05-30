import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepConfig } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-config'
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
    TrendingDown: icon('TrendingDown'),
  }
})

const defaultConfig: WizardConfig = {
  confidence: 95,
  duration: 14,
  autoApply: true,
  burnIn: 1,
  rotation: 'abba' as const,
  playoff: true,
}

function renderConfig(overrides?: Partial<WizardConfig>) {
  const config = { ...defaultConfig, ...overrides }
  const onChange = vi.fn()
  const result = render(<StepConfig config={config} onChange={onChange} />)
  return { config, onChange, ...result }
}

describe('StepConfig', () => {
  it('renders all 5 CfgRow controls', () => {
    renderConfig()
    // duration slider
    expect(screen.getByText('Duração')).toBeDefined()
    // confidence slider
    expect(screen.getByText('Confiança mínima')).toBeDefined()
    // auto-apply toggle
    expect(screen.getByText('Aplicar vencedor automaticamente')).toBeDefined()
    // burn-in slider
    expect(screen.getByText('Burn-in')).toBeDefined()
    // rotation segmented control
    expect(screen.getByText('Padrão de rotação')).toBeDefined()
  })

  it('renders a playoff toggle', () => {
    renderConfig()
    expect(screen.getByText('Modo playoff')).toBeDefined()
  })

  it('renders estimate card with estimated days, ABBA cycles, and YouTube quota', () => {
    renderConfig()
    expect(screen.getByText('Estimativas')).toBeDefined()
    expect(screen.getByText('Tempo estimado')).toBeDefined()
    expect(screen.getByText('Ciclos ABBA')).toBeDefined()
    expect(screen.getByText('YouTube quota')).toBeDefined()
    // With duration=14: estimatedDays = ceil(14*0.7) = 10
    expect(screen.getByText('10 days')).toBeDefined()
    // abbaCycles = ceil(14/2)*2 = 14
    expect(screen.getByText('14 pairs')).toBeDefined()
    // quotaPerDay = ~ceil(4*2) = ~8
    expect(screen.getByText('~8 calls/day')).toBeDefined()
  })

  it('duration slider has min=7 max=28', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    // Duration is the first slider
    const durationSlider = sliders[0]!
    expect(durationSlider.getAttribute('min')).toBe('7')
    expect(durationSlider.getAttribute('max')).toBe('28')
  })

  it('confidence slider has min=80 max=99', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    // Confidence is the second slider
    const confidenceSlider = sliders[1]!
    expect(confidenceSlider.getAttribute('min')).toBe('80')
    expect(confidenceSlider.getAttribute('max')).toBe('99')
  })

  it('burn-in slider has min=0 max=3', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    // Burn-in is the third slider
    const burnInSlider = sliders[2]!
    expect(burnInSlider.getAttribute('min')).toBe('0')
    expect(burnInSlider.getAttribute('max')).toBe('3')
  })

  it('rotation segmented control shows 3 options: ABBA, Sequential, Random', () => {
    renderConfig()
    const radiogroup = screen.getByRole('radiogroup', { name: 'Rotation pattern' })
    expect(radiogroup).toBeDefined()
    const radios = radiogroup.querySelectorAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(screen.getByText('ABBA')).toBeDefined()
    expect(screen.getByText('Sequential')).toBeDefined()
    expect(screen.getByText('Random')).toBeDefined()
  })
})
