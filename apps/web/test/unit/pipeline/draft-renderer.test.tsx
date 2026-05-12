import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { DraftRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer'

vi.mock('@tiptap/react', () => {
  const actual = vi.importActual('@tiptap/react')
  return {
    ...actual,
    useEditor: () => null,
    EditorContent: () => null,
  }
})

const noop = vi.fn()

describe('DraftRenderer', () => {
  it('renders empty state when content is null', () => {
    render(<DraftRenderer content={null} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/nenhum rascunho/i)).toBeTruthy()
  })

  it('renders empty state when content is whitespace-only', () => {
    render(<DraftRenderer content={"   \n  \n   "} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/nenhum rascunho/i)).toBeTruthy()
  })

  it('detects misplaced SEO data in JSON blob and shows warning', () => {
    const content = {
      body: 'This is the body text.',
      seo: { meta_title: 'My Title', meta_description: 'My Desc' },
    }
    render(<DraftRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/dados seo detectados/i)).toBeTruthy()
  })

  it('shows SEO editing warning when editing with misplaced SEO', () => {
    const content = {
      body: 'Body text.',
      seo: { meta_title: 'Title' },
    }
    render(<DraftRenderer content={content} isEditing={true} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/mova-os para a aba seo/i)).toBeTruthy()
  })

  it('does not show SEO warning for plain string content', () => {
    render(<DraftRenderer content="Some text" isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText(/dados seo/i)).toBeNull()
  })

  it('renders section outline when JSONContent has 2+ headings', () => {
    const jsonContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Section B' }] },
      ],
    }
    render(<DraftRenderer content={jsonContent} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Seções')).toBeTruthy()
    expect(screen.getByText('Section A')).toBeTruthy()
    expect(screen.getByText('Section B')).toBeTruthy()
  })

  it('does not render section outline with fewer than 2 headings', () => {
    const jsonContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Only One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
      ],
    }
    render(<DraftRenderer content={jsonContent} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText('Seções')).toBeNull()
  })

  it('does not render section outline for string content', () => {
    render(<DraftRenderer content="## Heading\n\nText" isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText('Seções')).toBeNull()
  })

  it('does not show section outline in editing mode', () => {
    const jsonContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'B' }] },
      ],
    }
    render(<DraftRenderer content={jsonContent} isEditing={true} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText('Seções')).toBeNull()
  })
})
