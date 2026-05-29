// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CoworkDeepLink } from '../../src/components/cms/cowork-deep-link'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('CoworkDeepLink', () => {
  let openSpy: ReturnType<typeof vi.spyOn>
  let clipboardSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    clipboardSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardSpy },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders button variant by default with correct label', () => {
    render(<CoworkDeepLink instruction="test instruction" />)
    const btn = screen.getByRole('button', { name: /Abrir no Cowork/i })
    expect(btn).toBeTruthy()
    expect(btn.className).toContain('bg-gradient-to-r')
  })

  it('renders icon variant when variant="icon"', () => {
    render(<CoworkDeepLink instruction="test" variant="icon" />)
    const btn = screen.getByRole('button', { name: /Cowork/i })
    expect(btn.textContent).toContain('🤖')
    expect(btn.className).toContain('text-[10px]')
  })

  it('renders inline variant when variant="inline"', () => {
    render(<CoworkDeepLink instruction="test" variant="inline" />)
    const btn = screen.getByRole('button', { name: /Abrir no Cowork/i })
    expect(btn.className).toContain('text-indigo-400')
  })

  it('calls window.open with correct deep link URL on click', () => {
    const instruction = 'Analise este roteiro'
    render(<CoworkDeepLink instruction={instruction} />)
    fireEvent.click(screen.getByRole('button'))
    expect(openSpy).toHaveBeenCalledWith(
      `claude://cowork/new?q=${encodeURIComponent(instruction)}`,
      '_self',
    )
  })

  it('shows instruction tooltip (title attribute, first 120 chars)', () => {
    const longInstruction = 'A'.repeat(200)
    render(<CoworkDeepLink instruction={longInstruction} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('title')).toBe('A'.repeat(120) + '...')
  })

  it('shows full instruction as tooltip when under 120 chars', () => {
    const shortInstruction = 'Short instruction'
    render(<CoworkDeepLink instruction={shortInstruction} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('title')).toBe(shortInstruction)
  })

  it('shows shortcut badge when shortcut prop is provided', () => {
    render(<CoworkDeepLink instruction="test" shortcut="⌘P" />)
    const badge = screen.getByText('⌘P')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('font-mono')
  })

  it('copies to clipboard when protocol handler does not open (no blur within 500ms)', async () => {
    const { toast } = await import('sonner')
    const instruction = 'Copy this instruction'
    render(<CoworkDeepLink instruction={instruction} />)

    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(clipboardSpy).toHaveBeenCalledWith(instruction)
    expect(toast.success).toHaveBeenCalledWith('Instrução copiada — cole no Cowork')
  })

  it('does not copy to clipboard when protocol handler opens successfully (blur fires)', async () => {
    render(<CoworkDeepLink instruction="test instruction" />)

    fireEvent.click(screen.getByRole('button'))

    // Simulate successful protocol handler: blur fires immediately
    fireEvent(window, new Event('blur'))

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(clipboardSpy).not.toHaveBeenCalled()
  })

  it('custom label renders correctly', () => {
    render(<CoworkDeepLink instruction="test" label="Gerar prompt" />)
    expect(screen.getByRole('button', { name: /Gerar prompt/i })).toBeTruthy()
  })

  it('custom className is applied', () => {
    render(<CoworkDeepLink instruction="test" className="my-custom-class" />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('my-custom-class')
  })

  it('disabled prop prevents click and applies visual styles', () => {
    render(<CoworkDeepLink instruction="test" disabled />)
    const btn = screen.getByRole('button')

    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.className).toContain('opacity-50')
    expect(btn.className).toContain('pointer-events-none')

    fireEvent.click(btn)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('double-click only fires window.open once', () => {
    render(<CoworkDeepLink instruction="test" />)
    const btn = screen.getByRole('button')

    fireEvent.click(btn)
    fireEvent.click(btn)

    expect(openSpy).toHaveBeenCalledTimes(1)
  })
})
