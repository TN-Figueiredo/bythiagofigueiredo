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
  it('renders all 6 config rows with Portuguese labels', () => {
    renderConfig()
    expect(screen.getByText('Duração máxima')).toBeDefined()
    expect(screen.getByText('Confiança alvo')).toBeDefined()
    expect(screen.getByText('Aplicar vencedor automaticamente')).toBeDefined()
    expect(screen.getByText('Burn-in')).toBeDefined()
    expect(screen.getByText('Padrão de rotação')).toBeDefined()
    expect(screen.getByText('Playoff automático')).toBeDefined()
  })

  it('renders estimate card with title, subtitle, and stats', () => {
    renderConfig()
    expect(screen.getByText('Estimativa')).toBeDefined()
    expect(screen.getByText(/Estimativa baseada na configuração/)).toBeDefined()
    expect(screen.getByText('Tempo estimado')).toBeDefined()
    expect(screen.getByText('Ciclos ABBA')).toBeDefined()
  })

  it('estimate card shows correct values for duration=14 confidence=95', () => {
    renderConfig()
    // estDays = Math.round(14 * 1) = 14 (confidence >= 95 => factor 1)
    expect(screen.getByText('~14 dias')).toBeDefined()
    // abbaCycles = ceil(14/2)*2 = 14
    expect(screen.getByText('14')).toBeDefined()
  })

  it('estimate adjusts for lower confidence (factor 0.8)', () => {
    renderConfig({ confidence: 90, duration: 14 })
    // estDays = Math.round(14 * 0.8) = 11
    expect(screen.getByText('~11 dias')).toBeDefined()
  })

  it('estimate card shows 6 gates footer note', () => {
    renderConfig()
    expect(screen.getByText(/6 gates precisam passar/)).toBeDefined()
  })

  it('duration slider has min=7 max=28', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    const durationSlider = sliders[0]!
    expect(durationSlider.getAttribute('min')).toBe('7')
    expect(durationSlider.getAttribute('max')).toBe('28')
  })

  it('confidence slider has min=80 max=99', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    const confidenceSlider = sliders[1]!
    expect(confidenceSlider.getAttribute('min')).toBe('80')
    expect(confidenceSlider.getAttribute('max')).toBe('99')
  })

  it('burn-in slider has min=0 max=3', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    const burnInSlider = sliders[2]!
    expect(burnInSlider.getAttribute('min')).toBe('0')
    expect(burnInSlider.getAttribute('max')).toBe('3')
  })

  it('rotation segmented control shows 3 Portuguese options', () => {
    renderConfig()
    const radiogroup = screen.getByRole('radiogroup', { name: 'Padrão de rotação' })
    expect(radiogroup).toBeDefined()
    const radios = radiogroup.querySelectorAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(screen.getByText('ABBA')).toBeDefined()
    expect(screen.getByText('Sequencial')).toBeDefined()
    expect(screen.getByText('Aleatório')).toBeDefined()
  })

  it('renders two 42x24px toggles for auto-apply and playoff', () => {
    renderConfig()
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    // Both should be 42x24 via inline style
    for (const sw of switches) {
      expect(sw.style.width).toBe('42px')
      expect(sw.style.height).toBe('24px')
    }
  })
})
