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
  burnIn: 1,
  rotation: 'abba' as const,
  durationTouched: true,
}

function renderConfig(overrides?: Partial<WizardConfig>) {
  const config = { ...defaultConfig, ...overrides }
  const onChange = vi.fn()
  const result = render(<StepConfig config={config} onChange={onChange} />)
  return { config, onChange, ...result }
}

describe('StepConfig', () => {
  it('renders the 3 config rows with Portuguese labels', () => {
    renderConfig()
    expect(screen.getByText('Duração máxima')).toBeDefined()
    expect(screen.getByText('Burn-in')).toBeDefined()
    expect(screen.getByText('Padrão de rotação')).toBeDefined()
  })

  it('não oferece mais as configurações sem efeito (A/B Lab P2)', () => {
    renderConfig()
    expect(screen.queryByText('Confiança alvo')).toBeNull()
    expect(screen.queryByText('Aplicar vencedor automaticamente')).toBeNull()
    expect(screen.queryByText('Playoff automático')).toBeNull()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    // sobra só o burn-in (a duração é texto fixo na regra nova)
    expect(screen.getAllByRole('slider')).toHaveLength(1)
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
    // teto padrão com 2 variantes = 15
    expect(screen.getByText('~15 dias')).toBeDefined()
    // abbaCycles = ceil(15/2)*2 = 16
    expect(screen.getByText('16')).toBeDefined()
  })

  it('estimativa é a duração máxima, não depende da confiança salva (~15)', () => {
    renderConfig({ confidence: 90, duration: 14 })
    expect(screen.getByText('~15 dias')).toBeDefined()
    expect(screen.queryByText('~11 dias')).toBeNull()
  })

  it('rodapé não fala de gates nem de confiança (a avaliação automática saiu)', () => {
    const { container } = renderConfig()
    expect(container.textContent).not.toMatch(/gates/i)
    expect(container.textContent).not.toMatch(/estabilidade/i)
  })

  it('duração: texto fixo, sem controle e sem onChange (regra v2: padrão 15, mínimo 12 com 2 variantes)', () => {
    const { onChange, container } = renderConfig()
    expect(screen.getByTestId('duracao-fixa').textContent).toBe('Duração: 15 dias; mínimo 12')
    expect(container.querySelector('input[type="range"][min="12"]')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('burn-in slider has min=0 max=3', () => {
    renderConfig()
    const sliders = screen.getAllByRole('slider')
    const burnInSlider = sliders[0]!
    expect(burnInSlider.getAttribute('min')).toBe('0')
    expect(burnInSlider.getAttribute('max')).toBe('3')
  })

  it('rotação travada em ABBA (regra v2): uma só opção', () => {
    renderConfig()
    const radios = screen.getByRole('radiogroup', { name: 'Padrão de rotação' }).querySelectorAll('[role="radio"]')
    expect(radios).toHaveLength(1)
    expect(screen.getByText('ABBA')).toBeDefined()
    expect(screen.queryByText('Sequencial')).toBeNull()
  })

  it('com 3 variantes: texto fixo com padrão 17 e mínimo 16, sem slider de duração', () => {
    const { container } = render(<StepConfig config={{ ...defaultConfig, durationTouched: false }} variantCount={3} onChange={vi.fn()} />)
    expect(screen.getByTestId('duracao-fixa').textContent).toBe('Duração: 17 dias; mínimo 16')
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    expect(container.textContent).toContain('~17 dias')
  })

  it('não renderiza nenhum toggle (os de aplicar vencedor e playoff saíram)', () => {
    renderConfig()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })
})
