import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepTipo } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-tipo'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'), FlaskConical: icon('FlaskConical'),
    Lock: icon('Lock'), Plus: icon('Plus'), Trash2: icon('Trash2'), Sparkles: icon('Sparkles'),
    CheckCircle: icon('CheckCircle'), Play: icon('Play'), ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'), ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'),
    Download: icon('Download'), Pause: icon('Pause'), Square: icon('Square'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'),
    Smartphone: icon('Smartphone'), Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'),
  }
})

describe('StepTipo', () => {
  it('renders radiogroup with 4 radio options', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Test type' })).toBeDefined()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('no selection initially shows first card focusable (tabIndex=0)', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios[0]!.tabIndex).toBe(0)
    expect(radios[1]!.tabIndex).toBe(-1)
    expect(radios[2]!.tabIndex).toBe(-1)
    expect(radios[3]!.tabIndex).toBe(-1)
  })

  it('clicking a card calls onSelect with the correct TestType', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Miniatura').closest('[role="radio"]')!)
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('selected card has aria-checked="true", others "false"', () => {
    render(<StepTipo selected="title" onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios[0]!.getAttribute('aria-checked')).toBe('false')
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false')
    expect(radios[2]!.getAttribute('aria-checked')).toBe('true')
    expect(radios[3]!.getAttribute('aria-checked')).toBe('false')
  })

  it('"Recommended" badge appears on combo type', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Recomendado')).toBeDefined()
  })

  it('"One-off" badge appears on description type', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Pontual')).toBeDefined()
  })

  it('ArrowRight from first selects second', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('ArrowLeft from first wraps to last', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith('description')
  })

  it('ArrowDown navigates forward', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="thumbnail" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('title')
  })

  it('ArrowUp navigates backward', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="title" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowUp' })
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('Space key selects focused card', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.keyDown(radios[2]!, { key: ' ' })
    expect(onSelect).toHaveBeenCalledWith('title')
  })

  it('Enter key selects focused card', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.keyDown(radios[1]!, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })
})
