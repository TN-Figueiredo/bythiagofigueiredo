import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DraftRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer'

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

  it('renders paragraphs from double-newline separated text', () => {
    const text = 'First paragraph here.\n\nSecond paragraph here.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]!.textContent).toContain('First paragraph')
    expect(paragraphs[1]!.textContent).toContain('Second paragraph')
  })

  it('renders headings from markdown-style # syntax', () => {
    const text = '# Main Title\n\nSome body text.\n\n## Sub heading'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const headings = container.querySelectorAll('[class*="font-bold"], [class*="font-semibold"]')
    expect(headings.length).toBeGreaterThanOrEqual(2)
  })

  it('shows word count and reading time', () => {
    const words = Array(200).fill('word').join(' ')
    render(<DraftRenderer content={words} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/200 palavras/)).toBeTruthy()
    expect(screen.getByText(/~1 min leitura/)).toBeTruthy()
  })

  it('detects misplaced SEO data in JSON blob and shows warning', () => {
    const content = {
      body: 'This is the body text.',
      seo: { meta_title: 'My Title', meta_description: 'My Desc' },
    }
    render(<DraftRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/dados seo detectados/i)).toBeTruthy()
    expect(screen.getByText(/This is the body text/)).toBeTruthy()
  })

  it('renders textarea in editing mode', () => {
    render(<DraftRenderer content="Some text" isEditing={true} lang="pt" onContentChange={noop} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('Some text')
  })

  it('calls onContentChange when editing string content', () => {
    const onChange = vi.fn()
    render(<DraftRenderer content="old" isEditing={true} lang="pt" onContentChange={onChange} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'new text' } })
    expect(onChange).toHaveBeenCalledWith('new text')
  })

  it('preserves JSON structure when editing body of a JSON blob', () => {
    const content = { body: 'old body', seo: { meta_title: 'Title' } }
    const onChange = vi.fn()
    render(<DraftRenderer content={content} isEditing={true} lang="pt" onContentChange={onChange} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'new body' } })
    expect(onChange).toHaveBeenCalledWith({ body: 'new body', seo: { meta_title: 'Title' } })
  })

  it('renders bold text from **markers**', () => {
    const text = 'This has **bold words** in it.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const strong = container.querySelector('strong')
    expect(strong).toBeTruthy()
    expect(strong!.textContent).toBe('bold words')
  })

  it('renders italic text from *markers*', () => {
    const text = 'This has *italic words* in it.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const em = container.querySelector('em')
    expect(em).toBeTruthy()
    expect(em!.textContent).toBe('italic words')
  })

  it('preserves single newlines as line breaks within paragraphs', () => {
    const text = 'Line one\nLine two\nLine three'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const brs = container.querySelectorAll('br')
    expect(brs).toHaveLength(2)
  })

  it('counts only actual paragraphs in footer stat', () => {
    const text = '# Heading\n\nParagraph one.\n\nParagraph two.'
    render(<DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/2 parágrafos/)).toBeTruthy()
  })

  it('renders bullet lists from markdown list syntax', () => {
    const text = '- Item one\n- Item two\n- Item three'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
  })

  it('renders single-item bullet list', () => {
    const text = '- Single item'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(1)
    expect(items[0]!.textContent).toContain('Single item')
  })

  it('renders numbered lists from 1. 2. 3. syntax', () => {
    const text = '1. First item\n2. Second item\n3. Third item'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const ol = container.querySelector('ol')
    expect(ol).toBeTruthy()
    const items = ol!.querySelectorAll('li')
    expect(items).toHaveLength(3)
    expect(items[0]!.textContent).toContain('First item')
  })

  it('renders blockquotes from > prefix lines', () => {
    const text = 'Before.\n\n> This is a quote\n> with two lines\n\nAfter.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const italicBlocks = container.querySelectorAll('[class*="italic"]')
    const bq = Array.from(italicBlocks).find(el => el.textContent?.includes('This is a quote'))
    expect(bq).toBeTruthy()
    expect(bq!.textContent).toContain('with two lines')
  })

  it('renders horizontal dividers from --- syntax', () => {
    const text = 'Paragraph one.\n\n---\n\nParagraph two.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    const dividers = container.querySelectorAll('[class*="my-6"]')
    expect(dividers).toHaveLength(1)
  })

  it('renders first paragraph as lead with larger text', () => {
    const text = 'Lead paragraph text.\n\nSecond paragraph.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs[0]!.className).toContain('text-[14px]')
    expect(paragraphs[1]!.className).toContain('text-[13px]')
  })

  it('renders section outline when 2+ headings exist', () => {
    const text = '# Section A\n\nText.\n\n# Section B\n\nMore text.'
    render(<DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Seções')).toBeTruthy()
    expect(screen.getAllByText('Section A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Section B').length).toBeGreaterThanOrEqual(1)
  })

  it('does not render section outline with fewer than 2 headings', () => {
    const text = '# Only one heading\n\nSome text.'
    render(<DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText('Seções')).toBeNull()
  })

  it('shows section count in footer when headings exist', () => {
    const text = '# A\n\nText.\n\n# B\n\nText.\n\n# C\n\nText.'
    render(<DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/3 seções/)).toBeTruthy()
  })

  it('renders single-line blockquote', () => {
    const text = 'Before.\n\n> Just one line.\n\nAfter.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const italicBlocks = container.querySelectorAll('[class*="italic"]')
    const bq = Array.from(italicBlocks).find(el => el.textContent?.includes('Just one line'))
    expect(bq).toBeTruthy()
  })

  it('renders *** and ___ as dividers', () => {
    const text = 'A.\n\n***\n\nB.\n\n___\n\nC.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const dividers = container.querySelectorAll('[class*="my-6"]')
    expect(dividers).toHaveLength(2)
  })

  it('has aria-label on article element', () => {
    render(<DraftRenderer content="Text here." isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByRole('article')).toBeTruthy()
  })

  it('renders headings with accent border styling', () => {
    const text = '# Styled Heading\n\nBody text.'
    const { container } = render(
      <DraftRenderer content={text} isEditing={false} lang="pt" onContentChange={noop} />,
    )
    const headings = container.querySelectorAll('[class*="rounded-r-md"]')
    const heading = Array.from(headings).find(el => el.textContent?.includes('Styled Heading'))
    expect(heading).toBeTruthy()
  })
})
