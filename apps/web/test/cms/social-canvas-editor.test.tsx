/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// Ensure React is available globally for JSX in source files
// (workaround for Vite React plugin not transforming files in parenthesized route groups)
globalThis.React = React

// Mock react-konva since happy-dom has no canvas
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-stage', ...props }, children as React.ReactNode),
  Layer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'konva-layer' }, children),
  Rect: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `konva-rect-${props['id'] ?? 'bg'}` }),
  Image: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `konva-image-${props['id'] ?? 'bg'}` }),
  Text: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': `konva-text-${props['id'] ?? 'unnamed'}` }),
  Group: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'konva-group' }, children),
  Transformer: () => React.createElement('div', { 'data-testid': 'konva-transformer' }),
}))

vi.mock('konva', () => ({}))

// vi.mock is hoisted before imports, so react-konva mock is active.
// Use relative path to avoid Vite alias issues with parenthesized route groups.
import { SocialCanvasEditor } from '../../src/app/cms/(authed)/social/new/_components/canvas-editor/index'
import { SOCIAL_ASPECT_RATIOS } from '../../src/app/cms/(authed)/social/new/_components/canvas-editor/social-left-panel'

const defaultProps = {
  aspectRatio: '9:16' as const,
  templates: [] as Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>,
  postData: {
    title: 'My Blog Post Title',
    description: 'A brief description of the post',
    coverImageUrl: 'https://example.com/cover.jpg',
    logoUrl: 'https://example.com/logo.png',
    shortUrl: 'go.btf.com/abc123',
  },
  onExport: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.com/story.png' }),
  onSaveTemplate: vi.fn().mockResolvedValue(undefined),
  onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
  onImageUpload: vi.fn().mockResolvedValue('https://blob.vercel.com/uploaded.png'),
}

describe('SocialCanvasEditor', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to a wide viewport for most tests
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true })
    window.dispatchEvent(new Event('resize'))
  })

  it('renders the three-panel layout', () => {
    render(<SocialCanvasEditor {...defaultProps} />)
    expect(screen.getByRole('application')).toBeDefined()
    // Aspect-ratio label appears in breadcrumb and status bar
    const storyLabel = SOCIAL_ASPECT_RATIOS.find(r => r.name === '9:16')!.label
    expect(screen.getAllByText(storyLabel).length).toBeGreaterThanOrEqual(1)
  })

  it('displays fixed aspect ratio options without custom sizing', () => {
    render(<SocialCanvasEditor {...defaultProps} />)
    for (const ratio of SOCIAL_ASPECT_RATIOS) {
      expect(screen.getAllByText(ratio.label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('shows canvas dimensions in status bar', () => {
    render(<SocialCanvasEditor {...defaultProps} />)
    // Status bar and left panel both show dimensions
    const dimElements = screen.getAllByText('1080×1920')
    expect(dimElements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows viewport-too-small message on narrow screens', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true })
    window.dispatchEvent(new Event('resize'))
    render(<SocialCanvasEditor {...defaultProps} />)
    expect(screen.getAllByText('Desktop Required').length).toBeGreaterThanOrEqual(1)
  })
})
