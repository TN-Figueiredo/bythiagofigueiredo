import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { HighlightsSidebar } from '../../../src/components/blog/highlights-sidebar'

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
})
