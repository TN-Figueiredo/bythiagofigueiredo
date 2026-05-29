import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Panel } from './panel'

describe('Panel', () => {
  it('renders title', () => {
    render(<Panel title="Cliques por dia"><p>chart</p></Panel>)
    expect(screen.getByText('Cliques por dia')).toBeTruthy()
  })

  it('renders children', () => {
    render(<Panel title="Test"><p data-testid="child">content</p></Panel>)
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('renders icon when provided', () => {
    const { container } = render(
      <Panel title="Test" icon="chart"><p>x</p></Panel>,
    )
    const iconEl = container.querySelector('[data-panel-icon]')
    expect(iconEl).toBeTruthy()
  })

  it('does not render icon when not provided', () => {
    const { container } = render(<Panel title="Test"><p>x</p></Panel>)
    const iconEl = container.querySelector('[data-panel-icon]')
    expect(iconEl).toBeFalsy()
  })

  it('renders right slot when provided', () => {
    const right = <button data-testid="export">CSV</button>
    render(<Panel title="Test" right={right}><p>x</p></Panel>)
    expect(screen.getByTestId('export')).toBeTruthy()
  })

  it('applies custom style', () => {
    const { container } = render(
      <Panel title="Test" style={{ gridColumn: 'span 2' }}><p>x</p></Panel>,
    )
    const panel = container.querySelector('[data-panel]')
    expect(panel?.getAttribute('style')).toContain('span 2')
  })

  it('renders as a card with data-panel marker', () => {
    const { container } = render(<Panel title="Test"><p>x</p></Panel>)
    expect(container.querySelector('[data-panel]')).toBeTruthy()
  })
})
