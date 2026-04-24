import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReadingProgressBar } from '../../../src/components/blog/reading-progress'
import { TimeLeftPill } from '../../../src/components/blog/time-left-pill'

describe('ReadingProgressBar', () => {
  it('renders segments for each section', () => {
    const sections = [
      { slug: 'intro', text: 'Intro', depth: 2 as const },
      { slug: 'body', text: 'Body', depth: 2 as const },
    ]
    const { container } = render(<ReadingProgressBar sections={sections} />)
    const segments = container.querySelectorAll('[data-segment]')
    expect(segments.length).toBe(2)
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
