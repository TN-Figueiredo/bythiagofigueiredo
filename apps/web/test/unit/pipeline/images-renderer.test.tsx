import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ImagesRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/images-renderer'

const noop = vi.fn()

describe('ImagesRenderer', () => {
  it('renders empty state when content is null', () => {
    render(<ImagesRenderer content={null} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText(/nenhuma sugestão de imagem/i)).toBeTruthy()
  })

  it('renders cover section from structured content', () => {
    const content = {
      cover: {
        prompts: [
          { rank: 1, prompt: 'A vivid sunset', rationale: 'Warm tones', alt_text_pt: 'Pôr do sol' },
        ],
        chosen: 1,
        image_url: null,
        status: 'prompt_ready',
      },
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('cover')).toBeTruthy()
    expect(screen.getByText('A vivid sunset')).toBeTruthy()
    expect(screen.getByText('Warm tones')).toBeTruthy()
    expect(screen.getByText('Prompt pronto')).toBeTruthy()
    expect(screen.getByText('Escolhida')).toBeTruthy()
    expect(screen.getByText(/alt: Pôr do sol/)).toBeTruthy()
  })

  it('renders body images and correct prompt count', () => {
    const content = {
      cover: {
        prompts: [{ rank: 1, prompt: 'Cover prompt', rationale: 'Cover reason' }],
        chosen: null,
        image_url: null,
      },
      body_images: [
        {
          ref_id: 'img-1',
          placement: 'after_section_2',
          intent: 'data_visualization',
          description: 'Chart showing growth',
          prompts: [{ rank: 1, prompt: 'Body prompt', rationale: 'Body reason' }],
          chosen: null,
          image_url: null,
        },
      ],
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('img-1')).toBeTruthy()
    expect(screen.getByText('Chart showing growth')).toBeTruthy()
    expect(screen.getByText('2 prompts Midjourney')).toBeTruthy()
    expect(screen.getByText('2 imagens')).toBeTruthy()
    expect(screen.getByText('0/2 escolhidas')).toBeTruthy()
  })

  it('toggles chosen prompt on click', () => {
    const onChange = vi.fn()
    const content = {
      cover: {
        prompts: [
          { rank: 1, prompt: 'Prompt A', rationale: 'Reason A' },
          { rank: 2, prompt: 'Prompt B', rationale: 'Reason B' },
        ],
        chosen: null,
        image_url: null,
      },
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={onChange} />)
    fireEvent.click(screen.getByText('Prompt A'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cover: expect.objectContaining({ chosen: 1 }) }),
    )
  })

  it('deselects chosen prompt on second click', () => {
    const onChange = vi.fn()
    const content = {
      cover: {
        prompts: [
          { rank: 1, prompt: 'Prompt A', rationale: 'Reason A' },
          { rank: 2, prompt: 'Prompt B', rationale: 'Reason B' },
        ],
        chosen: 1,
        image_url: null,
      },
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={onChange} />)
    fireEvent.click(screen.getByText('Prompt A'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cover: expect.objectContaining({ chosen: null }) }),
    )
  })

  it('shows click hint on unchosen prompt cards', () => {
    const content = {
      cover: {
        prompts: [
          { rank: 1, prompt: 'Prompt A', rationale: 'Reason A' },
        ],
        chosen: null,
        image_url: null,
      },
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Clique para escolher este prompt')).toBeTruthy()
  })

  it('does not show click hint on chosen prompt card', () => {
    const content = {
      cover: {
        prompts: [
          { rank: 1, prompt: 'Prompt A', rationale: 'Reason A' },
        ],
        chosen: 1,
        image_url: null,
      },
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.queryByText('Clique para escolher este prompt')).toBeNull()
  })

  it('toggles body_images chosen independently', () => {
    const onChange = vi.fn()
    const content = {
      body_images: [
        {
          ref_id: 'img-1',
          placement: 'after_section_2',
          intent: 'data_visualization',
          description: 'Chart',
          prompts: [
            { rank: 1, prompt: 'Body prompt 1', rationale: 'Reason' },
            { rank: 2, prompt: 'Body prompt 2', rationale: 'Reason 2' },
          ],
          chosen: null,
          image_url: null,
        },
      ],
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={onChange} />)
    fireEvent.click(screen.getByText('Body prompt 2'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        body_images: [expect.objectContaining({ chosen: 2 })],
      }),
    )
  })

  it('renders textarea in editing mode', () => {
    render(<ImagesRenderer content={[{ caption: 'Test' }]} isEditing={true} lang="pt" onContentChange={noop} />)
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('renders string content as legacy line-separated captions', () => {
    render(<ImagesRenderer content={'Cover image\nThumbnail image'} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Cover image')).toBeTruthy()
    expect(screen.getByText('Thumbnail image')).toBeTruthy()
  })

  it('renders legacy array format with backward compat', () => {
    const content = [
      { url: 'https://example.com/img.jpg', alt: 'Photo', caption: 'My caption', role: 'cover' },
    ]
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('My caption')).toBeTruthy()
    expect(screen.getByText('cover')).toBeTruthy()
    expect(screen.getByText('1 imagem')).toBeTruthy()
  })

  it('renders legacy nested images array', () => {
    const content = { images: [{ caption: 'Nested' }] }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Nested')).toBeTruthy()
  })

  it('shows empty prompts placeholder when cover has no prompts', () => {
    const content = {
      cover: { prompts: [], chosen: null, image_url: null },
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('Aguardando prompts do cowork...')).toBeTruthy()
  })

  it('shows chosen count in summary footer', () => {
    const content = {
      cover: {
        prompts: [{ rank: 1, prompt: 'P1', rationale: 'R1' }],
        chosen: 1,
        image_url: null,
      },
      body_images: [
        {
          ref_id: 'img-1',
          placement: 'after_intro',
          intent: 'illustration',
          description: 'Desc',
          prompts: [{ rank: 1, prompt: 'BP1', rationale: 'BR1' }],
          chosen: 1,
          image_url: null,
        },
      ],
    }
    render(<ImagesRenderer content={content} isEditing={false} lang="pt" onContentChange={noop} />)
    expect(screen.getByText('2/2 escolhidas')).toBeTruthy()
  })
})
