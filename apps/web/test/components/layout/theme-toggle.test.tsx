import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '../../../src/components/layout/theme-toggle'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))

describe('ThemeToggle', () => {
  it('renders sun icon in dark mode', () => {
    render(<ThemeToggle currentTheme="dark" />)
    expect(screen.getByText('☀')).toBeTruthy()
  })

  it('renders moon icon in light mode', () => {
    render(<ThemeToggle currentTheme="light" />)
    expect(screen.getByText('☾')).toBeTruthy()
  })

  it('has correct aria-label for dark mode', () => {
    render(<ThemeToggle currentTheme="dark" />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toBe('Switch to light mode')
  })

  it('has correct aria-label for light mode', () => {
    render(<ThemeToggle currentTheme="light" />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark mode')
  })

  it('has dashed border styling', () => {
    const { container } = render(<ThemeToggle currentTheme="dark" />)
    const btn = container.querySelector('button')
    expect(btn!.style.border).toContain('dashed')
  })

  it('toggles theme on click', () => {
    render(<ThemeToggle currentTheme="dark" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('☾')).toBeTruthy()
  })

  it('accepts optional size prop', () => {
    const { container } = render(<ThemeToggle currentTheme="dark" size={28} />)
    const btn = container.querySelector('button')
    expect(btn!.style.width).toBe('28px')
  })
})
