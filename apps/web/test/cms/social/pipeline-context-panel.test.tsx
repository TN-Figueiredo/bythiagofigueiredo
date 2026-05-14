/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { PipelineSnapshot } from '@/lib/social/types'

// Ensure React is available globally for dynamically-imported components
// whose JSX transform may not be applied by @vitejs/plugin-react when
// the file path contains special characters like (authed) or [id].
globalThis.React = React

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const BASE_SNAPSHOT: PipelineSnapshot = {
  pipeline_id: 'pip-1',
  code: 'BP-001',
  format: 'blog_post',
  stage: 'publication',
  language: 'pt-br',
  title_pt: 'Test Post',
  title_en: null,
  hook: 'A great hook',
  synopsis: 'A detailed synopsis of the content',
  tags: ['react', 'nextjs'],
  category: 'technology',
  cover_image_url: 'https://example.com/cover.jpg',
  sections: {
    'draft:pt': { content: 'text' },
    'seo:pt': { content: 'seo' },
    'images:shared': null,
  },
  format_metadata: {},
  blog_post_id: 'blog-1',
  newsletter_edition_id: null,
  campaign_id: null,
  youtube_video_id: null,
  graduated_at: '2026-05-14T10:30:00.000Z',
  graduated_by: 'user-1',
  version: 3,
}

async function importComponent() {
  const mod = await import(
    '../../../src/app/cms/(authed)/social/[id]/_components/pipeline-context-panel'
  )
  return mod.PipelineContextPanel
}

describe('PipelineContextPanel', () => {
  afterEach(() => cleanup())

  it('renders header "Pipeline Origin" with aria-label', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    const section = screen.getByRole('region', { name: 'Pipeline Origin' })
    expect(section).toBeDefined()

    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading.textContent).toBe('Pipeline Origin')
  })

  it('renders code badge', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText('BP-001')).toBeDefined()
  })

  it('renders format label — blog_post shows "Blog Post"', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText('Blog Post')).toBeDefined()
  })

  it('renders format label — video shows "Vídeo"', async () => {
    const PipelineContextPanel = await importComponent()
    render(
      <PipelineContextPanel
        snapshot={{ ...BASE_SNAPSHOT, format: 'video' }}
      />,
    )

    expect(screen.getByText('Vídeo')).toBeDefined()
  })

  it('renders language label — pt-br shows "PT-BR"', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText('PT-BR')).toBeDefined()
  })

  it('renders language label — both shows "PT + EN"', async () => {
    const PipelineContextPanel = await importComponent()
    render(
      <PipelineContextPanel
        snapshot={{ ...BASE_SNAPSHOT, language: 'both' }}
      />,
    )

    expect(screen.getByText('PT + EN')).toBeDefined()
  })

  it('renders version as "v{version}"', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText('v3')).toBeDefined()
  })

  it('renders category when present', async () => {
    const PipelineContextPanel = await importComponent()
    render(
      <PipelineContextPanel
        snapshot={{ ...BASE_SNAPSHOT, category: 'devops' }}
      />,
    )

    expect(screen.getByText('Category')).toBeDefined()
    expect(screen.getByText('devops')).toBeDefined()
  })

  it('hides category when null', async () => {
    const PipelineContextPanel = await importComponent()
    render(
      <PipelineContextPanel
        snapshot={{ ...BASE_SNAPSHOT, category: null }}
      />,
    )

    expect(screen.queryByText('Category')).toBeNull()
  })

  it('renders hook as blockquote when present', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    const hookEl = screen.getByText('A great hook')
    expect(hookEl.tagName).toBe('BLOCKQUOTE')
  })

  it('hides hook when null', async () => {
    const PipelineContextPanel = await importComponent()
    const { container } = render(
      <PipelineContextPanel snapshot={{ ...BASE_SNAPSHOT, hook: null }} />,
    )

    expect(container.querySelector('blockquote')).toBeNull()
  })

  it('renders synopsis with line-clamp-3', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    const synopsis = screen.getByText('A detailed synopsis of the content')
    expect(synopsis).toBeDefined()
    expect(synopsis.classList.contains('line-clamp-3')).toBe(true)
  })

  it('renders tags as pills', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    const reactTag = screen.getByText('react')
    const nextjsTag = screen.getByText('nextjs')
    expect(reactTag.tagName).toBe('SPAN')
    expect(nextjsTag.tagName).toBe('SPAN')
  })

  it('renders sections count — 2 non-null entries show "2 seções preenchidas"', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText('2 seções preenchidas')).toBeDefined()
  })

  it('renders singular "seção" for 1 section', async () => {
    const PipelineContextPanel = await importComponent()
    render(
      <PipelineContextPanel
        snapshot={{
          ...BASE_SNAPSHOT,
          sections: { 'draft:pt': { content: 'text' } },
        }}
      />,
    )

    expect(screen.getByText('1 seção preenchida')).toBeDefined()
  })

  it('renders cover image when present', async () => {
    const PipelineContextPanel = await importComponent()
    const { container } = render(
      <PipelineContextPanel snapshot={BASE_SNAPSHOT} />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://example.com/cover.jpg')
  })

  it('renders graduated date', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    const text = screen.getByText(/Graduado em/)
    expect(text.textContent).toContain('14')
    expect(text.textContent).toContain('2026')
  })

  it('link points to pipeline board — href /cms/pipeline/{format}', async () => {
    const PipelineContextPanel = await importComponent()
    render(<PipelineContextPanel snapshot={BASE_SNAPSHOT} />)

    const link = screen.getByText('Ver pipeline →')
    expect(link.getAttribute('href')).toBe('/cms/pipeline/blog_post')
  })
})
