import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
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
      <MobileTocSheet open={false} onClose={() => {}} sections={sections} locale="en" />,
      sections,
    )
    expect(container.textContent).toBe('')
  })

  it('renders sections when open', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} locale="en" />,
      sections,
    )
    expect(container.textContent).toContain('Introduction')
    expect(container.textContent).toContain('Main Body')
  })

  it('renders key points when provided (pt-BR)', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} keyPoints={['Point A', 'Point B']} locale="pt-BR" />,
      sections,
    )
    expect(container.textContent).toContain('Point A')
    expect(container.textContent).toContain('Pontos-chave')
  })

  it('has dialog role when open', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} locale="en" />,
      sections,
    )
    expect(container.querySelector('[role="dialog"]')).toBeTruthy()
  })

  it('renders In This Text label (en)', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} locale="en" />,
      sections,
    )
    expect(container.textContent).toContain('In This Text')
  })

  it('renders Neste Texto label (pt-BR)', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} locale="pt-BR" />,
      sections,
    )
    expect(container.textContent).toContain('Neste Texto')
  })

  it('has aria-modal="true" when open', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} locale="en" />,
      sections,
    )
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog!.getAttribute('aria-modal')).toBe('true')
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    renderWithScroll(
      <MobileTocSheet open onClose={onClose} sections={sections} locale="en" />,
      sections,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has a visible close button', () => {
    const { container } = renderWithScroll(
      <MobileTocSheet open onClose={() => {}} sections={sections} locale="en" />,
      sections,
    )
    expect(container.querySelector('[aria-label="Close summary"]')).toBeTruthy()
  })
})
