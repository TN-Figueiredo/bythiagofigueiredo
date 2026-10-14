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
  it('renders radiogroup with 3 radio options', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Tipo de teste' })).toBeDefined()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('no selection initially shows first card focusable (tabIndex=0)', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios[0]!.tabIndex).toBe(0)
    expect(radios[1]!.tabIndex).toBe(-1)
    expect(radios[2]!.tabIndex).toBe(-1)
  })

  it('clicking a card calls onSelect with the correct TestType', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Thumbnail').closest('[role="radio"]')!)
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('selected card has aria-checked="true", others "false"', () => {
    render(<StepTipo selected="title" onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios[0]!.getAttribute('aria-checked')).toBe('false')
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false')
    expect(radios[2]!.getAttribute('aria-checked')).toBe('true')
  })

  it('três opções na ordem Título + thumbnail, Thumbnail, Título; sem Descrição, recomendado nem pontual', () => {
    const { container } = render(<StepTipo selected={null} onSelect={vi.fn()} />)
    const titulos = screen.getAllByRole('radio').map(r => r.querySelector('span')?.textContent)
    expect(titulos).toEqual(['Título + thumbnail', 'Thumbnail', 'Título'])
    expect(container.textContent).not.toMatch(/Descri|recomendado|pontual/i)
  })

  it('o cartão do combo traz a frase fechada pelo Logan e a introdução nova', () => {
    render(<StepTipo selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Se ganhar, você não vai saber se foi o título ou a thumbnail.')).toBeDefined()
    expect(screen.getByText('Título e thumbnail mudam juntos')).toBeDefined()
    expect(screen.getByText('Escolha o que vai ser rotacionado no YouTube.')).toBeDefined()
  })

  it('ArrowRight from first selects second', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })

  it('ArrowLeft from first wraps to last (title)', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected="combo" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith('title')
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

  it('clicking third card selects title', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[2]!)
    expect(onSelect).toHaveBeenCalledWith('title')
  })

  it('clicking second card selects thumbnail', () => {
    const onSelect = vi.fn()
    render(<StepTipo selected={null} onSelect={onSelect} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[1]!)
    expect(onSelect).toHaveBeenCalledWith('thumbnail')
  })
})
