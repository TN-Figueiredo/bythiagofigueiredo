import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BotFilterToggle } from './bot-filter-toggle'

describe('BotFilterToggle', () => {
  it('renders toggle label', () => {
    render(<BotFilterToggle enabled={false} botPct={5} onChange={() => {}} />)
    expect(screen.getByText(/Excluir bots/)).toBeTruthy()
  })

  it('shows bot percentage', () => {
    const { container } = render(<BotFilterToggle enabled={false} botPct={12} onChange={() => {}} />)
    expect(container.textContent).toContain('12%')
  })

  it('calls onChange when toggled', () => {
    const onChange = vi.fn()
    render(<BotFilterToggle enabled={false} botPct={5} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('shows enabled state', () => {
    const { container } = render(<BotFilterToggle enabled={true} botPct={5} onChange={() => {}} />)
    const toggle = container.querySelector('[role="switch"]')
    expect(toggle?.getAttribute('aria-checked')).toBe('true')
  })
})
