import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PostToc } from '../../../src/components/blog/post-toc'

describe('PostToc', () => {
  it('renders TOC items with correct hierarchy', () => {
    const sections = [
      { slug: 'intro', text: 'Introduction', depth: 2 as const },
      { slug: 'sub', text: 'Sub section', depth: 3 as const },
      { slug: 'conclusion', text: 'Conclusion', depth: 2 as const },
    ]
    const { container } = render(<PostToc sections={sections} url="https://example.com" />)
    expect(container.textContent).toContain('Introduction')
    expect(container.textContent).toContain('Sub section')
    expect(container.textContent).toContain('Conclusion')
    expect(container.textContent).toContain('NESTE TEXTO')
  })
})
