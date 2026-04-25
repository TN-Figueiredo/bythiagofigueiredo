import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BlogArticleClient } from '../../../src/app/(public)/blog/[locale]/[slug]/blog-article-client'
import { ScrollProvider } from '../../../src/components/blog/scroll-context'

const defaultSections = [{ slug: 'intro', text: 'Intro', depth: 2 as const }]

function renderWithScroll(props: Partial<Parameters<typeof BlogArticleClient>[0]> & { children?: React.ReactNode }) {
  const mergedProps = {
    sections: defaultSections,
    readingTimeMin: 5,
    slug: 'test-post',
    locale: 'pt-BR',
    ...props,
  }
  return render(
    <ScrollProvider sections={mergedProps.sections}>
      <BlogArticleClient {...mergedProps}>
        {mergedProps.children ?? <p>Article content</p>}
      </BlogArticleClient>
    </ScrollProvider>,
  )
}

describe('BlogArticleClient', () => {
  it('renders children inside article wrapper', () => {
    const { container } = renderWithScroll({ children: <p>Article content</p> })
    expect(container.textContent).toContain('Article content')
  })

  it('renders reading progress bar', () => {
    const { container } = renderWithScroll({})
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy()
  })

  it('renders mobile TOC FAB button', () => {
    const { container } = renderWithScroll({})
    const fab = container.querySelector('[aria-label="Abrir sumario"]')
    expect(fab).toBeTruthy()
  })

  it('renders AI Reader button with Ler com IA', () => {
    const { container } = renderWithScroll({})
    expect(container.textContent).toContain('Ler com IA')
  })

  it('renders TimeLeftPill', () => {
    const { container } = renderWithScroll({ readingTimeMin: 12 })
    expect(container.textContent).toContain('min')
  })
})
