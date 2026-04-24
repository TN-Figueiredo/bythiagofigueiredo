import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { HighlightsSidebar } from '../../../src/components/blog/highlights-sidebar'
import { TextHighlighter } from '../../../src/components/blog/text-highlighter'

// happy-dom ships localStorage as a frozen proxy without .clear;
// install an in-memory shim so every test starts from a clean slate.
function installLocalStorageShim() {
  const store = new Map<string, string>()
  const shim: Storage = {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  }
  Object.defineProperty(window, 'localStorage', { value: shim, writable: true, configurable: true })
}

describe('HighlightsSidebar', () => {
  beforeEach(() => {
    installLocalStorageShim()
    localStorage.clear()
  })

  it('shows empty state when no highlights', () => {
    const { container } = render(<HighlightsSidebar slug="test-post" />)
    expect(container.textContent).toContain('Selecione texto no artigo')
  })

  it('renders saved highlights from localStorage', () => {
    const highlights = [
      { id: 'h1', text: 'Test highlight', startOffset: 0, endOffset: 14, createdAt: new Date().toISOString() },
    ]
    localStorage.setItem('btf-highlights:pt-BR/test-post', JSON.stringify(highlights))
    const { container } = render(<HighlightsSidebar slug="test-post" locale="pt-BR" />)
    expect(container.textContent).toContain('Test highlight')
  })

  it('remove button has aria-label="Remover destaque"', () => {
    const highlights = [
      { id: 'h1', text: 'Removable highlight', createdAt: new Date().toISOString() },
    ]
    localStorage.setItem('btf-highlights:pt-BR/test-post', JSON.stringify(highlights))
    const { container } = render(<HighlightsSidebar slug="test-post" locale="pt-BR" />)
    const removeBtn = container.querySelector('[aria-label="Remover destaque"]')
    expect(removeBtn).toBeTruthy()
  })

  it('removes highlight when remove button is clicked', () => {
    const highlights = [
      { id: 'h1', text: 'To be removed', createdAt: new Date().toISOString() },
    ]
    localStorage.setItem('btf-highlights:pt-BR/test-post', JSON.stringify(highlights))
    const { container, rerender } = render(<HighlightsSidebar slug="test-post" locale="pt-BR" />)
    expect(container.textContent).toContain('To be removed')
    const removeBtn = container.querySelector('[aria-label="Remover destaque"]')!
    fireEvent.click(removeBtn)
    // After removal, should show empty state
    expect(container.textContent).toContain('Selecione texto no artigo')
  })
})

describe('TextHighlighter', () => {
  it('renders children', () => {
    const { container } = render(
      <TextHighlighter slug="test-post" locale="pt-BR">
        <p>Article paragraph content</p>
      </TextHighlighter>,
    )
    expect(container.textContent).toContain('Article paragraph content')
  })

  it('wraps children in a relative container', () => {
    const { container } = render(
      <TextHighlighter slug="test-post">
        <span>Inner text</span>
      </TextHighlighter>,
    )
    // The root wrapper div should exist
    const wrapper = container.firstElementChild
    expect(wrapper).toBeTruthy()
    expect(wrapper!.tagName).toBe('DIV')
  })
})
