import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ImagesRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/images-renderer'

const noop = vi.fn()

describe('ImagesRenderer', () => {
  it('renders empty state when content is null', () => {
    render(<ImagesRenderer content={null} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/nenhuma imagem/i)).toBeTruthy()
  })

  it('renders image entries from array content', () => {
    const content = [
      { url: 'https://example.com/img.jpg', alt: 'Photo', caption: 'My caption', role: 'cover' },
    ]
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('My caption')).toBeTruthy()
    expect(screen.getByText('cover')).toBeTruthy()
    expect(screen.getByText('1 imagem')).toBeTruthy()
  })

  it('renders multiple images and correct plural count', () => {
    const content = [
      { caption: 'First' },
      { caption: 'Second' },
    ]
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('2 imagens')).toBeTruthy()
  })

  it('renders textarea in editing mode', () => {
    render(<ImagesRenderer content={[{ caption: 'Test' }]} isEditing={true} lang="pt" onContentChange={noop} />)
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('parses string content as line-separated captions', () => {
    const content = 'Cover image\nThumbnail image'
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Cover image')).toBeTruthy()
    expect(screen.getByText('Thumbnail image')).toBeTruthy()
  })

  it('handles nested images array in object', () => {
    const content = { images: [{ caption: 'Nested' }] }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Nested')).toBeTruthy()
  })
})
