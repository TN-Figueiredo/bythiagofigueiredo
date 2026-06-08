import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PillarRail } from '@/app/cms/(authed)/video/_components/pillar-rail'

const counts = { viagem: 2, codigo: 1 }

describe('PillarRail', () => {
  it('renders Todos + one chip per pillar with a colored dot', () => {
    const { container } = render(
      <PillarRail total={3} pillarCounts={counts} active={null} onChange={() => {}} />,
    )
    expect(screen.getByText('Todos')).toBeInTheDocument()
    expect(screen.getByText('Viagem')).toBeInTheDocument()
    expect(screen.getByText('IA')).toBeInTheDocument()
    expect(container.querySelectorAll('.pc-dot').length).toBeGreaterThan(0)
  })

  it('hides the count badge for non-Todos chips with count 0; Todos always shows its count', () => {
    render(<PillarRail total={3} pillarCounts={counts} active={null} onChange={() => {}} />)
    const todos = screen.getByText('Todos').closest('button')!
    expect(todos.textContent).toContain('3')
    const ia = screen.getByText('IA').closest('button')!
    expect(ia.querySelector('.pc-count')).toBeNull()
    const viagem = screen.getByText('Viagem').closest('button')!
    expect(viagem.querySelector('.pc-count')?.textContent).toBe('2')
  })

  it('marks the active chip filled via aria-pressed and emits onChange', () => {
    const onChange = vi.fn()
    render(<PillarRail total={3} pillarCounts={counts} active="viagem" onChange={onChange} />)
    const viagem = screen.getByText('Viagem').closest('button')!
    expect(viagem).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('Todos').closest('button')!)
    expect(onChange).toHaveBeenCalledWith(null)
    fireEvent.click(viagem)
    expect(onChange).toHaveBeenCalledWith('viagem')
  })
})
