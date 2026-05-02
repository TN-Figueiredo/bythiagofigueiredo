import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Paper, Tape, rot, lift } from '@/components/pinboard'

describe('Paper', () => {
  it('renders children with default styles', () => {
    const { container } = render(<Paper>Hello</Paper>)
    const div = container.firstElementChild as HTMLElement
    expect(div.textContent).toBe('Hello')
    expect(div.style.background).toContain('var(--pb-paper)')
    expect(div.style.padding).toBe('20px')
  })

  it('applies custom tint, rotation, and translateY', () => {
    const { container } = render(
      <Paper tint="var(--pb-paper2)" rotation={1.5} translateY={-4} padding="16px">
        Content
      </Paper>
    )
    const div = container.firstElementChild as HTMLElement
    expect(div.style.background).toContain('var(--pb-paper2)')
    expect(div.style.transform).toContain('rotate(1.5deg)')
    expect(div.style.transform).toContain('translateY(-4px)')
    expect(div.style.padding).toBe('16px')
  })

  it('disables shadow when shadow=false', () => {
    const { container } = render(<Paper shadow={false}>No shadow</Paper>)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.boxShadow).toBe('')
  })

  it('merges className and style props', () => {
    const { container } = render(
      <Paper className="custom-class" style={{ marginTop: 8 }}>Styled</Paper>
    )
    const div = container.firstElementChild as HTMLElement
    expect(div.className).toContain('custom-class')
    expect(div.style.marginTop).toBe('8px')
  })
})

describe('Tape', () => {
  it('renders with default tape color', () => {
    const { container } = render(<Tape />)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.background).toContain('var(--pb-tape)')
    expect(div.style.width).toBe('80px')
    expect(div.style.height).toBe('18px')
    expect(div.style.position).toBe('absolute')
  })

  it('accepts custom color', () => {
    const { container } = render(<Tape color="var(--pb-tape2)" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.background).toContain('var(--pb-tape2)')
  })
})

describe('rot / lift helpers', () => {
  it('produces deterministic rotation per index', () => {
    expect(rot(0)).toBe(-1.5)
    expect(rot(1)).toBe(-0.5)
    expect(rot(2)).toBe(0.5)
  })

  it('produces deterministic lift per index', () => {
    expect(lift(0)).toBe(-4)
    expect(lift(1)).toBe(2)
    expect(lift(2)).toBe(-2)
  })
})
