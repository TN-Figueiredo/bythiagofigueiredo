import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AiReaderButton } from '../../../src/components/blog/ai-reader-button'
import { AiReaderDrawer } from '../../../src/components/blog/ai-reader-drawer'

describe('AiReaderButton', () => {
  it('renders pill with Ler com IA label', () => {
    const { container } = render(<AiReaderButton onClick={() => {}} />)
    expect(container.textContent).toContain('Ler com IA')
  })

  it('returns null when hidden is true', () => {
    const { container } = render(<AiReaderButton onClick={() => {}} hidden />)
    expect(container.innerHTML).toBe('')
  })

  it('renders subtitle text', () => {
    const { container } = render(<AiReaderButton onClick={() => {}} />)
    expect(container.textContent).toContain('Resumo, explicacao, conversa')
  })
})

describe('AiReaderDrawer', () => {
  it('renders tabs when open', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('TL;DR')
    expect(container.textContent).toContain('Explicar')
    expect(container.textContent).toContain('Conversar')
  })

  it('shows intro content in TL;DR tab', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('resumo')
  })

  it('clicking Explicar tab switches content', () => {
    const { container, getByText } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('Gerar resumo')
    fireEvent.click(getByText('Explicar'))
    expect(container.textContent).toContain('linguagem mais simples')
    expect(container.textContent).not.toContain('Gerar resumo')
  })

  it('clicking Conversar tab shows suggestions', () => {
    const { container, getByText } = render(<AiReaderDrawer open onClose={() => {}} />)
    fireEvent.click(getByText('Conversar'))
    expect(container.textContent).toContain('Sugestoes')
    expect(container.textContent).toContain('Qual e a ideia principal?')
  })

  it('has role="dialog" when open', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog!.getAttribute('aria-label')).toBe('Leitura assistida')
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

  it('renders header with SparkIcon and Leitura assistida', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('Leitura assistida')
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders footer disclaimer', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('Respostas geradas por IA')
  })

  it('explain tab shows level selector', () => {
    const { container, getByText } = render(<AiReaderDrawer open onClose={() => {}} />)
    fireEvent.click(getByText('Explicar'))
    expect(container.textContent).toContain('ELI5')
    expect(container.textContent).toContain('Iniciante')
    expect(container.textContent).toContain('Intermediario')
  })
})
