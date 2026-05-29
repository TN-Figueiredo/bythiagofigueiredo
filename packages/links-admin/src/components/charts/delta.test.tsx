import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Delta } from './delta'

describe('Delta', () => {
  it('renders nothing when prev is null', () => {
    const { container } = render(<Delta cur={100} prev={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders positive delta with + prefix', () => {
    const { container } = render(<Delta cur={150} prev={100} />)
    expect(container.textContent).toContain('+50%')
  })

  it('renders negative delta without + prefix', () => {
    const { container } = render(<Delta cur={50} prev={100} />)
    expect(container.textContent).toContain('-50%')
  })

  it('uses green color for positive (non-inverted)', () => {
    const { container } = render(<Delta cur={150} prev={100} />)
    const span = container.querySelector('span')
    expect(span?.style.color).toContain('green')
  })

  it('uses red color for negative (non-inverted)', () => {
    const { container } = render(<Delta cur={50} prev={100} />)
    const span = container.querySelector('span')
    expect(span?.style.color).toContain('red')
  })

  it('inverts colors when invert=true', () => {
    const { container } = render(<Delta cur={150} prev={100} invert />)
    const span = container.querySelector('span')
    expect(span?.style.color).toContain('red')
  })

  it('renders custom suffix', () => {
    const { container } = render(<Delta cur={150} prev={100} suffix="pp" />)
    expect(container.textContent).toContain('pp')
  })

  it('handles prev=0 as 100% change', () => {
    const { container } = render(<Delta cur={50} prev={0} />)
    expect(container.textContent).toContain('100%')
  })

  it('handles zero change as 0%', () => {
    const { container } = render(<Delta cur={100} prev={100} />)
    expect(container.textContent).toContain('0%')
  })
})
