import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AiReaderButton } from '../../../src/components/blog/ai-reader-button'
import { AiReaderDrawer } from '../../../src/components/blog/ai-reader-drawer'

describe('AiReaderButton', () => {
  it('renders pill with AI Reader label', () => {
    const { container } = render(<AiReaderButton onClick={() => {}} />)
    expect(container.textContent).toContain('AI Reader')
  })
})

describe('AiReaderDrawer', () => {
  it('renders tabs when open', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('TL;DR')
    expect(container.textContent).toContain('Explain')
    expect(container.textContent).toContain('Chat')
  })

  it('shows placeholder content in TL;DR tab', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('resumo')
  })

  it('clicking Explain tab switches content', () => {
    const { container, getByText } = render(<AiReaderDrawer open onClose={() => {}} />)
    // Initially shows TL;DR content
    expect(container.textContent).toContain('resumo automatico')
    // Click the Explain tab
    fireEvent.click(getByText('Explain'))
    // Should now show explain content, not TL;DR
    expect(container.textContent).toContain('Selecione um trecho do artigo para explicar')
    expect(container.textContent).not.toContain('resumo automatico')
  })

  it('has role="dialog" when open', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog!.getAttribute('aria-label')).toBe('Leitor IA')
  })

  it('close button has aria-label="Fechar"', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    const closeBtn = container.querySelector('[aria-label="Fechar"]')
    expect(closeBtn).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<AiReaderDrawer open onClose={onClose} />)
    const closeBtn = container.querySelector('[aria-label="Fechar"]')!
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has aria-modal="true" when open', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog!.getAttribute('aria-modal')).toBe('true')
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(<AiReaderDrawer open onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
