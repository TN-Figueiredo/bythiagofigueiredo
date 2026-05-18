// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ReadyToPost } from '../../src/app/cms/(authed)/social/posts/[id]/ready/_components/ready-to-post'

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
})

const mockMarkAsPosted = vi.fn().mockResolvedValue({ ok: true })

describe('ReadyToPost', () => {
  const defaultProps = {
    postId: 'post-123',
    title: 'Blog Post Title',
    imageUrl: 'https://blob.vercel.com/stories/post-123-1716000000.png',
    shortUrl: 'https://go.btf.com/abc123',
    status: 'publishing' as const,
    onMarkAsPosted: mockMarkAsPosted,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the story preview image (legacy single imageUrl)', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const img = container.querySelector('img')
    expect(img).toBeDefined()
    expect(img?.getAttribute('src')).toBe(defaultProps.imageUrl)
  })

  it('renders multi-slide with carousel navigation', () => {
    const slides = [
      { index: 1, imageUrl: 'https://blob.vercel.com/stories/slide-1.png' },
      { index: 2, imageUrl: 'https://blob.vercel.com/stories/slide-2.png' },
      { index: 3, imageUrl: 'https://blob.vercel.com/stories/slide-3.png' },
    ]
    const { container } = render(
      <ReadyToPost {...defaultProps} slides={slides} imageUrl={undefined} />,
    )
    // Shows first slide image
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe(slides[0].imageUrl)
    // Shows slide counter
    expect(container.textContent).toContain('Slide 1 de 3')
    // Shows dot indicators (3 dots)
    const dots = container.querySelectorAll('button[aria-label^="Ir para slide"]')
    expect(dots.length).toBe(3)
    // Shows next button but not prev
    expect(container.querySelector('button[aria-label="Próximo slide"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Slide anterior"]')).toBeNull()
  })

  it('navigates between slides on arrow click', () => {
    const slides = [
      { index: 1, imageUrl: 'https://blob.vercel.com/stories/slide-1.png' },
      { index: 2, imageUrl: 'https://blob.vercel.com/stories/slide-2.png' },
    ]
    const { container } = render(
      <ReadyToPost {...defaultProps} slides={slides} imageUrl={undefined} />,
    )
    // Click next
    const nextBtn = container.querySelector('button[aria-label="Próximo slide"]')!
    fireEvent.click(nextBtn)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe(slides[1].imageUrl)
    expect(container.textContent).toContain('Slide 2 de 2')
  })

  it('displays the short URL with copy button', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const urlSpan = container.querySelector('.font-mono')
    expect(urlSpan?.textContent).toBe('go.btf.com/abc123')
    const copyBtn = container.querySelector('button[aria-label="Copiar URL"]')
    expect(copyBtn).toBeDefined()
    expect(copyBtn).not.toBeNull()
  })

  it('copies URL to clipboard on click', async () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const copyBtn = container.querySelector('button[aria-label="Copiar URL"]')!
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://go.btf.com/abc123')
    })
  })

  it('shows 4 numbered steps', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const steps = container.querySelectorAll('ol li')
    expect(steps.length).toBe(4)
    expect(steps[0].textContent).toContain('Baixe as imagens')
    expect(steps[1].textContent).toContain('Abra o Instagram')
    expect(steps[2].textContent).toContain('Envie as imagens')
    expect(steps[3].textContent).toContain('Link Sticker')
  })

  it('shows Marquei como Publicado button', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const btn = container.querySelector('button[aria-label="Marcar como publicado"]')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toContain('Marquei como Publicado')
  })

  it('hides Marquei como Publicado when already completed', () => {
    const { container } = render(<ReadyToPost {...defaultProps} status="completed" />)
    const btn = container.querySelector('button[aria-label="Marcar como publicado"]')
    expect(btn).toBeNull()
    // Should show success state
    const successEl = container.querySelector('.text-green-400')
    expect(successEl).not.toBeNull()
  })

  it('calls onMarkAsPosted when button clicked', async () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const btn = container.querySelector('button[aria-label="Marcar como publicado"]')!
    fireEvent.click(btn)
    await waitFor(() => {
      expect(mockMarkAsPosted).toHaveBeenCalledWith('post-123')
    })
  })

  it('shows download button when imageUrl is provided', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const downloadBtn = container.querySelector('button[aria-label="Baixar todas as imagens"]')
    expect(downloadBtn).not.toBeNull()
    expect(downloadBtn?.textContent).toContain('Baixar Imagem')
  })

  it('shows download count for multiple slides', () => {
    const slides = [
      { index: 1, imageUrl: 'https://blob.vercel.com/stories/slide-1.png' },
      { index: 2, imageUrl: 'https://blob.vercel.com/stories/slide-2.png' },
    ]
    const { container } = render(
      <ReadyToPost {...defaultProps} slides={slides} imageUrl={undefined} />,
    )
    const downloadBtn = container.querySelector('button[aria-label="Baixar todas as imagens"]')
    expect(downloadBtn?.textContent).toContain('2 Imagens')
  })
})
