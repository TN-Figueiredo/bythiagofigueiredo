import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReadingProgressBar } from '../../../src/components/blog/reading-progress'
import { TimeLeftPill } from '../../../src/components/blog/time-left-pill'
import { ScrollProvider } from '../../../src/components/blog/scroll-context'

function renderWithScroll(ui: React.ReactElement, sections: Array<{ slug: string; text: string; depth: 2 | 3 }>) {
  return render(<ScrollProvider sections={sections}>{ui}</ScrollProvider>)
}

describe('ReadingProgressBar', () => {
  it('renders segments for each section', () => {
    const sections = [
      { slug: 'intro', text: 'Intro', depth: 2 as const },
      { slug: 'body', text: 'Body', depth: 2 as const },
    ]
    const { container } = renderWithScroll(<ReadingProgressBar sections={sections} />, sections)
    const segments = container.querySelectorAll('[data-segment]')
    expect(segments.length).toBe(2)
  })

  it('has role="progressbar" attribute', () => {
    const sections = [
      { slug: 'intro', text: 'Intro', depth: 2 as const },
    ]
    const { container } = renderWithScroll(<ReadingProgressBar sections={sections} />, sections)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).toBeTruthy()
    expect(bar!.getAttribute('aria-label')).toBe('Progresso de leitura')
    expect(bar!.getAttribute('aria-valuemin')).toBe('0')
    expect(bar!.getAttribute('aria-valuemax')).toBe('100')
  })

  it('filters to only h2 (depth 2) sections', () => {
    const sections = [
      { slug: 'intro', text: 'Intro', depth: 2 as const },
      { slug: 'sub-detail', text: 'Sub Detail', depth: 3 as const },
      { slug: 'body', text: 'Body', depth: 2 as const },
      { slug: 'another-sub', text: 'Another Sub', depth: 3 as const },
    ]
    const { container } = renderWithScroll(<ReadingProgressBar sections={sections} />, sections)
    const segments = container.querySelectorAll('[data-segment]')
    // Only depth-2 sections should produce segments
    expect(segments.length).toBe(2)
    expect(segments[0]!.getAttribute('data-segment')).toBe('intro')
    expect(segments[1]!.getAttribute('data-segment')).toBe('body')
  })
})

describe('TimeLeftPill', () => {
  it('renders with reading time and current section', () => {
    const { container } = render(
      <TimeLeftPill totalMinutes={9} currentSection="O que e, entao" />,
    )
    expect(container.textContent).toContain('min')
    expect(container.textContent).toContain('restantes')
  })
})
