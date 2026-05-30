import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepVariantes } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-variantes'
import type { VariantData, StepVariantesProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-variantes'

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
  }
})

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

function makeOriginal(overrides: Partial<VariantData> = {}): VariantData {
  return {
    label: 'A',
    isOriginal: true,
    thumbUrl: null,
    titleText: 'Original title',
    descriptionText: 'Original description',
    ...overrides,
  }
}

function makeChallenger(label: 'B' | 'C' | 'D' = 'B', overrides: Partial<VariantData> = {}): VariantData {
  return {
    label,
    isOriginal: false,
    thumbUrl: null,
    titleText: `Title ${label}`,
    descriptionText: `Description ${label}`,
    ...overrides,
  }
}

function defaultProps(overrides: Partial<StepVariantesProps> = {}): StepVariantesProps {
  return {
    type: 'title',
    variants: [makeOriginal(), makeChallenger('B')],
    originalThumbUrl: null,
    onUpdateVariant: vi.fn(),
    onAddVariant: vi.fn(),
    onRemoveVariant: vi.fn(),
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('StepVariantes', () => {
  it('renders original variant as locked with "Travado" badge', () => {
    render(<StepVariantes {...defaultProps()} />)
    expect(screen.getByText('Travado')).toBeDefined()
    expect(screen.getByText('Original')).toBeDefined()
  })

  it('non-original variants have remove button', () => {
    render(<StepVariantes {...defaultProps()} />)
    expect(screen.getByLabelText('Remove variant B')).toBeDefined()
  })

  it('clicking remove calls onRemoveVariant with correct index', () => {
    const onRemove = vi.fn()
    render(<StepVariantes {...defaultProps({ onRemoveVariant: onRemove })} />)
    fireEvent.click(screen.getByLabelText('Remove variant B'))
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith(1) // index 1 (A=0, B=1)
  })

  it('"Add variant" button calls onAddVariant', () => {
    const onAdd = vi.fn()
    render(<StepVariantes {...defaultProps({ onAddVariant: onAdd })} />)
    fireEvent.click(screen.getByText('Adicionar variante'))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('"Adicionar variante" hidden when 3 challengers present', () => {
    const variants = [makeOriginal(), makeChallenger('B'), makeChallenger('C'), makeChallenger('D')]
    render(<StepVariantes {...defaultProps({ variants })} />)
    expect(screen.queryByText('Adicionar variante')).toBeNull()
  })

  it('shows "0/3 desafiantes" counter', () => {
    render(<StepVariantes {...defaultProps({ variants: [makeOriginal()] })} />)
    expect(screen.getByText('0/3 desafiantes')).toBeDefined()
  })

  it('warning message when no challengers', () => {
    render(<StepVariantes {...defaultProps({ variants: [makeOriginal()] })} />)
    expect(screen.getByText('Adicione pelo menos uma variante desafiante para continuar.')).toBeDefined()
  })

  it('title input fires onUpdateVariant for title type', () => {
    const onUpdate = vi.fn()
    render(<StepVariantes {...defaultProps({ type: 'title', onUpdateVariant: onUpdate })} />)
    const input = screen.getByLabelText('Title for variant B')
    fireEvent.change(input, { target: { value: 'New title' } })
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(onUpdate).toHaveBeenCalledWith(1, { titleText: 'New title' })
  })

  it('character counter shows count out of 100', () => {
    const variants = [makeOriginal(), makeChallenger('B', { titleText: 'Hello' })]
    render(<StepVariantes {...defaultProps({ type: 'title', variants })} />)
    expect(screen.getByText('5/100')).toBeDefined()
  })

  it('counter turns red at 101+ characters', () => {
    const longTitle = 'a'.repeat(101)
    const variants = [makeOriginal(), makeChallenger('B', { titleText: longTitle })]
    const { container } = render(<StepVariantes {...defaultProps({ type: 'title', variants })} />)
    const counter = screen.getByText('101/100')
    expect(counter.className).toContain('text-red-400')
    expect(counter.className).toContain('font-semibold')
  })

  it('shows thumbnail slot for "thumbnail" type', () => {
    render(<StepVariantes {...defaultProps({ type: 'thumbnail' })} />)
    // Editable drop zone text for the non-original variant
    expect(screen.getByText('Arraste ou clique para enviar')).toBeDefined()
  })

  it('hides thumbnail slot for "title" type', () => {
    render(<StepVariantes {...defaultProps({ type: 'title' })} />)
    expect(screen.queryByText('Arraste ou clique para enviar')).toBeNull()
    expect(screen.queryByText('Sem thumb')).toBeNull()
  })

  it('shows description textarea for "description" type', () => {
    render(<StepVariantes {...defaultProps({ type: 'description' })} />)
    expect(screen.getByLabelText('Description for variant B')).toBeDefined()
    // Title input should NOT be shown for description type
    expect(screen.queryByLabelText('Title for variant B')).toBeNull()
  })

  it('shows both title and description for "combo" type', () => {
    render(<StepVariantes {...defaultProps({ type: 'combo' })} />)
    expect(screen.getByLabelText('Title for variant B')).toBeDefined()
    expect(screen.getByLabelText('Description for variant B')).toBeDefined()
  })
})
