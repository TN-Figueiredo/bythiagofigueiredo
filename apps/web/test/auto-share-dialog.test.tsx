// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock the platform-icon dependency to avoid @tn-figueiredo/social import chain
vi.mock('../src/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => (
    <span data-testid={`icon-${provider}`}>{provider}</span>
  ),
  platformLabel: (provider: string) =>
    ({ facebook: 'Facebook', bluesky: 'Bluesky', instagram: 'Instagram', youtube: 'YouTube' }[
      provider
    ] ?? provider),
}))

import { AutoShareDialog } from '../src/app/cms/(authed)/_shared/social/auto-share-dialog'

const mockStrings = {
  autoShare: {
    title: 'Share to Social',
    shareNow: 'Share Now',
    customize: 'Customize in Composer',
    skip: 'Skip',
    captionLabel: 'Caption preview',
    undoToast: 'Shared to {platforms}',
    undoAction: 'Undo',
  },
}

describe('AutoShareDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    contentType: 'blog' as const,
    contentId: 'post-123',
    contentTitle: 'Como configurar OAuth 2.0',
    contentUrl: 'https://bythiagofigueiredo.com/pt/blog/oauth-guide',
    contentExcerpt: 'Guia completo de OAuth 2.0',
    contentImage: 'https://example.com/image.jpg',
    availablePlatforms: ['facebook', 'bluesky'] as const,
    defaultPlatforms: ['facebook', 'bluesky'] as const,
    onShareNow: vi.fn(),
    onCustomize: vi.fn(),
    strings: mockStrings,
  }

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders platform checkboxes pre-checked from defaults', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const fbCheckbox = screen.getByRole('checkbox', { name: /facebook/i }) as HTMLInputElement
    const bsCheckbox = screen.getByRole('checkbox', { name: /bluesky/i }) as HTMLInputElement
    expect(fbCheckbox.checked).toBe(true)
    expect(bsCheckbox.checked).toBe(true)
  })

  it('shows editable caption preview with character count', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const textarea = screen.getByLabelText(mockStrings.autoShare.captionLabel)
    expect(textarea).toBeDefined()
    // Bluesky limit indicator
    expect(screen.getByText(/\/300/)).toBeDefined()
  })

  it('calls onShareNow with checked platforms and caption', () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.shareNow }))
    expect(defaultProps.onShareNow).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: ['facebook', 'bluesky'],
        caption: expect.any(String),
      }),
    )
  })

  it('calls onCustomize to open Composer pre-filled', () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.customize }))
    expect(defaultProps.onCustomize).toHaveBeenCalled()
  })

  it('calls onClose when Skip is clicked', () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.skip }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('unchecking a platform removes it from share payload', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const fbCheckbox = screen.getByRole('checkbox', { name: /facebook/i })
    fireEvent.click(fbCheckbox)
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.shareNow }))
    expect(defaultProps.onShareNow).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: ['bluesky'],
      }),
    )
  })

  it('returns null when open is false', () => {
    const { container } = render(<AutoShareDialog {...defaultProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('disables Share Now when all platforms are unchecked', () => {
    render(<AutoShareDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /facebook/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /bluesky/i }))
    const shareBtn = screen.getByRole('button', { name: mockStrings.autoShare.shareNow }) as HTMLButtonElement
    expect(shareBtn.disabled).toBe(true)
  })

  it('renders default caption from title + url', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const textarea = screen.getByLabelText(mockStrings.autoShare.captionLabel) as HTMLTextAreaElement
    expect(textarea.value).toContain(defaultProps.contentTitle)
    expect(textarea.value).toContain(defaultProps.contentUrl)
  })

  it('updates caption when user edits textarea', () => {
    render(<AutoShareDialog {...defaultProps} />)
    const textarea = screen.getByLabelText(mockStrings.autoShare.captionLabel) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Custom caption' } })
    fireEvent.click(screen.getByRole('button', { name: mockStrings.autoShare.shareNow }))
    expect(defaultProps.onShareNow).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: 'Custom caption',
      }),
    )
  })
})
