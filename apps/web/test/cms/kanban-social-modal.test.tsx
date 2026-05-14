/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush, back: vi.fn() })),
}))

const mockConnections = [
  { provider: 'facebook' as const, account_name: 'My Page', status: 'connected' as const },
  { provider: 'instagram' as const, account_name: 'my_ig', status: 'connected' as const },
  { provider: 'bluesky' as const, account_name: 'user.bsky.social', status: 'disconnected' as const },
]

import { KanbanSocialModal } from '../../src/app/cms/(authed)/_shared/social/kanban-social-modal'

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onScheduleWithSocial: vi.fn(),
  onScheduleWithoutSocial: vi.fn(),
  contentTitle: 'AI Empire: O Que Vem Por Ai',
  contentType: 'blog' as const,
  contentId: 'blog-123',
  shortLink: 'go.bythiagofigueiredo.com/ai-emp',
  caption: 'O futuro da inteligencia artificial...',
  coverImage: 'https://example.com/cover.jpg',
  connections: mockConnections,
  platforms: ['facebook', 'instagram', 'bluesky'] as const,
}

describe('KanbanSocialModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header with content title', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    expect(screen.getByText('Agendar Publicação')).toBeDefined()
    expect(screen.getByText(defaultProps.contentTitle)).toBeDefined()
  })

  it('shows Social Share Confidence Card with platform status dots', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    expect(screen.getByText('Tudo pronto para compartilhar')).toBeDefined()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('shows green dot for connected platforms and gray for disconnected', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    const dots = screen.getAllByTestId('status-dot')
    expect(dots[0]!.className).toContain('bg-emerald')
    expect(dots[1]!.className).toContain('bg-emerald')
    expect(dots[2]!.className).toContain('bg-zinc')
  })

  it('shows short link and caption preview', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    expect(screen.getByText(defaultProps.shortLink)).toBeDefined()
    expect(screen.getByText(defaultProps.caption, { exact: false })).toBeDefined()
  })

  it('shows pipeline one-liner', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    expect(screen.getByText(/Publish.*Link.*OG.*Post.*~2-3 min/)).toBeDefined()
  })

  it('renders 3 action buttons', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    expect(screen.getByText('Agendar + Social')).toBeDefined()
    expect(screen.getByText('Agendar sem Social')).toBeDefined()
    expect(screen.getByText('Personalizar no Social Hub')).toBeDefined()
  })

  it('calls onScheduleWithSocial when primary button clicked', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Agendar + Social'))
    expect(defaultProps.onScheduleWithSocial).toHaveBeenCalledOnce()
  })

  it('calls onScheduleWithoutSocial when secondary button clicked', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Agendar sem Social'))
    expect(defaultProps.onScheduleWithoutSocial).toHaveBeenCalledOnce()
  })

  it('navigates to composer with pre-populated params when customize link clicked', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Personalizar no Social Hub'))
    expect(mockPush).toHaveBeenCalledWith(
      `/cms/social/new?source=${defaultProps.contentType}&id=${defaultProps.contentId}`
    )
  })

  it('shows mini preview grid with 3 platform previews', () => {
    render(<KanbanSocialModal {...defaultProps} />)
    expect(screen.getByTestId('preview-facebook')).toBeDefined()
    expect(screen.getByTestId('preview-instagram')).toBeDefined()
    expect(screen.getByTestId('preview-bluesky')).toBeDefined()
  })
})
