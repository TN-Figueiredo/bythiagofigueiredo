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

  it('renders the story preview image', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const img = container.querySelector('img[alt="Story preview"]')
    expect(img).toBeDefined()
    expect(img?.getAttribute('src')).toBe(defaultProps.imageUrl)
  })

  it('displays the short URL with copy button', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const urlSpan = container.querySelector('.font-mono')
    expect(urlSpan?.textContent).toBe('go.btf.com/abc123')
    const copyBtn = container.querySelector('button[aria-label="Copy URL"]')
    expect(copyBtn).toBeDefined()
    expect(copyBtn).not.toBeNull()
  })

  it('copies URL to clipboard on click', async () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const copyBtn = container.querySelector('button[aria-label="Copy URL"]')!
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://go.btf.com/abc123')
    })
  })

  it('shows 3 numbered steps', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const steps = container.querySelectorAll('ol li')
    expect(steps.length).toBe(3)
    expect(steps[0].textContent).toContain('Open Instagram')
    expect(steps[1].textContent).toContain('Upload the image')
    expect(steps[2].textContent).toContain('Add a Link Sticker')
  })

  it('shows Mark as Posted button', () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const btn = container.querySelector('button[aria-label="Mark as posted"]')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toContain('Mark as Posted')
  })

  it('hides Mark as Posted when already completed', () => {
    const { container } = render(<ReadyToPost {...defaultProps} status="completed" />)
    const btn = container.querySelector('button[aria-label="Mark as posted"]')
    expect(btn).toBeNull()
    // Should show "Posted" badge
    const posted = container.querySelector('.text-green-400')
    expect(posted).not.toBeNull()
    expect(posted?.textContent).toContain('Posted')
  })

  it('calls onMarkAsPosted when button clicked', async () => {
    const { container } = render(<ReadyToPost {...defaultProps} />)
    const btn = container.querySelector('button[aria-label="Mark as posted"]')!
    fireEvent.click(btn)
    await waitFor(() => {
      expect(mockMarkAsPosted).toHaveBeenCalledWith('post-123')
    })
  })
})
