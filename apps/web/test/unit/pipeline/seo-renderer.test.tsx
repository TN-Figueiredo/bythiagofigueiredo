import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SeoRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/seo-renderer'

const noop = vi.fn()

describe('SeoRenderer', () => {
  it('renders empty state when no SEO content', () => {
    render(<SeoRenderer content={null} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/seo ainda não tem conteúdo/i)).toBeTruthy()
  })

  it('renders structured fields from object content', () => {
    const content = { meta_title: 'My Blog Title', meta_description: 'A great description for SEO.' }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getAllByText('My Blog Title').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('A great description for SEO.').length).toBeGreaterThanOrEqual(1)
  })

  it('shows character count indicators', () => {
    const content = { meta_title: 'Short', meta_description: 'Also short' }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/5 chars · ideal/)).toBeTruthy()
  })

  it('shows warning for long meta title (>60 chars)', () => {
    const content = { meta_title: 'A'.repeat(65), meta_description: '' }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/65 chars · pode truncar/)).toBeTruthy()
  })

  it('shows error for very long meta title (>70 chars)', () => {
    const content = { meta_title: 'B'.repeat(75), meta_description: '' }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/75 chars · truncado/)).toBeTruthy()
  })

  it('renders SERP preview', () => {
    const content = { meta_title: 'Test Title', meta_description: 'Test desc', slug: 'test-slug' }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Preview SERP')).toBeTruthy()
    expect(screen.getAllByText(/test-slug/).length).toBeGreaterThanOrEqual(1)
  })

  it('parses nested seo object from content', () => {
    const content = { seo: { meta_title: 'Nested Title', meta_description: 'Nested Desc' } }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getAllByText('Nested Title').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Nested Desc').length).toBeGreaterThanOrEqual(1)
  })

  it('parses SEO fields from pipe-separated string content', () => {
    const content = 'Título: Como gravar | Desc: Guia prático'
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText(/seo ainda não tem conteúdo/i)).toBeNull()
    expect(screen.getAllByText('Como gravar').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Guia prático').length).toBeGreaterThanOrEqual(1)
  })

  it('renders input fields in editing mode', () => {
    const content = { meta_title: 'Edit Me', meta_description: 'Change this' }
    render(<SeoRenderer content={content} isEditing={true} lang="pt" onContentChange={noop} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onContentChange when editing meta_title', () => {
    const onChange = vi.fn()
    const content = { meta_title: 'Old', meta_description: 'Desc' }
    render(<SeoRenderer content={content} isEditing={true} lang="pt" onContentChange={onChange} />)
    const input = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(input, { target: { value: 'New Title' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ meta_title: 'New Title' }))
  })

  it('renders keywords when provided', () => {
    const content = { meta_title: 'T', meta_description: 'D', keywords: ['react', 'nextjs'] }
    render(<SeoRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('react')).toBeTruthy()
    expect(screen.getByText('nextjs')).toBeTruthy()
  })
})
