import { describe, it, expect } from 'vitest'
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
})
