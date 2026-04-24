import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MobileTocSheet } from '../../../src/components/blog/mobile-toc-sheet'
import { ScrollProvider } from '../../../src/components/blog/scroll-context'

function renderWithScroll(
  ui: React.ReactElement,
  sections: Array<{ slug: string; text: string; depth: 2 | 3 }>,
) {
  return render(<ScrollProvider sections={sections}>{ui}</ScrollProvider>)
}

describe('MobileTocSheet', () => {
  const sections = [
    { slug: 'intro', text: 'Introduction', depth: 2 as const },
    { slug: 'body', text: 'Main Body', depth: 2 as const },
  ]

  it('returns null when closed', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open={false} onClose={() => {}} sections={sections} />,
      sections,
    )
    // When closed, MobileTocSheet returns null — only the ScrollProvider wrapper remains
    expect(container.textContent).toBe('')
  })

  it('renders sections when open', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} />,
      sections,
    )
    expect(container.textContent).toContain('Introduction')
    expect(container.textContent).toContain('Main Body')
  })

  it('renders key points when provided', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} keyPoints={['Point A', 'Point B']} />,
      sections,
    )
    expect(container.textContent).toContain('Point A')
    expect(container.textContent).toContain('PONTOS-CHAVE')
  })

  it('has dialog role when open', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} />,
      sections,
    )
    expect(container.querySelector('[role="dialog"]')).toBeTruthy()
  })

  it('renders NESTE TEXTO label', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} />,
      sections,
    )
    expect(container.textContent).toContain('NESTE TEXTO')
  })
})
