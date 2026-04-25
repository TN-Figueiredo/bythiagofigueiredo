import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopStrip } from '../../../src/components/layout/top-strip'

describe('TopStrip', () => {
  it('renders language pill with PT and EN buttons', () => {
    render(<TopStrip locale="en" />)
    expect(screen.getByText('PT')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('marks the active locale button with active styling', () => {
    const { container } = render(<TopStrip locale="pt-BR" />)
    const activeBtn = container.querySelector('[data-active="true"]')
    expect(activeBtn).toBeTruthy()
    expect(activeBtn!.textContent).toBe('PT')
  })

  it('links inactive locale to the correct path', () => {
    render(<TopStrip locale="en" />)
    const ptLink = screen.getByText('PT').closest('a')
    expect(ptLink).toBeTruthy()
    expect(ptLink!.getAttribute('href')).toBe('/pt')
  })

  it('links EN locale correctly when PT is active', () => {
    render(<TopStrip locale="pt-BR" />)
    const enLink = screen.getByText('EN').closest('a')
    expect(enLink).toBeTruthy()
    expect(enLink!.getAttribute('href')).toBe('/')
  })

  it('has fixed positioning', () => {
    const { container } = render(<TopStrip locale="en" />)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.style.position).toBe('fixed')
  })

  it('uses z-index 999', () => {
    const { container } = render(<TopStrip locale="en" />)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.style.zIndex).toBe('999')
  })

  it('has lang-pill testid', () => {
    const { container } = render(<TopStrip locale="en" />)
    const pill = container.querySelector('[data-testid="lang-pill"]')
    expect(pill).toBeTruthy()
  })
})
